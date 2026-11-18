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
    role: "Founder · Lead Auditor",
    initials: "IK",
    photo: null,
    bio: "Imran is a smart contract security researcher and the founder of SENTRYX. He works on EVM and DeFi systems: manual adversarial review, threat modelling and exploit reproduction, alongside independent web3 bug-bounty research. He also builds the firm's AI-assisted audit tooling and leads scoping and the manual review on every engagement. He is a founder of Avanteia Private Limited, the Goa-based technology company that SENTRYX operates under.",
    specialisations: ["Solidity / EVM", "DeFi protocol review", "Threat modelling", "Bug bounty research", "AI-assisted audit tooling"],
    focus: ["Reentrancy and cross-contract state", "Oracle and price manipulation", "Access control and upgrade safety", "Exploit PoC engineering (Foundry)"],
    links: { github: "https://github.com/KhadriImran", x: "https://x.com/ImranKhadri1904", linkedin: "https://www.linkedin.com/in/imran-khadri/" },
    contests: [] // e.g. { platform: "Code4rena", handle: "PLACEHOLDER", url: "https://code4rena.com/@PLACEHOLDER" }
  },
  {
    id: "jagruti",
    name: "Jagruti",
    role: "Co-founder · Security Auditor",
    initials: "J",
    photo: null,
    bio: "Jagruti is a co-founder of SENTRYX and the second auditor on every engagement. She does her own separate read of the in-scope code after Imran, so every report has two sets of eyes and two names on it. She also runs client relations: first contact, scheduling and follow-up.",
    specialisations: ["Solidity / EVM", "Second-read code review", "Client relations"],
    focus: ["Access control and state checks", "Fix re-checks", "Keeping engagements on schedule"],
    links: { github: "", x: "", linkedin: "" },
    contests: []
  }
];
