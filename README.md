# Thymer Readwise References + Daily Footer

Sync Readwise into a single `References` collection and show built-in **journal footers**: **Today's Highlights** (per journal day) and **Quote Shuffler** (draw a random highlight from your whole `References` library, centered ritual-style type on the panel surface—no inner box; each journal day remembers its quote until you reshuffle).

‼️ In progress. Created by AI, vibes, and someone who knows nothing about coding! Suggestions and support very welcome! ‼️

## Breaking change / migration note

This repo now uses a consolidated References-based model and no longer ships the legacy files:
`Readwise.js`, `Readwise.json`, `Todays Highlights.js`, `Today's Highlights.json`, `Captures.json`, `Highlights.json`.

If you are upgrading from the old setup:

1. Ensure a **`References`** collection exists (plugin can create it on first load, or import `References.json`).
2. Install only `plugin.js` + `plugin.json`.
3. Disable/remove legacy Readwise + Today's Highlights plugins to avoid duplicate behavior.
4. Run `Readwise Ref: Full Sync` once to rebuild from the new model.

## What changed in this rewrite

- Replaced the old dual-collection model (`Captures` + `Highlights`) with:
  - one `References` collection (`References.json`)
- Merged sync + journal footer behavior into one plugin:
- `plugin.js` + `plugin.json`
- Added Path B storage-mode support (**Plugin Backend** collection mirror; legacy **Plugin Settings** still resolved):
  - token, last-run timestamp, panel visibility, shuffler collapse, per-day shuffler picks map, and Today's Highlights collapse can be synced

## Features

- One reference record per Readwise source/document in `References`
- Highlights grouped by date inside each Reference record body
- Journal footers built into this plugin:
  - **Today's Highlights** — lists highlights for the open journal day (same References body parsing as sync)
  - **Quote Shuffler** — expanded: floating collapse control + centered **ti-quote**-style draw icon; after draw, same flat panel surface + small corner **shuffle** reshuffle. Collapsed: header matches other panels (**Quote Shuffler** + **ti-quotes**-style icon). Per-day sticky quote + inline SVG icons.
- Footer source preference:
  - uses `References` body parse when available
  - falls back to legacy `Highlights` records if needed
- Command Palette actions:
  - `Readwise Ref: Set Token`
  - `Readwise Ref: Sync`
  - `Readwise Ref: Full Sync`
  - `Readwise Ref: Storage location…`
  - `Readwise Ref: Toggle Today's Highlights panel`
  - `Readwise Ref: Toggle Quote Shuffler panel`
  - `Readwise Ref: Shuffle Quote` (journal page with Quote Shuffler visible — works even if the panel body is collapsed)

## Setup

1. **References collection:** On first load the plugin creates **`References`** (and merges fields/views) if it is missing — same shape as `References.json`. You can still import `References.json` manually first if you prefer.
2. Create plugin `Readwise References`:
  - Configuration: `plugin.json`
  - Custom Code: `plugin.js`
3. Run `Readwise Ref: Set Token` (token from `https://readwise.io/access_token`).
4. Run `Readwise Ref: Full Sync` for first import.
5. Use `Readwise Ref: Sync` for subsequent updates.

## Notes

- This plugin can coexist with the original `readwise` plugin because it uses separate localStorage keys.
- During sync, writes are done to `References` and the plugin performs cheap mid-sync refreshes for the same collection.

### Console / DevTools — seeing `[ReadwiseRef]` logs

Sync progress uses **`console.info`** by default (prefix **`[ReadwiseRef]`**). If you see nothing:

1. In Chrome DevTools → **Console**, open the **Default levels** menu and ensure **Info** is checked (some presets hide everything except Errors/Warnings).
2. Check the **JavaScript context** dropdown at the top of the Console (often says “top”): if Thymer runs the plugin in an **iframe**, pick the frame that hosts the app so `console` matches where the plugin runs.
3. Optional — force louder output or duplicate to the top window:

```js
localStorage.setItem('readwise_references_console', 'warn');
localStorage.setItem('readwise_references_console_mirror_top', '1');
```

Values for `readwise_references_console`: `info` (default), `log`, `warn`, `both` (`log` + `info`). Remove the keys to restore defaults.

## Sync behavior (Reader + export)

Sync merges **two** Readwise feeds:

1. **Reader API** (`/api/v3/list/`) — documents and highlights saved through Readwise Reader (same spine as before).
2. **Export API** (`/api/v2/export/`) — your full Readwise library, including **Kindle books**, imported articles, etc. (similar to Logseq/Obsidian-style exports).

References are built from the **union**: export-only sources (e.g. Kindle highlights that never appear in the Reader list) get their own rows; when Reader and export describe the same work, highlights are **merged by highlight id**.

Each reference has **Category** as a **choice** field with four options — **Books**, **Articles**, **Podcasts**, **Video**. Readwise’s API still sends its own `category` strings; the plugin maps them:

| Readwise `category` | Thymer chip |
|---------------------|-------------|
| `books`, `supplementals`, `supplemental` (singular/plural), `epub` | **Books** |
| `podcast`, `podcasts` | **Podcasts** |
| `video`, `videos` | **Video** |
| `articles`, `article`, `email`, `rss`, `pdf`, `tweet`, anything else | **Articles** |

**Source** (`source_origin`) is also a **choice** field, with separate chips for each Readwise channel that has appeared in real syncs (Reader sub‑channels grouped via `Reader | …` labels). Reader sub‑channel mapping:

| Readwise `source` | Choice id | Label |
|-------------------|-----------|-------|
| `reader` | `reader` | Reader |
| `reader-mobile-app` | `reader_mobile` | Reader \| mobile |
| `reader-web-app` | `reader_web` | Reader \| web |
| `Reader RSS` | `reader_rss` | Reader \| RSS |
| `Reader Share Sheet Android` (and ios/web variants) | `reader_share_sheet` | Reader \| share sheet |
| `Reader in app link save` | `reader_in_app_save` | Reader \| in‑app save |
| `Reader add from import URL` | `reader_import_url` | Reader \| add (URL) |
| `Reader add from clipboard` | `reader_clipboard` | Reader \| add (clipboard) |
| `Readwise web highlighter` | `readwise_web_highlighter` | Readwise \| web highlighter |
| `readwise onboarding` | `readwise_onboarding` | Readwise \| onboarding |
| `kindle` | `kindle` | Kindle |
| `File Upload`, `file`, `files` | `upload` | Upload \| file |
| `pdf` (export) | `pdf_upload` | PDF upload |
| `snipd` | `snipd` | Snipd |
| `instapaper` | `instapaper` | Instapaper |
| `raindrop` | `raindrop` | Raindrop |
| `api_article` | `api_article` | API article |
| `manual` | `manual` | Manual |
| `supplemental` (export) | `supplemental` | Supplemental |
| empty/missing | `unknown` | Unknown |
| anything else | `other` | Other |

Reload Thymer after updating the plugin so **`SCHEMA_VER` 6** reapplies the collection field definition (`upgradeSchema`), then run **Readwise Ref: Full Sync** once so every existing reference row gets a fresh **Category** and **Source** choice. References are not deleted — sync updates rows by `external_id`.

**See what Readwise sent:** after a sync, open last diagnostics (`readwise_references_last_sync_diag`). **`readwiseCategoryRawHistogram`** / **`readwiseCategoryMappedHistogram`** are counts **per merged reference** from the document’s **`category`** field (what drives the Books/Articles/Podcasts chip). To see **everything** the APIs return before mapping, use:

| Diagnostic key | Meaning |
|----------------|---------|
| **`readwiseListApiCategoryHistogram`** | Reader v3 **list** — `category` on every row |
| **`readwiseListApiSourceHistogram`** | Reader v3 **list** — `source` on every row (often **`epub`**, **`kindle`**, **`reader`**, etc.) |
| **`readwiseListDocCategoryHistogram`** | List rows that are **documents** (no parent) |
| **`readwiseListHighlightCategoryHistogram`** | List rows that are **highlights** (has parent) — may include values like `reader_document_note` |
| **`readwiseExportBookCategoryHistogram`** | v2 **export** — each book’s `category` |
| **`readwiseExportBookSourceHistogram`** | v2 **export** — each book’s `source` |

The same data is logged during sync (`Reader API list — …`, `Export API books — …`).

**Custom mapping (optional):** set `localStorage` key **`readwise_references_category_map`** to JSON whose keys are either the **exact** trimmed `category` string from Readwise or the normalized underscore form (`supplementals`, `tweets`, `epub`, …). Values must be **`books`**, **`articles`**, **`podcasts`**, or **`video`**. Example: `localStorage.setItem('readwise_references_category_map', JSON.stringify({ tweet: 'articles', email: 'articles' }));` — remove the key to use defaults only.

**Source mapping (optional):** when a Readwise `source` string does not match a built-in choice id or alias, it lands on **Other**. To remap without editing the plugin, set **`readwise_references_source_map`** — keys are the exact API string or normalized slug; values must be valid **`source_origin`** ids (`reader`, `reader_mobile`, `kindle`, `upload`, `pdf_upload`, `snipd`, `unknown`, `other`, …). After changing the map, run **Full Sync** again. To add **new** choice labels permanently, edit **`References.json`** / **`ThymerReadwiseReferencesCollectionRuntime.js`** (same ids in both), update the embedded copy in **`plugin.js`** (or run `npm run embed-readwise-refs-coll`), bump **`SCHEMA_VER`**, reload.

**Workflow — inventory then tune:** (1) Paste updated **`plugin.js`**, reload Thymer. (2) Run **Readwise Ref: Full Sync** (wait until finished). (3) In the console, run `JSON.parse(localStorage.getItem('readwise_references_last_sync_diag'))` and copy **`readwiseListApiSourceHistogram`**, **`readwiseExportBookSourceHistogram`**, and the category histograms. (4) Decide mappings; use **`readwise_references_category_map`** / **`readwise_references_source_map`** or extend choice lists in the repo for one-off labels.

### Rate limits & speed

**Official Readwise limits** (from their docs — always subject to change; see [readwise.io/api_deets](https://readwise.io/api_deets) and the [Reader API](https://readwise.io/reader_api) page):

| API area | Documented limit |
|----------|------------------|
| **Reader API** (includes `/api/v3/list/` used here) | **20 requests per minute** per access token → sustained max is about **one request every 3 seconds** |
| **Main Readwise API** (most v2 endpoints) | **240 requests per minute** per token unless an endpoint is called out separately |
| **Highlight LIST** and **Book LIST** (v2 list endpoints named in api_deets) | **20 requests per minute** per token |

There is **no single magic number** in the response body: **429** means “you exceeded whatever bucket applies to that endpoint.” Readwise documents using the **`Retry-After`** response header (seconds to wait, or an HTTP date). This plugin now honors **`Retry-After`** on 429 when present, and otherwise uses exponential backoff.

**Plugin defaults (speed-first):**

- **List** spacing **3000 ms** — aligns with Reader’s **20/min** floor for `/api/v3/list/`.
- **Export** spacing **250 ms** — aligns with **240/min** for typical v2 traffic (`60_000 / 240 ≈ 250` ms). If export shares a stricter bucket and you 429, raise `readwise_references_export_delay_ms` or rely on `Retry-After`.

**Why the app felt slow during sync (before):** the plugin was yielding to the UI and **refreshing the References collection** every N references — that can make **page transitions stall**. Defaults are now **no** mid-sync yields and **no** mid-sync collection refresh (progress stays in the status bar / console; a full refresh still runs **once** at the end of sync).

**Tuning (`localStorage`, milliseconds):**

| Key | Built-in default | Notes |
|-----|------------------|--------|
| `readwise_references_list_delay_ms` | **3000** | Going **below ~3000** on Reader list fights the published **20/min** limit |
| `readwise_references_export_delay_ms` | **250** | Raise if export pages start returning 429 |

```js
localStorage.removeItem('readwise_references_list_delay_ms');
localStorage.removeItem('readwise_references_export_delay_ms');
```

**Other bottlenecks:** full sync still does heavy **per-reference body line work** in Thymer; that dominates after downloads finish.

**After one successful full sync**, use **Readwise Ref: Sync** (incremental) for day-to-day — it passes `updatedAfter` to Readwise so list + export pull **less** data.

**Short runs for testing / plugin dev** — cap how many merged sources get written (still downloads list+export; only the write loop is shortened):

```js
localStorage.setItem('readwise_references_debug_max_sources', '20');
```

**Cap the download phase** (Reader list pages and/or export pages) so the “List page: +100…” part finishes quickly:

```js
localStorage.setItem('readwise_references_debug_max_list_rows', '250'); // max Reader v3 list rows total
localStorage.setItem('readwise_references_debug_max_export_pages', '2'); // max v2 export API pages
```

When these are active, the first list log after “Full sync” should include **`DEBUG: readwise_references_debug_max_list_rows=…`**. If the list total keeps growing past your cap, Thymer is still running an **older** `plugin.js` — re-paste/update the plugin from this repo, reload, then sync again.

Clear when you want a real full import:

```js
localStorage.removeItem('readwise_references_debug_max_sources');
localStorage.removeItem('readwise_references_debug_max_list_rows');
localStorage.removeItem('readwise_references_debug_max_export_pages');
```

### RSS

RSS feeds are **skipped by default**. To include them as References:

```js
localStorage.setItem('readwise_references_include_rss', '1')
```

Reload the app / plugin after changing this.

### Notes / duplicate lines

Some Reader rows repeat the same text as a highlight’s note (different URLs). The sync pass removes common “echo” rows when it detects redundant note-only duplicates tied to `read.readwise.io` reader URLs.

When **Reader list** and **export** both include the same highlight, they sometimes arrive with **different ids** (e.g. Reader ULID vs export numeric id, or different `readwise_url` shapes); the merge step collapses rows that resolve to the same **`readwise.io/open/…`** using export enrichment and **`external_id`** when it is the classic numeric id (see `duplicateHighlightRowsMerged` in sync diagnostics). Rows whose **body is only a URL** that matches another highlight’s **note** are dropped as echo rows (`noteRowsDeduped`).

### Empty bodies after sync

Reference metadata can update before the note body API is ready on huge workspaces. The plugin waits longer for an editable record before writing the Highlights section.

### After upgrading

Run **`Readwise Ref: Full Sync`** once so export-backed books (Kindle, etc.) populate. Incremental sync uses Readwise `updatedAfter`; very old export-only rows rely on a full pass.

### Category / Source columns missing after updating the plugin

The schema fields are named **Category** (`source_category`, choice ids `books` / `articles` / `podcasts`) and **Source** (`source_origin`, choice ids such as `kindle`, `epub`, `reader`, …) — there is no property literally called “Type”.

If you pasted new `plugin.js` but the References collection still shows the old field list, **reload the whole Thymer tab** (or disable and re-enable the plugin) once. An older embedded `ThymerReadwiseReferencesColl` helper could stay on `globalThis` until reload; the plugin now uses an internal **schema version** so a fresh load picks up new fields and runs `upgradeSchema` on your References collection.

## Files in this repo

- `plugin.js`
- `plugin.json`
- `References.json`