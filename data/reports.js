/* ==========================================================================
   SENTRYX — public reports portfolio
   Rendered on reports.html (filterable by chain / severity / type).
   Add one object per PUBLISHED report. Do not add engagements you cannot
   link to. `illustrative: true` entries are shown with a visible label and
   are NOT counted anywhere as real work.
   Shape:
   { id, title, client, chain, type, date: "YYYY-MM-DD", severities: {critical,high,medium,low,info},
     summary, url (PDF/GitHub), repo (optional), tags: [..], illustrative: bool }
   ========================================================================== */
window.SENTRYX_REPORTS = [
  {
    id: "SNTX-EX-2026-001",
    title: "Aurora Vault — Smart Contract Security Audit (sample report)",
    client: "Aurora Vault (illustrative)",
    chain: "Ethereum",
    type: "DeFi",
    date: "2026-01-30",
    severities: { critical: 1, high: 2, medium: 2, low: 2, info: 1 },
    summary: "A constructed sample used to demonstrate the SENTRYX report format: threat model, findings with PoCs, and remediation verification. Not a client engagement.",
    url: "tools.html#report-viewer",
    repo: null,
    tags: ["ERC-4626", "Reentrancy", "Oracle", "Vault"],
    illustrative: true
  }
  // Real reports go here. Example (delete when adding real ones):
  // { id: "SNTX-2026-001", title: "Protocol X — Lending Market Audit", client: "Protocol X", chain: "Arbitrum", type: "DeFi", date: "2026-03-15",
  //   severities: { critical: 0, high: 1, medium: 3, low: 4, info: 6 }, summary: "...", url: "https://github.com/ORG/audits/blob/main/protocol-x.pdf", repo: "https://github.com/ORG/audits", tags: ["Lending", "Liquidations"], illustrative: false }
];
