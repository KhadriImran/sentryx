/* Vercel Serverless Function — deploy path: /api/deep-scan
   Set AI_ENDPOINT = "/api/deep-scan" in js/deep-scan.js */
"use strict";
const { handle } = require("../functions/_lib/deep-scan.js");

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).end(JSON.stringify({ ok: false, error: "POST only" })); return; }
  let payload = req.body;
  if (typeof payload === "string") { try { payload = JSON.parse(payload); } catch (e) { payload = {}; } }
  const { status, body } = await handle(payload || {});
  res.setHeader("content-type", "application/json");
  res.setHeader("access-control-allow-origin", process.env.ALLOWED_ORIGIN || "*");
  res.status(status).end(JSON.stringify(body));
};
