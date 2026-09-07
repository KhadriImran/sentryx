/* ==========================================================================
   SENTRYX — severity classification
   Used by the homepage severity band, the Severity Explorer tool, the report
   viewer and the pre-check tool. Edit definitions here, not in markup.
   Matrix: likelihood x impact, aligned with Immunefi / Code4rena conventions.
   ========================================================================== */
window.SENTRYX_SEVERITY = {
  critical: {
    label: "Critical", code: "SEV-0",
    short: "Direct loss of user funds or protocol insolvency, exploitable by anyone with no special preconditions.",
    definition: "A flaw that lets an unprivileged attacker directly steal or permanently freeze user or protocol funds, mint unbacked value, or take control of the protocol — with no preconditions beyond what any address can do. Likelihood high, impact catastrophic.",
    examples: ["Reentrancy that drains a vault or pool", "Unrestricted mint / burn / withdraw function", "Oracle manipulation that mis-prices collateral and allows undercollateralised borrowing", "Bridge message replay or forged proof verification", "Initializer left callable on an upgradeable proxy"],
    remediation: ["Halt: pause affected functions before disclosure if a pause exists", "Apply checks-effects-interactions and a reentrancy guard at every external call path", "Enforce access control with explicit role checks and two-step ownership", "Use TWAP or multi-source oracles with staleness and deviation bounds", "Re-audit the fix; add an invariant test that would have caught it"]
  },
  high: {
    label: "High", code: "SEV-1",
    short: "Significant loss or protocol damage, but requires specific conditions, timing or a privileged path.",
    definition: "Loss of funds or severe protocol malfunction that is realistic but constrained — it needs specific market conditions, a race, a large capital outlay, or a semi-trusted actor to misbehave. Alternatively, a permanent griefing vector that blocks core functionality for everyone.",
    examples: ["Front-runnable approve/transfer patterns leading to loss for specific users", "Rounding direction that lets attackers extract value over many transactions", "Liquidation logic that can be forced or blocked under volatility", "Governance proposal execution without timelock", "Denial of service from an unbounded loop over user-controlled arrays"],
    remediation: ["Round in the protocol's favour and add minimum-share / dead-shares defences", "Bound loops and paginate; move iteration off-chain where possible", "Add timelocks and quorum thresholds to governance execution", "Introduce slippage and deadline parameters on user-facing calls", "Add fuzz tests that search for the extraction path"]
  },
  medium: {
    label: "Medium", code: "SEV-2",
    short: "Bounded loss, incorrect accounting or degraded function under realistic but uncommon conditions.",
    definition: "The protocol can end up in an incorrect state, leak a bounded amount of value, or behave contrary to specification under conditions that are plausible but not common. Users are affected, but the damage is limited or recoverable.",
    examples: ["Fee accounting drift under specific token decimals", "Missing slippage protection on an internal swap", "Stale oracle price accepted for longer than intended", "Event / state inconsistency that breaks off-chain indexers", "Fee-on-transfer or rebasing tokens mishandled in accounting"],
    remediation: ["Normalise decimals at the boundary and test with 6/8/18-decimal tokens", "Add staleness checks with per-feed heartbeats", "Document supported token behaviours and reject unsupported ones", "Extend unit tests to cover edge-case token classes"]
  },
  low: {
    label: "Low", code: "SEV-3",
    short: "Minor issues with limited impact; defence-in-depth, edge cases and code hygiene that affects safety.",
    definition: "A deviation from best practice or a narrow edge case whose exploitation yields little value or requires unlikely preconditions. Worth fixing because Low issues compound and become High in the next upgrade.",
    examples: ["Missing zero-address or bounds validation on admin setters", "Floating pragma or outdated compiler version", "Unused return values from external calls that cannot fail today", "Lack of two-step ownership transfer", "Missing events on privileged state changes"],
    remediation: ["Pin the compiler version", "Validate all constructor / setter inputs", "Emit events for every privileged action", "Adopt two-step ownership (Ownable2Step)"]
  },
  info: {
    label: "Informational", code: "SEV-4",
    short: "No security impact today. Readability, gas, documentation and design observations that reduce future risk.",
    definition: "Observations with no direct security impact: gas optimisations, naming, NatSpec, dead code, architectural notes and recommendations for maintainability. Included because clean code is auditable code.",
    examples: ["Gas: cache storage reads in loops, use custom errors", "NatSpec missing or inaccurate", "Magic numbers instead of named constants", "Redundant checks already enforced by the compiler", "Suggestions for clearer module boundaries"],
    remediation: ["Address at the team's discretion", "Track in the backlog and revisit before the next audit"]
  }
};
