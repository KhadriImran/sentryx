/* ==========================================================================
   SENTRYX — Contract Risk Pre-Check
   ---------------------------------------------------------------------------
   A CLIENT-SIDE, INDICATIVE heuristic scan. Nothing is uploaded: the source
   never leaves the browser. This is pattern matching plus a little structural
   parsing ("AST-lite"), not an audit — it cannot reason about intent, cannot
   follow cross-contract state, and will both miss real bugs and flag safe code.

   To add a rule, append to RULES. Fields:
     id        short code shown in the UI
     sev       critical | high | medium | low | info
     title     one line
     re        RegExp with the /g flag (matched per line unless `whole`)
     whole     true to test the whole source instead of line-by-line
     not       optional RegExp — if it matches the whole source, rule is skipped
     desc      why it matters
     fix       what to do about it
   ========================================================================== */
(function () {
  "use strict";
  const root = document.getElementById("precheck");

  const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

  const RULES = [
    { id: "PC-01", sev: "critical", title: "External call before state update (reentrancy shape)",
      whole: true,
      re: /\.call\s*\{\s*value\s*:[^}]*\}\s*\(\s*""?\s*\)[\s\S]{0,400}?(balanceOf|balances|shares|deposits|totalSupply|totalShares)\s*\[[^\]]*\]\s*(-=|=)/g,
      desc: "Value is sent with a low-level call and the caller's balance appears to be reduced afterwards. A contract receiver can re-enter from its receive()/fallback hook while the balance is still unchanged and repeat the withdrawal.",
      fix: "Apply checks-effects-interactions — update state before the external call — and add a reentrancy guard (OpenZeppelin ReentrancyGuard) as defence in depth." },

    { id: "PC-02", sev: "critical", title: "tx.origin used for authorisation",
      re: /require\s*\(\s*tx\.origin|if\s*\(\s*tx\.origin|tx\.origin\s*==\s*owner|owner\s*==\s*tx\.origin/g,
      desc: "tx.origin is the externally-owned account that started the transaction, not the immediate caller. Any contract the owner is tricked into calling can act with the owner's authority.",
      fix: "Authorise on msg.sender. Use OpenZeppelin Ownable / AccessControl rather than hand-rolled checks." },

    { id: "PC-03", sev: "critical", title: "delegatecall to a non-constant target",
      re: /\.delegatecall\s*\(/g,
      desc: "delegatecall executes foreign code against this contract's storage and balance. If the target address is user-influenced or upgradeable without controls, the caller can rewrite any storage slot — including the owner.",
      fix: "Only delegatecall to immutable, audited implementations. Validate the target against an allowlist and keep storage layouts compatible." },

    { id: "PC-04", sev: "high", title: "State-changing function with no visible access control",
      whole: true,
      re: /function\s+(set[A-Z]\w*|initialize|init|mint|burn|withdrawAll|sweep|rescue|upgradeTo|setOwner|transferOwnership|pause|unpause|emergency\w*)\s*\([^)]*\)\s*(external|public)(?![^{]*\b(onlyOwner|onlyRole|onlyAdmin|onlyGovernance|onlyKeeper|auth|requiresAuth|initializer|reinitializer)\b)[^{]*\{/g,
      desc: "A privileged-sounding external or public function was found without a recognised access-control modifier on its signature. If authorisation is not enforced inside the body, anyone can call it.",
      fix: "Add an explicit modifier (onlyOwner / onlyRole) or an in-body require. Mark initializers with the `initializer` modifier so they cannot be re-run." },

    { id: "PC-05", sev: "high", title: "Unchecked return value from a low-level call or transfer",
      re: /(?<!\(bool[^;]{0,40})(?<!=\s*)(?:\b\w+\s*)\.(call|send|delegatecall|staticcall)\s*(\{[^}]*\})?\s*\([^;]*\)\s*;/g,
      desc: "The boolean result of a low-level call is discarded. A failed transfer or call will not revert, so the contract continues as if it succeeded — silently losing funds or skipping a required effect.",
      fix: "Capture the return value and require() it, or use SafeERC20 / Address.functionCall which revert on failure." },

    { id: "PC-06", sev: "high", title: "Spot price read from AMM reserves (oracle manipulation)",
      re: /getReserves\s*\(\s*\)|\.price0CumulativeLast|getAmountsOut\s*\(|\.slot0\s*\(\s*\)/g,
      desc: "Pricing from a pool's current reserves or slot0 is manipulable inside a single transaction with a flash loan. Anything valued this way — collateral, shares, payouts — can be moved by an attacker at will.",
      fix: "Use a manipulation-resistant source: a Chainlink feed with staleness and deviation checks, or a TWAP over ≥30 minutes, cross-checked against a second source." },

    { id: "PC-07", sev: "high", title: "Oracle answer used without staleness or bounds checks",
      whole: true,
      re: /latestRoundData\s*\(\s*\)(?![\s\S]{0,600}?(updatedAt|answeredInRound|staleness|MAX_AGE|block\.timestamp\s*-))/g,
      desc: "latestRoundData() is consumed without validating updatedAt / answeredInRound. A stale or zero answer will be accepted as a live price — the failure mode behind several nine-figure losses.",
      fix: "require(answer > 0), check block.timestamp - updatedAt <= heartbeat, and verify answeredInRound >= roundId. Handle L2 sequencer downtime feeds where applicable." },

    { id: "PC-08", sev: "high", title: "Unbounded loop over a dynamic array",
      re: /for\s*\(\s*uint\d*\s+\w+\s*=\s*0\s*;\s*\w+\s*<\s*\w+(\[[^\]]*\])?\.length\s*;/g,
      desc: "Iterating an array whose length users can grow makes gas cost unbounded. Once the array is large enough the function always exceeds the block gas limit — permanently bricking whatever depends on it.",
      fix: "Bound the iteration, paginate with explicit start/end arguments, or restructure so per-user work happens in that user's own transaction." },

    { id: "PC-09", sev: "high", title: "ERC-4626 / share vault without first-deposit protection",
      whole: true,
      re: /(totalSupply\s*==\s*0\s*\?|totalShares\s*==\s*0\s*\?)(?![\s\S]{0,800}?(_decimalsOffset|DEAD_SHARES|MINIMUM_LIQUIDITY|1e3|virtualAssets))/g,
      desc: "The first depositor mints shares 1:1 and can then donate assets directly to the vault, inflating the share price so the next depositor's shares round to zero — a well-known, cheap attack.",
      fix: "Mint dead shares on first deposit, use OpenZeppelin ERC4626's virtual-offset approach, or seed the vault at deployment." },

    { id: "PC-10", sev: "medium", title: "Swap or liquidity call without slippage / deadline protection",
      re: /swapExactTokensForTokens\s*\([^;]*?,\s*0\s*,|addLiquidity\w*\s*\([^;]*?,\s*0\s*,\s*0\s*,|amountOutMin\s*[:=]\s*0\b|block\.timestamp\s*\)\s*;/g,
      desc: "A minimum-output of zero, or a deadline of block.timestamp, offers no protection: the transaction can sit in the mempool and be sandwiched for its full value.",
      fix: "Compute amountOutMin from a trusted quote with an explicit tolerance, and pass a real deadline supplied by the caller." },

    { id: "PC-11", sev: "medium", title: "Raw ERC-20 transfer / transferFrom / approve",
      re: /(?<!Safe)\b(IERC20|ERC20|token|asset|underlying|\w+Token)\s*\(?[^;\n]{0,40}\)?\s*\.\s*(transfer|transferFrom|approve)\s*\(/g,
      desc: "Some widely-held tokens (USDT among them) do not return a bool, and others return false instead of reverting. Raw calls either revert on decode or silently no-op.",
      fix: "Use OpenZeppelin SafeERC20 (safeTransfer / safeTransferFrom / forceApprove) for every external token interaction." },

    { id: "PC-12", sev: "medium", title: "Block values used as randomness",
      re: /keccak256\s*\(\s*abi\.encodePacked\s*\([^)]*(block\.(timestamp|number|prevrandao|difficulty)|blockhash)|%\s*block\.(timestamp|number)/g,
      desc: "Block timestamp, number, prevrandao and blockhash are all observable or influenceable by validators and by anyone in the same block. Any value derived from them is predictable.",
      fix: "Use a verifiable randomness source (Chainlink VRF) or a commit-reveal scheme with economic penalties." },

    { id: "PC-13", sev: "medium", title: "unchecked block — arithmetic safety suppressed",
      re: /unchecked\s*\{/g,
      desc: "Solidity 0.8 reverts on overflow, but unchecked blocks opt out. Each one must be justified by a bound the compiler cannot see.",
      fix: "Keep unchecked blocks minimal, comment the invariant that makes them safe, and cover them with fuzz tests." },

    { id: "PC-14", sev: "medium", title: "Division before multiplication (precision loss)",
      re: /\w+\s*\/\s*\w+\s*\*\s*\w+/g,
      desc: "Integer division truncates. Dividing before multiplying discards precision and, repeated over many operations, leaks value in a direction an attacker can usually choose.",
      fix: "Multiply first, then divide. Use a fixed-point library (WAD/RAY maths) and round in the protocol's favour." },

    { id: "PC-15", sev: "low", title: "Floating or unpinned pragma",
      re: /pragma\s+solidity\s+[\^>~]/g,
      desc: "A floating pragma lets the contract compile with versions you never tested, including releases with known optimiser bugs (0.8.13–0.8.14) or PUSH0 issues on non-Shanghai chains (0.8.20+).",
      fix: "Pin an exact version — pragma solidity 0.8.24; — and set evm_version explicitly for the target chain." },

    { id: "PC-16", sev: "low", title: "Missing zero-address validation on an address parameter",
      whole: true,
      re: /function\s+\w+\s*\([^)]*address\s+(_?\w+)[^)]*\)\s*(external|public)(?![^{]*\{[\s\S]{0,300}?(require\s*\([^)]*!=\s*address\(0\)|ZeroAddress|revert\s+\w*Zero))/g,
      desc: "An address argument is accepted without a zero check. Setting a critical address to the zero address is usually irreversible and can permanently disable the contract.",
      fix: "require(addr != address(0)) — or a custom error — on every address setter and constructor argument." },

    { id: "PC-17", sev: "low", title: "Single-step ownership transfer",
      whole: true,
      re: /function\s+transferOwnership\s*\([\s\S]{0,300}?owner\s*=\s*\w+\s*;/g,
      desc: "Ownership moves immediately to whatever address was passed. A typo permanently loses admin control, including the ability to pause.",
      fix: "Use Ownable2Step so the incoming owner must explicitly accept." },

    { id: "PC-18", sev: "low", title: "selfdestruct present",
      re: /\bselfdestruct\s*\(|\bsuicide\s*\(/g,
      desc: "selfdestruct removes code and forwards the balance. Since EIP-6780 its behaviour changed, and any contract depending on it — or on receiving forced ether — may behave unexpectedly.",
      fix: "Remove selfdestruct. Use a pause plus a controlled withdrawal path instead." },

    { id: "PC-19", sev: "info", title: "Privileged state change without an event",
      whole: true,
      re: /function\s+set[A-Z]\w*\s*\([^)]*\)\s*(external|public)[^{]*\{(?![\s\S]{0,300}?emit\s)/g,
      desc: "A setter appears to change state without emitting an event. Off-chain monitoring and incident response depend on these events existing.",
      fix: "Emit an event with the old and new value for every privileged state change." },

    { id: "PC-20", sev: "info", title: "Storage read inside a loop condition",
      re: /for\s*\([^;]*;\s*\w+\s*<\s*(?!\w+\.length\s*\))\w+\s*;/g,
      desc: "Re-reading a storage variable on every iteration costs 100 gas per read after the first (warm SLOAD).",
      fix: "Cache the value in a memory variable before the loop." }
  ];

  /* ------------------------------------------------------------ helpers */
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const SEV_ORDER = ["critical", "high", "medium", "low", "info"];

  // Strip comments and string literals so rules don't fire on prose or URLs.
  function sanitise(src) {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
  }

  function scan(src) {
    const clean = sanitise(src);
    const lines = clean.split("\n");
    const rawLines = src.split("\n");
    const hits = [];

    for (const rule of RULES) {
      if (rule.not && rule.not.test(clean)) continue;
      const re = new RegExp(rule.re.source, rule.re.flags.includes("g") ? rule.re.flags : rule.re.flags + "g");
      if (rule.whole) {
        let m, seen = 0;
        while ((m = re.exec(clean)) !== null && seen < 3) {
          const line = clean.slice(0, m.index).split("\n").length;
          hits.push({ rule, line, snippet: (rawLines[line - 1] || "").trim().slice(0, 160) });
          seen++;
          if (m.index === re.lastIndex) re.lastIndex++;
        }
      } else {
        let seen = 0;
        for (let i = 0; i < lines.length && seen < 4; i++) {
          re.lastIndex = 0;
          if (re.test(lines[i])) {
            hits.push({ rule, line: i + 1, snippet: (rawLines[i] || "").trim().slice(0, 160) });
            seen++;
          }
        }
      }
    }
    hits.sort((a, b) => SEV_ORDER.indexOf(a.rule.sev) - SEV_ORDER.indexOf(b.rule.sev) || a.line - b.line);
    return hits;
  }

  function metrics(src) {
    const clean = sanitise(src);
    const loc = src.split("\n").filter((l) => l.trim() && !/^\s*(\/\/|\/\*|\*)/.test(l)).length;
    const fns = (clean.match(/function\s+\w+\s*\(/g) || []).length;
    const contracts = (clean.match(/\b(contract|library|interface)\s+\w+/g) || []).length;
    const ext = (clean.match(/\b(external|public)\b/g) || []).length;
    const pragma = (src.match(/pragma\s+solidity\s+([^\s;]+)/) || [])[1] || "not found";
    return { loc, fns, contracts, ext, pragma };
  }

  /* ------------------------------------------------ exported engine */
  // Reused by the Deep Scan tool, which runs every analyser in one pass.
  window.SENTRYX_precheck = { RULES: RULES, scan: scan, metrics: metrics, sanitise: sanitise, SEV_ORDER: SEV_ORDER };

  /* ------------------------------------------------------------- render */
  if (!root) return;
  const ta = root.querySelector("#pc-input");
  const out = root.querySelector("#pc-out");
  const runBtn = root.querySelector("#pc-run");
  const sampleBtn = root.querySelector("#pc-sample");
  const clearBtn = root.querySelector("#pc-clear");

  const SAMPLE = `// ILLUSTRATIVE — deliberately vulnerable sample
pragma solidity ^0.8.0;

interface IPair { function getReserves() external view returns (uint112,uint112,uint32); }

contract DemoVault {
    mapping(address => uint256) public balanceOf;
    uint256 public totalShares;
    address public owner;
    IPair public pair;

    function setOwner(address newOwner) external {
        owner = newOwner;
    }

    function price() public view returns (uint256) {
        (uint112 r0, uint112 r1, ) = pair.getReserves();
        return uint256(r1) * 1e18 / uint256(r0);
    }

    function deposit() external payable {
        uint256 shares = totalShares == 0 ? msg.value : msg.value * totalShares / address(this).balance;
        balanceOf[msg.sender] += shares;
        totalShares += shares;
    }

    function withdraw(uint256 shares) external {
        require(balanceOf[msg.sender] >= shares, "insufficient");
        uint256 amount = shares * address(this).balance / totalShares;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "fail");
        balanceOf[msg.sender] -= shares;
        totalShares -= shares;
    }

    function adminSweep(address to) external {
        require(tx.origin == owner, "not owner");
        payable(to).transfer(address(this).balance);
    }
}`;

  function render(src) {
    const trimmed = src.trim();
    if (!trimmed) { out.innerHTML = '<p class="filter-empty">Paste Solidity source or a contract address to begin.</p>'; return; }

    if (ADDRESS_RE.test(trimmed)) {
      out.innerHTML =
        '<div class="disclaimer" style="margin-bottom:var(--s-4)"><strong>Address detected.</strong> This pre-check runs entirely in your browser and does not fetch verified source from a block explorer — that would need an API key and a backend. Open the address on the relevant explorer, copy the verified Solidity source, and paste it here.</div>' +
        '<div class="hit" data-sev="info"><div class="hit-top"><h4>' + esc(trimmed) + '</h4><span class="sev sev-info">Info</span></div>' +
        '<p>No source analysed. For a real assessment of a deployed contract — including storage, proxy implementation and upgrade history — <a href="contact.html">request an audit</a>.</p></div>';
      return;
    }

    const hits = scan(src);
    const m = metrics(src);
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    hits.forEach((h) => counts[h.rule.sev]++);

    let html = '<div class="scan-summary" role="group" aria-label="Pattern counts by severity">';
    SEV_ORDER.forEach((s) => {
      html += '<div data-sev="' + s + '"><div class="n">' + counts[s] + '</div><div class="l">' + (s === "info" ? "Info" : s) + "</div></div>";
    });
    html += "</div>";

    html += '<div class="est-rows" style="margin:0 0 var(--s-4);padding:0;border:0">' +
      '<div class="est-row"><span>Lines scanned</span><span>' + m.loc + "</span></div>" +
      '<div class="est-row"><span>Contracts / libraries</span><span>' + m.contracts + "</span></div>" +
      '<div class="est-row"><span>Functions</span><span>' + m.fns + "</span></div>" +
      '<div class="est-row"><span>Pragma</span><span class="mono">' + esc(m.pragma) + "</span></div>" +
      "</div>";

    if (!hits.length) {
      html += '<div class="hit" data-sev="info"><div class="hit-top"><h4>No known patterns matched</h4><span class="sev sev-info">Info</span></div>' +
        "<p>This scan found none of the ~20 patterns it looks for. That is not a clean bill of health: the patterns behind most large exploits — flawed accounting, broken incentive design, cross-contract state assumptions — are invisible to regex. It means only that the obvious shapes are absent.</p></div>";
    } else {
      html += '<div class="hit-list">';
      hits.forEach((h) => {
        html += '<div class="hit" data-sev="' + h.rule.sev + '">' +
          '<div class="hit-top"><h4>' + esc(h.rule.title) + "</h4>" +
          '<span class="sev sev-' + (h.rule.sev === "info" ? "info" : h.rule.sev) + '">' + h.rule.sev + "</span></div>" +
          '<div class="hit-line">' + h.rule.id + " · line " + h.line + "</div>" +
          (h.snippet ? "<pre>" + esc(h.snippet) + "</pre>" : "") +
          "<p style='margin-top:10px'>" + esc(h.rule.desc) + "</p>" +
          '<div class="fix"><b>Remediation:</b> ' + esc(h.rule.fix) + "</div></div>";
      });
      html += "</div>";
    }
    out.innerHTML = html;
    out.setAttribute("aria-busy", "false");
  }

  runBtn.addEventListener("click", function () { out.setAttribute("aria-busy", "true"); render(ta.value); });
  sampleBtn.addEventListener("click", function () { ta.value = SAMPLE; render(SAMPLE); });
  clearBtn.addEventListener("click", function () { ta.value = ""; render(""); ta.focus(); });
  ta.addEventListener("keydown", function (e) { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); render(ta.value); } });
  render("");
})();
