/* ==========================================================================
   SENTRYX — pricing tiers
   ALL prices live here. pricing.html renders this; the homepage and service
   pages reference the `from` figures in copy (search "From $" if you change
   them). Values in USD. `from: null` renders "Custom".
   ========================================================================== */
window.SENTRYX_PRICING = {
  currency: "USD",
  note: "Scope drives price. Every engagement is quoted after a review of the repository — lines of code, external integrations, privileged roles and the state of your tests matter more than contract count. Figures below are starting points, not fixed prices.",
  tiers: [
    {
      id: "predeploy", name: "Pre-deployment assessment", from: 1500, unit: "",
      tagline: "A last look before mainnet for small, well-tested contract sets.",
      loc: "Up to ~500 LoC", timeline: "2–5 working days", researchers: "1 researcher",
      includes: ["Manual review of access control, external calls, arithmetic and initialisation", "Deployment script and constructor argument review", "Static analysis triage (Slither, Aderyn)", "Findings register with severities"],
      deliverables: ["Short-form report (PDF + Markdown)", "Findings JSON", "One round of fix verification"],
      cta: "Request an assessment"
    },
    {
      id: "standard", name: "Standard smart contract audit", from: 3000, unit: "",
      tagline: "Full manual audit of a contract system with tooling and PoCs.",
      loc: "~500 – 2,500 LoC", timeline: "1–3 weeks", researchers: "2 researchers (independent reads)",
      includes: ["Written threat model and trust-boundary map", "Two independent manual reviews of all in-scope code", "Static analysis + targeted fuzzing", "Runnable PoC for every Critical and High", "Remediation guidance per finding"],
      deliverables: ["Full report (PDF + Markdown)", "Findings JSON", "Walkthrough call", "Remediation verification and final report"],
      cta: "Request an audit", featured: true
    },
    {
      id: "defi", name: "DeFi protocol audit", from: 8000, unit: "",
      tagline: "Economic and code-level review of AMMs, lending, vaults, perps and yield systems.",
      loc: "~2,500 – 8,000 LoC", timeline: "3–5 weeks", researchers: "2–3 researchers",
      includes: ["Everything in Standard", "Economic attack and MEV analysis", "Oracle dependency and manipulation review", "Liquidation, accounting and share-maths invariants", "Foundry invariant suite for core properties"],
      deliverables: ["Full report + threat model", "Invariant suite (CI-ready)", "Findings JSON", "Remediation verification"],
      cta: "Scope a DeFi audit"
    },
    {
      id: "bridge", name: "Bridge / cross-chain audit", from: 15000, unit: "",
      tagline: "Message verification, relayer trust and finality assumptions across every chain in the path.",
      loc: "Scoped per chain pair", timeline: "4–8 weeks", researchers: "2–3 researchers (+ partner specialists per non-EVM chain)",
      includes: ["Everything in DeFi", "Cross-chain message and proof verification review", "Replay, reorg and finality failure-mode analysis", "Relayer / validator set trust model", "Off-chain component review (relayers, watchers)"],
      deliverables: ["Full report + cross-chain threat model", "Invariant suite", "Monitoring recommendations", "Remediation verification"],
      cta: "Scope a bridge audit"
    },
    {
      id: "invariants", name: "Invariant & fuzz suite", from: 4000, unit: "",
      tagline: "Properties your protocol must never violate, encoded as tests that run forever.",
      loc: "Any — priced by property count and state complexity", timeline: "1–3 weeks", researchers: "1–2 researchers",
      includes: ["Property elicitation workshop", "Foundry invariant tests with handlers and ghost variables", "Echidna or Medusa campaign configuration", "Coverage analysis and corpus reuse", "CI integration with failure artefacts"],
      deliverables: ["Test suite in your repo", "Property catalogue document", "CI workflow"],
      cta: "Build my suite"
    },
    {
      id: "incident", name: "Incident response", from: 5000, unit: "", emergency: true,
      tagline: "Live triage and forensics when funds are moving. Emergency rate applies for same-day engagement.",
      loc: "N/A", timeline: "Immediate — hours, not weeks", researchers: "On-call researcher + lead",
      includes: ["Live exploit triage and containment options", "Root-cause analysis and exploit reconstruction", "Fund tracing and exchange / white-hat coordination", "Public post-mortem drafting", "Fix review before redeploy"],
      deliverables: ["Incident timeline", "Root-cause report", "Post-mortem (public + internal)", "Remediation review"],
      cta: "Contact us now"
    },
    {
      id: "retainer", name: "Security retainer", from: 3000, unit: "/ month",
      tagline: "A named researcher embedded with your team, every month.",
      loc: "Priced by PR volume", timeline: "Monthly, cancel with 30 days' notice", researchers: "1 named researcher (+ backup)",
      includes: ["Review of every PR touching value flows", "Invariant suite maintenance", "Dependency and upgrade monitoring", "Priority incident response", "Quarterly threat model refresh"],
      deliverables: ["PR review comments", "Monthly security summary", "Updated invariant suite"],
      cta: "Start a retainer"
    },
    {
      id: "enterprise", name: "Enterprise / large protocol", from: null, unit: "",
      tagline: "Multi-repo, multi-chain systems, phased delivery and long-running programmes.",
      loc: "8,000+ LoC or multi-repo", timeline: "Phased, scoped jointly", researchers: "Dedicated team + partner specialists",
      includes: ["Programme-level threat model", "Phased audits aligned to release plan", "Formal verification of core maths where warranted", "Monitoring and incident runbooks", "Board- and investor-facing security reporting"],
      deliverables: ["Per-phase reports", "Security programme document", "Retained response"],
      cta: "Talk to us"
    }
  ],
  comparison: {
    rows: ["Written threat model", "Manual review", "PoC for C/H findings", "Invariant suite", "Economic / MEV analysis", "Remediation verification", "Walkthrough call", "Monitoring guidance"],
    cells: {
      predeploy: ["–", "1 researcher", "Yes", "–", "–", "1 round", "Optional", "–"],
      standard: ["Yes", "2 independent", "Yes", "Targeted fuzzing", "–", "Yes", "Yes", "–"],
      defi: ["Yes", "2–3 researchers", "Yes", "Yes", "Yes", "Yes", "Yes", "Recommended"],
      bridge: ["Cross-chain", "2–3 + partners", "Yes", "Yes", "Yes", "Yes", "Yes", "Yes"],
      invariants: ["Property catalogue", "–", "–", "Yes (deliverable)", "–", "–", "Yes", "–"],
      incident: ["–", "Forensic", "Reconstruction", "–", "–", "Fix review", "Yes", "Yes"],
      retainer: ["Quarterly", "Per PR", "As needed", "Maintained", "As needed", "Continuous", "Monthly", "Yes"],
      enterprise: ["Programme", "Team", "Yes", "Yes", "Yes", "Yes", "Yes", "Yes"]
    }
  }
};
