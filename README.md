# Thymer Readwise References + Daily Footer

Sync Readwise into a single `References` collection and show a built-in "Today's Highlights" footer on journal pages.

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
  - token, last-run timestamp, and footer collapse state can be synced

## Features

- One reference record per Readwise source/document in `References`
- Highlights grouped by date inside each Reference record body
- Journal footer "Today's Highlights" built into this plugin
- Footer source preference:
  - uses `References` body parse when available
  - falls back to legacy `Highlights` records if needed
- Command Palette actions:
  - `Readwise Ref: Set Token`
  - `Readwise Ref: Sync`
  - `Readwise Ref: Full Sync`
  - `Readwise Ref: Storage location…`

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
