/* ==========================================================================
   SENTRYX — research index
   Add an entry per article. The first entry renders as the feature card.
   `url` is relative to blog/index.html.
   ========================================================================== */
window.SENTRYX_POSTS = [
  { slug: "reentrancy-attacks-explained", url: "reentrancy-attacks-explained.html",
    title: "Reentrancy attacks explained: every variant, and why guards aren't enough",
    excerpt: "Single-function, cross-function, cross-contract and read-only reentrancy — with the code that breaks, the code that fixes it, and the cases where a nonReentrant modifier gives you false confidence.",
    date: "2026-02-04", readingTime: 12, tags: ["Vulnerability classes", "Solidity", "DeFi"] },
  { slug: "oracle-manipulation-attacks", url: "oracle-manipulation-attacks.html",
    title: "Oracle manipulation: how a flash loan turns a price feed into an exploit",
    excerpt: "Why spot prices from AMM reserves are not prices, what TWAP actually protects against, and the Chainlink integration checks that most teams skip.",
    date: "2026-02-11", readingTime: 13, tags: ["Vulnerability classes", "DeFi", "Oracles"] },
  { slug: "access-control-failures", url: "access-control-failures.html",
    title: "Access control failures: the simplest bug class, and the most expensive",
    excerpt: "Missing modifiers, callable initializers, tx.origin authentication and admin keys that can do more than anyone realised. Plus how to design roles that survive an upgrade.",
    date: "2026-02-18", readingTime: 11, tags: ["Vulnerability classes", "Solidity", "Access control"] },
  { slug: "erc4626-inflation-and-rounding", url: "erc4626-inflation-and-rounding.html",
    title: "Share price inflation and rounding: how vaults leak value one wei at a time",
    excerpt: "The first-depositor attack, donation attacks, rounding direction, and why 'it's only a wei' stops being true when an attacker can repeat it a million times.",
    date: "2026-02-25", readingTime: 12, tags: ["Vulnerability classes", "DeFi", "Accounting"] },
  { slug: "mev-and-front-running-defi", url: "mev-and-front-running-defi.html",
    title: "MEV and front-running: when correct code still loses users money",
    excerpt: "Sandwich attacks, liquidation races, weak commit-reveal and the protocol design decisions that decide how much value leaks to searchers before a user's transaction lands.",
    date: "2026-03-04", readingTime: 12, tags: ["Vulnerability classes", "DeFi", "MEV"] },
  { slug: "upgradeable-proxy-security", url: "upgradeable-proxy-security.html",
    title: "Upgradeable contracts: storage collisions, uninitialised proxies and admin risk",
    excerpt: "Transparent, UUPS and diamond patterns compared by failure mode — storage layout rules, initializer safety, and why your upgrade path is part of your attack surface.",
    date: "2026-03-11", readingTime: 13, tags: ["Vulnerability classes", "Solidity", "Upgrades"] }
];
