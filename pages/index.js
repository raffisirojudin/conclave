import React, { useState, useRef, useEffect } from "react";
import Head from "next/head";

/* ---------------------------------------------------------
   CONCLAVE
   A council of four AI personas cross-examines your dilemma,
   then a Chair delivers a structured verdict.
--------------------------------------------------------- */

const PERSONAS = [
  {
    id: "advocate",
    name: "The Advocate",
    role: "Opportunity & Courage",
    initial: "A",
    color: "var(--brass-bright)",
    system:
      "You are 'The Advocate' on a deliberation council. Your singular lens: opportunity, courage, and the cost of inaction. You argue for bold action and growth, naming what might be lost by playing it safe. Speak directly to the person in second person, 90-130 words, first person 'I' for yourself. No meta-commentary, no disclaimers, no headers, no markdown. Stay fully in character and do not summarize what you are about to say — just say it.",
  },
  {
    id: "steward",
    name: "The Steward",
    role: "Resources & Risk",
    initial: "S",
    color: "var(--sage)",
    system:
      "You are 'The Steward' on a deliberation council. Your singular lens: time, money, resources, and practical risk. You argue for measured, well-resourced, sustainable decisions. You have heard prior testimony below and may agree, disagree, or complicate it directly. Speak to the person in second person, 90-130 words, first person 'I' for yourself. No meta-commentary, no headers, no markdown. Stay in character.",
  },
  {
    id: "witness",
    name: "The Witness",
    role: "Values & Wellbeing",
    initial: "W",
    color: "var(--rose)",
    system:
      "You are 'The Witness' on a deliberation council. Your singular lens: relationships, identity, and wellbeing — what matters beneath the logic. You have heard the prior testimony below. Speak to the person in second person, 90-130 words, first person 'I' for yourself. No meta-commentary, no headers, no markdown. Stay in character.",
  },
  {
    id: "examiner",
    name: "The Examiner",
    role: "Cross-Examination",
    initial: "E",
    color: "var(--slate)",
    system:
      "You are 'The Examiner' on a deliberation council. Your role is to cross-examine: surface the unexamined assumption, the thing nobody said out loud, the question that changes everything. You have heard all three prior testimonies below — be pointed but fair, and may name a specific weakness in one of them. Speak to the person in second person, 90-130 words, first person 'I' for yourself, ending with one sharp question. No meta-commentary, no headers, no markdown. Stay in character.",
  },
];

const CHAIR_SYSTEM =
  'You are "The Chair" of a deliberation council, delivering the final verdict after hearing four testimonies. Read the case and all testimony below, then respond with ONLY a single raw JSON object and absolutely nothing else — no markdown code fences, no backticks, no preamble like "Here is the JSON", no explanation before or after. Your entire response must start with { and end with }. Match exactly this shape: {"verdict": "2-3 sentence direct recommendation in second person", "confidence": <integer 0-100, how confident you are in this verdict>, "alignment": <integer 0-100, how much the four council members actually agreed with each other>, "risks": ["short risk phrase", "short risk phrase"], "questions": ["reflection question", "reflection question", "reflection question"]}. Keep every string concise and concrete to this specific case.';

const CHAIR_FOLLOWUP_SYSTEM =
  "You are \"The Chair\" of the deliberation council. The person is pushing back on, or asking about, the verdict already given. Respond directly to what they raise, in 80-120 words, second person, plain text only, no markdown, no JSON. Stay consistent with the council's prior reasoning unless their point genuinely changes the calculus — in that case, say so plainly and explain why.";

function cleanJson(raw) {
  let cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  return cleaned;
}

async function callClaude(system, userMessage) {
  const response = await fetch("/api/conclave", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, message: userMessage }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || "Request failed: " + response.status);
  }
  if (!data.text) throw new Error("Empty response");
  return data.text;
}

function Seal({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="20" cy="20" r="13.5" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2.6" />
      <path d="M20 9 L23 17 L31 17 L24.5 22 L27 30 L20 25 L13 30 L15.5 22 L9 17 L17 17 Z" fill="currentColor" />
    </svg>
  );
}

function Gauge({ value, label, color }) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const r = 32, cx = 40, cy = 40;
  const circ = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const offset = circ * (1 - v / 100);
  return (
    <div className="gauge">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--paper-line)" strokeWidth="6" />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          className="gauge-arc"
        />
        <text x="40" y="46" textAnchor="middle" className="gauge-value">{v}</text>
      </svg>
      <div className="gauge-label">{label}</div>
    </div>
  );
}

export default function Conclave() {
  const [stage, setStage] = useState("intake"); // intake | session | verdict
  const [dilemma, setDilemma] = useState("");
  const [stakes, setStakes] = useState("");
  const [caseNumber] = useState(() => String(Math.floor(1000 + Math.random() * 9000)));
  const [transcript, setTranscript] = useState([]);
  const [activeIndices, setActiveIndices] = useState([]);
  const [verdict, setVerdict] = useState(null);
  const [verdictLoading, setVerdictLoading] = useState(false);
  const [error, setError] = useState("");
  const [challenge, setChallenge] = useState("");
  const [addenda, setAddenda] = useState([]);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [transcript, verdict, addenda]);

  async function runSession(e) {
    e.preventDefault();
    if (!dilemma.trim()) return;
    setError("");
    setStage("session");
    setTranscript([]);
    setVerdict(null);
    setAddenda([]);

    const stakesLine = stakes.trim() ? `\nWhat the person says is at stake: "${stakes.trim()}"` : "";

    try {
      // Phase 1 — three independent lenses speak at once; none has heard the others yet.
      setActiveIndices([0, 1, 2]);
      const opening = await Promise.all(
        PERSONAS.slice(0, 3).map((p) =>
          callClaude(
            p.system,
            `The case: "${dilemma.trim()}"${stakesLine}\n\nYou are speaking first; there is no prior testimony yet.\n\nGive your testimony now.`
          ).then((text) => ({ ...p, text }))
        )
      );
      setTranscript(opening);

      // Phase 2 — the Examiner hears all three and cross-examines.
      setActiveIndices([3]);
      const examinerPersona = PERSONAS[3];
      const examinerText = await callClaude(
        examinerPersona.system,
        `The case: "${dilemma.trim()}"${stakesLine}\n\nPrior testimony heard so far:\n${opening
          .map((a) => `${a.name}: ${a.text}`)
          .join("\n\n")}\n\nGive your testimony now.`
      );
      const allFour = [...opening, { ...examinerPersona, text: examinerText }];
      setTranscript(allFour);

      // Phase 3 — the Chair hears everything and delivers the verdict.
      setActiveIndices([]);
      setVerdictLoading(true);
      const chairUser = `The case: "${dilemma.trim()}"${stakesLine}\n\nFull testimony:\n${allFour
        .map((a) => `${a.name} (${a.role}): ${a.text}`)
        .join("\n\n")}`;
      const raw = await callClaude(CHAIR_SYSTEM, chairUser);
      let parsed;
      try {
        parsed = JSON.parse(cleanJson(raw));
      } catch {
        parsed = { verdict: raw, confidence: null, alignment: null, risks: [], questions: [] };
      }
      setVerdict(parsed);
      setVerdictLoading(false);
      setStage("verdict");
    } catch (err) {
      setError("The council could not be reached. Check your connection and try again.");
      setActiveIndices([]);
      setVerdictLoading(false);
    }
  }

  async function addressCouncil(e) {
    e.preventDefault();
    if (!challenge.trim() || !verdict) return;
    const q = challenge.trim();
    setChallengeLoading(true);
    setError("");
    try {
      const userMsg = `The case: "${dilemma.trim()}"\n\nYour verdict was: "${verdict.verdict}"\n\nThe person now says: "${q}"\n\nRespond as the Chair.`;
      const text = await callClaude(CHAIR_FOLLOWUP_SYSTEM, userMsg);
      setAddenda((prev) => [...prev, { question: q, answer: text }]);
      setChallenge("");
    } catch {
      setError("The Chair could not be reached. Try again.");
    } finally {
      setChallengeLoading(false);
    }
  }

  function newCase() {
    setStage("intake");
    setDilemma("");
    setStakes("");
    setTranscript([]);
    setVerdict(null);
    setAddenda([]);
    setChallenge("");
    setError("");
    setActiveIndices([]);
  }

  return (
    <>
      <Head>
        <title>Conclave — Five minds for the decision you can't make alone</title>
        <meta
          name="description"
          content="Convene a council of four AI personas to debate your hardest decision, then receive a structured verdict from the Chair."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="conclave-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

        .conclave-root {
          --ink: #14181f;
          --ink-soft: #1c222c;
          --ink-line: #2c333f;
          --paper: #ede6d6;
          --paper-line: #d9cdb0;
          --brass: #b08d3e;
          --brass-bright: #d4af5a;
          --burgundy: #7a2e2e;
          --sage: #6f8160;
          --rose: #ab6a64;
          --slate: #5c7a8a;
          --text-dark: #ede6d6;
          --text-dim: #a89f8c;
          --text-paper: #20242c;

          background: var(--ink);
          color: var(--text-dark);
          font-family: 'IBM Plex Sans', sans-serif;
          min-height: 100%;
          width: 100%;
          box-sizing: border-box;
          padding: clamp(20px, 5vw, 56px) clamp(16px, 6vw, 64px);
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .conclave-root *, .conclave-root *::before, .conclave-root *::after { box-sizing: border-box; }

        .wrap { width: 100%; max-width: 640px; }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--brass-bright);
          margin-bottom: 6px;
        }
        .brand-title {
          font-family: 'Fraunces', serif;
          font-weight: 600;
          font-size: clamp(28px, 5vw, 38px);
          letter-spacing: 0.04em;
          color: var(--text-dark);
        }
        .tagline {
          color: var(--text-dim);
          font-size: 14px;
          margin: 0 0 36px;
          letter-spacing: 0.02em;
        }

        .intake-card {
          background: var(--paper);
          color: var(--text-paper);
          border-radius: 4px;
          padding: clamp(20px, 4vw, 32px);
          border: 1px solid var(--paper-line);
          box-shadow: 0 18px 40px -20px rgba(0,0,0,0.6);
        }
        .field-label {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--burgundy);
          margin-bottom: 8px;
          display: block;
        }
        textarea, input[type="text"] {
          width: 100%;
          font-family: 'Fraunces', serif;
          font-size: 16px;
          background: transparent;
          border: none;
          border-bottom: 1.5px solid var(--paper-line);
          color: var(--text-paper);
          padding: 6px 2px 12px;
          resize: vertical;
          outline: none;
        }
        textarea::placeholder, input::placeholder { color: #8a8067; font-style: italic; }
        textarea:focus, input:focus { border-bottom-color: var(--burgundy); }
        .field { margin-bottom: 22px; }
        .field:last-of-type { margin-bottom: 0; }

        .seal-btn {
          margin-top: 28px;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: var(--ink);
          color: var(--brass-bright);
          border: 1px solid var(--brass);
          border-radius: 3px;
          padding: 14px 20px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12.5px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease;
        }
        .seal-btn:hover { background: #0e1117; }
        .seal-btn:focus-visible { outline: 2px solid var(--brass-bright); outline-offset: 3px; }
        .seal-btn:disabled { opacity: 0.55; cursor: default; }

        .docket {
          background: var(--paper);
          color: var(--text-paper);
          border-radius: 3px;
          padding: 16px 20px;
          margin-bottom: 28px;
          border-left: 4px solid var(--burgundy);
        }
        .docket-case {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.12em;
          color: var(--burgundy);
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .docket-text {
          font-family: 'Fraunces', serif;
          font-style: italic;
          font-size: 17px;
          line-height: 1.45;
        }

        .seats {
          display: flex;
          gap: 10px;
          margin-bottom: 26px;
        }
        .seat {
          flex: 1;
          border: 1px solid var(--ink-line);
          border-radius: 3px;
          padding: 10px 8px;
          text-align: center;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10.5px;
          letter-spacing: 0.06em;
          color: var(--text-dim);
          text-transform: uppercase;
          transition: border-color 0.3s ease, color 0.3s ease;
        }
        .seat.filled { border-color: var(--brass); color: var(--brass-bright); }
        .seat.active {
          border-color: var(--brass-bright);
          color: var(--brass-bright);
          animation: pulse 1.4s ease-in-out infinite;
        }

        .exhibit {
          background: var(--ink-soft);
          border: 1px solid var(--ink-line);
          border-left: 3px solid var(--persona-color, var(--brass));
          border-radius: 3px;
          padding: 18px 20px;
          margin-bottom: 16px;
          animation: rise 0.5s ease both;
        }
        .exhibit-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 10px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .exhibit-name { color: var(--persona-color, var(--brass-bright)); }
        .exhibit-num { color: var(--text-dim); }
        .exhibit-role { color: var(--text-dim); font-size: 11px; margin-bottom: 10px; font-style: italic; font-family: 'IBM Plex Mono', monospace; }
        .exhibit-text {
          font-family: 'Fraunces', serif;
          font-size: 16px;
          line-height: 1.6;
          color: var(--text-dark);
        }

        .waiting {
          color: var(--text-dim);
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12px;
          letter-spacing: 0.06em;
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 10px 0 24px;
        }
        .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--brass-bright); animation: pulse 1.2s ease-in-out infinite; }

        .verdict-card {
          background: var(--paper);
          color: var(--text-paper);
          border-radius: 4px;
          padding: clamp(20px, 4vw, 32px);
          margin-top: 8px;
          border: 1px solid var(--paper-line);
          box-shadow: 0 18px 40px -20px rgba(0,0,0,0.6);
          animation: stamp 0.55s cubic-bezier(.2,1.4,.4,1) both;
        }
        .verdict-label {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--burgundy);
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          margin-bottom: 14px;
        }
        .verdict-text {
          font-family: 'Fraunces', serif;
          font-weight: 500;
          font-size: clamp(19px, 3vw, 23px);
          line-height: 1.4;
          margin-bottom: 22px;
        }
        .gauges { display: flex; gap: 28px; margin-bottom: 22px; flex-wrap: wrap; }
        .gauge { text-align: center; }
        .gauge-value { font-family: 'IBM Plex Mono', monospace; font-size: 17px; fill: var(--text-paper); font-weight: 500; }
        .gauge-label { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6450; margin-top: 4px; }
        .gauge-arc { transition: stroke-dashoffset 0.9s ease; }

        .verdict-section { margin-bottom: 20px; }
        .verdict-section:last-child { margin-bottom: 0; }
        .verdict-section h4 {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #6b6450;
          margin: 0 0 10px;
        }
        .verdict-section ul { margin: 0; padding: 0; list-style: none; }
        .verdict-section li {
          font-family: 'Fraunces', serif;
          font-size: 15px;
          line-height: 1.5;
          padding-left: 18px;
          position: relative;
          margin-bottom: 8px;
        }
        .verdict-section li::before { position: absolute; left: 0; }
        .risks li::before { content: "—"; color: var(--burgundy); }
        .questions li::before { content: "?"; color: var(--brass); font-weight: 600; }

        .addendum {
          margin-top: 18px;
          padding-top: 16px;
          border-top: 1px dashed var(--paper-line);
        }
        .addendum-q { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: var(--burgundy); margin-bottom: 6px; }
        .addendum-a { font-family: 'Fraunces', serif; font-size: 15px; line-height: 1.55; }

        .challenge-form { margin-top: 22px; display: flex; gap: 10px; flex-wrap: wrap; }
        .challenge-form input { flex: 1; min-width: 180px; }
        .challenge-btn {
          background: var(--ink);
          color: var(--brass-bright);
          border: 1px solid var(--brass);
          border-radius: 3px;
          padding: 0 16px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11.5px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
        }
        .challenge-btn:disabled { opacity: 0.5; cursor: default; }
        .challenge-btn:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid var(--brass-bright); outline-offset: 2px; }

        .footer-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 28px;
        }
        .new-case {
          color: var(--text-dim);
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11.5px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          background: none;
          border: none;
          cursor: pointer;
          text-decoration: underline;
          padding: 0;
        }
        .powered { color: #5a6170; font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; letter-spacing: 0.05em; }

        .error-banner {
          background: rgba(122,46,46,0.18);
          border: 1px solid var(--burgundy);
          color: #e8b9b9;
          padding: 12px 16px;
          border-radius: 3px;
          font-size: 13px;
          margin-bottom: 20px;
          font-family: 'IBM Plex Sans', sans-serif;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .retry-btn {
          background: none;
          border: 1px solid var(--burgundy);
          color: #e8b9b9;
          border-radius: 3px;
          padding: 6px 12px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          cursor: pointer;
          flex-shrink: 0;
        }
        .retry-btn:hover { background: rgba(232,185,185,0.1); }

        @keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes stamp { from { opacity: 0; transform: scale(1.06) rotate(-2deg); } to { opacity: 1; transform: scale(1) rotate(0deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

        @media (prefers-reduced-motion: reduce) {
          .exhibit, .verdict-card, .dot, .seat.active { animation: none !important; }
        }
      `}</style>

      <div className="wrap">
        <div className="brand">
          <span style={{ color: "var(--brass-bright)" }}><Seal size={26} /></span>
        </div>
        <div className="brand-title">CONCLAVE</div>
        <p className="tagline">Five minds convened on the decision you can't make alone.</p>

        {error && (
          <div className="error-banner">
            {error}
            {stage === "session" && !verdict && (
              <button className="retry-btn" type="button" onClick={runSession}>Try again</button>
            )}
          </div>
        )}

        {stage === "intake" && (
          <div className="intake-card">
            <div className="field">
              <label className="field-label" htmlFor="dilemma">State your case</label>
              <textarea
                id="dilemma"
                rows={3}
                placeholder="e.g. Should I leave my stable job to start a company?"
                value={dilemma}
                onChange={(e) => setDilemma(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="stakes">What's at stake (optional)</label>
              <input
                id="stakes"
                type="text"
                placeholder="e.g. savings, a relationship, a sense of identity"
                value={stakes}
                onChange={(e) => setStakes(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") runSession(e); }}
              />
            </div>
            <button className="seal-btn" type="button" onClick={runSession} disabled={!dilemma.trim()}>
              <Seal size={16} /> Convene the Council
            </button>
          </div>
        )}

        {(stage === "session" || stage === "verdict") && (
          <>
            <div className="docket">
              <div className="docket-case">Case No. {caseNumber}</div>
              <div className="docket-text">"{dilemma}"</div>
            </div>

            <div className="seats">
              {PERSONAS.map((p, i) => {
                const filled = transcript.some((t) => t.id === p.id);
                const active = activeIndices.includes(i);
                return (
                  <div key={p.id} className={`seat ${filled ? "filled" : ""} ${active ? "active" : ""}`}>
                    {p.initial} · {filled || active ? "seated" : "empty"}
                  </div>
                );
              })}
            </div>

            {transcript.map((t, i) => (
              <div key={t.id} className="exhibit" style={{ "--persona-color": t.color }}>
                <div className="exhibit-head">
                  <span className="exhibit-name">{t.name}</span>
                  <span className="exhibit-num">Exhibit {["I", "II", "III", "IV"][i]}</span>
                </div>
                <div className="exhibit-role">{t.role}</div>
                <div className="exhibit-text">{t.text}</div>
              </div>
            ))}

            {activeIndices.length > 1 && (
              <div className="waiting">
                <span className="dot" /> {activeIndices.map((i) => PERSONAS[i].name).join(", ")} are testifying…
              </div>
            )}
            {activeIndices.length === 1 && (
              <div className="waiting"><span className="dot" /> {PERSONAS[activeIndices[0]].name} is cross-examining…</div>
            )}
            {activeIndices.length === 0 && verdictLoading && (
              <div className="waiting"><span className="dot" /> The Chair is deliberating…</div>
            )}

            {verdict && (
              <div className="verdict-card">
                <div className="verdict-label"><Seal size={14} /> Verdict</div>
                <div className="verdict-text">{verdict.verdict}</div>

                <div className="gauges">
                  <Gauge value={verdict.confidence} label="Confidence" color="var(--burgundy)" />
                  <Gauge value={verdict.alignment} label="Council Alignment" color="var(--sage)" />
                </div>

                {verdict.risks && verdict.risks.length > 0 && (
                  <div className="verdict-section risks">
                    <h4>Risks on the record</h4>
                    <ul>{verdict.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>
                  </div>
                )}

                {verdict.questions && verdict.questions.length > 0 && (
                  <div className="verdict-section questions">
                    <h4>Sit with this</h4>
                    <ul>{verdict.questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
                  </div>
                )}

                {addenda.map((a, i) => (
                  <div className="addendum" key={i}>
                    <div className="addendum-q">You: "{a.question}"</div>
                    <div className="addendum-a">{a.answer}</div>
                  </div>
                ))}

                <div className="challenge-form">
                  <input
                    type="text"
                    placeholder="Address the council…"
                    value={challenge}
                    onChange={(e) => setChallenge(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addressCouncil(e); }}
                    disabled={challengeLoading}
                  />
                  <button className="challenge-btn" type="button" onClick={addressCouncil} disabled={challengeLoading || !challenge.trim()}>
                    {challengeLoading ? "…" : "Speak"}
                  </button>
                </div>
              </div>
            )}

            <div className="footer-row">
              <button className="new-case" onClick={newCase} type="button">Open a new case</button>
              <span className="powered">Reasoned live by AI</span>
            </div>
          </>
        )}
        <div ref={endRef} />
      </div>
      </div>
    </>
  );
}
