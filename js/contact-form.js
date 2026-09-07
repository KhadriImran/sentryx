/* ==========================================================================
   SENTRYX — multi-step "Request an Audit" form
   ---------------------------------------------------------------------------
   FORM ENDPOINT: set FORM_ENDPOINT to your Formspree or Web3Forms URL.
     Formspree:  https://formspree.io/f/XXXXXXXX      (POST JSON, Accept: application/json)
     Web3Forms:  https://api.web3forms.com/submit     (POST JSON incl. access_key)
   If it is left empty the form validates, shows the review step and then
   reports that no endpoint is configured — it never silently pretends to send.
   ========================================================================== */
(function () {
  "use strict";
  const form = document.getElementById("audit-form");
  if (!form) return;

  const FORM_ENDPOINT = "";                       // <-- paste your endpoint here
  const WEB3FORMS_ACCESS_KEY = "";                // <-- only if using Web3Forms
  const FALLBACK_EMAIL = "audits@sentryx.example";

  const steps = Array.from(form.querySelectorAll(".form-step"));
  const bar = form.querySelector(".steps-bar");
  const stepNum = form.querySelector("[data-step-num]");
  const stepName = form.querySelector("[data-step-name]");
  const backBtn = form.querySelector("[data-back]");
  const nextBtn = form.querySelector("[data-next]");
  const submitBtn = form.querySelector("[data-submit]");
  const review = form.querySelector("#review-list");
  const status = form.querySelector("#form-status");
  const NAMES = ["Project", "Scope", "Engagement", "Contact", "Review"];
  let i = 0;

  bar.innerHTML = steps.map(() => "<div><i></i></div>").join("");

  /* ------------------------------------------------------- prefill from URL */
  const params = new URLSearchParams(location.search);
  // Pricing-tier ids (data/pricing.js) -> option text in the service <select>
  const TIER_TO_SERVICE = {
    predeploy: "Pre-deployment assessment",
    standard: "Smart contract security audit",
    defi: "DeFi protocol security review",
    bridge: "Bridge / cross-chain audit",
    invariants: "Invariant & fuzz suite development",
    incident: "Incident response (URGENT)",
    retainer: "Continuous security retainer",
    enterprise: "Not sure — help me scope it"
  };
  if (params.toString()) {
    const tier = params.get("service");
    if (tier && TIER_TO_SERVICE[tier]) {
      const sel = form.elements["service"];
      if (sel) {
        const want = TIER_TO_SERVICE[tier];
        const opt = Array.from(sel.options).find((o) => o.text.replace(/&amp;/g, "&") === want);
        if (opt) sel.value = opt.value || opt.text;
      }
    }
    // Estimator chain ids -> option text in the chain <select>
    const CHAIN_MAP = { evm: "Ethereum", l2: "Other EVM", multi: "Multi-chain / bridge",
                        solana: "Solana", move: "Aptos", cairo: "Starknet" };
    const map = { loc: "loc", contracts: "contracts", chain: "chain", urgency: "timeline_urgency" };
    Object.keys(map).forEach((k) => {
      let v = params.get(k); if (!v) return;
      const el = form.elements[map[k]];
      if (!el) return;
      if (k === "chain") v = CHAIN_MAP[v] || v;
      if (el.tagName === "SELECT") {
        const opt = Array.from(el.options).find((o) => o.value === v || o.text === v);
        if (opt) el.value = opt.value;
      } else el.value = v;
    });
    const est = params.get("estimate");
    if (est) {
      const b = form.elements["budget"];
      const note = form.elements["notes"];
      if (note) {
        const fmt = (n) => "$" + Number(n).toLocaleString("en-US");
        const parts = est.split("-");
        note.value = "Estimator range: " + fmt(parts[0]) + " – " + fmt(parts[1] || parts[0]) + "\n" + (note.value || "");
      }
      if (b) { const parts = est.split("-").map(Number); const low = parts[0] || 0;
        const target = low < 3000 ? "under-5k" : low < 8000 ? "5-10k" : low < 20000 ? "10-25k" : "25k-plus";
        const opt = Array.from(b.options).find((o) => o.value === target); if (opt) b.value = target; }
    }
  }

  /* ------------------------------------------------------------ validation */
  function fieldError(el, msg) {
    const wrap = el.closest(".field");
    if (!wrap) return;
    wrap.classList.toggle("is-invalid", !!msg);
    const e = wrap.querySelector(".error");
    if (e && msg) e.textContent = msg;
    el.setAttribute("aria-invalid", msg ? "true" : "false");
  }
  function validateStep(idx) {
    let ok = true, first = null;
    steps[idx].querySelectorAll("input, select, textarea").forEach((el) => {
      if (el.type === "radio" || el.type === "checkbox") return;
      let msg = "";
      const v = (el.value || "").trim();
      if (el.required && !v) msg = "This field is required.";
      else if (v && el.type === "email" && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v)) msg = "Enter a valid email address.";
      else if (v && el.type === "url" && !/^https?:\/\/.+\..+/i.test(v)) msg = "Enter a full URL, including https://";
      else if (v && el.name === "loc" && (isNaN(+v) || +v < 1)) msg = "Enter an approximate number of lines.";
      fieldError(el, msg);
      if (msg) { ok = false; if (!first) first = el; }
    });
    if (first) first.focus();
    return ok;
  }
  form.addEventListener("input", (e) => { if (e.target.closest(".field.is-invalid")) fieldError(e.target, ""); });

  /* ----------------------------------------------------------- navigation */
  function label(el) {
    if (el.tagName === "SELECT" && el.selectedIndex >= 0) return el.options[el.selectedIndex].text;
    return el.value;
  }
  function buildReview() {
    const rows = [];
    steps.slice(0, -1).forEach((s) => {
      s.querySelectorAll("input, select, textarea").forEach((el) => {
        if (!el.name || el.type === "checkbox" && !el.checked) return;
        const v = el.type === "checkbox" ? "Yes" : label(el);
        if (!v || !String(v).trim()) return;
        const lab = (el.closest(".field") && el.closest(".field").querySelector("label"));
        rows.push("<div><span>" + (lab ? lab.textContent.replace("*", "").trim() : el.name) + "</span><span>" +
          String(v).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c])) + "</span></div>");
      });
    });
    review.innerHTML = rows.join("") || "<p class='muted'>Nothing entered yet.</p>";
  }
  function go(n) {
    if (n > i && !validateStep(i)) return;
    i = Math.max(0, Math.min(steps.length - 1, n));
    steps.forEach((s, k) => (s.hidden = k !== i));
    Array.from(bar.children).forEach((d, k) => { d.classList.toggle("is-done", k < i); d.classList.toggle("is-active", k === i); });
    stepNum.textContent = "Step " + (i + 1) + " / " + steps.length;
    stepName.textContent = NAMES[i] || "";
    backBtn.hidden = i === 0;
    nextBtn.hidden = i === steps.length - 1;
    submitBtn.hidden = i !== steps.length - 1;
    if (i === steps.length - 1) buildReview();
    const y = form.getBoundingClientRect().top + window.scrollY - 110;
    if (window.scrollY > y) window.scrollTo({ top: y, behavior: "smooth" });
  }
  nextBtn.addEventListener("click", () => go(i + 1));
  backBtn.addEventListener("click", () => go(i - 1));
  form.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA" && i < steps.length - 1) { e.preventDefault(); go(i + 1); }
  });

  /* --------------------------------------------------------------- submit */
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!validateStep(i)) return;
    const data = Object.fromEntries(new FormData(form).entries());
    data._subject = "Audit request — " + (data.project_name || "unnamed project");
    data.page = location.href;

    status.hidden = false;
    status.className = "form-status";
    status.innerHTML = "Sending…";
    submitBtn.disabled = true;

    if (!FORM_ENDPOINT) {
      status.className = "form-status is-err";
      status.innerHTML = "<b>No form endpoint configured.</b><br>Set <code>FORM_ENDPOINT</code> at the top of <code>js/contact-form.js</code> (Formspree or Web3Forms). " +
        'Until then, email this to <a href="mailto:' + FALLBACK_EMAIL + '">' + FALLBACK_EMAIL + "</a>.";
      submitBtn.disabled = false;
      return;
    }
    try {
      if (WEB3FORMS_ACCESS_KEY) data.access_key = WEB3FORMS_ACCESS_KEY;
      const res = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        form.querySelector(".form-nav").hidden = true;
        steps.forEach((s) => (s.hidden = true));
        bar.hidden = true;
        status.className = "form-status is-ok";
        status.innerHTML = "<b>Request received.</b><br>A researcher will reply within one working day with scoping questions or a written scope and quote.";
      } else {
        throw new Error("HTTP " + res.status);
      }
    } catch (err) {
      status.className = "form-status is-err";
      status.innerHTML = "<b>That didn't send.</b><br>Please email <a href='mailto:" + FALLBACK_EMAIL + "'>" + FALLBACK_EMAIL + "</a> instead — we'll pick it up the same day.";
      submitBtn.disabled = false;
    }
  });

  go(0);
})();
