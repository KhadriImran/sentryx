/* ==========================================================================
   SENTRYX — site-wide settings
   Brand name, parent line, contact routes and social handles live here.
   Markup references these via data attributes where dynamic, but the brand
   name also appears in static HTML (<title>, headings, JSON-LD) — search and
   replace "SENTRYX" across the folder if you rename.
   ========================================================================== */
window.SENTRYX_SITE = {
  name: "SENTRYX",
  parent: "A brand of Avanteia Private Limited",
  domain: "https://sentryx.example",            // <- set to the live domain (used for canonicals / OG in markup too)
  email: "audits@sentryx.example",              // <- placeholder
  bookingUrl: "contact.html",
  social: {
    github: "https://github.com/PLACEHOLDER-sentryx",
    x: "https://x.com/PLACEHOLDER-sentryx",
    linkedin: "https://www.linkedin.com/company/PLACEHOLDER"
  },
  chains: ["Ethereum", "Arbitrum", "Optimism", "Base", "Polygon", "BNB Chain", "Avalanche", "zkSync", "Scroll", "Linea", "Solana", "Aptos", "Sui", "Starknet"],
  tooling: ["Foundry", "Hardhat", "Slither", "Echidna", "Medusa", "Certora", "Halmos", "Tenderly", "Aderyn", "Semgrep", "Mythril", "Wake"]
};
