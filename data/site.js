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
  domain: "https://sentryxaudit.com",            // <- set to the live domain (used for canonicals / OG in markup too)
  email: "sentryxaudit@gmail.com",              // <- placeholder
  bookingUrl: "contact.html",
  social: {
    github: "https://github.com/KhadriImran",
    x: "https://x.com/sentryxaudit",
    linkedin: "https://www.linkedin.com/company/sentryxaudit"
  },
  chains: ["Ethereum", "Arbitrum", "Optimism", "Base", "Polygon", "BNB Chain", "Avalanche", "zkSync", "Scroll", "Linea", "Solana", "Aptos", "Sui", "Starknet"],
  tooling: ["Foundry", "Hardhat", "Slither", "Echidna", "Medusa", "Certora", "Halmos", "Tenderly", "Aderyn", "Semgrep", "Mythril", "Wake"]
};
