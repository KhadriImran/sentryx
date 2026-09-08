/* ==========================================================================
   SENTRYX — AI Deep Scan proxy (shared handler)
   ---------------------------------------------------------------------------
   Keeps your LLM API key server-side. Used by js/deep-scan.js when
   AI_ENDPOINT is set.

   ENVIRONMENT
     ANTHROPIC_API_KEY   required (or swap the call below for your provider)
     DEEP_SCAN_MODEL     optional — defaults to a current Claude model id
     MAX_SOURCE_CHARS    optional — defaults to 60000

   POST { source, context: { localFindings }, source_meta }
   ->   { ok, findings: [...], summary }

   The prompt below is deliberately conservative: it asks for findings the
   deterministic analysers cannot produce, requires a concrete exploit path
   for anything rated Critical or High, and instructs the model to say
   nothing rather than pad the list. Tune it to your own audit methodology —
   this is the file to edit when you wire in your audit engine.
   ========================================================================== */
"use strict";

const SYSTEM_PROMPT = `You are a senior smart contract security researcher performing a first-pass review for SENTRYX. You are reviewing Solidity source that a visitor pasted into a public web tool.

Rules you must follow:
1. Report only findings that require REASONING about protocol behaviour — state interleaving, economic incentives, cross-function assumptions, specification mismatches, accounting drift, oracle trust, upgrade safety. Deterministic pattern matchers have already run; their results are supplied to you. Do not repeat them.
2. For any finding you rate critical or high, state a concrete exploit path: who calls what, in what order, and what they gain. If you cannot construct that path, rate it medium or lower and say why.
3. Severity is impact x likelihood, not novelty. Be conservative. A short, correct list is worth more than a long, speculative one.
4. If the code is too incomplete to analyse (interfaces only, missing dependencies, truncated), say so in the summary and return few or no findings.
5. Never invent line numbers, function names or behaviour that is not in the source.
6. Return ONLY valid JSON matching the schema. No markdown, no prose outside the JSON.

Schema:
{"summary":"2-3 sentences on what this contract is and the overall risk posture","findings":[{"severity":"critical|high|medium|low|info","title":"one line","location":"contract and function or line","description":"mechanism and exploit path","recommendation":"specific fix","confidence":"high|medium|low"}]}`;

async function handle(payload) {
  // Validate the request before touching credentials, so a malformed call
  // gets a useful error rather than a configuration one.
  const maxChars = parseInt(process.env.MAX_SOURCE_CHARS || "60000", 10);
  const source = String((payload && payload.source) || "");
  if (!source.trim()) {
    return { status: 400, body: { ok: false, error: "No source supplied." } };
  }
  if (source.length > maxChars) {
    return {
      status: 413,
      body: { ok: false, error: `Source is ${source.length} characters; this endpoint accepts up to ${maxChars}. Scan one contract at a time, or request a real audit.` }
    };
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { status: 500, body: { ok: false, error: "ANTHROPIC_API_KEY is not set on the server." } };
  }

  const local = ((payload.context && payload.context.localFindings) || [])
    .map((f) => `- [${f.severity}] ${f.id}: ${f.title}`).join("\n") || "(none)";

  const userMessage =
    `Deterministic analysers already reported these findings — do not repeat them:\n${local}\n\n` +
    `Solidity source:\n\`\`\`solidity\n${source}\n\`\`\``;

  let data;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: process.env.DEEP_SCAN_MODEL || "claude-sonnet-4-5",
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }]
      })
    });
    data = await res.json();
    if (!res.ok) {
      return { status: 502, body: { ok: false, error: (data && data.error && data.error.message) || `Upstream ${res.status}` } };
    }
  } catch (e) {
    return { status: 502, body: { ok: false, error: "Analysis service unreachable." } };
  }

  const text = (data.content || []).map((c) => c.text || "").join("").trim();
  let parsed;
  try {
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  } catch (e) {
    return { status: 502, body: { ok: false, error: "The analysis service returned an unparseable response." } };
  }

  const VALID = ["critical", "high", "medium", "low", "info"];
  const findings = (parsed.findings || [])
    .filter((f) => f && f.title)
    .slice(0, 40)
    .map((f) => ({
      severity: VALID.includes(String(f.severity || "").toLowerCase()) ? String(f.severity).toLowerCase() : "info",
      title: String(f.title).slice(0, 200),
      location: String(f.location || "").slice(0, 200),
      description: String(f.description || "").slice(0, 2000),
      recommendation: String(f.recommendation || "").slice(0, 2000),
      confidence: String(f.confidence || "medium")
    }));

  return { status: 200, body: { ok: true, summary: String(parsed.summary || "").slice(0, 1000), findings } };
}

module.exports = { handle, SYSTEM_PROMPT };
