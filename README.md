# Thymer Readwise References + Daily Footer

Sync Readwise into a single `References` collection and show built-in **journal footers**: **Today's Highlights** (per journal day) and **Quote Shuffler** (draw a random highlight from your whole `References` library, shown as a calm “daily card”; each journal day remembers its quote until you reshuffle).

‼️ In progress. Created by AI, vibes, and someone who knows nothing about coding! Suggestions and support very welcome! ‼️

## Breaking change / migration note

This repo now uses a consolidated References-based model and no longer ships the legacy files:
`Readwise.js`, `Readwise.json`, `Todays Highlights.js`, `Today's Highlights.json`, `Captures.json`, `Highlights.json`.

If you are upgrading from the old setup:

1. Import/create `References` using `References.json`.
2. Install only `Readwise References.js` + `Readwise References.json`.
3. Disable/remove legacy Readwise + Today's Highlights plugins to avoid duplicate behavior.
4. Run `Readwise Ref: Full Sync` once to rebuild from the new model.

## What changed in this rewrite

- Replaced the old dual-collection model (`Captures` + `Highlights`) with:
  - one `References` collection (`References.json`)
- Merged sync + journal footer behavior into one plugin:
  - `Readwise References.js` + `Readwise References.json`
- Added Path B storage-mode support (`Plugin Settings` collection mirror):
  - token, last-run timestamp, panel visibility, shuffler collapse, per-day shuffler picks map, and Today's Highlights collapse can be synced

## Features

- One reference record per Readwise source/document in `References`
- Highlights grouped by date inside each Reference record body
- Journal footers built into this plugin:
  - **Today's Highlights** — lists highlights for the open journal day (same References body parsing as sync)
  - **Quote Shuffler** — expanded: floating collapse control + centered **ti-quote**-style draw icon (no inner box until you draw); after draw, small corner **shuffle** reshuffle. Collapsed: header matches other panels (**Quote Shuffler** + **ti-quotes**-style icon). Per-day sticky quote + inline SVG icons.
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

1. Create collection `References` using `References.json`.
2. Create plugin `Readwise References`:
   - Configuration: `Readwise References.json`
   - Custom Code: `Readwise References.js`
3. Run `Readwise Ref: Set Token` (token from `https://readwise.io/access_token`).
4. Run `Readwise Ref: Full Sync` for first import.
5. Use `Readwise Ref: Sync` for subsequent updates.

## Notes

- This plugin can coexist with the original `readwise` plugin because it uses separate localStorage keys.
- During sync, writes are done to `References` and the plugin performs cheap mid-sync refreshes for the same collection.

## Files in this repo

- `Readwise References.js`
- `Readwise References.json`
- `References.json`
