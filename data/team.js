/* ==========================================================================
   SENTRYX — researchers
   Rendered on team.html. Replace PLACEHOLDER handles and add `photo` paths
   (e.g. "assets/team/imran.jpg") when available. `contests` is an array of
   { platform, handle, url } — leave empty until real handles exist; nothing
   is invented here.
   ========================================================================== */
window.SENTRYX_TEAM = [
  {
    id: "imran-khadri",
    name: "Imran Khadri",
    role: "Founder · Lead Security Researcher",
    initials: "IK",
    photo: null,
    bio: "Imran is a smart contract security researcher and the founder of SENTRYX. He works on EVM and DeFi systems: manual adversarial review, threat modelling and exploit reproduction, alongside independent web3 bug-bounty research. He also builds the firm's AI-assisted audit tooling and leads scoping and the manual review on every engagement. He is a founder of Avanteia Private Limited, the Goa-based technology company that SENTRYX operates under.",
    specialisations: ["Solidity / EVM", "DeFi protocol review", "Threat modelling", "Bug bounty research", "AI-assisted audit tooling"],
    focus: ["Reentrancy and cross-contract state", "Oracle and price manipulation", "Access control and upgrade safety", "Exploit PoC engineering (Foundry)"],
    links: { github: "https://github.com/PLACEHOLDER-imran", x: "https://x.com/PLACEHOLDER-imran", linkedin: "https://www.linkedin.com/in/PLACEHOLDER-imran" },
    contests: [] // e.g. { platform: "Code4rena", handle: "PLACEHOLDER", url: "https://code4rena.com/@PLACEHOLDER" }
  },
  {
    id: "jagruti",
    name: "Jagruti",
    role: "Co-founder · Security Researcher",
    initials: "J",
    photo: null,
    bio: "Jagruti is a smart contract security researcher and co-founder of SENTRYX. She is the second, independent reviewer on every engagement: a full read of the in-scope code, tooling and static-analysis triage, invariant-suite development and the remediation verification pass that turns a findings list into a publishable final report.",
    specialisations: ["Solidity / EVM", "Invariant and fuzz testing", "Static analysis triage", "Remediation verification"],
    focus: ["Property-based testing (Foundry, Echidna, Medusa)", "Accounting and share-maths invariants", "Token behaviour edge cases", "Report quality and reproducibility"],
    links: { github: "https://github.com/PLACEHOLDER-jagruti", x: "https://x.com/PLACEHOLDER-jagruti", linkedin: "https://www.linkedin.com/in/PLACEHOLDER-jagruti" },
    contests: []
  }
];
