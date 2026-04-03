# Thymer Readwise Sync with Daily Footer
Thymer Plugin to Sync Readwise Highlights &amp; Insert Footer on journal entries showing Readwise highlights made on that day

‼️ _In progress. Created by Claude and someone who knows nothing about coding! Suggestions and support very welcome!_ ‼️

### FEATURES

- Writes to two collections:
   - Captures  : one record per document (book / article / podcast / tweet)
   - Highlights : one record per individual highlight (queryable by date)
- Displays highlights organized by source on the journal page

---

### INSTRUCTIONS

- Create two Collections:
   - a "Highlights" Collection using the Highlights.json (Configuration)
   - a "Captures" Collection with the Captures.json (Configuration)
- Create two Global Plugins 
   - a "Readwise Sync" Plugin using the Readwise.js (Custom Code) & Readwise.json (Configuration)
   - a "Today's Highlights" Plugin using the Todays Highlights.js (Custom Code)  & Today's Highlights.json (Configuration)


- From Command Palette (Cntrl/Cmd + K) run "Readwise: Set Token" to insert your Readwise API token, retrievable from https://readwise.io/access_token
- From Command Palette (Cntrl/Cmd + K) run "Readwise: Full Sync" to import everything.
- From then on, run "Readwise: Sync" for new highlights

---

### CURRENT KNOWN CHALLENGES

- Highlight Notes not syncing
- Highlight Location not syncing
- Cover art not syncing
- Backlinks to Highlights not appearing in Captures
- Repopulation of Today's Highlights Panel when navigating between journal pages often requires refresh of page to show up
