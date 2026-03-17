# Secure Flowise Proxy Backend

Ein kleines **Node.js + Express** Backend als **Proxy** zwischen:

- **GitHub Pages Frontend**: `https://kai297097-cpu.github.io/kai-portfolio/`
- **Flowise (Render)**: wird **nur serverseitig** angesprochen

Ziel: **Security-by-Design** – keine Secrets im Browser, restriktives CORS, Rate-Limit, Input-Validation, generische Fehler.

## Anforderungen (umgesetzt)

- **Node.js + Express**
- **POST /api/chat**
- akzeptiert JSON `{ message: "..." }` oder `{ question: "..." }`
- **Input validation**, max. **1000 Zeichen**
- **nur POST** (andere Methoden → `405`)
- **CORS nur** für `https://kai297097-cpu.github.io`
- **Rate limiting**
- **Helmet**
- **Fehler generisch**
- **keine sensiblen Logs**
- Flowise-Weiterleitung via Environment Variables (`FLOWISE_API_URL`, optional Basic Auth serverseitig)

## API

### `POST /api/chat`

Request:

```json
{ "message": "..." }
```

oder

```json
{ "question": "..." }
```

Response (normalisiert):

```json
{ "answer": "..." }
```

## Lokal starten

```bash
cd backend
npm install
copy .env.example .env
npm start
```

Healthcheck:

- `GET /health`

## Environment Variables

- `PORT`: Port für Express
- `ALLOWED_ORIGIN`: **Origin** (ohne Pfad), z. B. `https://kai297097-cpu.github.io`
- `FLOWISE_API_URL`:
  - empfohlen als vollständiger Endpoint:
    - `https://<flowise>.onrender.com/api/v1/prediction/<chatflow-id>`
  - alternativ Base-URL + `FLOWISE_CHATFLOW_ID` (optional unterstützt)
- `FLOWISE_USERNAME` / `FLOWISE_PASSWORD`: optional Basic Auth (serverseitig)

## Render Deployment (kurz)

1. Render → **New Web Service**
2. Root Directory: `backend`
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Env Vars:
   - `ALLOWED_ORIGIN=https://kai297097-cpu.github.io`
   - `FLOWISE_API_URL=...`
   - optional `FLOWISE_USERNAME=...`, `FLOWISE_PASSWORD=...`

## Frontend anbinden

Auf GitHub Pages `chat-config.js` (aus `chat-config.example.js`) anlegen:

```js
window.__CHAT_CONFIG__ = { apiBaseUrl: "https://<dein-backend>.onrender.com" };
```

Wichtig: **Keine Secrets** in diese Datei schreiben.

