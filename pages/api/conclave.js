// pages/api/conclave.js
//
// Server-side proxy to the Groq API (OpenAI-compatible, free tier, no
// credit card required). The API key lives only here, in the server
// environment (process.env.GROQ_API_KEY) — it is never sent to or
// visible from the browser. This is what makes the app safe to share
// publicly: anyone can use it, nobody can see or steal the key from
// devtools/network tab.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error:
        "Server is missing GROQ_API_KEY. Set it in your deployment's environment variables.",
    });
  }

  const { system, message } = req.body || {};
  if (!system || !message) {
    return res.status(400).json({ error: "Both 'system' and 'message' are required." });
  }

  try {
    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1000,
        messages: [
          { role: "system", content: system },
          { role: "user", content: message },
        ],
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      const detail = data?.error?.message || "Upstream request failed.";
      return res.status(upstream.status).json({ error: detail });
    }

    const text = (data.choices?.[0]?.message?.content || "").trim();

    if (!text) {
      return res.status(502).json({ error: "Empty response from model." });
    }

    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: "Could not reach the AI service. Please try again." });
  }
}

