/* Netlify Functions wrapper — deploy path: /.netlify/functions/deep-scan
   Set AI_ENDPOINT = "/.netlify/functions/deep-scan" in js/deep-scan.js */
"use strict";
const { handle } = require("./_lib/deep-scan.js");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: "POST only" }) };
  }
  let payload = {};
  try { payload = JSON.parse(event.body || "{}"); }
  catch (e) { return { statusCode: 400, body: JSON.stringify({ ok: false, error: "Invalid JSON" }) }; }
  const { status, body } = await handle(payload);
  return {
    statusCode: status,
    headers: { "content-type": "application/json", "access-control-allow-origin": process.env.ALLOWED_ORIGIN || "*" },
    body: JSON.stringify(body)
  };
};
