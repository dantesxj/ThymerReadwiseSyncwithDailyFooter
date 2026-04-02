// ==Plugin==
// name: Today's Highlights
// description: Footer on journal entries showing Readwise highlights made on that day
// icon: ti-quote
// ==/Plugin==

/**
 * Today's Highlights
 *
 * Attaches a panel to journal entries (identified by GUID ending in YYYYMMDD).
 * Queries the Highlights collection for records whose `highlighted_at` date
 * matches the journal date, then groups them by source_title with expandable
 * inline previews.
 *
 * Visual style matches Backreferences and Today's Notes panels exactly.
 */

class Plugin extends AppPlugin {

    onLoad() {
        this._panelStates     = new Map();
        this._eventHandlerIds = [];
        this._collapsed       = this._loadBool('th_footer_collapsed', false);

        this._injectCSS();

        this._eventHandlerIds.push(this.events.on('panel.navigated', ev => this._handlePanel(ev.panel)));
        this._eventHandlerIds.push(this.events.on('panel.focused',   ev => this._handlePanel(ev.panel)));
        this._eventHandlerIds.push(this.events.on('panel.closed',    ev => this._disposePanel(ev.panel?.getId?.())));
        // Refresh all open panels when a new record appears (e.g. after a sync)
        this._eventHandlerIds.push(this.events.on('record.created',  () => this._refreshAll()));

        setTimeout(() => {
            const p = this.ui.getActivePanel();
            if (p) this._handlePanel(p);
        }, 300);
    }

    onUnload() {
        for (const id of (this._eventHandlerIds || [])) {
            try { this.events.off(id); } catch (_) {}
        }
        this._eventHandlerIds = [];
        for (const id of Array.from((this._panelStates || new Map()).keys())) {
            this._disposePanel(id);
        }
        this._panelStates?.clear();
    }

    // =========================================================================
    // Panel lifecycle
    // =========================================================================

    _handlePanel(panel) {
        const panelId = panel?.getId?.();
        if (!panelId) return;

        // Only show on normal pages — not custom panels
        const navType = panel?.getNavigation?.()?.type || '';
        if (navType === 'custom' || navType === 'custom_panel') {
            this._disposePanel(panelId);
            return;
        }

        const panelEl   = panel?.getElement?.();
        const container = this._findContainer(panelEl);
        if (!container) { this._disposePanel(panelId); return; }

        const record = panel?.getActiveRecord?.();
        if (!record)  { this._disposePanel(panelId); return; }

        // Only attach to journal entries (GUID ends in YYYYMMDD)
        const journalDate = this._journalDateFromGuid(record.guid);
        if (!journalDate) { this._disposePanel(panelId); return; }

        let state = this._panelStates.get(panelId);
        const dateChanged = state?.journalDate !== journalDate;

        if (!state) {
            state = {
                panelId,
                panel,
                journalDate,
                rootEl:   null,
                observer: null,
                loading:  false,
                loaded:   false,
                // Per-source expand state: Map<sourceTitle, boolean>
                expandedSources: new Map(),
            };
            this._panelStates.set(panelId, state);
        } else {
            state.journalDate = journalDate;
            state.panel = panel;
        }

        this._mountFooter(state, container, panelEl);
        if (dateChanged || !state.loaded) this._populate(state);
    }

    _disposePanel(panelId) {
        if (!panelId) return;
        const s = this._panelStates.get(panelId);
        if (!s) return;
        try { s.observer?.disconnect(); } catch (_) {}
        try { s.rootEl?.remove(); }       catch (_) {}
        this._panelStates.delete(panelId);
    }

    _refreshAll() {
        for (const [, s] of (this._panelStates || new Map())) {
            s.loaded = false;
            this._populate(s);
        }
    }

    // =========================================================================
    // DOM mounting
    // =========================================================================

    _mountFooter(state, container, panelEl) {
        if (!state.rootEl || !state.rootEl.isConnected) {
            state.rootEl = this._buildShell(state);
        }
        if (state.rootEl.parentElement !== container) {
            container.appendChild(state.rootEl);
        }
        if (!state.observer) {
            state.observer = new MutationObserver(() => {
                if (state.rootEl && !state.rootEl.isConnected) {
                    setTimeout(() => {
                        const c = this._findContainer(panelEl);
                        if (c) this._mountFooter(state, c, panelEl);
                    }, 0);
                }
            });
            state.observer.observe(panelEl, { childList: true, subtree: true });
        }
    }

    _findContainer(panelEl) {
        if (!panelEl) return null;
        for (const sel of ['.page-content', '.editor-wrapper', '.editor-panel', '#editor']) {
            if (panelEl.matches?.(sel)) return panelEl;
            const child = panelEl.querySelector?.(sel);
            if (child) return child;
        }
        return null;
    }

    // Build the outer shell (header + body placeholder)
    _buildShell(state) {
        const root = document.createElement('div');
        root.className       = 'th-footer';
        root.dataset.panelId = state.panelId;

        // ── Header ───────────────────────────────────────────────────────────
        const header = document.createElement('div');
        header.className = 'th-header';

        const toggle = document.createElement('button');
        toggle.className   = 'th-toggle button-none button-small button-minimal-hover';
        toggle.type        = 'button';
        toggle.title       = 'Collapse / expand';
        toggle.textContent = this._collapsed ? '+' : '−';

        const icon = document.createElement('span');
        icon.className = 'th-title-icon';
        try { icon.appendChild(this.ui.createIcon('ti-quote')); }
        catch (_) { icon.textContent = '❝'; }

        const titleEl = document.createElement('div');
        titleEl.className   = 'th-title';
        titleEl.textContent = "Today's Highlights";

        const countEl = document.createElement('div');
        countEl.className    = 'th-count';
        countEl.dataset.role = 'count';

        header.appendChild(toggle);
        header.appendChild(icon);
        header.appendChild(titleEl);
        header.appendChild(countEl);

        // ── Body ─────────────────────────────────────────────────────────────
        const body = document.createElement('div');
        body.dataset.role  = 'body';
        body.className     = 'th-body';
        body.style.display = this._collapsed ? 'none' : 'block';

        toggle.addEventListener('click', () => {
            this._collapsed    = !this._collapsed;
            this._saveBool('th_footer_collapsed', this._collapsed);
            toggle.textContent = this._collapsed ? '+' : '−';
            body.style.display = this._collapsed ? 'none' : 'block';
        });

        root.appendChild(header);
        root.appendChild(body);
        return root;
    }

    // =========================================================================
    // Data & rendering
    // =========================================================================

    async _populate(state) {
        if (state.loading) return;
        state.loading = true;

        const bodyEl  = state.rootEl?.querySelector('[data-role="body"]');
        const countEl = state.rootEl?.querySelector('[data-role="count"]');
        if (!bodyEl) { state.loading = false; return; }

        bodyEl.innerHTML = '<div class="th-loading">Loading…</div>';

        try {
            const highlights = await this._getHighlightsForDate(state.journalDate);
            if (!state.rootEl?.isConnected) { state.loading = false; return; }

            bodyEl.innerHTML = '';

            if (highlights.length === 0) {
                bodyEl.innerHTML = '<div class="th-empty">No highlights for this day.</div>';
                if (countEl) countEl.textContent = '';
            } else {
                if (countEl) countEl.textContent = String(highlights.length);

                // Group by source_title
                const groups = new Map();
                for (const h of highlights) {
                    const key = h.source_title || 'Unknown source';
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key).push(h);
                }

                for (const [sourceTitle, items] of groups) {
                    bodyEl.appendChild(this._buildGroup(sourceTitle, items, state));
                }
            }

            state.loaded = true;
        } catch (e) {
            console.error('[TodaysHighlights]', e);
            if (bodyEl) bodyEl.innerHTML = '<div class="th-empty">Error loading highlights.</div>';
        }

        state.loading = false;
    }

    // Query Highlights collection, filter by date
    async _getHighlightsForDate(yyyymmdd) {
        const y = parseInt(yyyymmdd.slice(0, 4), 10);
        const m = parseInt(yyyymmdd.slice(4, 6), 10) - 1;
        const d = parseInt(yyyymmdd.slice(6, 8), 10);
        const dayStart = new Date(y, m, d,  0,  0,  0,   0);
        const dayEnd   = new Date(y, m, d, 23, 59, 59, 999);

        const collections = await this.data.getAllCollections();
        const highlightsColl = collections.find(c => c.getName() === 'Highlights');
        if (!highlightsColl) return [];

        let records;
        try { records = await highlightsColl.getAllRecords(); }
        catch (_) { return []; }

        const results = [];
        for (const record of records) {
            const date = this._getDateValue(record, 'highlighted_at');
            if (!date) continue;
            if (date >= dayStart && date <= dayEnd) {
                results.push({
                    guid:         record.guid,
                    record,
                    text:         record.text('text')         || '',
                    note:         record.text('note')         || '',
                    source_title: record.text('source_title') || 'Unknown',
                    source_author: record.text('source_author') || '',
                    location:     record.text('location')     || '',
                    category:     record.prop('category')?.choice() || '',
                });
            }
        }

        // Sort by source_title then by original order
        results.sort((a, b) => a.source_title.localeCompare(b.source_title));
        return results;
    }

    _getDateValue(record, fieldId) {
        try {
            const prop = record.prop(fieldId);
            if (!prop) return null;
            if (typeof prop.date === 'function') {
                const d = prop.date();
                if (d instanceof Date && !isNaN(d)) return d;
            }
            const raw = prop.get();
            if (!raw) return null;
            if (raw instanceof Date && !isNaN(raw)) return raw;
            if (typeof raw.toDate  === 'function') { const d = raw.toDate();     if (!isNaN(d)) return d; }
            if (typeof raw.value   === 'function') { const d = new Date(raw.value()); if (!isNaN(d)) return d; }
            if (typeof raw === 'number')           { const d = new Date(raw);    if (!isNaN(d)) return d; }
            if (typeof raw === 'string' && raw.length >= 8) { const d = new Date(raw); if (!isNaN(d)) return d; }
        } catch (_) {}
        return null;
    }

    // =========================================================================
    // DOM — group rendering
    // =========================================================================

    _buildGroup(sourceTitle, items, state) {
        const isExpanded = state.expandedSources.get(sourceTitle) ?? false;

        const group = document.createElement('div');
        group.className = 'th-group';
        if (isExpanded) group.classList.add('th-group--expanded');

        // ── Group header ─────────────────────────────────────────────────────
        const groupHeader = document.createElement('div');
        groupHeader.className = 'th-group-header';

        const sourceEl = document.createElement('span');
        sourceEl.className   = 'th-source-title';
        sourceEl.textContent = sourceTitle;

        const hlCount = document.createElement('span');
        hlCount.className   = 'th-group-count';
        hlCount.textContent = items.length === 1 ? '1 highlight' : `${items.length} highlights`;

        const expandBtn = document.createElement('button');
        expandBtn.className = 'th-expand-btn button-none button-small button-minimal-hover';
        expandBtn.type      = 'button';
        expandBtn.title     = isExpanded ? 'Collapse' : 'Show highlights';
        expandBtn.textContent = isExpanded ? '▼' : '▶';

        groupHeader.appendChild(expandBtn);
        groupHeader.appendChild(sourceEl);
        groupHeader.appendChild(hlCount);

        // ── Preview area ─────────────────────────────────────────────────────
        const preview = document.createElement('div');
        preview.className    = 'th-preview';
        preview.style.display = isExpanded ? 'block' : 'none';

        for (const h of items) {
            preview.appendChild(this._buildHighlightRow(h, state));
        }

        // ── Toggle expand ─────────────────────────────────────────────────────
        expandBtn.addEventListener('click', () => {
            const nowExpanded = !state.expandedSources.get(sourceTitle);
            state.expandedSources.set(sourceTitle, nowExpanded);
            group.classList.toggle('th-group--expanded', nowExpanded);
            preview.style.display = nowExpanded ? 'block' : 'none';
            expandBtn.textContent = nowExpanded ? '▼' : '▶';
            expandBtn.title       = nowExpanded ? 'Collapse' : 'Show highlights';
        });

        group.appendChild(groupHeader);
        group.appendChild(preview);
        return group;
    }

    _buildHighlightRow(h, state) {
        const row = document.createElement('div');
        row.className = 'th-highlight-row';

        // Quote bar + text
        const quoteEl = document.createElement('div');
        quoteEl.className   = 'th-highlight-text';
        quoteEl.textContent = h.text;

        row.appendChild(quoteEl);

        // Note (if present)
        if (h.note && h.note.trim()) {
            const noteEl = document.createElement('div');
            noteEl.className   = 'th-highlight-note';
            noteEl.textContent = '✎ ' + h.note;
            row.appendChild(noteEl);
        }

        // Meta: location
        if (h.location && h.location.trim()) {
            const metaEl = document.createElement('div');
            metaEl.className   = 'th-highlight-meta';
            metaEl.textContent = h.location;
            row.appendChild(metaEl);
        }

        // Click to navigate to the highlight record
        row.addEventListener('click', () => {
            const wsGuid = this.getWorkspaceGuid?.() || this.data?.getActiveUsers?.()[0]?.workspaceGuid;
            if (!wsGuid) return;
            state.panel?.navigateTo({
                workspaceGuid: wsGuid,
                type:   'edit_panel',
                rootId: h.guid,
                subId:  h.guid,
            });
        });

        return row;
    }

    // =========================================================================
    // Utilities
    // =========================================================================

    _journalDateFromGuid(guid) {
        if (!guid || guid.length < 8) return null;
        const suffix = guid.slice(-8);
        if (!/^\d{8}$/.test(suffix)) return null;
        const year  = parseInt(suffix.slice(0, 4), 10);
        const month = parseInt(suffix.slice(4, 6), 10);
        const day   = parseInt(suffix.slice(6, 8), 10);
        if (year < 2000 || year > 2099) return null;
        if (month < 1 || month > 12)    return null;
        if (day < 1   || day > 31)      return null;
        return suffix;
    }

    getWorkspaceGuid() {
        try { return this.data.getActiveUsers()[0]?.workspaceGuid; }
        catch (_) { return null; }
    }

    _loadBool(key, def) {
        try { const v = localStorage.getItem(key); return v === null ? def : v === 'true'; }
        catch (_) { return def; }
    }
    _saveBool(key, val) {
        try { localStorage.setItem(key, val ? 'true' : 'false'); } catch (_) {}
    }

    // =========================================================================
    // CSS
    // =========================================================================

    _injectCSS() {
        this.ui.injectCSS(`
            /* ── Outer card — matches Backreferences / Today's Notes ── */
            .th-footer {
                margin-top: 16px;
                font-size: 13px;
                color: #e8e0d0;
                background-color: rgba(30, 30, 36, 0.60);
                border: 1px solid rgba(255, 255, 255, 0.10);
                border-radius: 10px;
                padding: 12px 16px 10px;
            }

            /* ── Header row ── */
            .th-header {
                display: flex;
                align-items: center;
                gap: 6px;
                min-height: 30px;
                margin-bottom: 6px;
            }
            .th-toggle {
                font-size: 13px;
                line-height: 1;
                color: #8a7e6a;
                cursor: pointer;
                padding: 0 4px;
                min-width: 18px;
                flex-shrink: 0;
            }
            .th-title-icon {
                color: #8a7e6a;
                font-size: 14px;
                flex-shrink: 0;
            }
            .th-title {
                font-weight: 600;
                font-size: 13px;
                flex: 1;
                white-space: nowrap;
            }
            .th-count {
                color: #8a7e6a;
                font-size: 12px;
                white-space: nowrap;
                font-variant-numeric: tabular-nums;
            }

            /* ── Body ── */
            .th-body { padding-bottom: 4px; }

            .th-loading, .th-empty {
                font-size: 12px;
                color: #8a7e6a;
                padding: 4px 0 6px;
                font-style: italic;
            }

            /* ── Group (one per source_title) ── */
            .th-group {
                border-top: 1px solid rgba(255,255,255,0.06);
                padding-top: 6px;
                margin-top: 6px;
            }
            .th-group:first-child {
                border-top: none;
                margin-top: 0;
                padding-top: 2px;
            }
            .th-group-header {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 3px 0;
            }
            .th-source-title {
                font-weight: 600;
                font-size: 13px;
                color: #e8e0d0;
                flex: 1;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                min-width: 0;
            }
            .th-group-count {
                font-size: 11px;
                color: #8a7e6a;
                white-space: nowrap;
                flex-shrink: 0;
            }
            .th-expand-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                color: #8a7e6a;
                cursor: pointer;
                padding: 0;
                margin: 0;
                background: none;
                border: none;
                font-weight: 600;
                line-height: 1;
                flex-shrink: 0;
                transition: color 0.1s;
                min-width: 14px;
                height: 16px;
            }
            .th-expand-btn:hover {
                color: #e8e0d0;
            }

            /* ── Expandable highlight list ── */
            .th-preview {
                margin-top: 4px;
                padding-left: 10px;
                border-left: 2px solid rgba(255,255,255,0.10);
                margin-left: 2px;
            }

            /* ── Individual highlight row ── */
            .th-highlight-row {
                padding: 6px 8px;
                border-radius: 5px;
                margin: 2px -8px;
                cursor: pointer;
                transition: background 0.1s;
            }
            .th-highlight-row:hover {
                background: rgba(255,255,255,0.05);
            }
            .th-highlight-text {
                font-size: 13px;
                color: #c8bfaf;
                line-height: 1.5;
                /* subtle left bar to signal "quote" */
            }
            .th-highlight-note {
                font-size: 12px;
                color: #8a7e6a;
                margin-top: 3px;
                font-style: italic;
            }
            .th-highlight-meta {
                font-size: 11px;
                color: #6a5f52;
                margin-top: 2px;
            }
        `);
    }
}
