/**
 * Readwise Highlights Sync — Standalone Plugin
 *
 * Token stored in localStorage.
 * Writes to two collections:
 *   - Captures  : one record per document (book / article / podcast)
 *   - Highlights : one record per individual highlight (queryable by date)
 *
 * SETUP:
 *   1. Open command palette -> "Readwise: Set Token"
 *   2. Paste your Readwise access token (from readwise.io/access_token)
 *   3. Run "Readwise: Full Sync" once to import everything
 *   4. After that, "Readwise: Sync" fetches only new highlights
 */

const RW_TOKEN_KEY    = 'readwise_token';
const RW_LAST_RUN_KEY = 'readwise_last_run';

class Plugin extends AppPlugin {

    async onLoad() {
        this._syncing = false;

        this._cmdSetToken = this.ui.addCommandPaletteCommand({
            label: 'Readwise: Set Token',
            icon: 'key',
            onSelected: () => this._showTokenDialog(),
        });
        this._cmdSync = this.ui.addCommandPaletteCommand({
            label: 'Readwise: Sync',
            icon: 'quote',
            onSelected: () => this._runSync(false),
        });
        this._cmdFullSync = this.ui.addCommandPaletteCommand({
            label: 'Readwise: Full Sync',
            icon: 'quote',
            onSelected: () => this._runSync(true),
        });
    }

    onUnload() {
        this._cmdSetToken?.remove();
        this._cmdSync?.remove();
        this._cmdFullSync?.remove();
        document.getElementById('rw-token-dialog')?.remove();
    }

    // =========================================================================
    // Token dialog — DOM overlay, same pattern as Quick Note _promptText
    // =========================================================================

    _showTokenDialog() {
        document.getElementById('rw-token-dialog')?.remove();

        const current = localStorage.getItem(RW_TOKEN_KEY) || '';

        const panel = this.ui.getActivePanel();
        let left = Math.round(window.innerWidth / 2) - 175;
        let top  = Math.round(window.innerHeight / 3);
        if (panel) {
            const el = panel.getElement();
            if (el) {
                const r = el.getBoundingClientRect();
                left = Math.round(r.left + r.width / 2) - 175;
                top  = Math.round(r.top + 80);
            }
        }

        const box = document.createElement('div');
        box.id = 'rw-token-dialog';
        box.style.position   = 'fixed';
        box.style.left       = left + 'px';
        box.style.top        = top + 'px';
        box.style.width      = '350px';
        box.style.background = 'var(--cmdpal-bg-color, var(--panel-bg-color, #1d1915))';
        box.style.border     = '1px solid var(--border-default, #3f3f46)';
        box.style.borderRadius = '10px';
        box.style.boxShadow  = 'var(--cmdpal-box-shadow, 0 8px 32px rgba(0,0,0,0.5))';
        box.style.padding    = '16px';
        box.style.zIndex     = '99999';
        box.style.display    = 'flex';
        box.style.flexDirection = 'column';
        box.style.gap        = '10px';

        const lbl = document.createElement('div');
        lbl.textContent      = 'Readwise Access Token';
        lbl.style.fontWeight = '600';
        lbl.style.fontSize   = '14px';

        const hint = document.createElement('div');
        hint.textContent  = 'Get yours at readwise.io/access_token';
        hint.style.fontSize = '12px';
        hint.style.color  = 'var(--text-muted, #888)';

        const inp = document.createElement('input');
        inp.type            = 'text';
        inp.placeholder     = 'Paste token here...';
        inp.value           = current;
        inp.style.width     = '100%';
        inp.style.padding   = '8px 10px';
        inp.style.borderRadius = '6px';
        inp.style.border    = '1px solid var(--border-default, #3f3f46)';
        inp.style.background = 'var(--input-bg-color, #181511)';
        inp.style.color     = 'inherit';
        inp.style.fontSize  = '13px';
        inp.style.boxSizing = 'border-box';
        inp.style.outline   = 'none';
        inp.style.fontFamily = 'monospace';

        const btnRow = document.createElement('div');
        btnRow.style.display        = 'flex';
        btnRow.style.gap            = '8px';
        btnRow.style.justifyContent = 'flex-end';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent        = 'Cancel';
        cancelBtn.style.padding      = '7px 14px';
        cancelBtn.style.background   = 'transparent';
        cancelBtn.style.color        = 'inherit';
        cancelBtn.style.border       = '1px solid var(--border-default, #3f3f46)';
        cancelBtn.style.borderRadius = '7px';
        cancelBtn.style.fontSize     = '13px';
        cancelBtn.style.cursor       = 'pointer';

        const saveBtn = document.createElement('button');
        saveBtn.textContent        = 'Save';
        saveBtn.style.padding      = '7px 18px';
        saveBtn.style.background   = 'var(--color-primary-500, #a78bfa)';
        saveBtn.style.color        = '#fff';
        saveBtn.style.border       = 'none';
        saveBtn.style.borderRadius = '7px';
        saveBtn.style.fontWeight   = '700';
        saveBtn.style.fontSize     = '13px';
        saveBtn.style.cursor       = 'pointer';

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(saveBtn);
        box.appendChild(lbl);
        box.appendChild(hint);
        box.appendChild(inp);
        box.appendChild(btnRow);
        document.body.appendChild(box);

        let resolved = false;
        const onOut = (e) => { if (!box.contains(e.target)) done(false); };

        const done = (save) => {
            if (resolved) return;
            resolved = true;
            document.removeEventListener('pointerdown', onOut, true);
            box.remove();
            if (!save) return;
            const token = inp.value.trim();
            if (!token) {
                localStorage.removeItem(RW_TOKEN_KEY);
                this._toast('Token cleared.');
            } else {
                localStorage.setItem(RW_TOKEN_KEY, token);
                this._toast('Token saved! Run "Readwise: Full Sync" to import your highlights.');
            }
        };

        saveBtn.addEventListener('click', () => done(true));
        cancelBtn.addEventListener('click', () => done(false));
        inp.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter')  { e.preventDefault(); done(true);  }
            if (e.key === 'Escape') { e.preventDefault(); done(false); }
        });
        document.addEventListener('pointerdown', onOut, true);
        requestAnimationFrame(() => { inp.focus(); inp.select(); });
    }

    // =========================================================================
    // Sync entry point
    // =========================================================================

    async _runSync(forceFullSync) {
        if (this._syncing) { this._toast('Sync already in progress...'); return; }

        const token = localStorage.getItem(RW_TOKEN_KEY);
        if (!token) { this._toast('No token set. Run "Readwise: Set Token" first.'); return; }

        this._syncing = true;
        this._toast(forceFullSync ? 'Starting full sync...' : 'Syncing new highlights...');

        try {
            // Test token first
            this._log('Testing token...');
            const testResp = await fetch('https://readwise.io/api/v3/list/?pageSize=1', {
                headers: { 'Authorization': 'Token ' + token }
            });
            if (testResp.status === 401) throw new Error('Invalid token - check readwise.io/access_token');
            if (testResp.status === 429) {
                this._toast('Rate limited by Readwise. Wait a few minutes and try again.');
                this._syncing = false;
                return;
            }

            const result = await this._sync(token, forceFullSync);
            this._toast('Done: ' + result.summary);
            localStorage.setItem(RW_LAST_RUN_KEY, new Date().toISOString());
        } catch (e) {
            console.error('[Readwise]', e);
            this._toast('Sync failed: ' + e.message);
        }

        this._syncing = false;
    }

    // =========================================================================
    // Core sync logic — processes records per page as they arrive
    // =========================================================================

    async _sync(token, forceFullSync) {
        this._loggedStructure = false; // Reset diagnostic flag
        const lastRun = localStorage.getItem(RW_LAST_RUN_KEY);
        const since   = (lastRun && !forceFullSync) ? lastRun : null;
        this._log(since ? ('Incremental since ' + since) : 'Full sync');

        const allCollections = await this.data.getAllCollections();
        const capturesColl   = allCollections.find(c => c.getName() === 'Captures');
        const highlightsColl = allCollections.find(c => c.getName() === 'Highlights');

        this._log('Highlights: ' + (!!highlightsColl) + '  Captures: ' + (!!capturesColl));
        if (!highlightsColl) throw new Error('Highlights collection not found');

        // Load existing records once upfront for dedup
        const existingHL  = await highlightsColl.getAllRecords();
        const hlByExtId   = new Map(existingHL.map(r => [r.text('external_id'), r]));
        let   capByExtId  = new Map();
        if (capturesColl) {
            const existingCap = await capturesColl.getAllRecords();
            capByExtId = new Map(existingCap.map(r => [r.text('external_id'), r]));
        }

        let createdHL = 0, updatedHL = 0, createdCap = 0, updatedCap = 0;
        let cursor = null, retryCount = 0;
        const maxRetries = 3;

        // Fetch and process one page at a time
        while (true) {
            let url = 'https://readwise.io/api/v3/list/?pageSize=100';
            if (since)  url += '&updatedAfter=' + encodeURIComponent(since);
            if (cursor) url += '&pageCursor='   + encodeURIComponent(cursor);

            const resp = await fetch(url, { headers: { 'Authorization': 'Token ' + token } });

            if (resp.status === 429) {
                retryCount++;
                if (retryCount > maxRetries) throw new Error('Rate limited too many times, giving up.');
                const wait = (120 * Math.pow(2, retryCount - 1)) * 1000;
                this._log('Rate limited. Waiting ' + (wait / 1000) + 's...');
                await this._sleep(wait);
                continue;
            }
            if (!resp.ok) throw new Error('Readwise API error ' + resp.status);

            retryCount = 0;
            const data = await resp.json();
            const results = data.results || [];

            // DIAGNOSTIC: Log first document and highlight structure (once per sync)
            if (results.length > 0 && !this._loggedStructure) {
                this._loggedStructure = true;
                const sampleDoc = results.find(i => !i.parent_id);
                const sampleHL = results.find(i => i.parent_id);
                if (sampleDoc) this._log('Sample DOC keys: ' + Object.keys(sampleDoc).join(', '));
                if (sampleHL) this._log('Sample HL keys: ' + Object.keys(sampleHL).join(', '));
                if (sampleHL) this._log('Sample HL location: ' + (sampleHL.location || 'undefined'));
            }

            // Separate page into docs and highlights
            const pageDocs = results.filter(i => !i.parent_id);
            const pageHLs  = results.filter(i =>  i.parent_id);

            // Build highlight lookup for this page's docs
            const pageHLsByDoc = new Map();
            for (const h of pageHLs) {
                if (!pageHLsByDoc.has(h.parent_id)) pageHLsByDoc.set(h.parent_id, []);
                pageHLsByDoc.get(h.parent_id).push(h);
            }

            this._log('Page: ' + pageDocs.length + ' docs, ' + pageHLs.length + ' highlights');

            // Process this page immediately
            for (const doc of pageDocs) {
                if (doc.category === 'rss') continue;
                const docHL = pageHLsByDoc.get(doc.id) || [];
                if (docHL.length === 0) continue;

                if (capturesColl) {
                    const extId = 'readwise_' + doc.id;

                    // Parse capture date
                    let captureDate = null;
                    if (doc.created_at) {
                        try {
                            captureDate = new Date(doc.created_at);
                            if (isNaN(captureDate.getTime())) captureDate = null;
                        } catch (_) {
                            captureDate = null;
                        }
                    }

                    const fields = {
                        external_id: extId,
                        source_title: doc.title || 'Untitled',
                        source_author: doc.author || '',
                        source_url: doc.source_url || '',
                        highlight_count: docHL.length,
                        synced_at: new Date(),
                    };

                    // Add cover image if available
                    if (doc.image_url) {
                        fields.banner = doc.image_url;
                    }
                    if (captureDate) fields.captured_at = captureDate;

                    const existing = capByExtId.get(extId);
                    if (existing) { this._setFields(existing, fields); updatedCap++; }
                    else {
                        const r = await this._createRecord(capturesColl, doc.title || 'Untitled');
                        if (r) { this._setFields(r, fields); capByExtId.set(extId, r); createdCap++; }
                    }
                }

                for (const h of docHL) {
                    const extId = 'readwise_hl_' + h.id;

                    // Parse highlight date (Readwise returns ISO string)
                    let highlightDate = null;
                    if (h.created_at) {
                        try {
                            highlightDate = new Date(h.created_at);
                            if (isNaN(highlightDate.getTime())) highlightDate = null;
                        } catch (_) {
                            highlightDate = null;
                        }
                    }

                    // DEBUG: Log what the API returned for this highlight
                    if (h.notes) {
                        this._log(`[DEBUG] Highlight ${h.id} has notes: "${h.notes}"`);
                    } else {
                        this._log(`[DEBUG] Highlight ${h.id} notes is: ${h.notes === undefined ? 'undefined' : h.notes === null ? 'null' : h.notes === '' ? 'empty string' : 'other'}`);
                    }

                    const fields = {
                        external_id: extId,
                        text: h.content || '',
                        note: h.notes || '',
                        source_title: doc.title || h.source || '',
                        source_author: doc.author || h.author || '',
                        source_url: doc.source_url || h.source_url || '',
                        location: h.location != null ? String(h.location) : '',
                        category: this._mapCategory(doc.category || h.category),
                        highlighted_at: highlightDate,
                        synced_at: new Date(),
                    };

                    // Add cover image if available
                    if (doc.image_url) {
                        fields.banner = doc.image_url;
                    }
                    if (h.image_url && !doc.image_url) {
                        fields.banner = h.image_url;
                    }
                    const existing = hlByExtId.get(extId);
                    if (existing) {
                        this._setFields(existing, fields);
                        updatedHL++;
                    } else {
                        const r = await this._createRecord(highlightsColl, this._trunc(h.content || 'Highlight', 80));
                        if (r) {
                            this._setFields(r, fields);
                            hlByExtId.set(extId, r);
                            createdHL++;
                        } else {
                            this._log('⚠️ Failed to create highlight record');
                        }
                    }
                }
            }

            if (createdHL + updatedHL + createdCap + updatedCap > 0) {
                this._log('Running totals: ' + createdHL + ' HL created, ' + updatedHL + ' updated, ' + createdCap + ' caps created');
            }

            if (!data.nextPageCursor) break;
            cursor = data.nextPageCursor;
            await this._sleep(3000);
        }

        const parts = [
            createdHL  > 0 ? createdHL  + ' highlights added'   : null,
            updatedHL  > 0 ? updatedHL  + ' highlights updated'  : null,
            createdCap > 0 ? createdCap + ' docs added'          : null,
            updatedCap > 0 ? updatedCap + ' docs updated'        : null,
        ].filter(Boolean);

        return { summary: parts.length ? parts.join(', ') : 'No new highlights' };
    }

    // =========================================================================
    // Record helpers
    // =========================================================================

    async _createRecord(coll, title) {
        const guid = coll.createRecord(title);
        if (!guid) {
            this._log('⚠️ createRecord returned null for: ' + this._trunc(title, 40));
            return null;
        }
        await this._sleep(80);
        const all = await coll.getAllRecords();
        const record = all.find(r => r.guid === guid);
        if (!record) {
            this._log('⚠️ Created record not found in getAllRecords (guid: ' + guid.slice(0, 8) + ')');
        }
        return record || null;
    }

    _setFields(record, fields) {
        const failed = [];
        for (const [id, val] of Object.entries(fields)) {
            if (val === null || val === undefined) continue;
            try {
                const prop = record.prop(id);
                if (!prop) {
                    failed.push(id + '(field not found)');
                    continue;
                }
                if (val instanceof Date) {
                    if (!isNaN(val)) {
                        // Use DateTime.dateOnly() with parsed components (month is 0-indexed)
                        const year = val.getFullYear();
                        const month = val.getMonth(); // Already 0-indexed
                        const day = val.getDate();
                        const dt = DateTime.dateOnly(year, month, day);
                        const dtVal = dt.value();
                        this._log(`[DEBUG] Setting ${id} to ${dtVal} (from ${val.toISOString()})`);
                        prop.set(dtVal);
                    }
                }
                else if (typeof val === 'number') {
                    prop.set(val);
                }
                else if (typeof val === 'string') {
                    const ok = typeof prop.setChoice === 'function' ? prop.setChoice(val) : false;
                    if (!ok) prop.set(val);
                }
            } catch (e) {
                failed.push(id + '(' + e.message + ')');
            }
        }
        if (failed.length > 0) {
            this._log('⚠️ Failed to set fields: ' + failed.join(', '));
        }
    }

    // =========================================================================
    // Utilities
    // =========================================================================

    _sleep(ms)       { return new Promise(r => setTimeout(r, ms)); }
    _trunc(s, max)   { return s && s.length > max ? s.slice(0, max - 1) + '...' : (s || ''); }
    _cap(s)          { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
    _log(msg)        { console.log('[Readwise] ' + msg); }

    _mapCategory(docCategory) {
        const mapping = {
            'article': 'article',
            'book': 'book',
            'epub': 'book',
            'pdf': 'book',
            'podcast': 'podcast',
            'email': 'article',
            'tweet': 'tweet',
            'video': 'video',
        };
        return mapping[(docCategory || '').toLowerCase()] || 'supplemental';
    }

    _toast(msg) {
        this.ui.addToaster({ title: 'Readwise', message: msg, dismissible: true, autoDestroyTime: 4000 });
    }
}
