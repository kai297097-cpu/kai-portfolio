const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");

const app = express();

// Security-by-design: reduce fingerprinting
app.disable("x-powered-by");
app.set("trust proxy", 1);

// Security headers (API-only service)
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://kai297097-cpu.github.io";
const FLOWISE_API_URL = process.env.FLOWISE_API_URL || "";
const FLOWISE_USERNAME = process.env.FLOWISE_USERNAME || "";
const FLOWISE_PASSWORD = process.env.FLOWISE_PASSWORD || "";

function buildFlowiseEndpoint() {
  const base = FLOWISE_API_URL.trim().replace(/\/$/, "");
  if (!base) return "";

  // Allow passing the full endpoint via env var.
  // Example: https://<flowise>.onrender.com/api/v1/prediction/<chatflow-id>
  const looksLikePredictionEndpoint = /\/api\/v1\/prediction\/[^/]+$/.test(base);
  if (looksLikePredictionEndpoint) return base;

  // Optional compatibility: if user passes base URL, allow appending chatflow id
  // (kept here as implementation, but not required by env var list).
  const chatflowId = (process.env.FLOWISE_CHATFLOW_ID || "").trim();
  if (chatflowId) return `${base}/api/v1/prediction/${chatflowId}`;

  return base;
}

const FLOWISE_ENDPOINT = buildFlowiseEndpoint();

// CORS: allow ONLY your GitHub Pages origin (not the full page URL).
app.use(
  cors({
    origin(origin, cb) {
      // Allow non-browser requests without Origin header (e.g. Render health checks).
      if (!origin) return cb(null, true);
      if (origin === ALLOWED_ORIGIN) return cb(null, true);
      return cb(new Error("CORS"), false);
    },
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    maxAge: 86400,
  })
);

// Only accept JSON and keep request size small (DoS safety).
app.use(
  express.json({
    limit: "20kb",
    type: "application/json",
  })
);

// Strict JSON-only for POST (prevents form posts / unexpected content types).
app.use((req, res, next) => {
  if (req.method === "POST") {
    const ct = String(req.headers["content-type"] || "").toLowerCase();
    if (!ct.includes("application/json")) {
      return res.status(415).json({ error: "Unsupported Media Type" });
    }
  }
  next();
});

// Rate limiting (basic abuse protection)
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" },
});

// Input validation (accept {message} OR {question})
const chatSchema = z
  .object({
    message: z.string().trim().max(1000).optional(),
    question: z.string().trim().max(1000).optional(),
  })
  .refine((v) => Boolean(v.message || v.question), { message: "Missing message" })
  .transform((v) => ({
    question: (v.question || v.message || "").trim(),
  }))
  .refine((v) => v.question.length >= 1, { message: "Empty message" });

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

// Only POST on /api/chat (everything else is rejected)
app.all("/api/chat", (req, res, next) => {
  if (req.method === "POST" || req.method === "OPTIONS") return next();
  res.setHeader("Allow", "POST, OPTIONS");
  return res.status(405).json({ error: "Method Not Allowed" });
});

app.post("/api/chat", chatLimiter, async (req, res) => {
  // Security-by-design: no logging of user input or secrets
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }

  if (!FLOWISE_ENDPOINT) {
    return res.status(500).json({ error: "Server not configured" });
  }

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // Optional Basic Auth (server-side only)
  if (FLOWISE_USERNAME && FLOWISE_PASSWORD) {
    const token = Buffer.from(`${FLOWISE_USERNAME}:${FLOWISE_PASSWORD}`).toString("base64");
    headers.Authorization = `Basic ${token}`;
  }

  try {
    const upstream = await fetch(FLOWISE_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({ question: parsed.data.question }),
    });

    const raw = await upstream.text();
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch {
      // keep data as null; do not leak raw upstream text
    }

    if (!upstream.ok) {
      // Generic error (no upstream details)
      return res.status(502).json({ error: "Upstream error" });
    }

    // Normalize Flowise outputs to one field: `answer`
    const answer =
      (data && (data.text ?? data.answer ?? data.result ?? data.output)) ??
      (typeof data === "string" ? data : "");

    return res.status(200).json({ answer: String(answer || "") });
  } catch {
    return res.status(502).json({ error: "Upstream unavailable" });
  }
});

// Generic error handler (no stack traces to clients)
app.use((err, req, res, next) => {
  if (err && err.message === "CORS") return res.status(403).json({ error: "Forbidden" });
  return res.status(500).json({ error: "Internal error" });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`Proxy backend listening on :${PORT}`);
});

