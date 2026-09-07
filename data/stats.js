/* ==========================================================================
   SENTRYX — stats band data
   Drop real numbers into `value`. While `value` is null the site shows the
   `placeholder` text and styles the cell as a placeholder (dimmed).
   NOTHING here is invented: every value ships as null until you have a real
   figure. `note` is optional small print under the label.
   Loaded as a JS file (not fetched JSON) so the site also works when opened
   from the local filesystem (file://) without a server.
   ========================================================================== */
window.SENTRYX_STATS = {
  updated: "YYYY-MM-DD",
  items: [
    { label: "Findings reported",      value: null, placeholder: "—", unit: "",  note: "Placeholder — populate from published reports" },
    { label: "Critical / High resolved", value: null, placeholder: "—", unit: "",  note: "Placeholder — count of C/H findings verified fixed" },
    { label: "Protocols reviewed",      value: null, placeholder: "—", unit: "",  note: "Placeholder — public engagements only" },
    { label: "Chains covered",          value: 11,   placeholder: "—", unit: "+", note: "EVM L1/L2s, Solana, Aptos, Sui, Starknet (see Services)" }
  ]
};
