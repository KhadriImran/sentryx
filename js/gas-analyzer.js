/* ==========================================================================
   SENTRYX — Gas Optimization Analyzer
   ---------------------------------------------------------------------------
   Finds gas waste with a savings estimate per hit, using post-Berlin
   (EIP-2929) costs. Every rule carries a correctness caveat where one exists,
   because a "gas optimisation" that changes behaviour is a bug, not a saving.

   Reference costs used below:
     SSTORE zero -> non-zero   20,000     SSTORE non-zero -> non-zero  2,900
     SLOAD cold                 2,100     SLOAD warm                     100
     CALL cold account          2,600     Non-zero calldata byte          16
     Deploy: 200 gas per byte of runtime code
   ========================================================================== */
(function () {
  "use strict";
  var root = document.getElementById("gas-tool");
  if (!root || !window.SENTRYX_sol) return;
  var sol = window.SENTRYX_sol;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  /* ------------------------------------------------------------ rule set */
  var RULES = [
    { id: "G-01", sev: "high", title: "Storage read inside a loop",
      re: /for\s*\([^)]*\)\s*\{[\s\S]{0,400}?\}/g,
      test: function (match, ctx) {
        // a state variable referenced inside the loop body without a memory cache
        var body = match[0];
        return ctx.stateNames.some(function (n) {
          return new RegExp("\\b" + n + "\\b").test(body) &&
            !new RegExp("(uint\\d*|address|bool|bytes\\d*)\\s+\\w+\\s*=\\s*" + n).test(body);
        });
      },
      save: "2,100 gas on the first read, then 100 per iteration avoided",
      why: "Each iteration re-reads the variable from storage. The first access costs 2,100 gas (cold SLOAD) and every subsequent one 100 gas (warm).",
      fix: "Cache the value in a memory variable before the loop and write it back once afterwards if it changes." },

    { id: "G-02", sev: "high", title: "require() with a string message",
      re: /require\s*\([^;]*?,\s*["'][^"']{1,}["']\s*\)/g,
      save: "~50 gas per revert, plus ~200 gas per byte of deployed string",
      why: "Revert strings are stored in the runtime bytecode. A 30-character message adds roughly 6,000 gas to deployment and makes the contract larger.",
      fix: "Use custom errors: <code>error InsufficientBalance(uint256 have, uint256 need);</code> then <code>if (a &lt; b) revert InsufficientBalance(a, b);</code> — cheaper and gives callers structured data." },

    { id: "G-03", sev: "medium", title: "Public function that could be external",
      whole: true,
      compute: function (ctx) {
        var hits = [];
        ctx.functions.forEach(function (f) {
          if (f.visibility !== "public" || f.kind !== "function") return;
          if (!f.params) return;
          if (!/\b(memory|calldata)\b/.test(f.params)) return;
          // called internally anywhere?
          var calledInternally = ctx.allBodies.some(function (b) {
            return new RegExp("(?<![.\\w])" + f.name + "\\s*\\(").test(b);
          });
          if (!calledInternally) hits.push({ line: f.line, snippet: f.raw.trim().slice(0, 120), extra: f.name });
        });
        return hits;
      },
      save: "Up to a few hundred gas per call on array/string arguments",
      why: "A <code>public</code> function copies its arguments from calldata into memory. <code>external</code> functions can read <code>calldata</code> directly.",
      fix: "Mark it <code>external</code> and change <code>memory</code> parameters to <code>calldata</code> — but only if nothing inside the contract calls it." },

    { id: "G-04", sev: "medium", title: "State variable never reassigned — could be immutable or constant",
      whole: true,
      compute: function (ctx) {
        var hits = [];
        ctx.stateVars.forEach(function (v) {
          if (v.constant || v.immutable) return;
          if (/mapping|\[\]/.test(v.type)) return;
          var assignedOutsideCtor = ctx.nonCtorBodies.some(function (b) {
            return new RegExp("\\b" + v.name + "\\s*(=[^=]|\\+=|-=|\\*=|/=)").test(b);
          });
          if (!assignedOutsideCtor) {
            hits.push({ line: v.line, snippet: v.raw.slice(0, 120), extra: v.name });
          }
        });
        return hits;
      },
      save: "2,100 gas per cold read, 100 per warm read — every single call",
      why: "A value only set in the constructor can be <code>immutable</code>; a compile-time literal can be <code>constant</code>. Both are inlined into bytecode, so reads cost no storage access at all.",
      fix: "Add <code>immutable</code> (constructor-set) or <code>constant</code> (literal). This is usually the single largest saving available in a contract." },

    { id: "G-05", sev: "medium", title: "Unbounded loop over a storage array",
      re: /for\s*\(\s*uint\d*\s+\w+\s*=\s*0\s*;\s*\w+\s*<\s*(\w+)\.length\s*;/g,
      save: "Unbounded — this is a denial-of-service risk as well as a gas cost",
      why: "Reading <code>.length</code> from storage on every iteration costs 100 gas warm, and an array users can grow makes the total cost unbounded.",
      fix: "Cache the length in memory (<code>uint256 len = arr.length;</code>) and, more importantly, bound the iteration or paginate.",
      alsoSecurity: true },

    { id: "G-06", sev: "low", title: "Post-increment in a loop counter",
      re: /for\s*\([^;]*;[^;]*;\s*\w+\s*\+\+\s*\)/g,
      save: "~5 gas per iteration",
      why: "<code>i++</code> stores the pre-increment value before adding. <code>++i</code> does not.",
      fix: "Use <code>++i</code>. In Solidity ≥0.8.22 the compiler also removes the overflow check on loop counters automatically, so an explicit <code>unchecked</code> block is no longer needed." },

    { id: "G-07", sev: "low", title: "Default value explicitly assigned",
      re: /\b(uint\d*|int\d*)\s+\w+\s*=\s*0\s*;|\bbool\s+\w+\s*=\s*false\s*;|\baddress\s+\w+\s*=\s*address\(0\)\s*;/g,
      save: "~3 gas per occurrence, more at deployment",
      why: "Variables are already zero-initialised. Writing the default costs bytecode and execution for nothing.",
      fix: "Drop the assignment: <code>uint256 i;</code> instead of <code>uint256 i = 0;</code>" },

    { id: "G-08", sev: "low", title: "Storage struct read where a memory copy would do",
      re: /\b[A-Z]\w*\s+storage\s+\w+\s*=\s*\w+\[[^\]]*\]\s*;/g,
      save: "Depends on field count — 2,100 gas per cold field read",
      why: "A <code>storage</code> pointer reads each field from storage on access. If the struct is only read (never written), a single <code>memory</code> copy is cheaper past two field accesses.",
      fix: "Use <code>memory</code> when the struct is read-only in this function. Keep <code>storage</code> when you write back — a memory copy that you mutate silently discards the write." },

    { id: "G-09", sev: "low", title: "Redundant zero-address check on a value that cannot be zero",
      re: /require\s*\(\s*msg\.sender\s*!=\s*address\(0\)/g,
      save: "~30 gas per call",
      why: "<code>msg.sender</code> can never be the zero address in a real transaction.",
      fix: "Remove the check. Keep zero-address checks on arguments and on constructor inputs, where they matter." },

    { id: "G-10", sev: "low", title: "Long revert string (>32 bytes)",
      re: /require\s*\([^;]*?,\s*["'][^"']{33,}["']\s*\)/g,
      save: "~200 gas per extra byte at deployment",
      why: "Strings longer than 32 bytes occupy more than one word and materially increase deployment cost.",
      fix: "Shorten the message, or switch to a custom error which carries no string at all." },

    { id: "G-11", sev: "info", title: "Public constant generates an unnecessary getter",
      re: /\b(uint\d*|bytes\d*|address|bool|string)\s+public\s+constant\s+\w+/g,
      save: "~200 gas per byte of the generated getter at deployment",
      why: "A public constant creates an external getter function in the bytecode.",
      fix: "If off-chain callers do not need it, make it <code>internal</code> or <code>private</code>." },

    { id: "G-12", sev: "info", title: "Division or multiplication by a power of two",
      re: /\/\s*2\b|\*\s*2\b|\/\s*4\b|\/\s*8\b|\/\s*16\b/g,
      save: "~15 gas per operation",
      why: "<code>DIV</code> and <code>MUL</code> cost 5 gas; <code>SHR</code> and <code>SHL</code> cost 3.",
      fix: "Shift instead: <code>x &gt;&gt; 1</code> for <code>x / 2</code>. Only do this in hot paths — it hurts readability, and readability is a security property." }
  ];

  /* ------------------------------------------------------------- analysis */
  function analyse(src) {
    var clean = sol.strip(src);
    var cs = sol.contracts(src);
    if (!cs.length) return { error: "No contract found. Paste a full Solidity file." };

    var stateVars = [], functions = [], allBodies = [], nonCtorBodies = [];
    cs.forEach(function (c) {
      sol.stateVars(c.body, c.cleanBody).forEach(function (v) { stateVars.push(v); });
      sol.functions(c.body, c.cleanBody).forEach(function (f) {
        functions.push(f);
        allBodies.push(f.body);
        if (f.kind !== "constructor") nonCtorBodies.push(f.body);
      });
    });
    var ctx = {
      stateVars: stateVars, stateNames: stateVars.map(function (v) { return v.name; }),
      functions: functions, allBodies: allBodies, nonCtorBodies: nonCtorBodies
    };

    var lines = clean.split("\n"), raw = src.split("\n"), hits = [];
    RULES.forEach(function (rule) {
      if (rule.whole && rule.compute) {
        rule.compute(ctx).forEach(function (h) {
          hits.push({ rule: rule, line: h.line, snippet: h.snippet, extra: h.extra });
        });
        return;
      }
      if (!rule.re) return;
      var re = new RegExp(rule.re.source, rule.re.flags.indexOf("g") === -1 ? rule.re.flags + "g" : rule.re.flags);
      var m, seen = 0;
      while ((m = re.exec(clean)) !== null && seen < 6) {
        if (rule.test && !rule.test(m, ctx)) { if (m.index === re.lastIndex) re.lastIndex++; continue; }
        var ln = clean.slice(0, m.index).split("\n").length;
        hits.push({ rule: rule, line: ln, snippet: (raw[ln - 1] || "").trim().slice(0, 150) });
        seen++;
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    });

    var order = ["high", "medium", "low", "info"];
    hits.sort(function (a, b) { return order.indexOf(a.rule.sev) - order.indexOf(b.rule.sev) || a.line - b.line; });
    return { hits: hits, ctx: ctx, loc: raw.filter(function (l) { return l.trim(); }).length, contracts: cs.length };
  }

  /* --------------------------------------------------------------- render */
  var out = root.querySelector("#gas-out");
  var input = root.querySelector("#gas-input");

  function render(src) {
    if (!src.trim()) { out.innerHTML = '<p class="filter-empty">Paste Solidity to analyse gas usage.</p>'; return; }
    var a = analyse(src);
    if (a.error) { out.innerHTML = '<p class="filter-empty">' + esc(a.error) + "</p>"; return; }
    var counts = { high: 0, medium: 0, low: 0, info: 0 };
    a.hits.forEach(function (h) { counts[h.rule.sev]++; });

    var html = '<div class="scan-summary" style="grid-template-columns:repeat(4,minmax(0,1fr))">' +
      ["high", "medium", "low", "info"].map(function (s) {
        return '<div data-sev="' + s + '"><div class="n">' + counts[s] + '</div><div class="l">' +
          (s === "info" ? "Info" : s + " impact") + "</div></div>";
      }).join("") + "</div>";

    html += '<div class="est-rows" style="border:0;padding:0;margin:var(--s-4) 0">' +
      '<div class="est-row"><span>Lines analysed</span><span>' + a.loc + "</span></div>" +
      '<div class="est-row"><span>Contracts</span><span>' + a.contracts + "</span></div>" +
      '<div class="est-row"><span>State variables</span><span>' + a.ctx.stateVars.length + "</span></div>" +
      '<div class="est-row"><span>Functions</span><span>' + a.ctx.functions.length + "</span></div>" +
      "</div>";

    if (!a.hits.length) {
      html += '<div class="hit" data-sev="info"><div class="hit-top"><h4>No patterns matched</h4><span class="sev sev-info">Info</span></div>' +
        "<p>None of the twelve patterns this tool checks were found. That does not mean the contract is gas-optimal &mdash; algorithmic choices, storage design and call structure dominate real gas costs, and none of those are visible to pattern matching.</p></div>";
    } else {
      html += '<div class="hit-list" style="max-height:none">' + a.hits.map(function (h) {
        return '<div class="hit" data-sev="' + h.rule.sev + '">' +
          '<div class="hit-top"><h4>' + esc(h.rule.title) + (h.extra ? ' <code>' + esc(h.extra) + "</code>" : "") + "</h4>" +
          '<span class="sev sev-' + h.rule.sev + '">' + h.rule.sev + "</span></div>" +
          '<div class="hit-line">' + h.rule.id + " · line " + h.line + (h.rule.alsoSecurity ? ' · <span style="color:var(--sev-high)">also a security finding</span>' : "") + "</div>" +
          (h.snippet ? "<pre>" + esc(h.snippet) + "</pre>" : "") +
          "<p style='margin-top:10px'>" + h.rule.why + "</p>" +
          '<div class="fix"><b>Fix:</b> ' + h.rule.fix + '<br><b style="color:var(--sev-fixed)">Saving:</b> ' + esc(h.rule.save) + "</div></div>";
      }).join("") + "</div>";
    }
    out.innerHTML = html;
  }

  var SAMPLE = `// ILLUSTRATIVE — deliberately gas-inefficient
pragma solidity 0.8.24;

contract Rewards {
    address public owner;              // set once in the constructor
    uint256 public rewardRate;         // never reassigned
    address[] public stakers;
    mapping(address => uint256) public staked;
    uint256 public constant PRECISION = 1e18;

    constructor(address _owner, uint256 _rate) {
        owner = _owner;
        rewardRate = _rate;
    }

    function distribute() public {
        require(msg.sender == owner, "Only the contract owner may call distribute");
        require(msg.sender != address(0), "zero");
        uint256 total = 0;
        for (uint256 i = 0; i < stakers.length; i++) {
            total = total + staked[stakers[i]] * rewardRate / PRECISION;
        }
        uint256 half = total / 2;
        staked[owner] = half;
    }

    function setRate(uint256[] memory rates) public {
        rewardRate = rates[0];
    }
}`;

  root.querySelector("#gas-run").addEventListener("click", function () { render(input.value); });
  root.querySelector("#gas-sample").addEventListener("click", function () { input.value = SAMPLE; render(SAMPLE); });
  root.querySelector("#gas-clear").addEventListener("click", function () { input.value = ""; render(""); input.focus(); });
  input.addEventListener("keydown", function (e) { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); render(input.value); } });
  render("");
  window.SENTRYX_gas = { analyse: analyse, RULES: RULES };
})();
