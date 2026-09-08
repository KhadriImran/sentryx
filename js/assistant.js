/* ==========================================================================
   SENTRYX — AI Security Assistant widget
   ---------------------------------------------------------------------------
   BACKEND WIRING
   Set API_ENDPOINT below to your assistant endpoint. Until it is set (or if a
   request fails) the widget runs in SCRIPTED FALLBACK mode: an intent matcher
   over a local knowledge base. The site is fully functional with no backend.

   Request shape (POST, JSON):
     {
       "message":  "how much does an audit cost",
       "history":  [ { "role": "user" | "assistant", "content": "..." } ],
       "page":     "/pricing.html",
       "source":   "sentryx-web"
     }
   Expected response (JSON), any ONE of:
     { "reply": "..." }            // preferred — plain text or light HTML
     { "message": "..." }
     { "choices": [ { "message": { "content": "..." } } ] }   // OpenAI-shaped

   Headers: set API_HEADERS for auth. NEVER put a secret API key here — this
   file is public. Put the key in a server-side proxy (Netlify/Vercel function)
   and point API_ENDPOINT at that proxy.
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------ CONFIGURATION */
  const API_ENDPOINT = "";                        // e.g. "/.netlify/functions/assistant"
  const API_HEADERS  = { "Content-Type": "application/json" };
  const API_TIMEOUT  = 12000;                     // ms before falling back
  const GREETING     = "SENTRYX assistant. I can answer questions about audit scope, our process, severity levels and pricing. What do you need?";
  const SUGGESTIONS  = ["What does an audit cost?", "How long does it take?", "What's in the report?", "What is a Critical?", "Do you audit Solana?"];

  /* --------------------------------------------- SCRIPTED KNOWLEDGE BASE */
  /* Each entry: keywords (any match scores), plus a weight for specificity.  */
  const KB = [
    { k: ["cost", "price", "pricing", "how much", "quote", "budget", "expensive", "rate", "fee"], a:
      "Scope drives price. Starting points:<br><br>• Pre-deployment assessment — from <b>$1,500</b><br>• Standard smart contract audit — from <b>$3,000</b><br>• DeFi protocol audit — from <b>$8,000</b><br>• Bridge / cross-chain audit — from <b>$15,000</b><br>• Invariant &amp; fuzz suite — from <b>$4,000</b><br>• Incident response — from <b>$5,000</b> (emergency rate applies)<br>• Security retainer — from <b>$3,000/month</b><br><br>Every engagement is quoted after we review the repository. Try the <a href='tools.html#estimator'>quote estimator</a> for a range, or see <a href='pricing.html'>pricing</a>." },
    { k: ["how long", "timeline", "duration", "weeks", "days", "turnaround", "fast", "when can you start", "lead time"], a:
      "Typically one to four weeks. A focused pre-deployment assessment can land in under a week; a lending protocol with oracle and liquidation logic usually needs three to four weeks including remediation verification. Bridges run four to eight weeks. Scoping itself takes under two working days." },
    { k: ["report", "deliverable", "what do i get", "pdf", "output"], a:
      "You receive: an executive summary, the written threat model and trust assumptions, every finding with severity / impact / likelihood, a runnable proof of concept for each Critical and High, and specific remediation guidance. Delivered as PDF <i>and</i> Markdown, plus the findings register as JSON. After you fix, we verify each remediation and issue a final report with per-finding status. See a <a href='tools.html#report-viewer'>sample report</a>." },
    { k: ["severity", "critical", "high", "medium", "low", "informational", "classify", "classification"], a:
      "Severity is impact × likelihood, not cleverness:<br><br>• <b>Critical (SEV-0)</b> — direct loss of funds or protocol takeover, exploitable by anyone.<br>• <b>High (SEV-1)</b> — significant loss under specific but realistic conditions.<br>• <b>Medium (SEV-2)</b> — bounded loss, broken accounting or degraded function.<br>• <b>Low (SEV-3)</b> — edge cases and hygiene that compound into future risk.<br>• <b>Informational (SEV-4)</b> — gas, readability, documentation.<br><br>Full definitions and remediation patterns are in the <a href='tools/severity-explorer.html'>Severity Explorer</a>." },
    { k: ["scope", "scoping", "what do you need", "prepare", "before we start", "requirements", "loc", "lines of code"], a:
      "To scope we need: the repository (or a commit hash), which contracts are in scope, your docs or spec, the list of external integrations (oracles, AMMs, bridges), who holds privileged roles, and your target date. Scoping is free and takes under two working days — you get a written scope, a fixed quote and a review plan, including who is assigned to it." },
    { k: ["process", "methodology", "how do you work", "steps", "stages"], a:
      "Six stages: <b>1)</b> scoping &amp; threat model, <b>2)</b> two independent manual reviews, <b>3)</b> tooling and invariants (Slither, Aderyn, Foundry, Echidna, Medusa), <b>4)</b> proof-of-concept development, <b>5)</b> report &amp; walkthrough, <b>6)</b> remediation verification. Details on the <a href='process.html'>methodology page</a>." },
    { k: ["poc", "proof of concept", "exploit", "reproduce", "demonstrate"], a:
      "Every Critical and High ships with a runnable proof of concept — usually a Foundry test against a fork — so your team can reproduce the issue and confirm the fix. If we cannot demonstrate an issue, we downgrade it and say so in the report." },
    { k: ["chain", "chains", "solana", "rust", "move", "aptos", "sui", "cairo", "starknet", "vyper", "language", "l2", "layer 2"], a:
      "Core in-house strength is <b>Solidity / EVM</b> — Ethereum and L2s including Arbitrum, Optimism, Base, Polygon, zkSync, Scroll and Linea — plus Vyper. Rust (Solana), Move (Aptos, Sui) and Cairo (Starknet) engagements are delivered <b>with vetted partner researchers</b>, and we name who is on the engagement before you sign. See <a href='services.html'>services</a>." },
    { k: ["guarantee", "safe", "insurance", "warranty", "certif"], a:
      "No audit can guarantee the absence of bugs, and we will not claim otherwise. An audit is a time-boxed adversarial review that materially reduces risk. We recommend layering it: invariant tests in CI, a bug bounty, on-chain monitoring, and a re-audit after any significant change — which is what the retainer covers." },
    { k: ["reentrancy", "reentrant"], a:
      "Reentrancy is an external call made before state is updated, letting the callee re-enter and repeat an operation against stale state. Classic, cross-function and cross-contract variants all still appear — vaults, NFT mints, ERC-777 hooks, <code>onERC721Received</code>. Fix: checks-effects-interactions plus a reentrancy guard. We wrote it up <a href='blog/reentrancy-attacks-explained.html'>here</a>." },
    { k: ["oracle", "price manipulation", "flash loan", "twap", "chainlink"], a:
      "Oracle manipulation means reading a price an attacker can move inside one transaction — typically spot reserves of an AMM pool, borrowed with a flash loan. Fix: manipulation-resistant sources (Chainlink with staleness + deviation bounds, or a 30-minute TWAP), cross-checked. Details <a href='blog/oracle-manipulation-attacks.html'>here</a>." },
    { k: ["access control", "onlyowner", "tx.origin", "role", "privileged", "initializer"], a:
      "Access control failures — missing modifiers, callable initializers, <code>tx.origin</code> auth, roles on the wrong address — are the simplest class to describe and behind a large share of total losses. One unguarded setter is enough. Read <a href='blog/access-control-failures.html'>the write-up</a>." },
    { k: ["invariant", "fuzz", "echidna", "medusa", "foundry", "test", "testing", "property"], a:
      "We build invariant and fuzz suites as a standalone engagement (from $4,000) or as part of a protocol audit: property elicitation, Foundry invariant tests with handlers and ghost variables, Echidna or Medusa campaigns, and CI integration so they keep running after we leave. See <a href='services/invariant-fuzz-testing.html'>invariant &amp; fuzz testing</a>." },
    { k: ["incident", "hacked", "exploit happening", "drained", "emergency", "attack right now", "being attacked"], a:
      "If you are being exploited right now, contact us immediately at <a href='mailto:audits@sentryx.example'>audits@sentryx.example</a> and mark it URGENT — do not wait for this chat. We run live triage, containment options, root-cause analysis, fund tracing and white-hat / exchange coordination. Incident response starts from $5,000 with an emergency rate for same-day engagement." },
    { k: ["retainer", "continuous", "ongoing", "monthly", "subscription"], a:
      "The retainer puts a dedicated reviewer on your team from $3,000/month: review of every PR that touches value flows, invariant-suite maintenance, dependency and upgrade monitoring, priority incident response and a quarterly threat-model refresh. Built for teams shipping weekly." },
    { k: ["who", "team", "researcher", "founder", "experience", "background", "staffing"], a:
      "SENTRYX is a small, specialist practice operating under Avanteia Private Limited (Goa, India). We do not publish researcher profiles — but before you sign, you get in writing exactly who is assigned to your engagement, what they have worked on, and the named partner specialists if any are involved. Every standard audit gets two independent reads of the full scope. More on <a href='about.html'>how we staff</a>." },
    { k: ["nda", "confidential", "private", "disclosure", "publish"], a:
      "We sign NDAs and run private engagements as standard. Nothing is published without your written approval — you decide whether the final report becomes public. Unfixed Critical findings are never disclosed publicly." },
    { k: ["start", "book", "hire", "engage", "contact", "get started", "talk"], a:
      "Send the repo and we'll tell you what it needs. <a href='contact.html'>Request an audit</a> — the multi-step form takes about two minutes — or email <a href='mailto:audits@sentryx.example'>audits@sentryx.example</a>. Scoping is free." },
    { k: ["re-audit", "reaudit", "remediation", "verify", "fix", "second opinion"], a:
      "Remediation verification is included in every audit: we re-review every changed line, re-run the PoCs and the invariant suite, then mark each finding Fixed, Acknowledged or Open in a publishable final report. Standalone re-audits and second-opinion reviews after another firm's audit are also available." },
    { k: ["tool", "tools", "pre-check", "precheck", "scan", "estimator", "calculator"], a:
      "Free tools on this site: a <a href='tools.html#precheck'>contract risk pre-check</a> (client-side heuristic scan of a Solidity snippet), an <a href='tools.html#estimator'>audit scope &amp; quote estimator</a>, a <a href='tools.html#severity'>severity explorer</a> and a <a href='tools.html#report-viewer'>sample report viewer</a>. The pre-check is indicative only — it is not an audit." },
    { k: ["bug bounty", "immunefi", "bounty"], a:
      "We design and triage bug bounty programmes — scope, severity matrix, payout bands and a triage process that pays fairly and closes reports fast. A bounty complements an audit; it does not replace one, because bounty hunters optimise for what is cheap to find." },
    { k: ["mev", "front-run", "frontrun", "sandwich", "slippage"], a:
      "MEV and front-running exposure is part of every DeFi review: swaps without slippage bounds, approvals, weak commit-reveal, liquidations that pay the fastest bot. We model the economic attack, not just the code path." },
    { k: ["bridge", "cross-chain", "crosschain", "relayer", "message"], a:
      "Bridge audits (from $15,000) cover message verification, relayer/validator trust, replay and reorg protection, finality assumptions and the off-chain components. Bridges hold the largest single-exploit losses in the industry, so we scope them per chain pair. See <a href='services/bridge-cross-chain-audit.html'>bridge &amp; cross-chain audits</a>." }
  ];
  const FALLBACK_ANSWER = "I don't have a scripted answer for that one. The <a href='services.html'>services</a>, <a href='process.html'>methodology</a> and <a href='pricing.html'>pricing</a> pages cover most of it — or ask a researcher directly via <a href='contact.html'>request an audit</a>. Try: cost, timeline, severity levels, chains covered, or what's in the report.";

  function scriptedReply(text) {
    const q = " " + text.toLowerCase().replace(/[^a-z0-9\s.]/g, " ") + " ";
    let best = null, bestScore = 0;
    for (const entry of KB) {
      let score = 0;
      for (const kw of entry.k) if (q.indexOf(kw) !== -1) score += kw.length > 6 ? 3 : 2;
      if (score > bestScore) { bestScore = score; best = entry; }
    }
    return bestScore >= 2 && best ? best.a : FALLBACK_ANSWER;
  }

  /* ------------------------------------------------------------- MARKUP */
  const fab = document.createElement("button");
  fab.className = "sx-fab"; fab.type = "button";
  fab.setAttribute("aria-expanded", "false");
  fab.setAttribute("aria-controls", "sx-panel");
  fab.setAttribute("aria-label", "Open the SENTRYX security assistant");
  fab.innerHTML =
    '<svg class="open-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2 21 6v6c0 5-3.8 8.9-9 10-5.2-1.1-9-5-9-10V6z"/><path d="M9 12l2 2 4-4"/></svg>' +
    '<svg class="close-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  const panel = document.createElement("div");
  panel.className = "sx-panel"; panel.id = "sx-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "SENTRYX security assistant");
  panel.innerHTML =
    '<div class="sx-panel-head"><span class="dot" aria-hidden="true"></span><div><b>Security assistant</b><span data-sx-mode>Scripted mode · no data leaves your browser</span></div></div>' +
    '<div class="sx-log" id="sx-log" role="log" aria-live="polite" aria-atomic="false"></div>' +
    '<div class="sx-sugg" id="sx-sugg"></div>' +
    '<form class="sx-form" id="sx-form" autocomplete="off">' +
      '<label class="sr-only" for="sx-input">Ask the security assistant</label>' +
      '<input id="sx-input" name="q" placeholder="Ask about scope, process, severity…" maxlength="400">' +
      '<button type="submit" aria-label="Send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h14M13 6l6 6-6 6"/></svg></button>' +
    '</form>';

  document.addEventListener("DOMContentLoaded", function () {
    document.body.append(fab, panel);
    const log = panel.querySelector("#sx-log");
    const form = panel.querySelector("#sx-form");
    const input = panel.querySelector("#sx-input");
    const sugg = panel.querySelector("#sx-sugg");
    const mode = panel.querySelector("[data-sx-mode]");
    if (API_ENDPOINT) mode.textContent = "Connected · answers may be logged";
    const history = [];
    let opened = false;

    function bubble(text, who) {
      const el = document.createElement("div");
      el.className = "sx-msg " + who;
      el.innerHTML = text;
      log.appendChild(el);
      log.scrollTop = log.scrollHeight;
      return el;
    }
    function typing() {
      const el = bubble('<span class="sx-typing"><i></i><i></i><i></i></span>', "bot");
      el.dataset.typing = "1";
      return el;
    }
    function renderSuggestions() {
      sugg.innerHTML = "";
      SUGGESTIONS.forEach(function (s) {
        const b = document.createElement("button");
        b.type = "button"; b.textContent = s;
        b.addEventListener("click", function () { input.value = s; form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true })); });
        sugg.appendChild(b);
      });
    }

    async function answer(question) {
      const t = typing();
      let reply = null;
      if (API_ENDPOINT) {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(function () { ctrl.abort(); }, API_TIMEOUT);
          const res = await fetch(API_ENDPOINT, {
            method: "POST", headers: API_HEADERS, signal: ctrl.signal,
            body: JSON.stringify({ message: question, history: history.slice(-10), page: location.pathname, source: "sentryx-web" })
          });
          clearTimeout(timer);
          if (res.ok) {
            const data = await res.json();
            reply = data.reply || data.message || (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || null;
          }
        } catch (_) { /* fall through to scripted mode */ }
      }
      if (!reply) { reply = scriptedReply(question); await new Promise(function (r) { setTimeout(r, 260); }); }
      t.remove();
      bubble(reply, "bot");
      history.push({ role: "assistant", content: reply.replace(/<[^>]+>/g, "") });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      bubble(q.replace(/[<>&]/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]; }), "me");
      history.push({ role: "user", content: q });
      input.value = "";
      answer(q);
    });

    function open() {
      panel.classList.add("is-open");
      fab.setAttribute("aria-expanded", "true");
      fab.setAttribute("aria-label", "Close the SENTRYX security assistant");
      if (!opened) { opened = true; bubble(GREETING, "bot"); renderSuggestions(); }
      setTimeout(function () { input.focus(); }, 260);
    }
    function close() {
      panel.classList.remove("is-open");
      fab.setAttribute("aria-expanded", "false");
      fab.setAttribute("aria-label", "Open the SENTRYX security assistant");
    }
    fab.addEventListener("click", function () { panel.classList.contains("is-open") ? close() : open(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && panel.classList.contains("is-open")) { close(); fab.focus(); } });
    document.querySelectorAll("[data-open-assistant]").forEach(function (el) {
      el.addEventListener("click", function (e) { e.preventDefault(); open(); });
    });
  });
})();
