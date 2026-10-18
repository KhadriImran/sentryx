# SENTRYX — website

Static HTML / CSS / JS. **No build step, no `npm install`, no `package.json`.**
Upload the folder and it works. Every page is a plain `.html` file you can open
and edit.

---

## 1. Quick start

```bash
# just open it
open index.html          # macOS      (works from the filesystem)
start index.html         # Windows

# or serve it locally (recommended — a couple of features prefer http://)
python3 -m http.server 8000
npx serve .              # if you have node
```

The only external requests are Google Fonts and GSAP from cdnjs. Offline, the
site still renders correctly with system-font fallbacks and static (non-scrubbed)
sections.

---

## 2. The palette, and why

**Hazard amber (`#ffa61a`) on near-black charcoal (`#08090b`).**

Amber is the colour of a warning light and of the `WARN` state in every terminal
a security engineer has ever read. It reads as *attention required* without the
hacker-green cliché, and against near-black it feels like industrial equipment
rather than a SaaS dashboard. Deliberately not the purple-blue gradient every
other security site uses.

It also leaves the **severity scale** free to carry meaning on its own — because
the accent is warm-orange, the severity colours (crimson / orange / yellow /
blue / slate) never compete with brand colour for the reader's attention. Severity
is the most important information on a security site, so it gets its own visual
language.

| Token | Value | Used for |
|---|---|---|
| `--bg-0` … `--bg-4` | `#08090b` → `#222731` | Surface elevations, dark to light |
| `--ink-0` … `--ink-3` | `#f3f1ea` → `#8f8d85` | Text, brightest to muted. All pass WCAG AA (≥4.5:1) on every surface |
| `--ink-4` | `#6b6a63` | **Decorative only** — outlines, strokes. Never body text |
| `--accent` | `#ffa61a` | Brand |
| `--cold` | `#6fb7ff` | Secondary accent — types in code, "fixed" states |
| `--sev-critical` … `--sev-info` | `#ff3355` → `#98a2b3` | Severity system |
| `--sev-fixed` | `#4ade80` | Remediated / verified |

**Fonts** (Google Fonts, `display: swap`):

- **Bricolage Grotesque** — display / headings. Characteristic, slightly condensed at heavy weights, signage-like.
- **Instrument Sans** — body. Clean grotesk, high legibility at small sizes.
- **JetBrains Mono** — code, finding IDs, severity labels, addresses, all mono UI chrome.

Everything above lives in **one `:root` block** at the top of `css/style.css`.
Change tokens there; do not change values in rules.

---

## 3. Where to change things

### Brand name

`SENTRYX` appears in markup (titles, headings, JSON-LD) as well as data files.
To rename:

```bash
# from the site root
grep -rl "SENTRYX\|Sentryx\|sentryx" --include="*.html" --include="*.js" --include="*.txt" --include="*.xml" . \
  | xargs sed -i '' 's/SENTRYX/NEWNAME/g; s/Sentryx/Newname/g; s/sentryx/newname/g'
```

Then update `data/site.js` (`name`, `parent`, `domain`, `email`, `social`) and
regenerate the OG images (section 6).

The parent line — *"A brand of Avanteia Private Limited"* — is in `data/site.js`
(`parent`) and in every page footer.

### The domain

Replace `https://sentryxaudit.com` everywhere. It appears in:

- `<link rel="canonical">` and Open Graph tags in every `.html`
- every JSON-LD block
- `sitemap.xml`, `robots.txt`, `llms.txt`
- `data/site.js` → `domain`

```bash
grep -rl "sentryx.example" . | xargs sed -i '' 's|https://sentryxaudit.com|https://yourdomain.com|g'
```

Also replace `sentryxaudit@gmail.com` with your real address.

### Content data files — edit these, not the markup

| File | Controls | Shown on |
|---|---|---|
| `data/site.js` | Brand name, parent line, domain, email, socials, chain and tooling lists | Everywhere |
| `data/pricing.js` | **All prices**, tier contents, LOC ranges, timelines, deliverables, comparison table | `pricing.html` |
| `data/services.js` | The 50+ service catalogue, grouped, each tagged `inhouse` or `partner` | `services.html` |
| `data/stats.js` | The homepage stats band | `index.html` |
| `data/severity.js` | Severity definitions, examples, remediation | Homepage band, Severity Explorer, report viewer |
| `data/findings.js` | The sample audit report (illustrative) | `tools/sample-audit-report.html` |
| `data/reports.js` | Published report portfolio | `reports.html` |
| `data/blog.js` | Research index cards | `blog/index.html` |
| `data/glossary.js` | 46 glossary terms, aliases, tags and cross-links | `glossary.html` |

They are plain `.js` files (`window.SENTRYX_X = {...}`) rather than JSON so the
site also works when opened directly from the filesystem, with no server and no
CORS problems.

### Prices

**One file: `data/pricing.js`.** Change `from`, `loc`, `timeline`, `researchers`,
`includes`, `deliverables` per tier. `from: null` renders as "Custom".

Starting prices are also written into prose in a few places (homepage service
cards, service-page FAQs, `llms.txt`). Search for `From $` and `from $` after
changing them.

The **estimator's** coefficients are separate and live in one `CONFIG` object at
the top of `js/estimator.js` — base fee, per-LOC rate, day rate, complexity /
chain / urgency multipliers, the quoted range width and the floor.

### Services

`data/services.js`. Each entry:

```js
{ group: "core",              // must match a group id in `groups`
  name: "Smart contract security audit",
  delivery: "inhouse",        // "inhouse" | "partner"  — drives the honesty tag
  flagship: "services/smart-contract-security-audit.html",  // optional detail page
  desc: "…" }
```

`delivery` is the honest-capability tag rendered on every card. Keep it accurate.

### Researcher profiles — deliberately absent

There is no team page and no researcher profiles anywhere on the site. This is a
positioning choice (the same one CertiK, Trail of Bits' marketing site and most
established firms make): the firm is the unit of credibility, not the individual.

What replaces it is a **staffing promise made in private**, stated in three places
and worth keeping accurate:

- `index.html` → the *How engagements run* section (`#staffing`, `#review-model`)
- `about.html` → the *How we staff* section (`#staffing`)
- `services.html` → the capability note (`inhouse` vs `partner` tags)

All three say the same thing: profiles are not published, but the scope document
names the reviewers assigned to the engagement before the client signs. If you
later decide to publish profiles, the CSS is still there — `.team-layout`,
`.team-card`, `.team-card .avatar` and `.team-card .socials` in `css/style.css`
are unused but intact, and the homepage section already uses that grid.

### Findings, stats and reports

`data/stats.js` ships every value as `null`, which renders a dimmed placeholder.
Set `value` to a real number to activate the animated counter.

`data/reports.js` contains one entry, flagged `illustrative: true`. Add real
reports as clients approve publication; delete the sample when you have real ones.

### AI assistant endpoint

`js/assistant.js`, top of the file:

```js
const API_ENDPOINT = "";   // e.g. "/.netlify/functions/assistant"
const API_HEADERS  = { "Content-Type": "application/json" };
```

**Request** (POST JSON):

```json
{ "message": "how much does an audit cost",
  "history": [{ "role": "user", "content": "…" }],
  "page": "/pricing.html",
  "source": "sentryx-web" }
```

**Response** — any one of `{"reply": "..."}`, `{"message": "..."}`, or an
OpenAI-shaped `{"choices":[{"message":{"content":"..."}}]}`.

Leave it empty and the widget runs in **scripted fallback mode**: a local intent
matcher over a ~24-topic knowledge base at the top of the same file, with no
network calls at all. The panel header tells the visitor which mode is active.

> **Never put an API key in this file — it is public.** Put the key in a
> serverless function (Netlify/Vercel) and point `API_ENDPOINT` at that function.

### Contact form endpoint

`js/contact-form.js`, top of the file:

```js
const FORM_ENDPOINT = "";            // https://formspree.io/f/XXXXXXXX
const WEB3FORMS_ACCESS_KEY = "";     // only if using Web3Forms
```

Both services accept the JSON body the form posts. Until an endpoint is set, the
form validates and reviews normally, then tells the visitor it is not configured
and shows the email address — it never silently pretends to have sent.

---

## 4. File map

```
sentryx/
├── index.html                    Home (hero canvas, services, process, severity, engagements, FAQ)
├── services.html                 Full catalogue, filterable, with the capability note
├── services/
│   ├── smart-contract-security-audit.html
│   ├── defi-protocol-audit.html
│   ├── bridge-cross-chain-audit.html
│   ├── invariant-fuzz-testing.html
│   ├── incident-response.html
│   └── continuous-security-retainer.html
├── process.html                  Six-stage methodology + severity matrix
├── reports.html                  Portfolio + disclosure policy
├── tools.html                    Tool index (11 tools)
├── pricing.html                  Tiers + comparison table
├── about.html                    Positioning, principles, entity
├── contact.html                  Multi-step audit request form
├── glossary.html                 46 security terms, A–Z index + live filter
├── compare.html                  How to compare audit firms (buyer's guide)
├── careers.html                  Open roles and how we assess
├── case-study-template.html      noindex template for publishing an engagement
├── tools/
│   ├── contract-risk-precheck.html        20 heuristic rules, browser-only
│   ├── ai-deep-scan.html                  Model-assisted review via a proxy
│   ├── storage-layout-visualizer.html     solc slot packing + upgrade diff
│   ├── gas-optimization-analyzer.html     12 rules, EIP-2929 costs
│   ├── access-control-matrix.html         External functions × guards
│   ├── contract-source-fetcher.html       Verified source, flattened
│   ├── proxy-detector.html                EIP-1967/1822/1167/beacon/diamond
│   ├── audit-cost-estimator.html          Scope → price range + timeline
│   ├── severity-explorer.html             Severity definitions and examples
│   ├── sample-audit-report.html           Illustrative report, diffs + PoCs
│   └── web3-unit-converter.html           Wei, keccak256, EIP-55, selectors
├── blog/
│   ├── index.html                Research index, filterable by topic
│   ├── rss.xml                   RSS 2.0 feed, regenerate when you add a post
│   └── <6 articles>.html
├── functions/                    Netlify Functions (see section 6)
│   ├── _lib/                     Shared handlers — the actual logic
│   ├── deep-scan.js
│   └── explorer-source.js
├── api/                          Vercel wrappers over the same _lib handlers
├── netlify.toml  vercel.json
├── 404.html                      Terminal-style
├── css/style.css                 Entire design system + every rule (one file)
├── js/
│   ├── main.js                   Shared: nav, reveals, cursor, magnetic, scramble,
│   │                             counters, typewriter, tilt, accordion, tabs,
│   │                             pinned horizontal process, page transitions
│   ├── hero.js                   Homepage canvas ("live threat mesh")
│   ├── assistant.js              AI security assistant widget (all pages)
│   ├── precheck.js               Contract risk pre-check
│   ├── estimator.js              Quote estimator
│   ├── report-viewer.js          Sample report + severity explorer + highlighter
│   ├── contact-form.js           Multi-step form
│   ├── filters.js                Services / reports / blog filtering, article TOC
│   ├── pricing.js                Pricing page renderer
│   ├── keccak.js                 Hand-written keccak256 (no dependency)
│   ├── solidity-parse.js         Shared "AST-lite" Solidity parser
│   ├── storage-layout.js         Storage layout + upgrade diff
│   ├── gas-analyzer.js           12 gas rules
│   ├── access-matrix.js          18 guard patterns
│   ├── utilities.js              Unit converter panels (BigInt)
│   ├── chain-tools.js            Source fetcher + proxy detector
│   ├── deep-scan.js              AI deep scan client
│   └── glossary.js               Glossary renderer + filter
├── data/                         All editable content (see the table above)
├── assets/og/                    One 1200×630 Open Graph image per page
├── sitemap.xml  robots.txt  llms.txt
└── README.md
```

---

## 5. Deployment

### Netlify

Drag the folder onto <https://app.netlify.com/drop>, or:

```bash
npm i -g netlify-cli
netlify deploy --dir . --prod
```

No build command, publish directory `.`. Netlify serves `404.html` automatically.

Optional `netlify.toml` for headers and caching:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "geolocation=(), microphone=(), camera=()"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/css/*"
  [headers.values]
    Cache-Control = "public, max-age=604800"
```

### Vercel

```bash
npm i -g vercel
vercel --prod
```

Framework preset: **Other**. No build command. Output directory: `.`.

### cPanel / Hostinger / any shared host

1. Zip the folder contents (not the folder itself).
2. cPanel → **File Manager** → `public_html`.
3. Upload the zip, right-click → **Extract**.
4. Delete the zip. `index.html` must sit directly in `public_html`.
5. Enable SSL: cPanel → **SSL/TLS Status** → *Run AutoSSL*.

Add an `.htaccess` in `public_html` for the 404 page, compression and caching:

```apache
ErrorDocument 404 /404.html

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript image/svg+xml application/json
</IfModule>

<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/css "access plus 1 week"
  ExpiresByType application/javascript "access plus 1 week"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
</IfModule>

# force https + strip www
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
RewriteCond %{HTTP_HOST} ^www\.(.+)$ [NC]
RewriteRule ^(.*)$ https://%1%{REQUEST_URI} [L,R=301]
```

### After deploying — a short checklist

- [ ] Replace `sentryx.example` everywhere (section 3).
- [ ] Set `FORM_ENDPOINT` in `js/contact-form.js` and send a test submission.
- [ ] Replace the `PLACEHOLDER-` GitHub / X handles in the footer and `data/site.js`.
- [ ] If you want the on-chain tools keyless, deploy the functions and set the two constants (section 6).
- [ ] Regenerate `blog/rss.xml` whenever you publish an article.
- [ ] Submit `sitemap.xml` in Google Search Console and Bing Webmaster Tools.
- [ ] Check the OG cards render: <https://cards-dev.twitter.com/validator> and the LinkedIn Post Inspector.
- [ ] Validate the structured data: <https://search.google.com/test/rich-results>.
- [ ] Run Lighthouse on the deployed URL (local `file://` runs score misleadingly low).

---

## 6. The serverless layer (optional)

Two of the eleven tools can do more when a server holds a secret key. **Both work
without one** — they say so in the UI rather than failing silently — so you can
ship the site first and add this later.

| Tool | Without a key | With the function deployed |
|---|---|---|
| Contract source fetcher / Proxy detector | Visitor pastes their own Etherscan key; it is stored in *their* `localStorage` and sent straight to Etherscan. You never see it. | Keyless for the visitor. The function holds your key. |
| AI Deep Scan | Runs the deterministic analysers only, and shows "AI layer: not configured" | Adds the model-assisted reasoning pass |

### What ships

```
functions/_lib/explorer-source.js   the real handler        ← shared
functions/_lib/deep-scan.js         the real handler        ← shared
functions/explorer-source.js        Netlify wrapper
functions/deep-scan.js              Netlify wrapper
api/explorer-source.js              Vercel wrapper
api/deep-scan.js                    Vercel wrapper
netlify.toml  vercel.json           already wired
```

The logic lives once, in `_lib/`. The four wrappers are a few lines each, so
Netlify and Vercel cannot drift apart.

### Environment variables

Set these in the host's dashboard (Netlify → *Site configuration → Environment
variables*; Vercel → *Settings → Environment Variables*):

| Variable | Required for | Notes |
|---|---|---|
| `ETHERSCAN_API_KEY` | Source fetcher, proxy detector | One key covers every chain — the tools use the Etherscan V2 multichain API with a `chainid` parameter |
| `ANTHROPIC_API_KEY` | AI Deep Scan | |
| `DEEP_SCAN_MODEL` | optional | Defaults to `claude-sonnet-4-5` |
| `MAX_SOURCE_CHARS` | optional | Defaults to `60000`; source above this is rejected with a 413 |
| `ALLOWED_ORIGIN` | optional | CORS origin, defaults to `*` |

### Then point the client at it

Two one-line constants, both near the top of their file:

```js
// js/chain-tools.js
var SOURCE_PROXY = "/.netlify/functions/explorer-source";   // or "/api/explorer-source"

// js/deep-scan.js
var AI_ENDPOINT  = "/.netlify/functions/deep-scan";         // or "/api/deep-scan"
```

Leave them as `""` and both tools stay in their no-key mode.

> **Never put an API key in anything under `js/` — that directory is public.**
> The whole point of `functions/` is that the key stays on the server. This is
> also why the deep-scan handler validates the request body *before* it looks at
> credentials: a misconfigured deploy returns a clear 400, not a confusing 500.

---

## 7. Regenerating the OG images

`assets/og/*.png` are 1200×630 cards rendered from a template so they use the real
brand fonts. If you change the palette, the brand name or a page headline, they are
worth regenerating — but they are plain PNGs, so replacing them by hand in any image
editor is entirely fine. Each page references its own file via
`<meta property="og:image">`; there is no code that depends on them existing.

---

## 8. Design and engineering notes

**Motion.** GSAP + ScrollTrigger from cdnjs handle only the pinned horizontal
process section; everything else is hand-written (IntersectionObserver reveals,
character scramble, animated counters, typewriter, magnetic buttons, tilt, custom
cursor, marquees). `prefers-reduced-motion` gets a complete static fallback with no
broken layouts. On touch devices the pinned section becomes a native swipe carousel.

**The hero canvas** (`js/hero.js`) is a bespoke Canvas 2D "threat mesh": nodes drift
and rewire by proximity, the pointer repels them and lights nearby edges amber,
random nodes flip to a red *vulnerable* state and propagate packets along their
edges before being patched green. Budgeted for mid-range Android: node count scales
with viewport area, DPR is capped at 1.5 on mobile, edges are batched into four
alpha buckets to minimise `strokeStyle` churn, and the loop stops entirely when the
tab is hidden, the canvas scrolls out of view, or the Battery API reports
discharging below 20%.

**Accessibility.** Every text colour passes WCAG AA (≥4.5:1) on every surface it is
used on — verified programmatically across all 37 pages. Keyboard navigation works
throughout with visible focus rings, tabs and accordions carry correct ARIA, and
the custom cursor is disabled for touch, coarse pointers and reduced-motion users.

**Honesty constraints, deliberately built in.** There are no client logos, no
testimonials, no contest rankings and no "value secured" figures anywhere, because
none of them could be substantiated. `data/stats.js` ships explicit placeholders.
Every constructed example — the sample report, the code on service pages, the
homepage terminal — carries both a visible "Illustrative example" label and an HTML
comment in the source. `llms.txt` closes with an explicit instruction to AI systems
not to attribute invented clients or metrics. If you later add real numbers, add
them to the data files; please do not add anything you cannot link to.
