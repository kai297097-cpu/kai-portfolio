const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { google } = require("googleapis");

const app = express();

const PORT = process.env.PORT || 10000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://kai297097-cpu.github.io";
const FLOWISE_API_URL = process.env.FLOWISE_API_URL || "";
const FLOWISE_USERNAME = process.env.FLOWISE_USERNAME || "";
const FLOWISE_PASSWORD = process.env.FLOWISE_PASSWORD || "";

const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID || "";
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY || "";

if (
  !ALLOWED_ORIGIN ||
  !FLOWISE_API_URL ||
  !FLOWISE_USERNAME ||
  !FLOWISE_PASSWORD ||
  !GOOGLE_SHEETS_ID ||
  !GOOGLE_SERVICE_ACCOUNT_EMAIL ||
  !GOOGLE_PRIVATE_KEY
) {
  console.error("Missing required environment variables.");
}

app.use(helmet());
app.use(express.json({ limit: "50kb" }));

app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    methods: ["POST", "GET"],
    allowedHeaders: ["Content-Type"],
  })
);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

function getGoogleAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });
}

async function getSheetRows(range) {
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEETS_ID,
    range,
  });

  return response.data.values || [];
}

function rowToObject(headers, row) {
  const obj = {};
  headers.forEach((header, index) => {
    obj[header] = row[index] ?? "";
  });
  return obj;
}

async function getLastDataRow(sheetName) {
  const rows = await getSheetRows(`${sheetName}!A:Z`);

  if (!rows || rows.length < 2) {
    throw new Error(`Sheet ${sheetName} has no data rows.`);
  }

  const headers = rows[0];
  const dataRows = rows
    .slice(1)
    .filter((row) => row.some((cell) => String(cell).trim() !== ""));

  if (dataRows.length === 0) {
    throw new Error(`Sheet ${sheetName} has no non-empty rows.`);
  }

  const lastRow = dataRows[dataRows.length - 1];
  return rowToObject(headers, lastRow);
}

function pickFirst(obj, candidates) {
  for (const key of candidates) {
    if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== "") {
      return obj[key];
    }
  }
  return "";
}

function buildCombinedPrompt(userMessage, marketRow, sentimentRow) {
  const timestamp = pickFirst(marketRow, [
    "timestamp [Datum, Uhrzeit] (A)",
    "timestamp",
  ]);

  const price = pickFirst(marketRow, [
    "price [$] (B)",
    "price",
  ]);

  const funding = pickFirst(marketRow, [
    "funding [%] (C)",
    "funding",
  ]);

  const openInterest = pickFirst(marketRow, [
    "open_interest [$] (D)",
    "open_interest",
  ]);

  const oiChange = pickFirst(marketRow, [
    "oi_change [%] (E)",
    "oi_change",
  ]);

  const signal = pickFirst(marketRow, [
    "signal [Buy/Sell/Hold] (G)",
    "signal",
  ]);

  const atrPct = pickFirst(marketRow, [
    "atr_pct [%] (I)",
    "atr_pct",
  ]);

  const volumeSpike = pickFirst(marketRow, [
    "volume_spike (J)",
    "volume_spike",
  ]);

  const marketPressure = pickFirst(marketRow, [
    "market pressure (K)",
    "market_pressure",
  ]);

  const gatekeeper = pickFirst(marketRow, [
    "gatekeeper (L)",
    "gatekeeper",
  ]);

  const newsTimestamp = pickFirst(sentimentRow, [
    "timestamp (A)",
    "timestamp",
  ]);

  const newsCount = pickFirst(sentimentRow, [
    "news_count (B)",
    "news_count",
  ]);

  const newsSentimentScore = pickFirst(sentimentRow, [
    "news_sentiment_score (C)",
    "news_sentiment_score",
  ]);

  const newsSentimentLabel = pickFirst(sentimentRow, [
    "news_sentiment_label (D)",
    "news_sentiment_label",
  ]);

  const headline1 = pickFirst(sentimentRow, [
    "top_headline_1 (E)",
    "top_headline_1",
  ]);

  const headline2 = pickFirst(sentimentRow, [
    "top_headline_2 (F)",
    "top_headline_2",
  ]);

  const headline3 = pickFirst(sentimentRow, [
    "top_headline_3 (G)",
    "top_headline_3",
  ]);

  const fearGreedValue = pickFirst(sentimentRow, [
    "fear_greed_value (H)",
    "fear_greed_value",
  ]);

  const fearGreedLabel = pickFirst(sentimentRow, [
    "fear_greed_label (I)",
    "fear_greed_label",
  ]);

  const marketSentiment = pickFirst(sentimentRow, [
    "market_sentiment (J)",
    "market_sentiment",
  ]);

  return `
You are analyzing the latest Bitcoin market situation.

Use BOTH:
1. the structured live market and sentiment data below
2. your knowledge base and retrieved context from the Flowise chatflow

Live market data from Make / Google Sheets:
Timestamp: ${timestamp}
Price: ${price}
Funding rate: ${funding}
Open interest: ${openInterest}
Open interest change: ${oiChange}
Signal: ${signal}
ATR volatility (%): ${atrPct}
Volume spike: ${volumeSpike}
Market pressure: ${marketPressure}
Gatekeeper: ${gatekeeper}

Latest sentiment data from Make / Google Sheets:
Sentiment timestamp: ${newsTimestamp}
News count: ${newsCount}
News sentiment score: ${newsSentimentScore}
News sentiment label: ${newsSentimentLabel}
Fear & Greed value: ${fearGreedValue}
Fear & Greed label: ${fearGreedLabel}
Overall market sentiment: ${marketSentiment}
Top headline 1: ${headline1}
Top headline 2: ${headline2}
Top headline 3: ${headline3}

User question:
${userMessage}

Instructions:
- answer in a short professional analytical style
- combine the live data with your retrieved background knowledge
- do not give financial advice
`;
}

async function callFlowise(question) {
  const authHeader = Buffer.from(`${FLOWISE_USERNAME}:${FLOWISE_PASSWORD}`).toString("base64");

  const response = await fetch(FLOWISE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${authHeader}`,
    },
    body: JSON.stringify({ question }),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Flowise error ${response.status}: ${text}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Flowise returned non-JSON response: ${text}`);
  }

  return data;
}

app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = String(req.body?.message || req.body?.question || "").trim();

    if (!userMessage) {
      return res.status(400).json({ error: "Message is required." });
    }

    if (userMessage.length > 1000) {
      return res.status(400).json({ error: "Message too long." });
    }

    const [marketRow, sentimentRow] = await Promise.all([
      getLastDataRow("market_data"),
      getLastDataRow("news_sentiment"),
    ]);

    const combinedPrompt = buildCombinedPrompt(userMessage, marketRow, sentimentRow);
    const flowiseData = await callFlowise(combinedPrompt);

    const answer =
      flowiseData.text ||
      flowiseData.response ||
      flowiseData.output ||
      "";

    return res.status(200).json({
      text: answer,
      meta: {
        marketTimestamp: pickFirst(marketRow, ["timestamp [Datum, Uhrzeit] (A)", "timestamp"]),
        sentimentTimestamp: pickFirst(sentimentRow, ["timestamp (A)", "timestamp"]),
      },
    });
  } catch (error) {
    console.error("api/chat error:", error.message);
    return res.status(500).json({
      error: "The chat request could not be completed.",
    });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});