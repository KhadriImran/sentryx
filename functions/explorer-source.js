/* Netlify Functions wrapper — deploy path: /.netlify/functions/explorer-source
   Set SOURCE_PROXY = "/.netlify/functions/explorer-source" in js/chain-tools.js */
"use strict";
const { handle } = require("./_lib/explorer-source.js");

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const { status, body } = await handle(q.address, q.chainid);
  return {
    statusCode: status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": process.env.ALLOWED_ORIGIN || "*",
      "cache-control": "public, max-age=3600"
    },
    body: JSON.stringify(body)
  };
};
