/* ==========================================================================
   SENTRYX — verified source proxy (shared handler)
   ---------------------------------------------------------------------------
   Keeps your explorer API key server-side so the browser never sees it.
   Used by js/chain-tools.js when SOURCE_PROXY is set.

   ENVIRONMENT
     ETHERSCAN_API_KEY   required — one key works across chains on the V2 API
     ALLOWED_ORIGIN      optional — defaults to "*" (this endpoint returns only
                         public, already-verified source, so it is not sensitive)

   GET ?address=0x…&chainid=1
   -> { ok, name, source, compiler, optimization, runs, license, proxy, implementation }
   ========================================================================== */
"use strict";

const API = "https://api.etherscan.io/v2/api";
const ADDR = /^0x[a-fA-F0-9]{40}$/;
const ALLOWED_CHAINS = [1, 10, 56, 137, 8453, 42161, 43114, 59144, 534352];

// Etherscan returns raw Solidity, a JSON file map, or {{standard-json}}.
function flatten(sourceCode) {
  let s = String(sourceCode || "").trim();
  if (s.startsWith("{{")) s = s.slice(1, -1);
  if (!s.startsWith("{")) return s;
  try {
    const j = JSON.parse(s);
    const files = j.sources || j;
    return Object.keys(files)
      .map((p) => `// ==== ${p} ====\n${files[p].content != null ? files[p].content : files[p]}`)
      .join("\n\n");
  } catch (_) {
    return String(sourceCode);
  }
}

async function handle(address, chainid) {
  if (!ADDR.test(String(address || ""))) {
    return { status: 400, body: { ok: false, error: "Invalid address." } };
  }
  const chain = parseInt(chainid || "1", 10);
  if (!ALLOWED_CHAINS.includes(chain)) {
    return { status: 400, body: { ok: false, error: "Unsupported chain id." } };
  }
  const key = process.env.ETHERSCAN_API_KEY;
  if (!key) {
    return { status: 500, body: { ok: false, error: "ETHERSCAN_API_KEY is not set on the server." } };
  }

  const url = `${API}?chainid=${chain}&module=contract&action=getsourcecode` +
              `&address=${encodeURIComponent(address)}&apikey=${encodeURIComponent(key)}`;

  let j;
  try {
    const r = await fetch(url);
    j = await r.json();
  } catch (e) {
    return { status: 502, body: { ok: false, error: "Explorer request failed." } };
  }

  if (j.status !== "1" || !Array.isArray(j.result) || !j.result.length) {
    const msg = typeof j.result === "string" ? j.result : (j.message || "No result from the explorer.");
    return { status: 404, body: { ok: false, error: msg } };
  }
  const r0 = j.result[0];
  if (!r0.SourceCode) {
    return { status: 404, body: { ok: false, error: "This contract's source is not verified on the explorer." } };
  }
  return {
    status: 200,
    body: {
      ok: true,
      name: r0.ContractName,
      source: flatten(r0.SourceCode),
      compiler: r0.CompilerVersion,
      optimization: r0.OptimizationUsed === "1",
      runs: r0.Runs,
      license: r0.LicenseType,
      proxy: r0.Proxy === "1",
      implementation: r0.Implementation || null
    }
  };
}

module.exports = { handle, flatten, ALLOWED_CHAINS };
