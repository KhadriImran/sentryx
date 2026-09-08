/* ==========================================================================
   SENTRYX — sample audit report (ILLUSTRATIVE)
   ---------------------------------------------------------------------------
   EVERYTHING IN THIS FILE IS A CONSTRUCTED TEACHING EXAMPLE. "Aurora Vault"
   is not a client; the code is written to demonstrate finding classes and the
   report format. The UI labels it "Illustrative example" wherever it appears.
   When you have a real, publishable report, add it to data/reports.js and
   point the viewer at it (see js/report-viewer.js — it reads any object with
   this shape).
   ========================================================================== */
window.SENTRYX_SAMPLE_REPORT = {
  illustrative: true,
  id: "SNTX-EX-2026-001",
  title: "Aurora Vault — Smart Contract Security Audit",
  client: "Aurora Vault (illustrative)",
  chain: "Ethereum (EVM)",
  type: "DeFi · ERC-4626 vault + strategy",
  scope: ["src/Vault.sol", "src/Strategy.sol", "src/PriceRouter.sol", "src/Admin.sol"],
  loc: 1184,
  commit: "0xdeadbeef (illustrative)",
  dates: { start: "2026-01-12", end: "2026-01-30", verified: "2026-02-06" },
  reviewers: "Two independent reviewers (names withheld in this illustrative example)",
  summary: "Aurora Vault is an ERC-4626-style vault that accepts a single ERC-20, deploys it into an external yield strategy and mints shares against the strategy's reported value. Our review found one Critical reentrancy in the withdrawal path, one High oracle dependency on a spot price, and a series of Medium and Low accounting and hygiene issues. All Critical and High findings were fixed and verified. The team also adopted the invariant suite delivered with this report.",
  threatModel: {
    actors: ["Owner (multisig) — can set strategy and fees", "Keeper — can call harvest()", "User — deposit / withdraw / redeem", "Strategy — external, trusted for accounting", "Price router — reads an AMM pool"],
    assets: ["Deposited tokens held by Vault and Strategy", "Share supply integrity (no unbacked mint)", "Fee accrual to treasury"],
    assumptions: ["The multisig is honest but may be slow", "The underlying token is a standard ERC-20 (no fee-on-transfer, no rebasing)", "The AMM pool is not manipulated within a block"]
  },
  findings: [
    {
      id: "C-01", severity: "critical", status: "fixed",
      title: "Reentrancy in Vault.withdraw() allows draining all deposits",
      location: "src/Vault.sol#L142-L156",
      description: "withdraw() computes the payout, transfers ETH to the caller with a low-level call, and only then burns the caller's shares and updates totalShares. A contract receiver can re-enter withdraw() from its receive() hook; because shares have not been burned, the balance check still passes and the payout is repeated until the vault is empty.",
      impact: "Total loss of vault assets by any address holding at least one share.",
      likelihood: "High — single transaction, no privileged access, no capital requirement beyond one share.",
      recommendation: "Apply checks-effects-interactions: burn shares and update totalShares before the external call. Add OpenZeppelin ReentrancyGuard (nonReentrant) on all state-changing user entry points as defence in depth. Add an invariant test asserting that vault balance never falls below the sum of redeemable shares.",
      vulnerable: "function withdraw(uint256 shares) external {\n    uint256 amount = shares * address(this).balance / totalShares;\n    require(balanceOf[msg.sender] >= shares, \"insufficient\");\n    (bool ok, ) = msg.sender.call{value: amount}(\"\");  // external call first\n    require(ok, \"transfer failed\");\n    balanceOf[msg.sender] -= shares;                    // state updated after\n    totalShares -= shares;\n}",
      fixed: "function withdraw(uint256 shares) external nonReentrant {\n    uint256 amount = shares * address(this).balance / totalShares;\n    require(balanceOf[msg.sender] >= shares, \"insufficient\");\n    balanceOf[msg.sender] -= shares;                    // effects first\n    totalShares -= shares;\n    (bool ok, ) = msg.sender.call{value: amount}(\"\");  // interaction last\n    require(ok, \"transfer failed\");\n}",
      poc: "// forge test --match-test test_C01_drain -vvv\ncontract Attacker {\n    Vault v; uint256 shares;\n    constructor(Vault _v) { v = _v; }\n    function attack() external payable {\n        v.deposit{value: msg.value}();\n        shares = v.balanceOf(address(this));\n        v.withdraw(shares);\n    }\n    receive() external payable {\n        if (address(v).balance >= msg.value) v.withdraw(shares); // re-enter\n    }\n}\n\nfunction test_C01_drain() public {\n    vm.deal(address(attacker), 1 ether);\n    vm.deal(address(vault), 100 ether);          // other users' deposits\n    attacker.attack{value: 1 ether}();\n    assertEq(address(vault).balance, 0);          // vault emptied in one tx\n    assertGt(address(attacker).balance, 100 ether);\n}",
      verification: "Re-reviewed commit b2c4e1 (illustrative). State updates precede the external call; nonReentrant applied to deposit, withdraw and redeem. PoC now reverts with ReentrancyGuardReentrantCall. Invariant vault_solvent holds over 50,000 runs."
    },
    {
      id: "H-01", severity: "high", status: "fixed",
      title: "Share price derived from spot AMM reserves is manipulable within a block",
      location: "src/PriceRouter.sol#L58-L71",
      description: "PriceRouter.getPrice() reads getReserves() from a single Uniswap V2 pool and returns reserve1/reserve0. Vault.totalAssets() uses this price to value the strategy position, so the share price — and therefore how many shares a deposit mints and how much a redemption pays — depends on a value an attacker can move with a flash loan inside the same transaction.",
      impact: "An attacker can inflate the reported asset value, redeem shares at an inflated price, and restore the pool, extracting value from remaining depositors. Loss is bounded by pool depth and flash-loan liquidity, not by the attacker's own capital.",
      likelihood: "High for pools with moderate liquidity; the attack is a standard, well-documented pattern.",
      recommendation: "Use a manipulation-resistant source: a Chainlink feed with staleness and deviation checks, or a TWAP over at least 30 minutes, and bound the accepted deviation between sources. Never value assets from spot reserves of a pool that can be borrowed against.",
      vulnerable: "function getPrice() public view returns (uint256) {\n    (uint112 r0, uint112 r1, ) = pair.getReserves();\n    return uint256(r1) * 1e18 / uint256(r0);   // spot, manipulable\n}",
      fixed: "function getPrice() public view returns (uint256) {\n    (, int256 answer, , uint256 updatedAt, ) = feed.latestRoundData();\n    require(answer > 0, \"bad answer\");\n    require(block.timestamp - updatedAt <= MAX_STALENESS, \"stale\");\n    uint256 twap = twapOracle.consult(address(token), 30 minutes);\n    uint256 chainlink = uint256(answer) * 1e18 / 10 ** feed.decimals();\n    require(_within(chainlink, twap, MAX_DEVIATION_BPS), \"deviation\");\n    return chainlink;\n}",
      poc: "function test_H01_flashloan_price() public {\n    uint256 before = vault.convertToAssets(1e18);\n    // borrow, dump into pool, read price, repay — all in one tx\n    flash.borrow(10_000e18, abi.encodeCall(this.manipulate, ()));\n    uint256 duringAttack = recordedPrice;\n    assertGt(duringAttack, before * 3);     // share price tripled mid-tx\n}",
      verification: "Fixed by switching to Chainlink + 30-minute TWAP cross-check with a 2% deviation bound. PoC no longer moves the reported price. We recommended monitoring for deviation reverts as an early warning."
    },
    {
      id: "H-02", severity: "high", status: "acknowledged",
      title: "First depositor can inflate share price and steal subsequent deposits (ERC-4626 inflation)",
      location: "src/Vault.sol#L88-L104",
      description: "When totalShares is zero, deposit() mints shares 1:1 with assets. An attacker deposits 1 wei to receive 1 share, then transfers a large amount of the underlying directly to the vault, inflating assets-per-share. The next depositor's shares round down to zero and their deposit accrues to the attacker's single share.",
      impact: "Loss of the first real deposit after the attack, up to the amount donated by the attacker (which they recover).",
      likelihood: "Medium-High — well-known, cheap to execute, front-runnable on the first deposit.",
      recommendation: "Mint dead shares to address(0) on first deposit (e.g. 1e3), or use a virtual-offset decimal approach as in OpenZeppelin ERC4626 v4.9+. Alternatively seed the vault with an initial protocol deposit at deployment.",
      vulnerable: "function deposit(uint256 assets) external returns (uint256 shares) {\n    shares = totalShares == 0 ? assets : assets * totalShares / totalAssets();\n    _mint(msg.sender, shares);\n    token.safeTransferFrom(msg.sender, address(this), assets);\n}",
      fixed: "// Team chose to seed the vault at deployment with 1e6 units held by the\n// protocol and to migrate to OpenZeppelin ERC4626 (virtual offset) next release.",
      poc: "function test_H02_inflation() public {\n    attacker.deposit(1);                       // 1 share\n    token.transfer(address(vault), 10_000e18); // donate directly\n    victim.deposit(9_999e18);\n    assertEq(vault.balanceOf(victim), 0);      // victim gets 0 shares\n}",
      verification: "Acknowledged. Mitigated operationally via a protocol seed deposit in the deployment script (reviewed). Code-level fix scheduled; risk is accepted by the team until then."
    },
    {
      id: "M-01", severity: "medium", status: "fixed",
      title: "Fee-on-transfer tokens break share accounting",
      location: "src/Vault.sol#L96",
      description: "deposit() mints shares for the `assets` argument but the vault receives `assets - fee` for tokens that charge a transfer fee. Shares are therefore over-minted relative to real balance; repeated deposits dilute earlier depositors.",
      impact: "Bounded value leak proportional to the transfer fee; incorrect share price reporting.",
      likelihood: "Medium — depends on which tokens the owner whitelists.",
      recommendation: "Measure balance before and after transferFrom and mint against the difference, or document and enforce a no-fee-on-transfer allowlist.",
      vulnerable: "token.safeTransferFrom(msg.sender, address(this), assets);\n_mint(msg.sender, shares);          // shares based on requested `assets`",
      fixed: "uint256 before = token.balanceOf(address(this));\ntoken.safeTransferFrom(msg.sender, address(this), assets);\nuint256 received = token.balanceOf(address(this)) - before;\nshares = _convertToShares(received);\n_mint(msg.sender, shares);",
      poc: "",
      verification: "Fixed; balance-delta accounting in place. Tested with a mock 1% fee token."
    },
    {
      id: "M-02", severity: "medium", status: "fixed",
      title: "harvest() can be called with a stale strategy report, locking in losses",
      location: "src/Strategy.sol#L120-L134",
      description: "harvest() accepts the strategy's last reported value without checking when it was reported. If the strategy's report is older than the vault's fee period, performance fees are charged against gains that may have since reversed.",
      impact: "Over-charged performance fees; incorrect share price until the next fresh report.",
      likelihood: "Medium — requires keeper delay, which occurs in practice.",
      recommendation: "Require a fresh report (block.timestamp - lastReport <= MAX_REPORT_AGE) before charging fees, and emit the report timestamp with the Harvest event.",
      vulnerable: "", fixed: "", poc: "",
      verification: "Fixed with a MAX_REPORT_AGE of 1 hour and an explicit event."
    },
    {
      id: "L-01", severity: "low", status: "fixed",
      title: "Single-step ownership transfer",
      location: "src/Admin.sol#L22",
      description: "transferOwnership() sets the new owner immediately. A typo in the address permanently loses admin control of the vault, including the ability to pause.",
      impact: "Loss of administrative control on operator error.",
      likelihood: "Low, but consequences are irreversible.",
      recommendation: "Use Ownable2Step so the new owner must accept.",
      vulnerable: "", fixed: "", poc: "",
      verification: "Fixed; migrated to Ownable2Step."
    },
    {
      id: "L-02", severity: "low", status: "fixed",
      title: "Floating pragma and outdated compiler",
      location: "src/*.sol#L2",
      description: "Contracts use `pragma solidity ^0.8.0`, allowing compilation with versions that have known optimizer bugs (e.g. 0.8.13–0.8.14 storage-write removal, 0.8.20 PUSH0 on non-Shanghai chains).",
      impact: "Behavioural differences or deployment failure depending on toolchain.",
      likelihood: "Low.",
      recommendation: "Pin to a specific audited version (0.8.24 at time of review) and set evm_version explicitly for the target chain.",
      vulnerable: "", fixed: "", poc: "",
      verification: "Fixed; pinned to 0.8.24, evm_version = paris."
    },
    {
      id: "I-01", severity: "info", status: "acknowledged",
      title: "Missing events on privileged setters and cached storage reads in loops",
      location: "src/Admin.sol, src/Strategy.sol",
      description: "setFee(), setStrategy() and setRouter() emit no events, making off-chain monitoring of privileged changes impossible. Several loops re-read totalShares from storage on each iteration.",
      impact: "None directly; reduces observability and wastes gas.",
      likelihood: "N/A",
      recommendation: "Emit an event for every privileged state change; cache storage reads in memory inside loops.",
      vulnerable: "", fixed: "", poc: "",
      verification: "Events added; gas optimisation deferred to next release."
    }
  ]
};
