/* Vercel Serverless Function — deploy path: /api/explorer-source
   Set SOURCE_PROXY = "/api/explorer-source" in js/chain-tools.js */
"use strict";
const { handle } = require("../functions/_lib/explorer-source.js");

module.exports = async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const { status, body } = await handle(url.searchParams.get("address"), url.searchParams.get("chainid"));
  res.setHeader("content-type", "application/json");
  res.setHeader("access-control-allow-origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("cache-control", "public, max-age=3600");
  res.status(status).end(JSON.stringify(body));
};
