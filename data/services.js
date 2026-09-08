/* ==========================================================================
   SENTRYX — service catalogue
   Rendered on services.html (grouped + filterable) and referenced by the
   quote estimator. `delivery`: "inhouse" = core in-house strength,
   "partner" = delivered with vetted partner researchers. Keep this honest.
   `flagship` links to the six detail pages.
   ========================================================================== */
window.SENTRYX_SERVICES = {
  groups: [
    { id: "core", label: "Core Audits" },
    { id: "chain", label: "Chain & Language Specialisations" },
    { id: "protocol", label: "Protocol Categories" },
    { id: "testing", label: "Testing & Verification" },
    { id: "adjacent", label: "Adjacent Security" },
    { id: "offensive", label: "Offensive & Response" },
    { id: "advisory", label: "Advisory & Retainers" }
  ],
  items: [
    // Core Audits
    { group: "core", name: "Smart contract security audit", delivery: "inhouse", flagship: "services/smart-contract-security-audit.html", desc: "Manual line-by-line review against a written threat model, backed by static analysis and fuzzing. Findings with severity, PoC and remediation guidance." },
    { group: "core", name: "Protocol & architecture security review", delivery: "inhouse", desc: "System-level review of contracts, off-chain components, keepers and upgrade paths before code is final. Finds design flaws that no per-function audit catches." },
    { group: "core", name: "Re-audit & remediation verification", delivery: "inhouse", desc: "Every changed line re-reviewed, PoCs re-run, invariants re-executed. Each finding marked Fixed, Acknowledged or Open in a publishable final report." },
    { group: "core", name: "Pre-deployment security assessment", delivery: "inhouse", desc: "Time-boxed review of a small contract set immediately before mainnet: access control, external calls, arithmetic, initialisation and deployment scripts." },
    { group: "core", name: "Private / solo audit engagements", delivery: "inhouse", desc: "A single dedicated reviewer embedded with your team for confidential review of unreleased code, under NDA, with direct Slack or Telegram access." },
    { group: "core", name: "Second-opinion audits", delivery: "inhouse", desc: "Independent review after another firm's audit. Focused on the classes the first report did not cover and on verifying that reported fixes are real." },

    // Chain & Language Specialisations
    { group: "chain", name: "Solidity / EVM audits", delivery: "inhouse", desc: "Ethereum mainnet and every EVM L2. Solidity 0.4 through 0.8+, OpenZeppelin and Solady patterns, assembly hot paths." },
    { group: "chain", name: "Vyper audits", delivery: "inhouse", desc: "Vyper contracts including the compiler-version pitfalls behind the 2023 reentrancy-lock incidents. Reviewed with Vyper-specific tooling." },
    { group: "chain", name: "Rust audits (Solana)", delivery: "partner", desc: "Anchor and native Solana programs: account validation, signer checks, PDA derivation, CPI safety and arithmetic. Delivered with vetted Rust researchers." },
    { group: "chain", name: "Move audits (Aptos & Sui)", delivery: "partner", desc: "Move modules and resource semantics, object ownership on Sui, capability patterns and formal Move Prover specs where available." },
    { group: "chain", name: "Cairo audits (Starknet)", delivery: "partner", desc: "Cairo 1 contracts, felt arithmetic edge cases, L1↔L2 messaging and account abstraction flows on Starknet." },
    { group: "chain", name: "Layer 2 & rollup contract review", delivery: "inhouse", desc: "Bridges, sequencer-facing contracts, fee models and the L1 escape hatches of OP-stack, Arbitrum and zk rollups." },
    { group: "chain", name: "Upgradeable proxy pattern review", delivery: "inhouse", desc: "Transparent, UUPS, beacon and diamond patterns: storage layout, initialiser safety, selector clashes and admin key exposure." },
    { group: "chain", name: "Assembly / Yul review", delivery: "inhouse", desc: "Inline assembly and pure Yul: memory safety, free-pointer discipline, calldata decoding and the optimisations that silently break invariants." },

    // Protocol Categories
    { group: "protocol", name: "DeFi audits (AMM, lending, staking, yield, perps, vaults)", delivery: "inhouse", flagship: "services/defi-protocol-audit.html", desc: "Economic and code-level review of value flows, oracles, liquidations, fee accounting and share maths under adversarial market conditions." },
    { group: "protocol", name: "NFT & marketplace audits", delivery: "inhouse", desc: "Minting logic, royalty enforcement, signature-based listings, reentrancy through receiver hooks, and metadata / reveal integrity." },
    { group: "protocol", name: "Token & tokenomics contract audits", delivery: "inhouse", desc: "ERC-20/721/1155 implementations, fee-on-transfer and rebasing behaviour, permit signatures, supply caps and privileged mint paths." },
    { group: "protocol", name: "DAO & governance audits", delivery: "inhouse", desc: "Proposal lifecycle, voting power snapshots, flash-loan vote manipulation, timelock bypasses and executor privilege." },
    { group: "protocol", name: "Bridge & cross-chain audits", delivery: "inhouse", flagship: "services/bridge-cross-chain-audit.html", desc: "Message verification, relayer trust, replay protection, finality assumptions and failure modes across every chain in the path." },
    { group: "protocol", name: "Stablecoin mechanism review", delivery: "inhouse", desc: "Collateral accounting, peg maintenance, redemption paths, oracle dependence and the liquidation spiral scenarios that break pegs." },
    { group: "protocol", name: "RWA tokenisation audits", delivery: "inhouse", desc: "Permissioned transfer logic, whitelist enforcement, off-chain attestation trust and redemption flows for tokenised real-world assets." },
    { group: "protocol", name: "Restaking & LST / LRT audits", delivery: "inhouse", desc: "Withdrawal queues, slashing accounting, exchange-rate manipulation, operator trust and the rounding paths of share-based vaults." },
    { group: "protocol", name: "Prediction market audits", delivery: "inhouse", desc: "Resolution and oracle disputes, market creation griefing, payout maths and MEV around resolution events." },
    { group: "protocol", name: "GameFi contract audits", delivery: "inhouse", desc: "Randomness sources, item minting, marketplace integration, economy sinks and the exploits that come from off-chain signed game state." },
    { group: "protocol", name: "Launchpad & vesting contract audits", delivery: "inhouse", desc: "Cliff and linear vesting maths, claim double-spend, allocation caps, refund paths and admin revocation semantics." },

    // Testing & Verification
    { group: "testing", name: "Invariant testing suite development", delivery: "inhouse", flagship: "services/invariant-fuzz-testing.html", desc: "We write the properties your protocol must always hold and build a Foundry invariant suite with handlers that reach deep state." },
    { group: "testing", name: "Fuzz testing (Echidna, Medusa)", delivery: "inhouse", desc: "Property-based fuzzing campaigns with corpus reuse, coverage-guided handlers and CI integration." },
    { group: "testing", name: "Formal verification (Certora, Halmos)", delivery: "partner", desc: "Specifications for core maths and access rules, proven with Certora CVL or Halmos symbolic tests. Delivered with vetted FV specialists." },
    { group: "testing", name: "Symbolic execution", delivery: "inhouse", desc: "Halmos and hevm symbolic runs on arithmetic-heavy functions to find inputs unit tests never generate." },
    { group: "testing", name: "Differential testing", delivery: "inhouse", desc: "Reference implementations in another language or library compared against your contracts across generated inputs." },
    { group: "testing", name: "Test coverage engineering", delivery: "inhouse", desc: "Coverage analysis, branch-level gap closure and test refactoring so that audits start from a trustworthy baseline." },
    { group: "testing", name: "CI/CD security pipeline setup", delivery: "inhouse", desc: "Slither, Aderyn, Semgrep, invariant and fuzz runs wired into GitHub Actions with severity gates and artefact retention." },

    // Adjacent Security
    { group: "adjacent", name: "dApp & frontend security review", delivery: "partner", desc: "Wallet connection flows, transaction construction, signature prompts, dependency risk and the DNS / hosting attacks behind frontend drains." },
    { group: "adjacent", name: "Wallet integration security assessment", delivery: "inhouse", desc: "Permit and approval flows, EIP-712 typed data, account abstraction paymasters and the phishing surface your UX creates." },
    { group: "adjacent", name: "Oracle integration & price manipulation review", delivery: "inhouse", desc: "Feed selection, staleness and deviation checks, TWAP windows, L2 sequencer uptime, and flash-loan resistance." },
    { group: "adjacent", name: "MEV & economic attack analysis", delivery: "inhouse", desc: "Sandwich, back-run and liquidation MEV exposure, plus economic attacks that are profitable at scale even when the code is correct." },
    { group: "adjacent", name: "Gas optimisation review", delivery: "inhouse", desc: "Storage layout, calldata usage, loop structure and custom errors, with every optimisation checked for behavioural change." },
    { group: "adjacent", name: "Access control & key management review", delivery: "inhouse", desc: "Role design, two-step ownership, multisig thresholds, signer hygiene and emergency-pause authority." },
    { group: "adjacent", name: "Upgrade & migration safety review", delivery: "inhouse", desc: "Storage compatibility, initialiser re-runs, migration scripts and rollback plans reviewed before the upgrade transaction is signed." },
    { group: "adjacent", name: "Multisig & treasury security review", delivery: "inhouse", desc: "Safe configuration, module and guard risk, signer distribution and the operational procedures around large transfers." },
    { group: "adjacent", name: "Supply chain / dependency review", delivery: "inhouse", desc: "Pinned library versions, known-vulnerable dependencies, build reproducibility and compiler-version exposure." },

    // Offensive & Response
    { group: "offensive", name: "Incident response & post-exploit forensics", delivery: "inhouse", flagship: "services/incident-response.html", desc: "Live triage, root-cause analysis, fund tracing and a defensible post-mortem when something has already gone wrong." },
    { group: "offensive", name: "On-chain threat monitoring setup", delivery: "inhouse", desc: "Alerting on privileged calls, large withdrawals, oracle deviation and invariant breaches, wired to your response runbook." },
    { group: "offensive", name: "War-game / red-team exercises", delivery: "partner", desc: "Scenario-driven exercises that test your team's detection and response — key compromise, oracle failure, governance attack." },
    { group: "offensive", name: "Bug bounty program design & triage", delivery: "inhouse", desc: "Scope, severity matrix, payout bands and a triage process that pays fairly and closes reports fast." },
    { group: "offensive", name: "White-hat recovery advisory", delivery: "inhouse", desc: "Negotiation support, safe-harbour terms and technical coordination when funds can still be recovered." },

    // Advisory & Retainers
    { group: "advisory", name: "Continuous security retainer", delivery: "inhouse", flagship: "services/continuous-security-retainer.html", desc: "A dedicated reviewer on every value-touching pull request, maintaining your invariant suite and on call for incidents." },
    { group: "advisory", name: "Continuous auditing for fast-shipping teams", delivery: "inhouse", desc: "Weekly review cadence aligned to your sprints so audits stop being a launch gate." },
    { group: "advisory", name: "Security roadmap & threat modelling", delivery: "inhouse", desc: "A written threat model and a prioritised roadmap: what to test, monitor, insure and re-audit, and when." },
    { group: "advisory", name: "Secure development training for protocol teams", delivery: "inhouse", desc: "Hands-on workshops built from real exploit classes — reentrancy, oracle manipulation, access control, upgrade safety — using your own codebase." },
    { group: "advisory", name: "VC & investor technical due diligence", delivery: "inhouse", desc: "Independent assessment of a target's code quality, audit history, key management and unreviewed attack surface before a cheque is written." },
    { group: "advisory", name: "Tokenomics & economic security consulting", delivery: "partner", desc: "Incentive design, emission schedules and attack-cost modelling, delivered with economic-security partners." },
    { group: "advisory", name: "Pre-launch security readiness review", delivery: "inhouse", desc: "A checklist-driven review of audits, tests, monitoring, keys, incident plan and disclosures in the two weeks before launch." },
    { group: "advisory", name: "Compliance & security documentation", delivery: "inhouse", desc: "Security posture documents, audit summaries and control descriptions for exchanges, partners and institutional counterparties." }
  ]
};
