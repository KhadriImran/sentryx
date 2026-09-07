/* ==========================================================================
   SENTRYX — Audit Scope & Quote Estimator
   ---------------------------------------------------------------------------
   ALL coefficients live in the single CONFIG object below. Change numbers
   there; no other file needs editing.

   Model:
     base       = BASE_FEE + (LOC × RATE_PER_LOC)
     adjusted   = base × complexity × chain × urgency × contractCountFactor
     + reaudit  = adjusted × REAUDIT_UPLIFT (if requested)
     range      = adjusted × [RANGE_LOW, RANGE_HIGH], floored at TIER minimum
     days       = ceil(adjusted / DAY_RATE), clamped to [MIN_DAYS, MAX_DAYS],
                  then × urgency compression
   ========================================================================== */
(function () {
  "use strict";
  const root = document.getElementById("estimator");
  if (!root) return;

  /* =================================================== CONFIG (edit me) */
  const CONFIG = {
    currency: "USD", symbol: "$",
    BASE_FEE: 1200,          // fixed cost of scoping, reporting, verification
    RATE_PER_LOC: 2.6,       // per line of in-scope Solidity
    DAY_RATE: 1400,          // used to derive the timeline from the fee
    MIN_DAYS: 3, MAX_DAYS: 45,
    RANGE_LOW: 0.85, RANGE_HIGH: 1.35,   // quoted range around the midpoint
    FLOOR: 1500,             // never quote below the pre-deployment entry price
    REAUDIT_UPLIFT: 1.22,    // full re-review of changed code + PoC re-runs
    CONTRACT_STEP: 0.03,     // per contract beyond the first five
    CONTRACT_CAP: 1.35,

    complexity: {
      simple:   { m: 1.00, d: 1.00, label: "Simple",   note: "Token, vesting, static NFT mint. Few external calls." },
      moderate: { m: 1.35, d: 1.15, label: "Moderate", note: "Staking, escrow, marketplace, basic governance." },
      complex:  { m: 1.85, d: 1.35, label: "Complex",  note: "AMM, lending, vaults, oracles, upgradeable proxies." },
      extreme:  { m: 2.60, d: 1.60, label: "Very complex", note: "Perps, bridges, restaking, novel cryptography or economics." }
    },
    chain: {
      evm:      { m: 1.00, label: "Ethereum / EVM L1",   note: "Core in-house strength." },
      l2:       { m: 1.10, label: "EVM L2 or rollup",    note: "Adds sequencer, bridge and fee-model surface." },
      multi:    { m: 1.45, label: "Multi-chain / bridge", note: "Every chain in the path must be modelled." },
      solana:   { m: 1.40, label: "Solana (Rust)",       note: "Delivered with vetted partner researchers." },
      move:     { m: 1.40, label: "Aptos / Sui (Move)",  note: "Delivered with vetted partner researchers." },
      cairo:    { m: 1.45, label: "Starknet (Cairo)",    note: "Delivered with vetted partner researchers." }
    },
    urgency: {
      standard: { m: 1.00, d: 1.00, label: "Standard",  note: "Scheduled into the next available slot." },
      priority: { m: 1.25, d: 0.75, label: "Priority",  note: "Starts within a week; compressed calendar." },
      rush:     { m: 1.60, d: 0.55, label: "Rush",      note: "Immediate start, researchers reassigned." }
    }
  };
  window.SENTRYX_ESTIMATOR_CONFIG = CONFIG;   // exposed for easy tweaking / debugging

  /* ---------------------------------------------------------------- DOM */
  const $ = (s) => root.querySelector(s);
  const locInput = $("#es-loc"), locRange = $("#es-loc-range");
  const contracts = $("#es-contracts");
  const outAmount = $("#es-amount"), outRows = $("#es-rows"), outBar = $("#es-bar i"), outNote = $("#es-note");

  function fmt(n) {
    // round to the nearest 100 below 20k, nearest 500 above — quotes are not to the dollar
    const step = n >= 20000 ? 500 : 100;
    return CONFIG.symbol + (Math.round(n / step) * step).toLocaleString("en-US");
  }

  function pick(name) {
    const el = root.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : null;
  }

  function compute() {
    const loc = Math.max(50, Math.min(30000, parseInt(locInput.value || "0", 10) || 0));
    const n = Math.max(1, Math.min(60, parseInt(contracts.value || "1", 10) || 1));
    const cx = CONFIG.complexity[pick("complexity")] || CONFIG.complexity.moderate;
    const ch = CONFIG.chain[pick("chain")] || CONFIG.chain.evm;
    const ur = CONFIG.urgency[pick("urgency")] || CONFIG.urgency.standard;
    const reaudit = $("#es-reaudit").checked;

    const countFactor = Math.min(CONFIG.CONTRACT_CAP, 1 + Math.max(0, n - 5) * CONFIG.CONTRACT_STEP);
    let mid = (CONFIG.BASE_FEE + loc * CONFIG.RATE_PER_LOC) * cx.m * ch.m * ur.m * countFactor;
    if (reaudit) mid *= CONFIG.REAUDIT_UPLIFT;

    let low = Math.max(CONFIG.FLOOR, mid * CONFIG.RANGE_LOW);
    let high = Math.max(low * 1.2, mid * CONFIG.RANGE_HIGH);

    let days = Math.ceil((mid / CONFIG.DAY_RATE) * cx.d * ur.d);
    days = Math.max(CONFIG.MIN_DAYS, Math.min(CONFIG.MAX_DAYS, days));
    const daysHigh = Math.min(CONFIG.MAX_DAYS + 10, Math.ceil(days * 1.4));
    const researchers = mid > 12000 ? 3 : mid > 4000 ? 2 : 1;

    return { loc, n, cx, ch, ur, reaudit, low, high, days, daysHigh, researchers, countFactor };
  }

  function render() {
    const r = compute();
    outAmount.innerHTML = fmt(r.low) + ' <span class="to">–</span> ' + fmt(r.high);
    outRows.innerHTML =
      row("Estimated timeline", r.days + "–" + r.daysHigh + " working days") +
      row("Researchers", r.researchers + (r.researchers > 1 ? " researchers" : " researcher")) +
      row("Scope", r.loc.toLocaleString() + " LoC · " + r.n + (r.n > 1 ? " contracts" : " contract")) +
      row("Complexity", r.cx.label) +
      row("Chain", r.ch.label) +
      row("Urgency", r.ur.label) +
      row("Re-audit included", r.reaudit ? "Yes" : "No");

    // Position the bar within a 0–40k visual scale
    const scale = 40000;
    outBar.style.left = Math.min(92, (r.low / scale) * 100) + "%";
    outBar.style.right = Math.max(2, 100 - Math.min(100, (r.high / scale) * 100)) + "%";

    const partner = ["solana", "move", "cairo", "multi"].indexOf(pick("chain")) !== -1;
    outNote.innerHTML =
      "This is an indicative range generated in your browser, not a quote. " +
      (partner ? "This chain is delivered with vetted partner researchers — we name them before you sign. " : "") +
      "Final pricing follows a free scoping review of the repository, which takes under two working days.";
  }
  function row(k, v) { return '<div class="est-row"><span>' + k + "</span><span>" + v + "</span></div>"; }

  // Keep number + range inputs in sync
  locRange.addEventListener("input", function () { locInput.value = locRange.value; render(); });
  locInput.addEventListener("input", function () { locRange.value = Math.min(20000, Math.max(50, parseInt(locInput.value || "0", 10) || 50)); render(); });
  root.addEventListener("change", render);
  contracts.addEventListener("input", render);

  // Hand the estimate to the request form
  const send = $("#es-send");
  if (send) send.addEventListener("click", function (e) {
    e.preventDefault();
    const r = compute();
    const q = new URLSearchParams({
      loc: String(r.loc), contracts: String(r.n),
      complexity: pick("complexity") || "moderate", chain: pick("chain") || "evm",
      urgency: pick("urgency") || "standard", reaudit: r.reaudit ? "yes" : "no",
      estimate: Math.round(r.low) + "-" + Math.round(r.high)
    });
    location.href = "contact.html?" + q.toString();
  });

  render();
})();
