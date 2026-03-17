const chatLog = document.getElementById("chatLog");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const statusText = document.getElementById("statusText");
const errorText = document.getElementById("errorText");

const CONFIG =
  (window.__CHAT_CONFIG__ && typeof window.__CHAT_CONFIG__ === "object" ? window.__CHAT_CONFIG__ : {}) || {};

// GitHub Pages kann kein `/api/*` serverseitig bedienen.
// Daher setzen wir in `chat-config.js` die Render-Backend-URL (ohne Secrets).
const API_BASE_URL = typeof CONFIG.apiBaseUrl === "string" ? CONFIG.apiBaseUrl.replace(/\/$/, "") : "";
const API_URL = `${API_BASE_URL}/api/chat`;

function addMessage({ role, text }) {
  const msg = document.createElement("div");
  msg.className = `msg msg--${role}`;

  const avatar = document.createElement("div");
  avatar.className = "msg__avatar";
  avatar.textContent = role === "user" ? "DU" : "AI";

  const bubble = document.createElement("div");
  bubble.className = "msg__bubble";
  bubble.textContent = text;

  msg.appendChild(avatar);
  msg.appendChild(bubble);
  chatLog.appendChild(msg);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function setBusy(isBusy) {
  sendBtn.disabled = isBusy;
  messageInput.disabled = isBusy;
  statusText.textContent = isBusy ? "Denke nach …" : "";
}

function setError(message) {
  errorText.textContent = message || "";
}

addMessage({
  role: "assistant",
  text: "Hi! Stell mir eine Frage zu Krypto (keine Anlageberatung).",
});

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setError("");

  const question = (messageInput.value || "").trim();
  if (!question) return;

  if (question.length > 1000) {
    setError("Deine Nachricht ist zu lang (max. 1000 Zeichen).");
    return;
  }

  if (!API_BASE_URL) {
    setError("Chat ist noch nicht konfiguriert (Backend-URL fehlt).");
    return;
  }

  addMessage({ role: "user", text: question });
  messageInput.value = "";
  setBusy(true);

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error((data && data.error) || "Request failed");
    }

    const answer =
      (data && (data.answer || data.text || data.result)) || "Ich habe gerade keine Antwort erhalten.";

    addMessage({ role: "assistant", text: String(answer) });
  } catch {
    setError("Sorry – gerade ist ein Fehler aufgetreten. Bitte versuche es erneut.");
  } finally {
    setBusy(false);
    messageInput.focus();
  }
});

