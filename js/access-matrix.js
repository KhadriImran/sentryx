/* ==========================================================================
   SENTRYX — Access Control Matrix Generator
   ---------------------------------------------------------------------------
   Builds the roles x functions table we produce by hand in every engagement.
   It answers the question most teams cannot answer about their own protocol:
   "exactly what can each key do?"

   It classifies every externally-reachable function by the guard on it, flags
   the ones with no guard at all, and separately lists what a compromised
   admin key could do — because "the owner is trusted" is an assumption, not
   a control.

   Runs entirely in your browser. Nothing is uploaded.
   ========================================================================== */
(function () {
  "use strict";
  var root = document.getElementById("acl-tool");
  if (!root || !window.SENTRYX_sol) return;
  var sol = window.SENTRYX_sol;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  // Guard modifiers we recognise, mapped to a role label.
  var KNOWN = [
    [/^onlyOwner\b/, "Owner"], [/^onlyAdmin\b/, "Admin"], [/^onlyGovernance\b/, "Governance"],
    [/^onlyGovernor\b/, "Governance"], [/^onlyKeeper\b/, "Keeper"], [/^onlyOperator\b/, "Operator"],
    [/^onlyGuardian\b/, "Guardian"], [/^onlyPauser\b/, "Pauser"], [/^onlyMinter\b/, "Minter"],
    [/^onlyTimelock\b/, "Timelock"], [/^onlyDAO\b/, "DAO"], [/^onlyVault\b/, "Vault"],
    [/^onlyStrategy\b/, "Strategy"], [/^onlySelf\b/, "Self"], [/^onlyRole\s*\(/, "Role (AccessControl)"],
    [/^onlyProxy\b/, "Proxy"], [/^auth\b/, "Auth (DSAuth)"], [/^requiresAuth\b/, "Auth (Solmate)"],
    [/^initializer\b/, "Initializer"], [/^reinitializer\s*\(/, "Initializer"],
    [/^whenNotPaused\b/, null], [/^whenPaused\b/, null], [/^nonReentrant\b/, null]
  ];
  // Functions whose names suggest they move or redirect value / control.
  var DANGEROUS = /^(set|update|change|upgrade|migrate|withdraw|sweep|rescue|recover|drain|mint|burn|transferOwnership|renounce|pause|unpause|emergency|kill|destroy|seize|liquidate|execute|call|delegate|grant|revoke|add|remove|whitelist|blacklist|configure|init)/i;

  function guardOf(f) {
    var roles = [], gates = [], unknown = [];
    f.modifiers.forEach(function (mod) {
      var matched = false;
      for (var i = 0; i < KNOWN.length; i++) {
        if (KNOWN[i][0].test(mod)) {
          matched = true;
          if (KNOWN[i][1]) roles.push(KNOWN[i][1] + (/onlyRole\s*\(/.test(mod) ? " " + (mod.match(/\(([^)]*)\)/) || [, ""])[1].trim() : ""));
          else gates.push(mod.replace(/\(.*/, ""));
          break;
        }
      }
      if (!matched) unknown.push(mod.replace(/\(.*/, ""));
    });
    // in-body checks
    var body = f.body || "";
    var inBody = [];
    if (/require\s*\(\s*msg\.sender\s*==\s*owner/.test(body)) inBody.push("Owner (in-body)");
    if (/require\s*\(\s*msg\.sender\s*==\s*admin/.test(body)) inBody.push("Admin (in-body)");
    if (/require\s*\(\s*msg\.sender\s*==\s*address\(this\)/.test(body)) inBody.push("Self (in-body)");
    if (/hasRole\s*\(/.test(body)) inBody.push("Role (in-body)");
    if (/require\s*\(\s*tx\.origin/.test(body) || /tx\.origin\s*==/.test(body)) inBody.push("tx.origin ⚠");
    if (/_checkOwner\s*\(\s*\)/.test(body)) inBody.push("Owner (in-body)");
    return { roles: roles.concat(inBody), gates: gates, unknown: unknown };
  }

  function analyse(src) {
    var cs = sol.contracts(src);
    if (!cs.length) return { error: "No contract found. Paste a full Solidity file." };
    var rows = [], rolesSet = {}, gatesSet = {};

    cs.forEach(function (c) {
      if (c.kind === "interface") return;
      sol.functions(c.body, c.cleanBody).forEach(function (f) {
        if (f.visibility !== "public" && f.visibility !== "external" && f.kind === "function") return;
        if (f.mutability === "view" || f.mutability === "pure") return;   // read-only: not an authority question
        if (f.isAbstract) return;
        var g = guardOf(f);
        g.roles.forEach(function (r) { rolesSet[r] = true; });
        g.gates.forEach(function (x) { gatesSet[x] = true; });
        var open = g.roles.length === 0;
        var dangerous = DANGEROUS.test(f.name) || f.kind === "constructor";
        rows.push({
          contract: c.name, name: f.name, kind: f.kind, line: f.line,
          visibility: f.visibility, mutability: f.mutability,
          roles: g.roles, gates: g.gates, unknown: g.unknown,
          open: open, dangerous: dangerous,
          risk: open && dangerous ? "critical" : open ? "medium" : g.roles.some(function (r) { return /tx\.origin/.test(r); }) ? "critical" : "ok",
          params: f.params
        });
      });
    });

    var roles = Object.keys(rolesSet).sort();
    return {
      rows: rows, roles: roles, gates: Object.keys(gatesSet).sort(),
      contracts: cs.filter(function (c) { return c.kind !== "interface"; }).map(function (c) { return c.name; })
    };
  }

  /* --------------------------------------------------------------- render */
  var out = root.querySelector("#acl-out");
  var input = root.querySelector("#acl-input");

  function render(src) {
    if (!src.trim()) { out.innerHTML = '<p class="filter-empty">Paste a contract to build its access control matrix.</p>'; return; }
    var a = analyse(src);
    if (a.error) { out.innerHTML = '<p class="filter-empty">' + esc(a.error) + "</p>"; return; }
    if (!a.rows.length) {
      out.innerHTML = '<p class="filter-empty">No state-changing external or public functions found.</p>'; return;
    }

    var openDangerous = a.rows.filter(function (r) { return r.risk === "critical"; });
    var openOther = a.rows.filter(function (r) { return r.risk === "medium"; });
    var guarded = a.rows.filter(function (r) { return r.risk === "ok"; });

    var html = '<div class="scan-summary" style="grid-template-columns:repeat(4,minmax(0,1fr))">' +
      '<div data-sev="critical"><div class="n">' + openDangerous.length + '</div><div class="l">Unguarded &amp; privileged</div></div>' +
      '<div data-sev="medium"><div class="n">' + openOther.length + '</div><div class="l">Unguarded</div></div>' +
      '<div data-sev="low"><div class="n">' + guarded.length + '</div><div class="l">Guarded</div></div>' +
      '<div data-sev="info"><div class="n">' + a.roles.length + '</div><div class="l">Distinct roles</div></div>' +
      "</div>";

    // The matrix
    var cols = a.roles.length ? a.roles : ["(no roles found)"];
    html += '<h3 style="margin-top:var(--s-6);font-size:1.05rem">Roles &times; functions</h3>' +
      '<div class="table-wrap" style="margin-top:var(--s-4)"><table class="cmp-table acl-table" style="min-width:' + (420 + cols.length * 130) + 'px">' +
      "<thead><tr><th>Function</th><th>Visibility</th>" +
      cols.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") +
      "<th>Anyone</th></tr></thead><tbody>" +
      a.rows.map(function (r) {
        return '<tr data-sev="' + (r.risk === "ok" ? "low" : r.risk) + '">' +
          "<th scope='row'><code>" + esc(r.name) + "</code>" +
          '<div class="dim mono" style="font-size:11px;margin-top:3px">' + esc(r.contract) + " · line " + r.line + "</div></th>" +
          "<td>" + esc(r.visibility) + (r.mutability === "payable" ? ' <span class="sev sev-medium" style="padding:2px 6px">payable</span>' : "") + "</td>" +
          cols.map(function (c) {
            return "<td>" + (r.roles.indexOf(c) !== -1 ? '<span style="color:var(--sev-fixed)">&#10003;</span>' : '<span class="dim">&mdash;</span>') + "</td>";
          }).join("") +
          "<td>" + (r.open
            ? '<span class="sev sev-' + (r.dangerous ? "critical" : "medium") + '">' + (r.dangerous ? "YES ⚠" : "yes") + "</span>"
            : '<span class="dim">no</span>') + "</td></tr>";
      }).join("") + "</tbody></table></div>";

    // findings
    var findings = [];
    if (openDangerous.length) {
      findings.push({
        sev: "critical",
        title: openDangerous.length + " privileged function" + (openDangerous.length > 1 ? "s have" : " has") + " no access control",
        body: "These functions have names that suggest they change protocol state or move value, and no recognised guard was found on the signature or in the body: " +
          openDangerous.map(function (r) { return "<code>" + esc(r.name) + "</code>"; }).join(", ") +
          ". If authorisation is not enforced somewhere this tool cannot see, anyone can call them.",
        fix: "Add an explicit modifier (<code>onlyOwner</code> / <code>onlyRole</code>) or an in-body <code>require</code>. Verify each one manually — this is the single most expensive bug class in the industry."
      });
    }
    if (openOther.length) {
      findings.push({
        sev: "medium",
        title: openOther.length + " unguarded state-changing function" + (openOther.length > 1 ? "s" : ""),
        body: "Permissionless by design in many protocols (deposits, swaps, claims), but each one should be a deliberate decision: " +
          openOther.map(function (r) { return "<code>" + esc(r.name) + "</code>"; }).join(", ") + ".",
        fix: "Confirm each is intended to be callable by anyone, and that its internal accounting cannot be manipulated by an attacker calling it repeatedly or with extreme values."
      });
    }
    var txOrigin = a.rows.filter(function (r) { return r.roles.some(function (x) { return /tx\.origin/.test(x); }); });
    if (txOrigin.length) {
      findings.push({
        sev: "critical", title: "tx.origin used for authorisation",
        body: "<code>tx.origin</code> is the EOA that started the transaction, not the caller. Any contract the privileged user is tricked into interacting with can act with their authority.",
        fix: "Authorise on <code>msg.sender</code>."
      });
    }
    var unknownMods = {};
    a.rows.forEach(function (r) { r.unknown.forEach(function (u) { unknownMods[u] = true; }); });
    if (Object.keys(unknownMods).length) {
      findings.push({
        sev: "info", title: "Unrecognised modifiers",
        body: "These modifiers were found but are not in the tool's known list, so their effect on authorisation was not classified: " +
          Object.keys(unknownMods).map(function (u) { return "<code>" + esc(u) + "</code>"; }).join(", ") + ".",
        fix: "Read each one and add it to the matrix by hand. A custom modifier is exactly where a subtle authorisation bug hides."
      });
    }
    var adminCan = a.rows.filter(function (r) { return !r.open && r.dangerous; });
    if (adminCan.length) {
      findings.push({
        sev: "medium", title: "What a compromised privileged key could do",
        body: "Assume the key is compromised, not that it is trusted. These functions are reachable by a privileged role and change protocol state: " +
          adminCan.map(function (r) { return "<code>" + esc(r.name) + "</code>"; }).join(", ") +
          ". Users have to be told this, and the answer should be in your docs.",
        fix: "Bound every parameter in code (a fee setter with no maximum is a drain function with extra steps), timelock the dangerous paths, split operational keys from upgrade keys, and emit an event on every privileged change."
      });
    }

    html += '<h3 style="margin-top:var(--s-7);font-size:1.05rem">Findings</h3>' +
      '<div class="hit-list" style="max-height:none;margin-top:var(--s-4)">' + findings.map(function (f) {
        return '<div class="hit" data-sev="' + f.sev + '"><div class="hit-top"><h4>' + esc(f.title) + '</h4><span class="sev sev-' + f.sev + '">' + f.sev + "</span></div>" +
          "<p>" + f.body + '</p><div class="fix"><b>Action:</b> ' + f.fix + "</div></div>";
      }).join("") + "</div>";

    out.innerHTML = html;
  }

  var SAMPLE = `// ILLUSTRATIVE — mixed access control
pragma solidity 0.8.24;

contract Protocol {
    address public owner;
    address public keeper;
    uint256 public feeBps;
    bool public paused;

    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }
    modifier onlyKeeper() { require(msg.sender == keeper, "not keeper"); _; }
    modifier whenNotPaused() { require(!paused, "paused"); _; }

    function deposit(uint256 amount) external whenNotPaused {}

    function harvest() external onlyKeeper {}

    function setFee(uint256 _feeBps) external onlyOwner { feeBps = _feeBps; }

    function setKeeper(address _keeper) external {          // <-- no guard
        keeper = _keeper;
    }

    function sweep(address token, address to) external {     // <-- no guard
        // moves value, callable by anyone
    }

    function emergencyWithdraw() external {
        require(tx.origin == owner, "not owner");            // <-- tx.origin
    }

    function pause() external onlyOwner { paused = true; }

    function totalAssets() external view returns (uint256) { return 0; }
}`;

  root.querySelector("#acl-run").addEventListener("click", function () { render(input.value); });
  root.querySelector("#acl-sample").addEventListener("click", function () { input.value = SAMPLE; render(SAMPLE); });
  root.querySelector("#acl-clear").addEventListener("click", function () { input.value = ""; render(""); input.focus(); });
  input.addEventListener("keydown", function (e) { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); render(input.value); } });
  render("");
  window.SENTRYX_acl = { analyse: analyse };
})();
