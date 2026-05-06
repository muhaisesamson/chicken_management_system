const AI_API_ENDPOINT = "/api/gemini/insights";

const AI_PROMPT = `You are a farm analytics assistant. Respond in valid JSON only, with no markdown or extra text. Use this exact format:
{
  "summary": "string",
  "anomalies": "string",
  "recommendations": "string",
  "mortalityRate": number,
  "profit": number,
  "anomaliesDetected": number
}
Only include these keys and ensure the payload is parseable JSON.`;

const validateInsights = (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid AI response: expected JSON object.");
  }

  const normalized = {
    summary: payload.summary ?? "",
    anomalies: payload.anomalies ?? "",
    recommendations: payload.recommendations ?? "",
    mortalityRate: Number(payload.mortalityRate ?? 0),
    profit: Number(payload.profit ?? 0),
    anomaliesDetected: Number(payload.anomaliesDetected ?? 0),
  };

  if (typeof normalized.summary !== "string" || typeof normalized.anomalies !== "string" || typeof normalized.recommendations !== "string") {
    throw new Error("Invalid AI response: summary, anomalies, and recommendations must be strings.");
  }

  if (Number.isNaN(normalized.mortalityRate) || Number.isNaN(normalized.profit) || Number.isNaN(normalized.anomaliesDetected)) {
    throw new Error("Invalid AI response: numeric fields must be valid numbers.");
  }

  return normalized;
};

const getInsights = async (structuredAnalytics) => {
  const response = await fetch(AI_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      analytics: structuredAnalytics,
      prompt: AI_PROMPT,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorBody}`);
  }

  const payload = await response.json();
  return validateInsights(payload);
};

export default {
  getInsights,
};
