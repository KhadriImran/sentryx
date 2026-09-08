/* ==========================================================================
   SENTRYX — lightweight Solidity parser ("AST-lite")
   ---------------------------------------------------------------------------
   Shared by the storage-layout, gas, access-control and deep-scan tools.
   This is a pragmatic regex + brace-matching parser, NOT a real compiler
   front end. It is accurate enough for the analyses these tools perform and
   deliberately reports what it could not understand rather than guessing.

   Known limits (surfaced in the UI, not hidden):
     • Inheritance is resolved only across contracts present in the same paste.
     • `using … for` and user-defined value types are treated as opaque.
     • Assembly blocks are not interpreted.
     • Struct layouts are computed, but nested struct arrays are approximated.

   API — window.SENTRYX_sol
     strip(src)            -> source with comments and string literals blanked
     contracts(src)        -> [{ kind, name, bases, body, start }]
     stateVars(body)       -> [{ type, name, visibility, constant, immutable, line, raw }]
     functions(body)       -> [{ name, kind, params, visibility, mutability,
                                 modifiers, body, line, raw, signature }]
     structs(body)         -> { Name: [{type,name}] }
     enums(body)           -> { Name: memberCount }
     typeSize(type, ctx)   -> bytes a type occupies, or null if dynamic/unknown
     layout(vars, ctx)     -> [{ slot, offset, size, type, name, packed }]
     resolveInherited(src, name) -> ordered state vars including parents
   ========================================================================== */
(function (global) {
  "use strict";

  /* ------------------------------------------------------------- stripping */
  // Replace comments and string literals with spaces, preserving offsets and
  // line numbers so every reported line number stays correct.
  function strip(src) {
    var out = src.split("");
    var i = 0, n = src.length, inLine = false, inBlock = false, q = null;
    while (i < n) {
      var c = src[i], c2 = src[i + 1];
      if (inLine) {
        if (c === "\n") inLine = false; else out[i] = " ";
      } else if (inBlock) {
        if (c === "*" && c2 === "/") { out[i] = " "; out[i + 1] = " "; i += 2; inBlock = false; continue; }
        if (c !== "\n") out[i] = " ";
      } else if (q) {
        if (c === "\\") { out[i] = " "; if (src[i + 1] !== "\n") out[i + 1] = " "; i += 2; continue; }
        if (c === q) q = null;
        if (c !== "\n") out[i] = " ";
      } else {
        if (c === "/" && c2 === "/") { inLine = true; out[i] = " "; out[i + 1] = " "; i += 2; continue; }
        if (c === "/" && c2 === "*") { inBlock = true; out[i] = " "; out[i + 1] = " "; i += 2; continue; }
        if (c === '"' || c === "'") { q = c; out[i] = " "; }
      }
      i++;
    }
    return out.join("");
  }

  function lineAt(src, index) { return src.slice(0, index).split("\n").length; }

  // Return the index just past the block opened by the '{' at or after `from`.
  function matchBrace(src, from) {
    var i = src.indexOf("{", from);
    if (i === -1) return -1;
    var depth = 0;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") { depth--; if (depth === 0) return i; }
    }
    return -1;
  }

  /* ------------------------------------------------------------- contracts */
  function contracts(src) {
    var clean = strip(src), out = [];
    var re = /\b(abstract\s+contract|contract|library|interface)\s+([A-Za-z_]\w*)\s*(is\s+([^{]+))?\{/g, m;
    while ((m = re.exec(clean)) !== null) {
      var open = clean.indexOf("{", m.index + m[0].length - 1);
      var close = matchBrace(clean, m.index);
      if (close === -1) continue;
      out.push({
        kind: m[1].replace("abstract ", ""),
        abstract: m[1].indexOf("abstract") === 0,
        name: m[2],
        bases: m[4] ? m[4].split(",").map(function (s) { return s.trim().replace(/\(.*/, "").trim(); }).filter(Boolean) : [],
        body: src.slice(open + 1, close),
        cleanBody: clean.slice(open + 1, close),
        start: m.index,
        line: lineAt(src, m.index)
      });
    }
    return out;
  }

  /* ---------------------------------------------------------- state vars */
  var ELEMENTARY = /^(u?int\d*|address|bool|byte|bytes\d*|string)$/;

  function stateVars(body, cleanBody) {
    var clean = cleanBody || strip(body);
    var vars = [];
    // Walk top-level statements only (depth 0 inside the contract body).
    var depth = 0, stmtStart = 0, i;
    for (i = 0; i < clean.length; i++) {
      var c = clean[i];
      if (c === "{" || c === "(" || c === "[") depth++;
      else if (c === "}" || c === ")" || c === "]") depth--;
      else if (c === ";" && depth === 0) {
        pushVar(clean.slice(stmtStart, i), body.slice(stmtStart, i), stmtStart);
        stmtStart = i + 1;
      } else if (c === "}" && depth === 0) {
        stmtStart = i + 1;
      }
      // skip whole function/modifier/struct bodies
      if (depth === 1 && c === "{") {
        var end = matchBrace(clean, i);
        if (end !== -1) { i = end; depth = 0; stmtStart = end + 1; }
      }
    }

    function pushVar(stmtClean, stmtRaw, offset) {
      var s = stmtClean.trim();
      if (!s) return;
      // exclude declarations that are not state variables
      if (/^(function|modifier|event|error|struct|enum|using|constructor|receive|fallback|import|pragma|type)\b/.test(s)) return;
      if (/^\s*$/.test(s)) return;
      // Strip any initialiser — but only at a top-level '=' that is not part of
      // '=>' (mapping arrow), '==', '>=', '<=' or '!='.
      var decl = s, d = 0;
      for (var k = 0; k < s.length; k++) {
        var ch = s[k];
        if (ch === "(" || ch === "[") d++;
        else if (ch === ")" || ch === "]") d--;
        else if (ch === "=" && d === 0) {
          if (s[k + 1] === ">" || s[k + 1] === "=") continue;
          if (k > 0 && /[=!<>]/.test(s[k - 1])) continue;
          decl = s.slice(0, k);
          break;
        }
      }
      decl = decl.trim();
      // mapping(...) name  |  Type[..] name  |  Type name
      var mm = decl.match(/^(mapping\s*\(.*\)|[A-Za-z_][\w.]*(\s*\[[^\]]*\])*)\s+((public|private|internal|constant|immutable|override|transient)\s+)*([A-Za-z_]\w*)$/);
      var type = null, name = null;
      if (mm) { type = mm[1].replace(/\s+/g, " ").trim(); name = mm[5]; }
      else {
        // fall back: last identifier is the name, everything before is the type
        var parts = decl.split(/\s+/).filter(Boolean);
        if (parts.length < 2) return;
        name = parts[parts.length - 1];
        if (!/^[A-Za-z_]\w*$/.test(name)) return;
        type = parts.slice(0, -1)
          .filter(function (p) { return !/^(public|private|internal|constant|immutable|override|transient)$/.test(p); })
          .join(" ").trim();
      }
      if (!type || !name) return;
      if (/^(returns|memory|storage|calldata)$/.test(name)) return;
      vars.push({
        type: type,
        name: name,
        visibility: (decl.match(/\b(public|private|internal)\b/) || [null, "internal"])[1],
        constant: /\bconstant\b/.test(decl),
        immutable: /\bimmutable\b/.test(decl),
        transient: /\btransient\b/.test(decl),
        raw: stmtRaw.trim(),
        line: lineAt(body, offset)
      });
    }
    return vars;
  }

  /* ----------------------------------------------------------- functions */
  function functions(body, cleanBody) {
    var clean = cleanBody || strip(body);
    var out = [];
    var re = /\b(function\s+([A-Za-z_]\w*)|constructor|receive|fallback)\s*\(([^)]*)\)([^{;]*)(\{|;)/g, m;
    while ((m = re.exec(clean)) !== null) {
      var kind = m[1].indexOf("function") === 0 ? "function" : m[1];
      var name = kind === "function" ? m[2] : kind;
      var attrs = m[4] || "";
      var fnBody = "";
      if (m[5] === "{") {
        var close = matchBrace(clean, m.index + m[0].length - 1);
        if (close !== -1) fnBody = body.slice(clean.indexOf("{", m.index + m[0].length - 1) + 1, close);
      }
      var mods = (attrs.match(/\b[A-Za-z_]\w*(\s*\([^)]*\))?/g) || []).filter(function (t) {
        return !/^(public|private|internal|external|pure|view|payable|returns|virtual|override|memory|storage|calldata|nonpayable)\b/.test(t.trim());
      }).map(function (t) { return t.trim(); });
      var paramTypes = (m[3] || "").split(",").map(function (p) {
        p = p.trim(); if (!p) return null;
        return p.split(/\s+/)[0];
      }).filter(Boolean);
      out.push({
        kind: kind,
        name: name,
        params: m[3] ? m[3].trim() : "",
        paramTypes: paramTypes,
        signature: kind === "function" ? name + "(" + paramTypes.join(",") + ")" : null,
        visibility: (attrs.match(/\b(public|external|internal|private)\b/) || [null, kind === "function" ? "public" : "n/a"])[1],
        mutability: (attrs.match(/\b(pure|view|payable)\b/) || [null, "nonpayable"])[1],
        modifiers: mods,
        virtual: /\bvirtual\b/.test(attrs),
        override: /\boverride\b/.test(attrs),
        body: fnBody,
        isAbstract: m[5] === ";",
        line: lineAt(body, m.index),
        raw: m[0]
      });
    }
    return out;
  }

  function modifiersDefined(body, cleanBody) {
    var clean = cleanBody || strip(body), out = [], m;
    var re = /\bmodifier\s+([A-Za-z_]\w*)\s*(\([^)]*\))?\s*\{/g;
    while ((m = re.exec(clean)) !== null) {
      var close = matchBrace(clean, m.index);
      out.push({ name: m[1], body: close !== -1 ? body.slice(clean.indexOf("{", m.index) + 1, close) : "" });
    }
    return out;
  }

  function structs(body, cleanBody) {
    var clean = cleanBody || strip(body), out = {}, m;
    var re = /\bstruct\s+([A-Za-z_]\w*)\s*\{/g;
    while ((m = re.exec(clean)) !== null) {
      var close = matchBrace(clean, m.index);
      if (close === -1) continue;
      var inner = clean.slice(clean.indexOf("{", m.index) + 1, close);
      out[m[1]] = inner.split(";").map(function (f) {
        f = f.trim(); if (!f) return null;
        var parts = f.split(/\s+/).filter(Boolean);
        if (parts.length < 2) return null;
        return { type: parts.slice(0, -1).join(" "), name: parts[parts.length - 1] };
      }).filter(Boolean);
    }
    return out;
  }

  function enums(body, cleanBody) {
    var clean = cleanBody || strip(body), out = {}, m;
    var re = /\benum\s+([A-Za-z_]\w*)\s*\{([^}]*)\}/g;
    while ((m = re.exec(clean)) !== null) {
      out[m[1]] = m[2].split(",").map(function (s) { return s.trim(); }).filter(Boolean).length;
    }
    return out;
  }

  /* ------------------------------------------------------- storage layout */
  // Bytes a type occupies inside a slot. null = takes whole slots / unknown.
  function typeSize(type, ctx) {
    ctx = ctx || {};
    var t = String(type).trim().replace(/\s+/g, " ");

    if (/^mapping\s*\(/.test(t)) return { size: 32, whole: true, dynamic: true, note: "mapping — occupies one slot as a hash base" };
    if (/\[\s*\]$/.test(t)) return { size: 32, whole: true, dynamic: true, note: "dynamic array — slot holds the length" };

    var fixedArr = t.match(/^(.+)\[\s*(\d+)\s*\]$/);
    if (fixedArr) {
      var el = typeSize(fixedArr[1], ctx);
      var count = parseInt(fixedArr[2], 10);
      if (!el || el.unknown) return { size: 32 * count, whole: true, unknown: true, note: "fixed array of an unknown type" };
      var perSlot = el.whole ? 1 : Math.floor(32 / el.size);
      var slots = el.whole ? count * Math.ceil(el.size / 32) : Math.ceil(count / perSlot);
      return { size: slots * 32, whole: true, note: "fixed array — " + slots + " slot" + (slots === 1 ? "" : "s") };
    }

    if (t === "string" || t === "bytes") return { size: 32, whole: true, dynamic: true, note: "dynamic — short values inline, long values hashed" };
    if (t === "address" || t === "address payable") return { size: 20 };
    if (t === "bool") return { size: 1 };
    if (t === "byte") return { size: 1 };

    var b = t.match(/^bytes(\d+)$/);
    if (b) return { size: parseInt(b[1], 10) };

    var n = t.match(/^u?int(\d*)$/);
    if (n) return { size: (n[1] ? parseInt(n[1], 10) : 256) / 8 };

    if (ctx.enums && ctx.enums[t] != null) return { size: ctx.enums[t] > 256 ? 2 : 1, note: "enum" };

    if (ctx.structs && ctx.structs[t]) {
      var inner = layout(ctx.structs[t].map(function (f) { return { type: f.type, name: f.name }; }), ctx);
      var slots2 = inner.length ? inner[inner.length - 1].slot + Math.max(1, Math.ceil(inner[inner.length - 1].size / 32)) : 1;
      return { size: slots2 * 32, whole: true, note: "struct — " + slots2 + " slot" + (slots2 === 1 ? "" : "s"), inner: inner };
    }

    // Contract / interface / unknown user type -> behaves as an address
    if (/^[A-Z]/.test(t)) return { size: 20, note: "contract or interface reference (address-sized)" };

    return { size: 32, whole: true, unknown: true, note: "unrecognised type — assumed to take a full slot" };
  }

  // Compute slot/offset assignments with packing, exactly as solc does.
  function layout(vars, ctx) {
    var out = [], slot = 0, offset = 0;
    vars.forEach(function (v) {
      if (v.constant || v.immutable) {
        out.push({ slot: null, offset: null, size: 0, type: v.type, name: v.name,
                   skip: true, reason: v.constant ? "constant — lives in bytecode" : "immutable — lives in bytecode",
                   line: v.line, visibility: v.visibility });
        return;
      }
      if (v.transient) {
        out.push({ slot: null, offset: null, size: 0, type: v.type, name: v.name,
                   skip: true, reason: "transient — EIP-1153 transient storage, not persistent", line: v.line, visibility: v.visibility });
        return;
      }
      var info = typeSize(v.type, ctx);
      if (info.whole) {
        if (offset > 0) { slot++; offset = 0; }
        var slots = Math.max(1, Math.ceil(info.size / 32));
        out.push({ slot: slot, offset: 0, size: info.size, slots: slots, type: v.type, name: v.name,
                   note: info.note, dynamic: info.dynamic, unknown: info.unknown, inner: info.inner,
                   line: v.line, visibility: v.visibility, packed: false });
        slot += slots; offset = 0;
      } else {
        if (offset + info.size > 32) { slot++; offset = 0; }
        out.push({ slot: slot, offset: offset, size: info.size, slots: 1, type: v.type, name: v.name,
                   note: info.note, line: v.line, visibility: v.visibility, packed: offset > 0 });
        offset += info.size;
        if (offset === 32) { slot++; offset = 0; }
      }
    });
    // mark any var that shares a slot with another
    var bySlot = {};
    out.forEach(function (e) { if (e.slot != null) (bySlot[e.slot] = bySlot[e.slot] || []).push(e); });
    Object.keys(bySlot).forEach(function (k) {
      if (bySlot[k].length > 1) bySlot[k].forEach(function (e) { e.packed = true; });
    });
    return out;
  }

  /* --------------------------------------------------- inheritance walker */
  // Returns state vars in solc's layout order: most-base-first, then the
  // contract's own. Only resolves parents present in the same source.
  function resolveInherited(src, contractName) {
    var all = contracts(src);
    var byName = {};
    all.forEach(function (c) { byName[c.name] = c; });
    var target = byName[contractName] || all[all.length - 1];
    if (!target) return { vars: [], missing: [], chain: [] };

    var missing = [], chain = [], seen = {};
    (function walk(c) {
      if (!c || seen[c.name]) return;
      seen[c.name] = true;
      c.bases.forEach(function (b) {
        if (byName[b]) walk(byName[b]);
        else if (missing.indexOf(b) === -1) missing.push(b);
      });
      chain.push(c);
    })(target);

    var vars = [];
    chain.forEach(function (c) {
      stateVars(c.body, c.cleanBody).forEach(function (v) {
        v.origin = c.name;
        vars.push(v);
      });
    });
    return { vars: vars, missing: missing, chain: chain.map(function (c) { return c.name; }), target: target };
  }

  global.SENTRYX_sol = {
    strip: strip, contracts: contracts, stateVars: stateVars, functions: functions,
    modifiersDefined: modifiersDefined, structs: structs, enums: enums,
    typeSize: typeSize, layout: layout, resolveInherited: resolveInherited,
    matchBrace: matchBrace, lineAt: lineAt, ELEMENTARY: ELEMENTARY
  };
  if (typeof module !== "undefined" && module.exports) module.exports = global.SENTRYX_sol;
})(typeof window !== "undefined" ? window : globalThis);
