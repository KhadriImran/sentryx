/* ==========================================================================
   SENTRYX — on-chain tools
     1. Verified source fetch  (feeds the pre-check / deep scan)
     2. Proxy detector         (EIP-1967 / 1822 / 1167 / beacon / diamond)
   ---------------------------------------------------------------------------
   CONFIGURATION

   SOURCE_PROXY — a serverless endpoint that holds your explorer API key.
     Ship the included function (see functions/explorer-source.js) and set:
       const SOURCE_PROXY = "/.netlify/functions/explorer-source";   // Netlify
       const SOURCE_PROXY = "/api/explorer-source";                  // Vercel
     Request:  GET  <SOURCE_PROXY>?address=0x…&chainid=1
     Response: { ok, name, source, compiler, optimization, runs, proxy, implementation, license }

   With no proxy configured the tool offers "bring your own key": the visitor
   pastes their own free Etherscan key, which is stored only in their browser's
   localStorage and sent directly to Etherscan. We never see it.

   RPC endpoints are public and CORS-enabled; override RPCS to use your own.
   ========================================================================== */
(function () {
  "use strict";

  /* ================================================== CONFIGURATION ===== */
  var SOURCE_PROXY = "";                                  // <-- set to enable keyless fetching
  var EXPLORER_API = "https://api.etherscan.io/v2/api";    // Etherscan V2 multichain endpoint

  var CHAINS = [
    { id: 1,     name: "Ethereum",  rpc: "https://eth.llamarpc.com" },
    { id: 42161, name: "Arbitrum",  rpc: "https://arb1.arbitrum.io/rpc" },
    { id: 10,    name: "Optimism",  rpc: "https://mainnet.optimism.io" },
    { id: 8453,  name: "Base",      rpc: "https://mainnet.base.org" },
    { id: 137,   name: "Polygon",   rpc: "https://polygon-rpc.com" },
    { id: 56,    name: "BNB Chain", rpc: "https://bsc-dataseed.binance.org" },
    { id: 43114, name: "Avalanche", rpc: "https://api.avax.network/ext/bc/C/rpc" },
    { id: 59144, name: "Linea",     rpc: "https://rpc.linea.build" },
    { id: 534352, name: "Scroll",   rpc: "https://rpc.scroll.io" }
  ];

  // EIP-1967 and friends. Values are the standard, well-known slots.
  var SLOTS = {
    "EIP-1967 implementation": "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
    "EIP-1967 admin":          "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103",
    "EIP-1967 beacon":         "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50",
    "EIP-1822 proxiable":      "0xc5f16f0fcc639fa48a6947836d9850f504798523bf8c9a3a87d5876cf622bcf7",
    "OZ legacy implementation":"0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3",
    "OZ legacy admin":         "0x10d6a54a4754c8869d6886b5f5d7fbfa5b4522237ea5c60d11bc4e7a1ff9390b"
  };

  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var ADDR = /^0x[a-fA-F0-9]{40}$/;
  var LS_KEY = "sentryx.explorerKey";

  function chainById(id) { return CHAINS.filter(function (c) { return c.id === +id; })[0] || CHAINS[0]; }

  /* ------------------------------------------------------------ RPC call */
  function rpc(url, method, params) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: method, params: params })
    }).then(function (r) {
      if (!r.ok) throw new Error("RPC HTTP " + r.status);
      return r.json();
    }).then(function (j) {
      if (j.error) throw new Error(j.error.message || "RPC error");
      return j.result;
    });
  }

  function slotToAddress(word) {
    if (!word || /^0x0*$/.test(word)) return null;
    var a = "0x" + word.slice(-40);
    return /^0x0{40}$/.test(a) ? null : a;
  }

  /* =============================================== 1. SOURCE FETCH ===== */
  function fetchSource(address, chainid, userKey) {
    if (SOURCE_PROXY) {
      return fetch(SOURCE_PROXY + "?address=" + encodeURIComponent(address) + "&chainid=" + encodeURIComponent(chainid))
        .then(function (r) { return r.json(); })
        .then(function (j) { if (!j.ok) throw new Error(j.error || "Proxy returned an error"); return j; });
    }
    if (!userKey) return Promise.reject(new Error("NO_KEY"));
    var url = EXPLORER_API + "?chainid=" + encodeURIComponent(chainid) +
      "&module=contract&action=getsourcecode&address=" + encodeURIComponent(address) +
      "&apikey=" + encodeURIComponent(userKey);
    return fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      if (j.status !== "1" || !j.result || !j.result.length) {
        throw new Error(j.result && typeof j.result === "string" ? j.result : (j.message || "Explorer returned no result"));
      }
      var r0 = j.result[0];
      if (!r0.SourceCode) throw new Error("This contract's source is not verified on the explorer.");
      return {
        ok: true,
        name: r0.ContractName,
        source: flatten(r0.SourceCode),
        compiler: r0.CompilerVersion,
        optimization: r0.OptimizationUsed === "1",
        runs: r0.Runs,
        license: r0.LicenseType,
        proxy: r0.Proxy === "1",
        implementation: r0.Implementation || null
      };
    });
  }

  // Etherscan returns either raw Solidity, a JSON map of files, or a
  // double-brace-wrapped standard-json-input. Flatten all three.
  function flatten(sourceCode) {
    var s = String(sourceCode).trim();
    if (s.indexOf("{{") === 0) s = s.slice(1, -1);
    if (s[0] !== "{") return s;
    try {
      var j = JSON.parse(s);
      var files = j.sources || j;
      return Object.keys(files).map(function (path) {
        var content = files[path].content != null ? files[path].content : files[path];
        return "// ==== " + path + " ====\n" + content;
      }).join("\n\n");
    } catch (e) { return String(sourceCode); }
  }

  /* =============================================== 2. PROXY DETECT ===== */
  function detectProxy(address, chainid) {
    var chain = chainById(chainid);
    var found = [], code = "";
    return rpc(chain.rpc, "eth_getCode", [address, "latest"]).then(function (c) {
      code = c || "0x";
      if (code === "0x") throw new Error("No contract code at this address on " + chain.name + " — it is an EOA, or the contract is on a different chain.");
      var reads = Object.keys(SLOTS).map(function (label) {
        return rpc(chain.rpc, "eth_getStorageAt", [address, SLOTS[label], "latest"])
          .then(function (w) { return { label: label, word: w, addr: slotToAddress(w) }; })
          .catch(function () { return { label: label, word: null, addr: null }; });
      });
      return Promise.all(reads);
    }).then(function (results) {
      results.forEach(function (r) { if (r.addr) found.push(r); });

      // EIP-1167 minimal proxy — the target is embedded in the runtime code
      var minimal = code.match(/^0x363d3d373d3d3d363d73([0-9a-fA-F]{40})5af43d82803e903d91602b57fd5bf3/);
      var minimalTarget = minimal ? "0x" + minimal[1] : null;

      // Diamond loupe — facets() selector 0x7a0ed627
      return rpc(chain.rpc, "eth_call", [{ to: address, data: "0x7a0ed627" }, "latest"])
        .then(function (r) { return r && r !== "0x"; })
        .catch(function () { return false; })
        .then(function (isDiamond) {
          var impl = (found.filter(function (f) { return /implementation/i.test(f.label); })[0] || {}).addr || minimalTarget;
          var admin = (found.filter(function (f) { return /admin/i.test(f.label); })[0] || {}).addr;
          var beacon = (found.filter(function (f) { return /beacon/i.test(f.label); })[0] || {}).addr;
          var kind = minimalTarget ? "EIP-1167 minimal proxy"
            : isDiamond ? "EIP-2535 diamond"
            : beacon ? "Beacon proxy"
            : (admin && impl) ? "Transparent proxy (EIP-1967)"
            : impl ? "UUPS or EIP-1967 proxy"
            : found.some(function (f) { return /proxiable/i.test(f.label); }) ? "EIP-1822 proxiable"
            : null;
          return {
            chain: chain, address: address, codeSize: (code.length - 2) / 2,
            kind: kind, slots: found, implementation: impl, admin: admin, beacon: beacon,
            isDiamond: isDiamond, minimal: minimalTarget
          };
        });
    }).then(function (res) {
      if (!res.admin) return res;
      // Is the admin an EOA or a contract? A single EOA admin is a finding.
      return rpc(chain.rpc, "eth_getCode", [res.admin, "latest"]).then(function (c) {
        res.adminIsContract = !!(c && c !== "0x");
        return res;
      }).catch(function () { return res; });
    });
  }

  /* ================================================= UI: SOURCE FETCH == */
  var fetchRoot = document.getElementById("fetch-tool");
  if (fetchRoot) {
    var fAddr = fetchRoot.querySelector("#cf-addr");
    var fChain = fetchRoot.querySelector("#cf-chain");
    var fOut = fetchRoot.querySelector("#cf-out");
    var fKeyWrap = fetchRoot.querySelector("#cf-key-wrap");
    var fKey = fetchRoot.querySelector("#cf-key");
    var fSrc = fetchRoot.querySelector("#cf-source");

    fChain.innerHTML = CHAINS.map(function (c) { return '<option value="' + c.id + '">' + c.name + "</option>"; }).join("");
    if (SOURCE_PROXY) fKeyWrap.hidden = true;
    else {
      try { fKey.value = localStorage.getItem(LS_KEY) || ""; } catch (e) {}
      fKey.addEventListener("change", function () { try { localStorage.setItem(LS_KEY, fKey.value.trim()); } catch (e) {} });
    }

    fetchRoot.querySelector("#cf-run").addEventListener("click", function () {
      var addr = fAddr.value.trim();
      if (!ADDR.test(addr)) {
        fOut.innerHTML = '<div class="disclaimer"><strong>Not a valid address.</strong> Paste a 42-character contract address beginning 0x.</div>';
        return;
      }
      fOut.innerHTML = '<p class="filter-empty">Fetching verified source…</p>';
      fSrc.value = "";
      fetchSource(addr, fChain.value, fKey ? fKey.value.trim() : "").then(function (d) {
        fSrc.value = d.source;
        var loc = d.source.split("\n").filter(function (l) { return l.trim(); }).length;
        fOut.innerHTML =
          '<div class="est-rows" style="border:0;padding:0">' +
            r2("Contract name", esc(d.name || "—")) +
            r2("Compiler", esc(d.compiler || "—")) +
            r2("Optimizer", d.optimization ? "enabled (" + esc(d.runs || "?") + " runs)" : "disabled") +
            r2("License", esc(d.license || "—")) +
            r2("Lines fetched", String(loc)) +
            (d.proxy ? r2("Explorer flag", "Marked as a proxy" + (d.implementation ? " → " + esc(d.implementation) : "")) : "") +
          "</div>" +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:var(--s-5)">' +
            '<button class="btn btn-primary btn-sm" id="cf-to-precheck" type="button">Run the risk pre-check</button>' +
            '<button class="btn btn-ghost btn-sm" id="cf-copy" type="button">Copy source</button>' +
            (d.implementation ? '<button class="btn btn-ghost btn-sm" id="cf-impl" type="button">Fetch implementation instead</button>' : "") +
          "</div>";
        var toPre = fOut.querySelector("#cf-to-precheck");
        if (toPre) toPre.addEventListener("click", function () {
          sessionStorage.setItem("sentryx.pendingSource", d.source);
          location.href = "contract-risk-precheck.html#loaded";
        });
        var cp = fOut.querySelector("#cf-copy");
        if (cp) cp.addEventListener("click", function () {
          navigator.clipboard.writeText(d.source).then(function () { cp.textContent = "Copied"; setTimeout(function () { cp.textContent = "Copy source"; }, 1500); });
        });
        var im = fOut.querySelector("#cf-impl");
        if (im) im.addEventListener("click", function () { fAddr.value = d.implementation; fetchRoot.querySelector("#cf-run").click(); });
      }).catch(function (err) {
        if (err.message === "NO_KEY") {
          fOut.innerHTML = '<div class="disclaimer"><strong>An explorer API key is needed.</strong> This site has no backend, so the request goes directly from your browser to Etherscan. ' +
            'Get a free key at <a href="https://etherscan.io/apis" rel="noopener" target="_blank">etherscan.io/apis</a> and paste it above — it is stored only in your browser and never sent to us. ' +
            '<br><br>Site owner: set <code>SOURCE_PROXY</code> in <code>js/chain-tools.js</code> to remove this step for everyone.</div>';
        } else {
          fOut.innerHTML = '<div class="disclaimer"><strong>Could not fetch that contract.</strong> ' + esc(err.message) + "</div>";
        }
      });
    });
    fAddr.addEventListener("keydown", function (e) { if (e.key === "Enter") fetchRoot.querySelector("#cf-run").click(); });
  }

  /* ================================================== UI: PROXY DETECT == */
  var pxRoot = document.getElementById("proxy-tool");
  if (pxRoot) {
    var pAddr = pxRoot.querySelector("#px-addr");
    var pChain = pxRoot.querySelector("#px-chain");
    var pOut = pxRoot.querySelector("#px-out");
    pChain.innerHTML = CHAINS.map(function (c) { return '<option value="' + c.id + '">' + c.name + "</option>"; }).join("");

    pxRoot.querySelector("#px-run").addEventListener("click", function () {
      var addr = pAddr.value.trim();
      if (!ADDR.test(addr)) {
        pOut.innerHTML = '<div class="disclaimer"><strong>Not a valid address.</strong> Paste a 42-character contract address beginning 0x.</div>';
        return;
      }
      pOut.innerHTML = '<p class="filter-empty">Reading storage slots…</p>';
      detectProxy(addr, pChain.value).then(function (d) { pOut.innerHTML = renderProxy(d); })
        .catch(function (err) { pOut.innerHTML = '<div class="disclaimer"><strong>Lookup failed.</strong> ' + esc(err.message) + "</div>"; });
    });
    pAddr.addEventListener("keydown", function (e) { if (e.key === "Enter") pxRoot.querySelector("#px-run").click(); });

    pxRoot.querySelectorAll("[data-example]").forEach(function (b) {
      b.addEventListener("click", function () {
        pAddr.value = b.dataset.example;
        pChain.value = b.dataset.chain || "1";
        pxRoot.querySelector("#px-run").click();
      });
    });
  }

  function renderProxy(d) {
    var findings = [];
    if (!d.kind) {
      findings.push({ sev: "info", title: "No proxy pattern detected",
        body: "None of the standard proxy storage slots hold an address, the runtime code is not an EIP-1167 minimal proxy, and the diamond loupe did not respond. This looks like a regular contract — though a non-standard custom proxy would not be detected." });
    } else {
      findings.push({ sev: "info", title: "Detected: " + d.kind,
        body: "Upgradeability means the code at this address can be replaced. The security of everything above it depends on who controls the upgrade path." });
    }
    if (d.admin) {
      findings.push({
        sev: d.adminIsContract === false ? "critical" : "medium",
        title: d.adminIsContract === false ? "Proxy admin is an EOA" : "Proxy admin is a contract",
        body: d.adminIsContract === false
          ? "The admin slot holds an externally-owned account, not a multisig or timelock. A single compromised private key can replace the implementation and take control of everything the proxy holds — with no delay and no warning to users."
          : "The admin is a contract. Verify it is a multisig with a real threshold and independent signers, and that upgrades pass through a timelock long enough for users to exit."
      });
    }
    if (d.kind && !d.admin && !d.beacon && !d.minimal && !d.isDiamond) {
      findings.push({ sev: "medium", title: "No admin slot set — likely UUPS",
        body: "Upgrade authority lives in the implementation contract rather than in a proxy admin slot. Read <code>_authorizeUpgrade</code> in the implementation: if a future version omits it, the proxy becomes permanently unupgradeable; if the implementation was left initialisable, it can be hijacked directly." });
    }
    if (d.minimal) {
      findings.push({ sev: "info", title: "Minimal proxy (clone)",
        body: "EIP-1167 clones are not upgradeable — the target is hard-coded in the runtime bytecode. Review the target implementation and the factory that deployed this clone." });
    }
    if (d.isDiamond) {
      findings.push({ sev: "medium", title: "Diamond (EIP-2535)",
        body: "The real attack surface is the union of every facet plus the selector routing table. Enumerate the facets, check for selector collisions between them, and confirm who can call <code>diamondCut</code>." });
    }

    var html = '<div class="est-rows" style="border:0;padding:0;margin-bottom:var(--s-5)">' +
      r2("Chain", esc(d.chain.name)) +
      r2("Address", esc(d.address)) +
      r2("Runtime code size", d.codeSize.toLocaleString() + " bytes" + (d.codeSize > 24576 ? " ⚠ over the 24,576-byte limit" : "")) +
      r2("Pattern", d.kind ? esc(d.kind) : "none detected") +
      (d.implementation ? r2("Implementation", link(d.implementation, d.chain)) : "") +
      (d.admin ? r2("Admin", link(d.admin, d.chain) + (d.adminIsContract === false ? '  <span class="sev sev-critical" style="padding:2px 6px">EOA</span>' : '  <span class="sev sev-info" style="padding:2px 6px">contract</span>')) : "") +
      (d.beacon ? r2("Beacon", link(d.beacon, d.chain)) : "") +
      "</div>";

    if (d.slots.length) {
      html += '<h3 style="font-size:1.05rem;margin-bottom:var(--s-3)">Storage slots read</h3>' +
        '<div class="table-wrap"><table class="cmp-table" style="min-width:640px"><thead><tr><th>Slot</th><th>Address</th></tr></thead><tbody>' +
        d.slots.map(function (s) {
          return "<tr><th scope='row'>" + esc(s.label) + '<div class="dim mono" style="font-size:10px;word-break:break-all;margin-top:3px">' + esc(SLOTS[s.label]) + "</div></th>" +
            "<td>" + link(s.addr, d.chain) + "</td></tr>";
        }).join("") + "</tbody></table></div>";
    }

    html += '<h3 style="font-size:1.05rem;margin:var(--s-6) 0 var(--s-3)">What this means</h3>' +
      '<div class="hit-list" style="max-height:none">' + findings.map(function (f) {
        return '<div class="hit" data-sev="' + f.sev + '"><div class="hit-top"><h4>' + esc(f.title) + '</h4><span class="sev sev-' + f.sev + '">' + f.sev + "</span></div><p>" + f.body + "</p></div>";
      }).join("") + "</div>";
    return html;
  }
  function link(addr, chain) {
    if (!addr) return '<span class="dim">—</span>';
    var base = { 1: "https://etherscan.io", 42161: "https://arbiscan.io", 10: "https://optimistic.etherscan.io",
                 8453: "https://basescan.org", 137: "https://polygonscan.com", 56: "https://bscscan.com",
                 43114: "https://snowtrace.io", 59144: "https://lineascan.build", 534352: "https://scrollscan.com" }[chain.id];
    return base ? '<a class="mono" href="' + base + "/address/" + addr + '" rel="noopener" target="_blank" style="word-break:break-all">' + esc(addr) + "</a>"
                : '<span class="mono" style="word-break:break-all">' + esc(addr) + "</span>";
  }
  function r2(k, v) { return '<div class="est-row"><span>' + k + '</span><span style="word-break:break-all">' + v + "</span></div>"; }

  window.SENTRYX_chain = { fetchSource: fetchSource, detectProxy: detectProxy, CHAINS: CHAINS, SLOTS: SLOTS, flatten: flatten };
})();
