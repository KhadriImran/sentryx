/* ==========================================================================
   SENTRYX — security glossary
   Each entry: { term, aka, def, see: [slug|url], tags }
   `see` entries starting with "blog/" or "tools/" become internal links.
   Add terms here; glossary.html renders and indexes them automatically.
   ========================================================================== */
window.SENTRYX_GLOSSARY = [
{ term: "Access control", tags: ["Core"],
  def: "The rules deciding which addresses may call which functions. Failures — a missing modifier, a callable initializer, a role granted to the wrong address — are the simplest bug class to describe and among the most expensive in practice, because one unguarded setter is enough.",
  see: ["blog/access-control-failures.html", "tools/access-control-matrix.html"] },

{ term: "AMM", aka: "Automated market maker", tags: ["DeFi"],
  def: "A contract that quotes a price from its own token reserves rather than an order book. Because the quote is a function of inventory, and inventory can be changed by anyone with capital, an AMM's instantaneous price is not a price — it is a position that can be moved inside a single transaction.",
  see: ["blog/oracle-manipulation-attacks.html"] },

{ term: "Beacon proxy", tags: ["Upgrades"],
  def: "A proxy pattern where many proxies read their implementation address from one shared beacon contract, so a single upgrade transaction moves every proxy at once. Efficient, and a correspondingly large blast radius if the beacon's owner is compromised.",
  see: ["tools/proxy-detector.html", "blog/upgradeable-proxy-security.html"] },

{ term: "Checks-effects-interactions", tags: ["Core"],
  def: "The ordering discipline that prevents reentrancy: validate inputs, update your own state, and only then call out to another contract. Reversing the last two steps is the shape behind the majority of reentrancy findings.",
  see: ["blog/reentrancy-attacks-explained.html"] },

{ term: "Cold and warm access", aka: "EIP-2929", tags: ["Gas"],
  def: "The first read of a storage slot or account in a transaction costs 2,100 gas (cold); subsequent reads of the same slot cost 100 (warm). This is why caching a storage variable before a loop is a real saving rather than a micro-optimisation.",
  see: ["tools/gas-optimization-analyzer.html"] },

{ term: "Commit-reveal", tags: ["MEV"],
  def: "A two-phase scheme where a participant first publishes a hash of their input and later reveals the input itself, so that ordering cannot be exploited. It only works if the commitment is salted (otherwise it is brute-forceable), bound to the sender, and backed by a penalty for committing and never revealing.",
  see: ["blog/mev-and-front-running-defi.html"] },

{ term: "Cross-function reentrancy", tags: ["Core"],
  def: "Reentrancy where the attacker re-enters a different function that reads the same state, rather than the one that made the external call. A reentrancy guard on only the calling function does nothing, which is why guards must cover the whole set of functions sharing mutable state.",
  see: ["blog/reentrancy-attacks-explained.html"] },

{ term: "Custom error", tags: ["Gas", "Solidity"],
  def: "A named error type replacing a revert string. It carries a 4-byte selector plus optional structured arguments instead of storing text in the runtime bytecode, which is both cheaper to deploy and more useful to callers than a string they have to parse.",
  see: ["tools/gas-optimization-analyzer.html"] },

{ term: "Delegatecall", tags: ["Core", "Upgrades"],
  def: "An EVM call that executes another contract's code against the caller's own storage, balance and address. It is the mechanism every proxy depends on, and — if the target can be influenced by an attacker — a way to rewrite any storage slot, including the owner.",
  see: ["blog/upgradeable-proxy-security.html"] },

{ term: "Diamond", aka: "EIP-2535", tags: ["Upgrades"],
  def: "A proxy pattern routing function selectors to multiple implementation contracts called facets. Powerful for contracts that exceed the 24KB size limit, and the hardest pattern to review: the real attack surface is the union of every facet plus the routing table itself.",
  see: ["tools/proxy-detector.html"] },

{ term: "Donation attack", tags: ["DeFi", "Accounting"],
  def: "Sending tokens directly to a contract — bypassing its deposit function — to change a value it derives from its own balance. Used to inflate a vault's share price so a later depositor's shares round down to zero.",
  see: ["blog/erc4626-inflation-and-rounding.html"] },

{ term: "EIP-1167", aka: "Minimal proxy, clone", tags: ["Upgrades"],
  def: "A 45-byte proxy that delegates every call to one hard-coded implementation. Not upgradeable — the target is baked into the runtime bytecode — which makes clones cheap to deploy and simple to reason about.",
  see: ["tools/proxy-detector.html"] },

{ term: "EIP-1967", tags: ["Upgrades"],
  def: "The standard that fixes which storage slots a proxy uses for its implementation, admin and beacon addresses. The slots are hashes minus one, so they cannot collide with variables the implementation declares — which is what lets any tool inspect any proxy without an ABI.",
  see: ["tools/proxy-detector.html", "blog/upgradeable-proxy-security.html"] },

{ term: "EIP-55 checksum", tags: ["Reference"],
  def: "The mixed-case encoding of an Ethereum address, where capitalisation is derived from the hash of the lowercase form. It costs nothing and catches most typos and tampering, which is why wallets warn on a mismatch.",
  see: ["tools/web3-unit-converter.html"] },

{ term: "ERC-4626", tags: ["DeFi", "Accounting"],
  def: "The tokenised vault standard: deposit an asset, receive shares representing a proportional claim. Its security depends almost entirely on rounding direction and on protecting the first deposit, because both determine whether shares can be made to represent more or less than they should.",
  see: ["blog/erc4626-inflation-and-rounding.html"] },

{ term: "Fee-on-transfer token", tags: ["Tokens"],
  def: "A token that delivers less than the amount requested because it takes a cut on transfer. Any contract that credits the requested amount rather than the amount actually received over-credits the sender, quietly diluting everyone else.",
  see: ["blog/erc4626-inflation-and-rounding.html"] },

{ term: "First-depositor attack", aka: "Inflation attack", tags: ["DeFi", "Accounting"],
  def: "Depositing a single wei into an empty vault to receive one share, donating a large amount directly to inflate the share price, then letting the next depositor's shares round to zero. Cheap, front-runnable, and prevented by virtual shares or a dead-share mint.",
  see: ["blog/erc4626-inflation-and-rounding.html"] },

{ term: "Flash loan", tags: ["DeFi"],
  def: "An uncollateralised loan that must be repaid within the same transaction. Not a vulnerability in itself — it is a capital-requirement remover, turning attacks that used to need a whale's balance sheet into attacks that need a gas fee.",
  see: ["blog/oracle-manipulation-attacks.html"] },

{ term: "Formal verification", tags: ["Testing"],
  def: "Proving mathematically that code satisfies a written specification for all inputs, rather than testing it on some. Expensive and worth it for core arithmetic and access rules; it proves what you specified, so a wrong specification yields a confident wrong proof.",
  see: ["services/invariant-fuzz-testing.html"] },

{ term: "Front-running", tags: ["MEV"],
  def: "Observing a pending transaction and submitting your own to execute first. Possible because the mempool is public and block builders order transactions by their own revenue, which makes ordering an attacker-controlled input to your protocol.",
  see: ["blog/mev-and-front-running-defi.html"] },

{ term: "Fuzzing", tags: ["Testing"],
  def: "Generating large volumes of random inputs and call sequences to search for a state that violates a property. Where a unit test encodes what you expected, a fuzzer attacks what you require — which is why it finds compositions you never thought to write a test for.",
  see: ["services/invariant-fuzz-testing.html", "tools/ai-deep-scan.html"] },

{ term: "Griefing", tags: ["Core"],
  def: "An attack whose goal is to make a protocol malfunction rather than to profit. A liquidation path that can be made to revert, or a loop that can be made to exceed the block gas limit, turns a solvent protocol insolvent with no gain to the attacker beyond the damage.",
  see: ["blog/mev-and-front-running-defi.html"] },

{ term: "Immutable", tags: ["Gas", "Solidity"],
  def: "A variable assigned once in the constructor and then inlined into the runtime bytecode. Reads cost no storage access at all, which usually makes converting constructor-set variables to immutable the single largest gas saving available in a contract.",
  see: ["tools/gas-optimization-analyzer.html"] },

{ term: "Invariant", tags: ["Testing"],
  def: "A property that must hold after any sequence of actions — total collateral always covers total debt, share price never falls outside a realised loss, value is never created. Invariants are the artefact worth keeping from a security engagement, because they keep testing every future commit.",
  see: ["services/invariant-fuzz-testing.html"] },

{ term: "Initializer", tags: ["Upgrades"],
  def: "The function that replaces a constructor in an upgradeable contract, because constructors do not run in the proxy's storage context. It must be guarded so it runs once, and the implementation contract itself must be left uninitialisable — otherwise it can be hijacked directly.",
  see: ["blog/upgradeable-proxy-security.html"] },

{ term: "Liquidation", tags: ["DeFi"],
  def: "Closing an undercollateralised position to keep a lending market solvent. Two questions decide whether the design is safe: can a liquidation be blocked or forced by someone other than the protocol, and does the incentive go to the protocol or to a gas auction?",
  see: ["services/defi-protocol-audit.html"] },

{ term: "MEV", aka: "Maximal extractable value", tags: ["MEV"],
  def: "Value a block builder or searcher can extract by choosing the order, inclusion or exclusion of transactions. It is a property of a public permissionless mempool, not a bug — the question a review answers is how much of your users' value your design leaks by default.",
  see: ["blog/mev-and-front-running-defi.html"] },

{ term: "Oracle manipulation", tags: ["DeFi", "Oracles"],
  def: "Moving the value a protocol reads as a price, then exploiting whatever the protocol does with it. The defining property of this class is that no line of code is wrong — the protocol is defeated by believing a number an attacker chose.",
  see: ["blog/oracle-manipulation-attacks.html"] },

{ term: "Proof of concept", aka: "PoC", tags: ["Process"],
  def: "A runnable test that demonstrates a finding, usually against a mainnet fork, with the attacker's profit or the protocol's loss measured in an assertion. It is what keeps severity honest: a finding that cannot be demonstrated gets downgraded.",
  see: ["process.html", "tools/sample-audit-report.html"] },

{ term: "Read-only reentrancy", tags: ["Core"],
  def: "Reentrancy where nothing is written. A view function — a share price, an exchange rate — is queried during a callback while the contract sits in an intermediate state, returning a value that is simply wrong. The victim is usually a different protocol that integrated with it.",
  see: ["blog/reentrancy-attacks-explained.html"] },

{ term: "Reentrancy", tags: ["Core"],
  def: "A contract hands control to code it does not own while its own state still describes a world that is about to change, and that code calls back in. Every external call is a yield; the bug is in the ordering, not in the call.",
  see: ["blog/reentrancy-attacks-explained.html"] },

{ term: "Reentrancy guard", aka: "nonReentrant", tags: ["Core"],
  def: "A mutex that reverts if a guarded function is re-entered. Defence in depth, not the fix — correct ordering is the fix, and a guard applied to only one of several functions sharing state gives false confidence.",
  see: ["blog/reentrancy-attacks-explained.html"] },

{ term: "Rounding direction", tags: ["Accounting"],
  def: "Which way integer division truncates on each conversion. Every share calculation must round in the protocol's favour; getting one of the four ERC-4626 entry points backwards leaks a fraction of a unit per call, which becomes real money when an attacker can loop it cheaply.",
  see: ["blog/erc4626-inflation-and-rounding.html"] },

{ term: "Sandwich attack", tags: ["MEV"],
  def: "Buying immediately before a victim's swap to push the price against them, then selling immediately after. Prevented not by secrecy but by a real minimum-output parameter and a caller-supplied deadline.",
  see: ["blog/mev-and-front-running-defi.html"] },

{ term: "Severity", tags: ["Process"],
  def: "Impact multiplied by likelihood, applied consistently and written down. Not a measure of how clever or novel a bug is — a well-known flaw that drains a vault outranks an elegant one that requires conditions nobody will ever create.",
  see: ["tools/severity-explorer.html"] },

{ term: "Slippage protection", tags: ["MEV", "DeFi"],
  def: "A minimum acceptable output on a trade. Passing zero authorises unlimited loss; passing block.timestamp as a deadline authorises unlimited delay. Protocols that perform internal swaps with neither are donating value to searchers on every operation.",
  see: ["blog/mev-and-front-running-defi.html"] },

{ term: "Storage collision", tags: ["Upgrades"],
  def: "Two variables occupying the same storage slot across versions of an upgradeable contract, so the new code reads bytes written by the old. There is no revert and no warning — the values are simply wrong from the upgrade transaction onward.",
  see: ["tools/storage-layout-visualizer.html", "blog/upgradeable-proxy-security.html"] },

{ term: "Storage gap", aka: "__gap", tags: ["Upgrades"],
  def: "Reserved empty slots at the end of an upgradeable base contract so children can grow without colliding. When you add N slots of state above it, the gap must shrink by exactly N.",
  see: ["tools/storage-layout-visualizer.html"] },

{ term: "Storage packing", tags: ["Gas", "Solidity"],
  def: "Solidity fitting multiple small state variables into one 32-byte slot when they are declared adjacently. An address (20 bytes) plus a uint96 fills a slot exactly; the same two variables separated by a uint256 waste 12 bytes and an extra slot.",
  see: ["tools/storage-layout-visualizer.html"] },

{ term: "Threat model", tags: ["Process"],
  def: "The written statement of who the actors are, what privileges they hold, which contracts are trusted, what external dependencies exist and what assets are at risk. Almost every serious audit finding is a gap between this document and the code.",
  see: ["process.html"] },

{ term: "Timelock", tags: ["Governance", "Upgrades"],
  def: "A mandatory delay between queuing a privileged action and executing it, so users can exit if they disagree. An upgrade path with no timelock makes user funds custodial in practice, whatever the documentation says.",
  see: ["blog/access-control-failures.html"] },

{ term: "TWAP", aka: "Time-weighted average price", tags: ["Oracles"],
  def: "A price averaged over a window, which makes manipulation cost proportional to duration and therefore impossible inside one transaction. Its safety depends on the window length and the depth of the specific pool it reads — a short TWAP over thin liquidity protects nothing.",
  see: ["blog/oracle-manipulation-attacks.html"] },

{ term: "tx.origin", tags: ["Core"],
  def: "The externally-owned account that started the transaction, as opposed to msg.sender which is the immediate caller. Using it for authorisation means any contract a privileged user is tricked into calling can act with their authority.",
  see: ["blog/access-control-failures.html"] },

{ term: "Unchecked block", tags: ["Solidity", "Gas"],
  def: "A block where Solidity 0.8's automatic overflow and underflow checks are disabled. Each one is a claim that the developer knows a bound the compiler cannot see, and that claim needs a comment and a fuzz test behind it.",
  see: ["tools/gas-optimization-analyzer.html"] },

{ term: "UUPS", aka: "EIP-1822 successor", tags: ["Upgrades"],
  def: "A proxy pattern where the upgrade function lives in the implementation rather than the proxy, making the proxy small and cheap. Its failure modes are severe: an implementation that omits _authorizeUpgrade freezes the proxy permanently, and an implementation left initialisable can be hijacked directly.",
  see: ["blog/upgradeable-proxy-security.html", "tools/proxy-detector.html"] },

{ term: "Yul", aka: "Inline assembly", tags: ["Solidity"],
  def: "The low-level intermediate language usable inside Solidity via assembly blocks. It bypasses the compiler's memory safety, bounds checks and type system, so every block is unreviewed-by-the-compiler code that a human has to verify instead.",
  see: ["services/smart-contract-security-audit.html"] }
];
