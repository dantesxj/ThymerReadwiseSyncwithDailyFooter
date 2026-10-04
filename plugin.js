/**
 * Dawn Readwise sync engine — prod Readwise References sync path (References bodies + day index).
 * @generated — do not edit by hand; run: node ThymerExtensions/scripts/build-readwise-sync-engine.mjs
 *
 * Footer UI lives in plugin.js. This module only: token, API sync, References bodies, th_highlights_by_day_v1.
 */

// @generated BEGIN thymer-plugin-settings-stub (host: Plugin Backend Runtime — do not embed full Path B here)
(function thymerPathBStub(g) {
  if (g.ThymerPluginSettings && !g.ThymerPluginSettings.__pathBStub) return;

  const queue = (g.__thymerPathBQueue = g.__thymerPathBQueue || []);

  function armWait() {
    if (g.__thymerPathBWait) return;
    let ticks = 0;
    g.__thymerPathBWait = setInterval(function () {
      ticks += 1;
      const real = g.ThymerPluginSettings;
      if (real && !real.__pathBStub) {
        clearInterval(g.__thymerPathBWait);
        g.__thymerPathBWait = null;
        const items = queue.splice(0, queue.length);
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          try {
            const v = real[it.prop];
            const r = typeof v === 'function' ? v.apply(real, it.args || []) : v;
            Promise.resolve(r).then(it.resolve, it.reject);
          } catch (e) {
            try { it.reject(e); } catch (_) {}
          }
        }
        return;
      }
      // Safety: stop after ~15s if host never appears (avoids forever-hot poll).
      if (ticks >= 600) {
        clearInterval(g.__thymerPathBWait);
        g.__thymerPathBWait = null;
        const items = queue.splice(0, queue.length);
        const err = new Error('[PathB stub] host missing');
        for (let i = 0; i < items.length; i++) {
          try { items[i].reject(err); } catch (_) {}
        }
      }
    }, 25);
  }

  const stub = new Proxy(
    { __pathBStub: true },
    {
      get: function (target, prop) {
        if (prop === '__pathBStub') return true;
        if (prop === Symbol.toStringTag) return 'ThymerPluginSettingsStub';
        if (prop === 'then') return undefined;
        return function () {
          const args = Array.prototype.slice.call(arguments);
          return new Promise(function (resolve, reject) {
            const real = g.ThymerPluginSettings;
            if (real && !real.__pathBStub) {
              try {
                const v = real[prop];
                Promise.resolve(typeof v === 'function' ? v.apply(real, args) : v).then(resolve, reject);
              } catch (e) {
                reject(e);
              }
              return;
            }
            queue.push({ prop: prop, args: args, resolve: resolve, reject: reject });
            armWait();
          });
        };
      },
    }
  );

  g.ThymerPluginSettings = stub;
})(typeof globalThis !== 'undefined' ? globalThis : window);
// @generated END thymer-plugin-settings-stub

// @generated BEGIN thymer-readwise-references-coll (source: plugins/public repo/readwise-references/ThymerReadwiseReferencesCollectionRuntime.js — run: npm run embed-readwise-refs-coll)
/**
 * ThymerReadwiseReferencesColl — ensure workspace **References** collection (Readwise Option B).
 * Shape matches `ThymerReadwiseSyncwithDailyFooter/References.json` (filter_colguid omitted for portability).
 *
 * Edit in repo, then: `npm run embed-readwise-refs-coll`
 * Debug: `[ThymerExt/ReadwiseRefs]`; silence: `localStorage.setItem('thymerext_debug_collections','0')`
 *
 * API:
 *   ThymerReadwiseReferencesColl.findColl(data) — locate existing collection (no create)
 *   ThymerReadwiseReferencesColl.ensure(data) — create if missing + merge schema; returns collection or null
 */
(function readwiseRefsCollRuntime(g) {
  /**
   * Bump when REFERENCES_SHAPE changes. Without this, `if (ThymerReadwiseReferencesColl) return` kept an
   * old embedded runtime on globalThis after in-app plugin saves (new plugin.js never re-ran the IIFE).
   */
  const THYMER_READWISE_REFS_COLL_SCHEMA_VER = 6;
  if (g.ThymerReadwiseReferencesColl && g.ThymerReadwiseReferencesColl.SCHEMA_VER === THYMER_READWISE_REFS_COLL_SCHEMA_VER) {
    return;
  }

  const COL_NAME = 'References';
  const MANAGED_UNLOCK = { fields: false, views: false, sidebar: false };

  const DEBUG_COLLECTIONS = (() => {
    try {
      const o = localStorage.getItem('thymerext_debug_collections');
      if (o === '0' || o === 'off' || o === 'false') return false;
      return o === '1' || o === 'true' || o === 'on';
    } catch (_) {}
    return false;
  })();
  const DEBUG_REFS_ID = 'rr-' + (Date.now() & 0xffffffff).toString(16) + '-' + Math.random().toString(36).slice(2, 7);

  /**
   * Same dedupe as Plugin Settings: use **`window.top`** (shared) for cross-iframe promises when
   * not cross-origin, plus `__thymerExtSerializedDataCreateP_v1` on that window for all `data.createCollection()`.
   */
  function getSharedDeduplicationWindow() {
    try {
      if (typeof window === 'undefined') return g;
      const t = window.top;
      if (t) {
        void t.document;
        return t;
      }
    } catch (_) {}
    try {
      let w = typeof window !== 'undefined' ? window : null;
      let best = w || g;
      while (w) {
        try {
          void w.document;
          best = w;
        } catch (_) {
          break;
        }
        if (w === w.top) break;
        w = w.parent;
      }
      return best;
    } catch (_) {
      return typeof window !== 'undefined' ? window : g;
    }
  }

  const RR_ENSURE_GLOBAL_P = '__thymerReadwiseReferencesEnsureGlobalP';
  const SERIAL_DATA_CREATE_P = '__thymerExtSerializedDataCreateP_v1';
  const GETALL_COLLECTIONS_SANITY = '__thymerExtGetAllCollectionsSanityV1';
  function touchGetAllSanityFromCount(len) {
    const n = Number(len) || 0;
    const h = getSharedDeduplicationWindow();
    if (!h[GETALL_COLLECTIONS_SANITY]) h[GETALL_COLLECTIONS_SANITY] = { nLast: 0, tLast: 0 };
    const s = h[GETALL_COLLECTIONS_SANITY];
    if (n > 0) {
      s.nLast = n;
      s.tLast = Date.now();
    }
  }
  function isSuspiciousEmptyAfterRecentNonEmptyList(currentLen) {
    const c = Number(currentLen) || 0;
    if (c > 0) {
      touchGetAllSanityFromCount(c);
      return false;
    }
    const h = getSharedDeduplicationWindow();
    const s = h[GETALL_COLLECTIONS_SANITY];
    if (!s || s.nLast <= 0 || !s.tLast) return false;
    return Date.now() - s.tLast < 60_000;
  }

  function chainReferencesEnsure(data, work) {
    const root = getSharedDeduplicationWindow();
    try {
      if (!root[RR_ENSURE_GLOBAL_P]) root[RR_ENSURE_GLOBAL_P] = Promise.resolve();
    } catch (_) {
      return Promise.resolve().then(work);
    }
    root[RR_ENSURE_GLOBAL_P] = root[RR_ENSURE_GLOBAL_P].catch(() => {}).then(work);
    return root[RR_ENSURE_GLOBAL_P];
  }

  function withUnlockedManaged(base) {
    return { ...(base && typeof base === 'object' ? base : {}), managed: MANAGED_UNLOCK };
  }

  function cloneFieldDef(x) {
    try {
      return structuredClone(x);
    } catch (_) {
      return JSON.parse(JSON.stringify(x));
    }
  }

  function mergeViewsArray(baseViews, desiredViews) {
    const desired = Array.isArray(desiredViews) ? desiredViews.map((v) => cloneFieldDef(v)) : [];
    const cur = Array.isArray(baseViews) ? baseViews.map((v) => cloneFieldDef(v)) : [];
    if (cur.length === 0) {
      return { views: desired, changed: desired.length > 0 };
    }
    const ids = new Set(cur.map((v) => v && v.id).filter(Boolean));
    let changed = false;
    for (const v of desired) {
      if (v && v.id && !ids.has(v.id)) {
        cur.push(cloneFieldDef(v));
        ids.add(v.id);
        changed = true;
      }
    }
    return { views: cur, changed };
  }

  /**
   * Readwise `category` → Thymer choice ids (`prop.setChoice(id)`).
   * Three choices only — see plugin `_normalizeReadwiseCategoryChoiceId`.
   */
  const READWISE_SOURCE_CATEGORY_CHOICES = [
    { id: 'books', label: 'Books', color: '1', active: true },
    { id: 'articles', label: 'Articles', color: '2', active: true },
    { id: 'podcasts', label: 'Podcasts', color: '3', active: true },
    { id: 'video', label: 'Video', color: '4', active: true },
  ];

  const READWISE_SOURCE_ORIGIN_CHOICES = [
    { id: 'reader', label: 'Reader', color: '1', active: true },
    { id: 'reader_mobile', label: 'Reader | mobile', color: '1', active: true },
    { id: 'reader_web', label: 'Reader | web', color: '1', active: true },
    { id: 'reader_rss', label: 'Reader | RSS', color: '1', active: true },
    { id: 'reader_share_sheet', label: 'Reader | share sheet', color: '1', active: true },
    { id: 'reader_in_app_save', label: 'Reader | in-app save', color: '1', active: true },
    { id: 'reader_import_url', label: 'Reader | add (URL)', color: '1', active: true },
    { id: 'reader_clipboard', label: 'Reader | add (clipboard)', color: '1', active: true },
    { id: 'readwise_web_highlighter', label: 'Readwise | web highlighter', color: '2', active: true },
    { id: 'readwise_onboarding', label: 'Readwise | onboarding', color: '2', active: true },
    { id: 'kindle', label: 'Kindle', color: '3', active: true },
    { id: 'upload', label: 'Upload | file', color: '4', active: true },
    { id: 'pdf_upload', label: 'PDF upload', color: '4', active: true },
    { id: 'snipd', label: 'Snipd', color: '5', active: true },
    { id: 'instapaper', label: 'Instapaper', color: '6', active: true },
    { id: 'raindrop', label: 'Raindrop', color: '6', active: true },
    { id: 'api_article', label: 'API article', color: '7', active: true },
    { id: 'manual', label: 'Manual', color: '0', active: true },
    { id: 'supplemental', label: 'Supplemental', color: '0', active: true },
    { id: 'unknown', label: 'Unknown', color: '0', active: true },
    { id: 'other', label: 'Other', color: '0', active: true },
  ];

  /**
   * Canonical shape — keep in sync with `ThymerReadwiseSyncwithDailyFooter/References.json`.
   * `filter_colguid` on `source_author` is workspace-specific; omitted so auto-create works in any workspace.
   */
  const REFERENCES_SHAPE = {
    ver: 1,
    name: COL_NAME,
    icon: 'ti-books',
    color: null,
    home: false,
    page_field_ids: [
      'external_id',
      'source_title',
      'source_author',
      'source_url',
      'source_category',
      'source_origin',
      'highlight_count',
      'captured_at',
      'synced_at',
      'banner',
    ],
    item_name: 'Reference',
    description: 'Books, articles, and podcasts from Readwise (Option B: highlights in body)',
    show_sidebar_items: true,
    show_cmdpal_items: true,
    fields: [
      { icon: 'ti-id', id: 'external_id', label: 'External ID', type: 'text', read_only: true },
      { icon: 'ti-book', id: 'source_title', label: 'Title', type: 'text', read_only: true },
      {
        icon: 'ti-user',
        id: 'source_author',
        label: 'Author',
        many: false,
        read_only: true,
        active: true,
        type: 'record',
        target_collection_id: 'People',
      },
      { icon: 'ti-link', id: 'source_url', label: 'URL', type: 'url', read_only: true },
      {
        icon: 'ti-category',
        id: 'source_category',
        label: 'Category',
        type: 'choice',
        read_only: true,
        active: true,
        many: false,
        choices: READWISE_SOURCE_CATEGORY_CHOICES.map((c) => cloneFieldDef(c)),
      },
      {
        icon: 'ti-cloud-download',
        id: 'source_origin',
        label: 'Source',
        type: 'choice',
        read_only: true,
        active: true,
        many: false,
        choices: READWISE_SOURCE_ORIGIN_CHOICES.map((c) => cloneFieldDef(c)),
      },
      { icon: 'ti-quote', id: 'highlight_count', label: 'Highlight Count', type: 'number', read_only: true },
      { icon: 'ti-calendar-event', id: 'captured_at', label: 'Captured', type: 'datetime', read_only: true },
      { icon: 'ti-clock-plus', id: 'synced_at', label: 'Synced', type: 'datetime', read_only: true },
      {
        icon: 'ti-abc',
        id: 'title',
        label: 'Title',
        many: false,
        read_only: false,
        active: true,
        type: 'text',
      },
      {
        icon: 'ti-clock-edit',
        id: 'updated_at',
        label: 'Modified',
        many: false,
        read_only: true,
        active: true,
        type: 'datetime',
      },
      {
        icon: 'ti-clock-plus',
        id: 'created_at',
        label: 'Created',
        many: false,
        read_only: true,
        active: true,
        type: 'datetime',
      },
      {
        icon: 'ti-photo',
        id: 'banner',
        label: 'Banner',
        many: false,
        read_only: false,
        active: true,
        type: 'banner',
      },
      {
        icon: 'ti-align-left',
        id: 'icon',
        label: 'Icon',
        many: false,
        read_only: false,
        active: true,
        type: 'text',
      },
    ],
    sidebar_record_sort_dir: 'desc',
    sidebar_record_sort_field_id: 'updated_at',
    managed: MANAGED_UNLOCK,
    custom: {},
    views: [
      {
        id: 'table',
        type: 'table',
        icon: '',
        label: 'Table',
        description: '',
        read_only: false,
        shown: true,
        field_ids: [
          'title',
          'external_id',
          'source_title',
          'source_author',
          'source_url',
          'source_category',
          'source_origin',
          'highlight_count',
          'captured_at',
          'synced_at',
          'banner',
        ],
        sort_dir: 'asc',
        sort_field_id: 'title',
        group_by_field_id: null,
      },
    ],
  };

  function cloneShape() {
    try {
      return structuredClone(REFERENCES_SHAPE);
    } catch (_) {
      return JSON.parse(JSON.stringify(REFERENCES_SHAPE));
    }
  }

  function collectionDisplayName(c) {
    if (!c) return '';
    let s = '';
    try {
      s = String(c.getName?.() || '').trim();
    } catch (_) {}
    if (s) return s;
    try {
      s = String(c.getConfiguration?.()?.name || '').trim();
    } catch (_) {}
    return s;
  }

  /** When Thymer omits names on list entries, match the Readwise References schema. */
  function refsHeuristicScore(c) {
    if (!c) return 0;
    try {
      const conf = c.getConfiguration?.() || {};
      const fields = Array.isArray(conf.fields) ? conf.fields : [];
      const ids = new Set(fields.map((f) => f && f.id).filter(Boolean));
      if (!ids.has('external_id') || !ids.has('source_title')) return 0;
      let s = 2;
      if (ids.has('source_url')) s += 1;
      if (ids.has('highlight_count')) s += 1;
      const nm = collectionDisplayName(c).toLowerCase();
      if (nm === 'references') s += 2;
      return s;
    } catch (_) {
      return 0;
    }
  }

  function pickRefsHeuristic(all) {
    const list = Array.isArray(all) ? all : [];
    const cands = [];
    let bestS = 0;
    for (const c of list) {
      const sc = refsHeuristicScore(c);
      if (sc > bestS) {
        bestS = sc;
        cands.length = 0;
        cands.push(c);
      } else if (sc === bestS && sc >= 2) {
        cands.push(c);
      }
    }
    if (!cands.length) return null;
    const named = cands.find((c) => collectionDisplayName(c) === COL_NAME);
    return named || cands[0];
  }

  /** Same “has References” rule as `snapshotReferencesState`, on an existing list (no I/O). */
  function hasReferencesOnWorkspaceSyncList(list) {
    const arr = Array.isArray(list) ? list : [];
    if (arr.length === 0) return false;
    for (const c of arr) {
      if (collectionDisplayName(c) === COL_NAME) return true;
    }
    return !!pickRefsHeuristic(arr);
  }

  /** One `getAllCollections` — replaces paired `findReferencesColl` + `hasReferencesOnWorkspace` (was 2× per check). */
  async function snapshotReferencesState(data) {
    if (!data || typeof data.getAllCollections !== 'function') return { coll: null, has: false, len: 0 };
    try {
      const all = await data.getAllCollections();
      const list = Array.isArray(all) ? all : [];
      const coll = list.find((c) => collectionDisplayName(c) === COL_NAME) || pickRefsHeuristic(list) || null;
      let has = false;
      for (const c of list) {
        if (collectionDisplayName(c) === COL_NAME) {
          has = true;
          break;
        }
      }
      if (!has) has = !!pickRefsHeuristic(list);
      return { coll, has, len: list.length };
    } catch (_) {
      return { coll: null, has: false, len: 0 };
    }
  }

  async function findReferencesColl(data) {
    return (await snapshotReferencesState(data)).coll;
  }

  async function hasReferencesOnWorkspace(data) {
    return (await snapshotReferencesState(data)).has;
  }

  async function yieldMainForPaint() {
    await new Promise((r) => {
      try {
        requestAnimationFrame(() => setTimeout(r, 0));
      } catch (_) {
        setTimeout(r, 0);
      }
    });
  }

  /** When `collOpt` is null, `ensure()` must have run `ensureReferencesCollection` first — nesting ensure here caused a second create (stale `getAllCollections`). */
  async function upgradeReferencesSchema(data, collOpt) {
    const coll = collOpt || (await findReferencesColl(data));
    if (!coll || typeof coll.getConfiguration !== 'function' || typeof coll.saveConfiguration !== 'function') return;
    try {
      let base = coll.getConfiguration() || {};
      try {
        if (typeof coll.getExistingCodeAndConfig === 'function') {
          const pack = coll.getExistingCodeAndConfig();
          if (pack && pack.json && typeof pack.json === 'object') {
            base = { ...base, ...pack.json };
          }
        }
      } catch (_) {}

      const desired = cloneShape();
      const curFields = Array.isArray(base.fields) ? base.fields.map((f) => cloneFieldDef(f)) : [];
      const curIds = new Set(curFields.map((f) => (f && f.id ? f.id : null)).filter(Boolean));
      let changed = false;
      for (const f of desired.fields) {
        if (!f || !f.id) continue;
        const idx = curFields.findIndex((x) => x && x.id === f.id);
        if (idx < 0) {
          curFields.push(cloneFieldDef(f));
          curIds.add(f.id);
          changed = true;
        } else {
          const cur = curFields[idx];
          const choiceMismatch =
            f.type === 'choice'
            && JSON.stringify(cur.choices || []) !== JSON.stringify(f.choices || []);
          if (cur.type !== f.type || choiceMismatch) {
            curFields[idx] = cloneFieldDef(f);
            changed = true;
          }
        }
      }

      const vMerge = mergeViewsArray(base.views, desired.views);
      if (vMerge.changed) changed = true;

      const curPages = [...(base.page_field_ids || [])];
      const wantPages = [...(desired.page_field_ids || [])];
      const mergedPages = [...new Set([...wantPages, ...curPages])];
      if (JSON.stringify(curPages) !== JSON.stringify(mergedPages)) changed = true;

      if ((base.description || '') !== desired.description) changed = true;
      if ((base.item_name || '') !== (desired.item_name || '')) changed = true;
      if (String(base.name || '').trim() !== COL_NAME) changed = true;
      if ((base.icon || '') !== (desired.icon || '')) changed = true;

      if (changed) {
        const merged = withUnlockedManaged({
          ...base,
          name: COL_NAME,
          description: desired.description,
          item_name: desired.item_name || base.item_name,
          icon: desired.icon || base.icon,
          color: desired.color !== undefined ? desired.color : base.color,
          home: desired.home !== undefined ? desired.home : base.home,
          fields: curFields,
          views: vMerge.views,
          page_field_ids: mergedPages.length ? mergedPages : wantPages,
          sidebar_record_sort_field_id: desired.sidebar_record_sort_field_id || base.sidebar_record_sort_field_id,
          sidebar_record_sort_dir: desired.sidebar_record_sort_dir || base.sidebar_record_sort_dir,
        });
        const ok = await coll.saveConfiguration(merged);
        if (ok === false) console.warn('[ThymerReadwiseReferencesColl] saveConfiguration returned false (schema merge)');
      }
    } catch (e) {
      console.error('[ThymerReadwiseReferencesColl] upgrade schema', e);
    }
  }

  const RR_LOCK_NAME = 'thymer-ext-readwise-references-ensure-v1';
  const DATA_ENSURE_P = '__thymerExtDataReadwiseReferencesEnsureP';

  function dlogRef(phase, extra) {
    if (!DEBUG_COLLECTIONS) return;
    try {
      const row = { runId: DEBUG_REFS_ID, kind: 'ReadwiseReferences', phase, t: (typeof performance !== 'undefined' && performance.now) ? +performance.now().toFixed(1) : 0, ...extra };
      console.info('[ThymerExt/ReadwiseRefs]', row);
    } catch (_) {
      void 0;
    }
  }

  function refsPathWindowSnapshot() {
    const snap = { runId: DEBUG_REFS_ID, topReadable: null, hasLocks: null };
    try {
      if (typeof window !== 'undefined' && window.top) {
        void window.top.document;
        snap.topReadable = true;
      }
    } catch (e) {
      snap.topReadable = false;
      try { snap.topErr = String((e && e.name) || e) || 'top'; } catch (_) { snap.topErr = 'top'; }
    }
    const host = getSharedDeduplicationWindow();
    try { snap.hasLocks = !!(typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request); } catch (_) { snap.hasLocks = 'err'; }
    try { snap.locationHref = typeof location !== 'undefined' ? String(location.href) : ''; } catch (_) { snap.locationHref = ''; }
    try {
      snap.selfIsTop = typeof window !== 'undefined' && window === window.top;
      snap.hostIsTop = host === (typeof window !== 'undefined' ? window.top : null);
      snap.hostType = (host && host.constructor && host.constructor.name) || '';
      snap.gHasRrP = host && host[RR_ENSURE_GLOBAL_P] != null;
      snap.gHasCreateQ = host && host[SERIAL_DATA_CREATE_P] != null;
    } catch (_) {
      void 0;
    }
    return snap;
  }

  function queueDataCreateOnSharedWindow(factory) {
    const host = getSharedDeduplicationWindow();
    if (DEBUG_COLLECTIONS) dlogRef('queueDataCreate_enter', refsPathWindowSnapshot());
    try {
      if (!host[SERIAL_DATA_CREATE_P] || typeof host[SERIAL_DATA_CREATE_P].then !== 'function') {
        host[SERIAL_DATA_CREATE_P] = Promise.resolve();
      }
      const p = (host[SERIAL_DATA_CREATE_P] = host[SERIAL_DATA_CREATE_P].catch(() => {}).then(factory));
      if (DEBUG_COLLECTIONS) dlogRef('queueDataCreate_chained', { ok: true });
      return p;
    } catch (e) {
      if (DEBUG_COLLECTIONS) dlogRef('queueDataCreate_fallback', { err: String((e && e.message) || e) });
      return factory();
    }
  }

  async function runReferencesEnsureBody(data) {
    if (DEBUG_COLLECTIONS) {
      dlogRef('ensureBody_start', { path: refsPathWindowSnapshot() });
      try {
        if (data && data.getAllCollections) {
          const a = await data.getAllCollections();
          const names = (Array.isArray(a) ? a : []).map((c) => { try { return String(collectionDisplayName(c) || '').trim() || '(no-name)'; } catch (__) { return '(err)'; } });
          dlogRef('ensureBody_collections', { count: (names && names.length) || 0, names: (names || []).slice(0, 40) });
          if (data && data.getAllCollections) touchGetAllSanityFromCount((names && names.length) || 0);
        }
      } catch (e) {
        dlogRef('ensureBody_getAll_failed', { err: String((e && e.message) || e) });
      }
    }
    try {
      await yieldMainForPaint();
      for (let attempt = 0; attempt < 4; attempt++) {
        const snap = await snapshotReferencesState(data);
        if (snap.coll) return;
        if (snap.has) return;
        if (attempt < 3) await new Promise((r) => setTimeout(r, 50 + attempt * 50));
      }
      let post = await snapshotReferencesState(data);
      if (post.coll) return;
      if (post.has) return;
      await new Promise((r) => setTimeout(r, 120));
      post = await snapshotReferencesState(data);
      if (post.coll) return;
      if (post.has) return;
      let preCreateLen = 0;
      try {
        if (data && data.getAllCollections) {
          const all0 = await data.getAllCollections();
          const list0 = Array.isArray(all0) ? all0 : [];
          preCreateLen = list0.length;
          if (preCreateLen > 0) touchGetAllSanityFromCount(preCreateLen);
          if (preCreateLen > 0) {
            const c0 = list0.find((c) => collectionDisplayName(c) === COL_NAME) || pickRefsHeuristic(list0) || null;
            if (c0) return;
            if (hasReferencesOnWorkspaceSyncList(list0)) return;
          }
        }
        if (preCreateLen === 0) {
          await new Promise((r) => setTimeout(r, 150));
          if (data && data.getAllCollections) {
            const all1 = await data.getAllCollections();
            const list1 = Array.isArray(all1) ? all1 : [];
            preCreateLen = list1.length;
            if (preCreateLen > 0) touchGetAllSanityFromCount(preCreateLen);
            if (preCreateLen > 0) {
              const c1 = list1.find((c) => collectionDisplayName(c) === COL_NAME) || pickRefsHeuristic(list1) || null;
              if (c1) return;
              if (hasReferencesOnWorkspaceSyncList(list1)) return;
            }
          }
        }
        if (isSuspiciousEmptyAfterRecentNonEmptyList(preCreateLen) && preCreateLen === 0) {
          if (DEBUG_COLLECTIONS) {
            try {
              const h = getSharedDeduplicationWindow();
              dlogRef('refuse_create_flaky_getall_empty', { path: refsPathWindowSnapshot(), s: h[GETALL_COLLECTIONS_SANITY] || null });
            } catch (_) {
              dlogRef('refuse_create_flaky_getall_empty', { path: refsPathWindowSnapshot() });
            }
          }
          return;
        }
      } catch (_) {
        void 0;
      }
      await yieldMainForPaint();
      if (DEBUG_COLLECTIONS) dlogRef('ensureBody_about_to_create', { path: refsPathWindowSnapshot() });
      const coll = await queueDataCreateOnSharedWindow(() => data.createCollection());
      if (!coll || typeof coll.getConfiguration !== 'function' || typeof coll.saveConfiguration !== 'function') {
        return;
      }
      const conf = cloneShape();
      const base = coll.getConfiguration();
      if (base && typeof base.ver === 'number') conf.ver = base.ver;
      const ok = await coll.saveConfiguration(withUnlockedManaged(conf));
      if (ok === false) console.warn('[ThymerReadwiseReferencesColl] initial saveConfiguration returned false');
      await new Promise((r) => setTimeout(r, 250));
    } catch (e) {
      console.error('[ThymerReadwiseReferencesColl] ensure collection', e);
    }
  }

  function runReferencesEnsureWithLocksOrChain(data) {
    try {
      if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
        if (DEBUG_COLLECTIONS) dlogRef('ensure_route', { via: 'locks', lockName: RR_LOCK_NAME, path: refsPathWindowSnapshot() });
        return navigator.locks.request(RR_LOCK_NAME, () => runReferencesEnsureBody(data));
      }
    } catch (e) {
      if (DEBUG_COLLECTIONS) dlogRef('ensure_locks_threw', { err: String((e && e.message) || e) });
    }
    if (DEBUG_COLLECTIONS) dlogRef('ensure_route', { via: 'hierarchyChain', path: refsPathWindowSnapshot() });
    return chainReferencesEnsure(data, () => runReferencesEnsureBody(data));
  }

  function ensureReferencesCollection(data) {
    if (DEBUG_COLLECTIONS) {
      let dHint = 'no-data';
      try {
        dHint = data
          ? `ctor=${(data && data.constructor && data.constructor.name) || '?'},eqPrev=${
            !!(data && data === g.__th_lastDataRr)
          }`
          : 'null';
        g.__th_lastDataRr = data;
      } catch (_) {
        dHint = 'err';
      }
      dlogRef('ensureReferencesCollection', { dataHint: dHint, hasDataEnsure: (() => { try { return data ? !!data[DATA_ENSURE_P] : false; } catch (_) { return 'throw'; } })(), path: refsPathWindowSnapshot() });
    }
    if (!data || typeof data.getAllCollections !== 'function' || typeof data.createCollection !== 'function') {
      return Promise.resolve();
    }
    try {
      if (!data[DATA_ENSURE_P] || typeof data[DATA_ENSURE_P].then !== 'function') {
        data[DATA_ENSURE_P] = Promise.resolve();
      }
      if (DEBUG_COLLECTIONS) dlogRef('data_ensure_p_chained', {});
      const next = data[DATA_ENSURE_P]
        .catch(() => {})
        .then(() => runReferencesEnsureWithLocksOrChain(data));
      data[DATA_ENSURE_P] = next;
      return next;
    } catch (e) {
      if (DEBUG_COLLECTIONS) dlogRef('data_ensure_p_throw', { err: String((e && e.message) || e) });
      return runReferencesEnsureWithLocksOrChain(data);
    }
  }

  g.ThymerReadwiseReferencesColl = {
    SCHEMA_VER: THYMER_READWISE_REFS_COLL_SCHEMA_VER,
    COL_NAME,
    findColl: findReferencesColl,
    ensureReferencesCollection,
    upgradeSchema: (data, coll) => upgradeReferencesSchema(data, coll),
    async ensure(data) {
      await ensureReferencesCollection(data);
      await upgradeReferencesSchema(data, null);
      return findReferencesColl(data);
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
// @generated END thymer-readwise-references-coll


/**
 * Readwise References (Option B) — one **References** record per Readwise source document.
 * All highlights live under `❣️ Highlights...` in the body, grouped by calendar day (see
 * `formatReadwiseRefDateHeading`: weekday, month, day, and **year** so daily matching is unambiguous).
 * Notes and Readwise URLs are child blocks under each quote.
 * **Today's Highlights:** Journal footer listing highlights for the open journal day (References
 * body parse, or legacy Highlights collection fallback).
 *
 * **Quote Shuffler:** Second journal footer card; draw a random highlight per journal day (quote icon
 * when expanded; collapsed header matches Today’s Highlights). Sticky per day until reshuffle. Path B.
 *
 * Coexists with `plugins/readwise/` (per-highlight records). Uses separate localStorage keys.
 */

const RWR_TOKEN_KEY    = 'readwise_references_token';
const RWR_LAST_RUN_KEY = 'readwise_references_last_run';
/** JSON blob from the last sync — use "Readwise Ref: Log last sync diagnostics" to inspect. */
const RWR_LAST_SYNC_DIAG_KEY = 'readwise_references_last_sync_diag';
/** Per-`external_id` content hash — skip expensive body rebuild when highlights unchanged.
 * v3: journal date headings prefer real `@ref` links (force one rebuild after linking fix). */
const RWR_BODY_SIGS_KEY = 'readwise_references_body_sigs_v3';

/** People `Tags` field id for Readwise author stubs. Override: `readwise_references_people_tags_field_id`. */
const RWR_PEOPLE_TAGS_FIELD_ID_DEFAULT = 'F31TEM8CGEG08F1';
/** Hashtag value (no `#`) — filter with `@People.Tags = ReadwiseAuthor`. Override: `readwise_references_people_author_tag`. */
const RWR_PEOPLE_READWISE_AUTHOR_TAG_DEFAULT = 'ReadwiseAuthor';
/** People Notes / Group field ids (workspace defaults — match `People.json`). */
const RWR_PEOPLE_NOTES_FIELD_ID_DEFAULT = 'F6P3FJ4ACTZZZZ1';
const RWR_PEOPLE_GROUP_FIELD_ID_DEFAULT = 'FFZBHK06BNB3WT8';

/** Touch/coarse-pointer deferral (from embedded Plugin Settings runtime on `globalThis`). */
function rwrPreferDeferredHeavyWork() {
    try {
        if (typeof globalThis.thymerExtPreferDeferredHeavyWork === 'function') {
            return !!globalThis.thymerExtPreferDeferredHeavyWork();
        }
    } catch (_) {}
    return false;
}

/** Journal footer panels — persisted (localStorage + Path B when synced). */
const TH_KEY_SHOW_HIGHLIGHTS   = 'th_panel_show_highlights';
const TH_KEY_SHOW_SHUFFLER     = 'th_panel_show_shuffler';
const TH_KEY_SHUFFLER_COLLAPSED = 'th_shuffler_collapsed';
/** When true, Quote Shuffler mounts in its own glass shell below Today's Highlights (suite parity). */
const TH_KEY_SHUFFLER_DETACHED = 'th_shuffler_detached';
const TH_JFS_MIGRATED_KEY = 'jfs_config_v1__migrated_to_readwise';
/** JSON object: { [YYYYMMDD]: { sig, guid, text, note, location, source_title, source_author } } */
const TH_KEY_SHUFFLER_QUOTES_BY_DAY = 'th_shuffler_quotes_by_day';
const TH_KEY_SHUFFLER_POOL_CACHE = 'th_shuffler_pool_cache_v4';
/**
 * Compact date→highlights index for Today's Highlights (avoids full References body scan).
 * Shape: `{ v:1, updatedAt:number, entries:{ [guid]:{ st, sa, cat, d:{ [YYYYMMDD]:[[text,note,loc],...] } } } }`
 * Mirrored via Path B when storage mode is synced. Pool cache stays device-local (too large).
 */
const TH_KEY_HIGHLIGHTS_BY_DAY = 'th_highlights_by_day_v1';
/** Debounced cross-device sync for per-day shuffle picks (avoid workspace-wide flashes on every click). */
const TH_SHUFFLER_DAYMAP_SYNC_IDLE_MS = 15000;
const TH_DAY_INDEX_SYNC_IDLE_MS = 15000;
const TH_SHUFFLER_POOL_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const TH_SHUFFLER_POOL_CONCURRENCY = 10;

/** Opt-in: `localStorage.setItem('thymerext_debug_readwise_dupes','1')` → `[ReadwiseRef/DupDiag]` lines for duplicate-collection repro. */
function rwDupDiagReadwiseEnabled() {
    try {
        const o = localStorage.getItem('thymerext_debug_readwise_dupes');
        return o === '1' || o === 'true' || o === 'on';
    } catch (_) {
        return false;
    }
}

/** Must match Today's Highlights parser. */
const READWISE_REF_HIGHLIGHTS_HEADER = '❣️ Highlights...';

/** 0 = no rAF / setTimeout yields between references during sync (fastest; UI may freeze until sync ends). */
const RWR_UI_YIELD_EVERY = 0;
/**
 * 0 = no mid-sync References collection refresh (much faster navigation during sync; progress only in console/status).
 * Final sync still runs a full refresh once at the end.
 */
const RWR_UI_REFS_COLL_REFRESH_EVERY = 0;

/** Debounce panel.navigated / panel.focused → footer work (matches Backreferences-style scheduling). */
const RWR_PANEL_DEBOUNCE_MS = 650;
/** Coalesce MutationObserver callbacks — subtree:true sees every header/journal DOM tick; without this Readwise fights Journal Header Suite. */
const RWR_MUTATION_OBS_DEBOUNCE_MS = 450;
/** Coalesce `record.created` → `await _ensureRwCollections()` then cache clear + `_refreshAll` only if References may be affected (SDK: `ev.collectionGuid`; empty pending = conservative refresh). */
const RWR_RECORD_CREATED_DEBOUNCE_MS = 2800;
const RWR_RECORD_CREATED_DEBOUNCE_MOBILE_MS = 4200;
/** After cold load, ignore `record.created` footer churn while Thymer syncs many unrelated rows. */
const RWR_RECORD_CREATED_COLD_START_GRACE_MS = 18000;

/**
 * How many source documents to process concurrently during sync.
 * Metadata/property updates are light; body rebuilds still serialize inside each worker.
 * Override: `localStorage.setItem('readwise_references_sync_concurrency','1')` to restore serial.
 */
const RWR_SYNC_CONCURRENCY = 3;

/** 0 = no yields inside the per-highlight body loop (fastest body rebuild). */
const RWR_BODY_YIELD_EVERY_HIGHLIGHTS = 0;

/**
 * Reader `/api/v3/list/` — official Reader API default is **20 requests/minute/token** (~3000 ms between requests).
 * Override: `readwise_references_list_delay_ms` (set lower at your own 429 risk).
 * Default sync is export-first and skips this endpoint unless opted in (see rwrFetchListFromStorage).
 */
const RWR_LIST_PAGE_DELAY_MS_DEFAULT = 3000;
/**
 * v2 `/api/v2/export/` — main Readwise API docs cite **240 requests/minute/token** for most endpoints (~250 ms spacing).
 * (Highlight LIST / Book LIST are 20/min — export paging is not those.) Override: `readwise_references_export_delay_ms`.
 */
const RWR_EXPORT_PAGE_DELAY_MS_DEFAULT = 250;

/**
 * Default OFF — sync uses v2 /export/ only (Readwise’s recommended path).
 * Opt in to also pull Reader `/api/v3/list/` (slow; 20/min): `localStorage.setItem('readwise_references_fetch_list','1')`.
 * List is still fetched automatically when export fails or returns zero books.
 */
function rwrFetchListFromStorage() {
    try {
        const o = localStorage.getItem('readwise_references_fetch_list');
        return o === '1' || o === 'true' || o === 'on';
    } catch (_) {
        return false;
    }
}

/** Default OFF — set `readwise_references_markdown_bodies=1` to try bulk insertFromMarkdown (falls back to lines). */
function rwrPreferMarkdownBodiesFromStorage() {
    try {
        const o = localStorage.getItem('readwise_references_markdown_bodies');
        return o === '1' || o === 'true' || o === 'on';
    } catch (_) {
        return false;
    }
}

function rwrSyncConcurrencyFromStorage() {
    try {
        const v = parseInt(localStorage.getItem('readwise_references_sync_concurrency'), 10);
        if (Number.isFinite(v) && v >= 1 && v <= 8) return v;
    } catch (_) {}
    return RWR_SYNC_CONCURRENCY;
}

/** RSS-category sources sync by default. Opt out: `localStorage.setItem('readwise_references_include_rss','0')`. */
function rwrIncludeRssFromStorage() {
    try {
        const o = localStorage.getItem('readwise_references_include_rss');
        if (o === '0' || o === 'false' || o === 'off') return false;
        return true;
    } catch (_) {
        return true;
    }
}

function rwrParseDelayMs(key, defaultMs) {
    try {
        const v = parseInt(localStorage.getItem(key), 10);
        if (Number.isFinite(v) && v >= 0) return v;
    } catch (_) {}
    return defaultMs;
}

/** Default on — skip delete+rewrite of highlight bodies when API payload hash matches last sync. */
function rwrSkipUnchangedBodiesFromStorage() {
    try {
        const o = localStorage.getItem('readwise_references_skip_unchanged_bodies');
        if (o === '0' || o === 'false') return false;
    } catch (_) {}
    return true;
}

function rwrLoadBodySigMap() {
    try {
        const raw = localStorage.getItem(RWR_BODY_SIGS_KEY);
        if (raw) {
            const o = JSON.parse(raw);
            return o && typeof o === 'object' ? o : Object.create(null);
        }
        // Migrate v2 → v3 so a key bump does not force rewriting every Reference body.
        const legacy = localStorage.getItem('readwise_references_body_sigs_v2');
        if (legacy) {
            try { localStorage.setItem(RWR_BODY_SIGS_KEY, legacy); } catch (_) {}
            const o = JSON.parse(legacy);
            return o && typeof o === 'object' ? o : Object.create(null);
        }
        return Object.create(null);
    } catch (_) {
        return Object.create(null);
    }
}

function rwrSaveBodySigMap(map) {
    try {
        localStorage.setItem(RWR_BODY_SIGS_KEY, JSON.stringify(map || {}));
    } catch (_) {}
}

/** Dev only: `localStorage.setItem('readwise_references_debug_max_sources','25')` — cap merged sources written this run (clear key for full sync). */
function rwrDebugMaxSources() {
    try {
        const v = parseInt(localStorage.getItem('readwise_references_debug_max_sources'), 10);
        if (Number.isFinite(v) && v > 0) return v;
    } catch (_) {}
    return 0;
}

/** Dev: `readwise_references_debug_max_list_rows` — stop Reader `/api/v3/list/` pagination after this many rows (still one full last page may be trimmed). */
function rwrDebugMaxListRows() {
    try {
        const v = parseInt(localStorage.getItem('readwise_references_debug_max_list_rows'), 10);
        if (Number.isFinite(v) && v > 0) return v;
    } catch (_) {}
    return 0;
}

/** Dev: `readwise_references_debug_max_export_pages` — stop v2 `/export/` after this many response pages. */
function rwrDebugMaxExportPages() {
    try {
        const v = parseInt(localStorage.getItem('readwise_references_debug_max_export_pages'), 10);
        if (Number.isFinite(v) && v > 0) return v;
    } catch (_) {}
    return 0;
}

/**
 * Optional JSON on `localStorage.readwise_references_category_map`: map normalized Readwise keys → `books`|`articles`|`podcasts`.
 * Keys use the same form as sync diagnostics `readwiseCategoryRawHistogram` (trimmed API string, or `(empty)`).
 * Example: `{"tweets":"articles","supplemental_books":"books"}` — defaults still apply for keys you omit.
 */
function rwrCategoryMapOverride() {
    try {
        const j = localStorage.getItem('readwise_references_category_map');
        if (!j || !String(j).trim()) return null;
        const o = JSON.parse(j);
        return o && typeof o === 'object' ? o : null;
    } catch (_) {
        return null;
    }
}

/** Must match `source_origin` choice ids in References.json / embedded READWISE_SOURCE_ORIGIN_CHOICES. */
const READWISE_SOURCE_ORIGIN_ALLOWED = new Set([
    'reader', 'reader_mobile', 'reader_web', 'reader_rss', 'reader_share_sheet',
    'reader_in_app_save', 'reader_import_url', 'reader_clipboard',
    'readwise_web_highlighter', 'readwise_onboarding',
    'kindle', 'upload', 'pdf_upload', 'snipd', 'instapaper', 'raindrop',
    'api_article', 'manual', 'supplemental', 'unknown', 'other',
]);

/**
 * Optional JSON on `localStorage.readwise_references_source_map`: map Readwise `source` strings → `source_origin` choice id.
 * Keys: exact trimmed API value, normalized key (`epub`, `google_play_books`), or `(empty)`.
 * Values: allowed ids — `reader`, `kindle`, `epub`, …, `other`.
 */
function rwrSourceMapOverride() {
    try {
        const j = localStorage.getItem('readwise_references_source_map');
        if (!j || !String(j).trim()) return null;
        const o = JSON.parse(j);
        return o && typeof o === 'object' ? o : null;
    } catch (_) {
        return null;
    }
}

/** Visible separator between highlights under the same day (Thymer may not style `br` or `---` as a rule). */
const READWISE_REF_QUOTE_SEPARATOR_TEXT = '\u2500'.repeat(28);

/** Separator between calendar-day groups (sibling lines under the Highlights section). */
const READWISE_REF_BETWEEN_DATE_DIVIDER_TEXT = '\u2500'.repeat(36);

/** Month abbrev → 0–11 for parsing `Mon May 11, 2026` style headings. */
const READWISE_REF_MONTH_ABBREV = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/**
 * Parse plain date heading text with explicit year → `YYYYMMDD` or null.
 * Accepts the canonical format from {@link formatReadwiseRefDateHeading}.
 * @param {string} plain
 */
function parseReadwiseRefDateHeadingYmd(plain) {
    const s = String(plain || '').trim();
    const m = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s*(\d{4})$/.exec(s);
    if (!m) return null;
    const mo = READWISE_REF_MONTH_ABBREV[m[2]];
    if (mo === undefined) return null;
    const d = parseInt(m[3], 10);
    const y = parseInt(m[4], 10);
    if (d < 1 || d > 31 || y < 1970 || y > 2100) return null;
    const dt = new Date(y, mo, d);
    if (isNaN(dt.getTime())) return null;
    if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
    const wk = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    if (wk[dt.getDay()] !== m[1]) return null;
    const mm = String(mo + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}${mm}${dd}`;
}

/**
 * Canonical date line under each day group (e.g. "Sat Apr 18, 2026"). Used by sync and journal footer parser.
 * The year is required so the same calendar month/day in different years does not collide in Today’s Highlights matching.
 * @param {Date} d
 */
function formatReadwiseRefDateHeading(d) {
    if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
    const wk = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return wk[d.getDay()] + ' ' + mo[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

class DawnReadwiseSyncEngine {
    /** Cached journal GUID prefix (`S-…-P000000000-0-`) for constructing day links. */
    _journalGuidPrefix = null;
    /** Workspace-scoped cache for named collections (one `getAllCollections` until cleared). */
    _rwCollsKey = null;
    _rwCollsResolved = false;
    /** Cached References `collection.getGuid()` for `record.created` filtering (survives until workspace coll cache invalidates). */
    _rwReferencesCollGuid = null;
    _rwRefsColl = null;
    _rwPeopleColl = null;
    _rwHighlightsColl = null;
    /** Ephemeral status bar chip while sync runs (see `_syncStatusShow` / `_syncStatusHide`). */
    _rwrSyncStatusItem = null;
    /** After a successful References `ensure`, skip re-running bootstrap. */
    _rwRefsBootstrapComplete = false;
    /** `requestIdleCallback` id or `setTimeout` id — cancelled when eager bootstrap runs or on unload. */
    _rwRefsBootstrapDeferHandle = null;
    _rwRefsBootstrapDeferIsIdle = false;
    /** Trailing debounce for `record.created` → footer refresh (cleared on unload). */
    _rwRecordCreatedRefreshTimer = null;
    /** `collectionGuid` values seen during the current debounce window (for post-`ensure` filtering). */
    _rwRecordCreatedPendingColls = new Set();
    /** Resolves after `registerPluginSlug` + `ThymerPluginSettings.init` finish (deferred off critical path). */
    _rwPathBReadyPromise = null;
    _rwPathBReadyResolve = null;

    _cancelReferencesBootstrapDefer() {
        const h = this._rwRefsBootstrapDeferHandle;
        if (h == null) return;
        this._rwRefsBootstrapDeferHandle = null;
        const idle = this._rwRefsBootstrapDeferIsIdle;
        this._rwRefsBootstrapDeferIsIdle = false;
        try {
            if (idle && typeof cancelIdleCallback === 'function') cancelIdleCallback(h);
        } catch (_) {}
        try {
            clearTimeout(h);
        } catch (_) {}
    }

    /** Defer References `ensure` so install/save can paint before another `getAllCollections` / create pass. */
    _scheduleReferencesBootstrapDeferred() {
        if (this._rwRefsBootstrapComplete || this._rwRefsBootstrapPromise || this._rwRefsBootstrapDeferHandle != null) return;
        const fire = () => {
            this._rwRefsBootstrapDeferHandle = null;
            this._rwRefsBootstrapDeferIsIdle = false;
            if (this._rwRefsBootstrapComplete || this._rwRefsBootstrapPromise) return;
            void this._bootstrapReferencesCollectionIfNeeded();
        };
        try {
            if (typeof requestIdleCallback === 'function') {
                this._rwRefsBootstrapDeferIsIdle = true;
                this._rwRefsBootstrapDeferHandle = requestIdleCallback(fire, { timeout: 2200 });
            } else {
                this._rwRefsBootstrapDeferIsIdle = false;
                this._rwRefsBootstrapDeferHandle = setTimeout(fire, 450);
            }
        } catch (_) {
            this._rwRefsBootstrapDeferIsIdle = false;
            this._rwRefsBootstrapDeferHandle = setTimeout(fire, 450);
        }
    }

    async _ensureRwCollections() {
        if (!this._rwRefsBootstrapComplete) {
            await this._bootstrapReferencesCollectionIfNeeded();
        }
        let key = '';
        try {
            key = String(this.data.getActiveUsers?.()?.[0]?.workspaceGuid || '');
        } catch (_) {}
        if (this._rwCollsKey === key && this._rwCollsResolved) return;
        const all = await this.data.getAllCollections();
        this._rwRefsColl = all.find((c) => c.getName() === 'References') || null;
        try {
            this._rwReferencesCollGuid = this._rwRefsColl?.getGuid?.() || null;
        } catch (_) {
            this._rwReferencesCollGuid = null;
        }
        this._rwPeopleColl = all.find((c) => c.getName() === 'People') || null;
        this._rwHighlightsColl = all.find((c) => c.getName() === 'Highlights') || null;
        this._rwCollsKey = key;
        this._rwCollsResolved = true;
    }

    _invalidateRwCollectionHandleCache() {
        this._rwCollsKey = null;
        this._rwCollsResolved = false;
        this._rwReferencesCollGuid = null;
        this._rwRefsColl = null;
        this._rwPeopleColl = null;
        this._rwHighlightsColl = null;
    }

    _rwDupDiagLog(phase, detail) {
        if (!rwDupDiagReadwiseEnabled()) return;
        try {
            let ws = '';
            try {
                ws = String(this.data?.getActiveUsers?.()?.[0]?.workspaceGuid || '').slice(0, 10);
            } catch (_) {}
            const dt = this.data ? this.data.constructor?.name || 'data' : 'null';
            console.info('[ReadwiseRef/DupDiag]', phase, { ws, dataType: dt, ...detail });
        } catch (_) {}
    }

    /** On load: create **References** if missing and merge schema (embedded `ThymerReadwiseReferencesColl`). Single-flight so overlapping callers share one `ensure`. */
    async _bootstrapReferencesCollectionIfNeeded() {
        if (this._rwRefsBootstrapComplete) return;
        if (this._rwRefsBootstrapPromise) {
            this._rwDupDiagLog('references_bootstrap_coalesce', { reason: 'in-flight' });
            try {
                await this._rwRefsBootstrapPromise;
            } catch (_) {}
            return;
        }
        this._cancelReferencesBootstrapDefer();
        const api = globalThis.ThymerReadwiseReferencesColl;
        if (!api || typeof api.ensure !== 'function') {
            console.warn('[Readwise Ref] References collection helper missing — redeploy full plugin.js from repo (embed-readwise-refs-coll).');
            return;
        }
        this._rwDupDiagLog('references_bootstrap_start', {});
        this._rwRefsBootstrapPromise = (async () => {
            try {
                await api.ensure(this.data);
                this._rwRefsBootstrapComplete = true;
            } catch (e) {
                console.warn('[Readwise Ref] References collection setup failed', e);
            } finally {
                this._invalidateRwCollectionHandleCache();
            }
        })();
        try {
            await this._rwRefsBootstrapPromise;
        } finally {
            this._rwRefsBootstrapPromise = null;
        }
    }

    /**
     * `registerPluginSlug` + `init` are heavy; normally wait for idle so other globals can mount.
     * Coarse pointer only — do NOT use maxTouchPoints (touchscreen laptops are desktop).
     */
    _rwPreferSlowStart() {
        try {
            if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) return true;
        } catch (_) {}
        return false;
    }

    _rwInColdStartGrace() {
        const until = this._rwColdStartGraceUntil;
        return Number.isFinite(until) && until > 0 && Date.now() < until;
    }

    /** Wake deferred Path B idle gate (e.g. footer needs day index from vault before scanning). */
    _rwMarkPathBUrgent() {
        this._rwPathBUrgent = true;
        const wake = this._rwPathBIdleWake;
        if (typeof wake === 'function') {
            try { wake(); } catch (_) {}
        }
    }

    _rwEnsurePathBReady() {
        if (this._rwPathBReadyDone) return Promise.resolve();
        if (this._rwPathBReadyPromise) return this._rwPathBReadyPromise;
        this._rwPathBReadyPromise = this._rwRunDeferredPathB()
            .then(() => {
                this._rwPathBReadyDone = true;
            })
            .catch(() => {});
        return this._rwPathBReadyPromise;
    }

    async _rwAwaitPathBReady(opts) {
        if (opts?.urgent) this._rwMarkPathBUrgent();
        await this._rwEnsurePathBReady();
    }

    async _rwRunDeferredPathB() {
        try {
            this._rehydrateDayIndexAfterPathB();
            this._scheduleReferencesBootstrapDeferred();
        } catch (e) {
            try {
                console.warn('[Dawn/ReadwiseSync] Path B hydrate', e);
            } catch (_) {}
        }
    }

    attach(host) {
        this._host = host || null;
        this.data = host?.data;
        this.ui = host?.ui;
        this.events = host?.events;
        this._pluginSettingsPluginId = 'dawn-readwise';
        this._pluginSettingsSyncMode = 'synced';
        this._rwUnloaded = false;
        this._dayIndexRebuildEpoch = (this._dayIndexRebuildEpoch || 0) + 1;
        this._dayIndexRebuilding = false;
        this._dayIndexRebuildScheduled = false;
        this._dayIndexMissingToasted = false;
        this._syncing = false;
        this._thRefQueryCache = new Map();
        this._quotePoolCache = null;
        this._quotePoolCacheSavedAt = 0;
        this._quotePoolBuildingPromise = null;
        this._highlightsDayIndex = null;
        this._highlightsDayIndexDirty = false;
        this._hydrateHighlightsDayIndexFromStorage();
        this._scheduleReferencesBootstrapDeferred();
    }

    detach() {
        this._rwUnloaded = true;
        this._dayIndexRebuildEpoch = (this._dayIndexRebuildEpoch || 0) + 1;
        this._dayIndexRebuilding = false;
        this._cancelReferencesBootstrapDefer();
        try {
            if (typeof this._rwPathBReadyResolve === 'function') this._rwPathBReadyResolve();
        } catch (_) {}
        this._rwPathBReadyResolve = null;
        this._rwPathBReadyPromise = null;
        try {
            if (this._rwRecordCreatedRefreshTimer) clearTimeout(this._rwRecordCreatedRefreshTimer);
        } catch (_) {}
        this._rwRecordCreatedRefreshTimer = null;
        try {
            if (this._rwPopulateStormTimer) clearTimeout(this._rwPopulateStormTimer);
        } catch (_) {}
        this._rwPopulateStormTimer = null;
        try {
            this._rwRecordCreatedPendingColls?.clear();
        } catch (_) {}
        for (const id of (this._eventHandlerIds || [])) {
            try { this.events.off(id); } catch (_) {}
        }
        this._eventHandlerIds = [];
        for (const t of (this._navDeferTimers || new Map()).values()) {
            try { clearTimeout(t); } catch (_) {}
        }
        this._navDeferTimers?.clear();
        for (const id of Array.from((this._panelStates || new Map()).keys())) {
            this._disposePanel(id);
        }
        this._panelStates?.clear();
        this._clearFooterDataCaches();
        if (this._shufflerDayMapSyncTimer) {
            try { clearTimeout(this._shufflerDayMapSyncTimer); } catch (_) {}
            this._shufflerDayMapSyncTimer = null;
        }
        if (this._dayIndexSyncTimer) {
            try { clearTimeout(this._dayIndexSyncTimer); } catch (_) {}
            this._dayIndexSyncTimer = null;
        }
        this._syncStatusHide();

        if (globalThis.__thymerReadwiseJfsSuiteNotify === this._readwiseJfsNotifyBound) {
            try { delete globalThis.__thymerReadwiseJfsSuiteNotify; } catch (_) {
                globalThis.__thymerReadwiseJfsSuiteNotify = undefined;
            }
        }

        this._cmdSetToken?.remove();
        this._cmdSync?.remove();
        this._cmdFullSync?.remove();
        this._cmdCancelSync?.remove();
        this._cmdRebuildThisBody?.remove();
        this._cmdRelinkDates?.remove();
        this._cmdRebuildDayIndex?.remove();
        this._cmdDiagnoseRef?.remove();
        this._cmdSyncDiag?.remove();
        this._cmdStatusReport?.remove();
        this._cmdStorage?.remove();
        this._cmdToggleHighlights?.remove();
        this._cmdToggleShuffler?.remove();
        this._cmdToggleShufflerDetached?.remove();
        this._cmdShuffleQuote?.remove();
        document.getElementById('rwr-token-dialog')?.remove();
    }

    /** Keys mirrored to Plugin Settings when storage mode is synced. */
    _pathBMirrorKeys() {
        return [
            RWR_TOKEN_KEY,
            RWR_LAST_RUN_KEY,
            'th_footer_collapsed',
            TH_KEY_SHOW_HIGHLIGHTS,
            TH_KEY_SHOW_SHUFFLER,
            TH_KEY_SHUFFLER_COLLAPSED,
            TH_KEY_SHUFFLER_DETACHED,
            TH_KEY_SHUFFLER_QUOTES_BY_DAY,
            TH_KEY_HIGHLIGHTS_BY_DAY,
        ];
    }

    /**
     * One-time map from Journal Footer Suite chrome prefs → standalone keys
     * so retiring the suite keeps Highlights / Shuffler / detach state.
     */
    _migrateJfsConfigIfNeeded() {
        try {
            if (localStorage.getItem(TH_JFS_MIGRATED_KEY)) return;
        } catch (_) { return; }

        let jfs = null;
        try { jfs = JSON.parse(localStorage.getItem('jfs_config_v1') || 'null'); }
        catch (_) { jfs = null; }
        if (!jfs || typeof jfs !== 'object') return;

        const applyIfUnset = (key, val) => {
            try {
                if (localStorage.getItem(key) !== null) return;
            } catch (_) { return; }
            this._saveBool(key, !!val);
        };

        const enabled = jfs.enabled && typeof jfs.enabled === 'object' ? jfs.enabled : null;
        if (enabled) {
            if (enabled.highlights !== undefined) applyIfUnset(TH_KEY_SHOW_HIGHLIGHTS, enabled.highlights !== false);
            if (enabled.shuffler !== undefined) applyIfUnset(TH_KEY_SHOW_SHUFFLER, enabled.shuffler !== false);
        }
        if (typeof jfs.shufflerExpanded === 'boolean') {
            applyIfUnset(TH_KEY_SHUFFLER_COLLAPSED, !jfs.shufflerExpanded);
        }
        if (typeof jfs.shufflerDetached === 'boolean') {
            applyIfUnset(TH_KEY_SHUFFLER_DETACHED, jfs.shufflerDetached);
        }
        if (typeof jfs.collapsed === 'boolean') {
            applyIfUnset('th_footer_collapsed', jfs.collapsed);
        }

        try { localStorage.setItem(TH_JFS_MIGRATED_KEY, '1'); } catch (_) {}
    }

    _showHighlightsPanel() {
        return this._loadBool(TH_KEY_SHOW_HIGHLIGHTS, true);
    }

    _showShufflerPanel() {
        return this._loadBool(TH_KEY_SHOW_SHUFFLER, true);
    }

    _showShufflerDetached() {
        return this._loadBool(TH_KEY_SHUFFLER_DETACHED, true);
    }

    /** Whether this panel should receive a populate kick (suite mount and/or standalone flags). */
    _rwPanelWantsPopulate(panelId) {
        if (!panelId) return false;
        return this._showHighlightsPanel() || this._showShufflerPanel();
    }

    /**
     * Stroke SVGs — `ui.createIcon` often renders empty in journal-injected footers
     * (no Tabler font / sizing context). Same visual language as line icons elsewhere.
     */
    _rwrSvgIcon(kind, sizePx) {
        const n = sizePx || 18;
        if (kind === 'shuffle') {
            return '<svg xmlns="http://www.w3.org/2000/svg" width="' + n + '" height="' + n + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>';
        }
        /* ti-quote–style draw control (single block, filled) */
        if (kind === 'quote') {
            return '<svg xmlns="http://www.w3.org/2000/svg" width="' + n + '" height="' + n + '" viewBox="0 0 14 24" fill="currentColor" aria-hidden="true"><path d="M6 17h3l2-4V7H5v6h3z"/></svg>';
        }
        /* ti-quotes–style collapsed header (pair of blocks, filled) */
        if (kind === 'quotes') {
            return '<svg xmlns="http://www.w3.org/2000/svg" width="' + n + '" height="' + n + '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>';
        }
        const stroke = (body, w) => '<svg xmlns="http://www.w3.org/2000/svg" width="' + n + '" height="' + n
            + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 2)
            + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
        /* Light chevron matching the Backreferences fold caret (rotate via CSS). */
        if (kind === 'chevron') return stroke('<polyline points="9 6 15 12 9 18"/>', 1.75);
        if (kind === 'cog') {
            return stroke('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>', 1.75);
        }
        /* Per-category source glyphs (Readwise `source_category`). */
        /* Tabler `book` — open book with three spines. */
        if (kind === 'cat-book') {
            return stroke('<path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6l0 13"/><path d="M12 6l0 13"/><path d="M21 6l0 13"/>');
        }
        if (kind === 'cat-article') {
            return stroke('<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="17" y2="13"/><line x1="7" y1="17" x2="13" y2="17"/>');
        }
        if (kind === 'cat-podcast') {
            return stroke('<rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="18" x2="12" y2="21.5"/>');
        }
        if (kind === 'cat-video') {
            return stroke('<rect x="2.5" y="5" width="13.5" height="14" rx="2"/><path d="M16 10.5 21.5 7v10L16 13.5z"/>');
        }
        /* Default (highlights panel title): Tabler `quote`. */
        return stroke('<path d="M10 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5"/><path d="M19 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5"/>');
    }

    /** Readwise `source_category` (choice id or label) → inline SVG icon kind. */
    _rwrCategoryIconKind(category) {
        const k = String(category || '').trim().toLowerCase();
        if (!k) return '';
        if (k.startsWith('book')) return 'cat-book';
        if (k.startsWith('article') || k === 'rss' || k.startsWith('email')) return 'cat-article';
        if (k.startsWith('podcast')) return 'cat-podcast';
        if (k.startsWith('video') || k.startsWith('tweet')) return 'cat-video';
        return '';
    }

    /** Light chevron that rotates down when expanded (no glyph swap). */
    _rwrBuildChevron(expanded, extraClass) {
        const el = document.createElement('span');
        el.className = 'th-chevron' + (extraClass ? ' ' + extraClass : '');
        el.innerHTML = this._rwrSvgIcon('chevron', 14);
        el.setAttribute('aria-hidden', 'true');
        this._rwrSyncChevron(el, expanded);
        return el;
    }

    _rwrSyncChevron(el, expanded) {
        if (!el?.classList) return;
        el.classList.toggle('th-chevron--open', expanded === true);
    }

    _rwrAppendSvgIcon(parent, kind, sizePx) {
        const wrap = document.createElement('span');
        wrap.className = 'th-inline-svg-icon';
        wrap.innerHTML = this._rwrSvgIcon(kind, sizePx);
        parent.appendChild(wrap);
        return wrap;
    }

    /** Hide `source_author` when the field resolved to an opaque record id instead of a human name. */
    _rwrLooksLikeOpaqueId(s) {
        const t = String(s || '').trim();
        if (t.length < 18) return false;
        if (/^[0-9A-Fa-f]{32}$/.test(t)) return true;
        if (/^[0-9A-Z]{24,}$/.test(t) && !/\s/.test(t)) return true;
        return false;
    }

    _clearFooterDataCaches() {
        try { this._thRefQueryCache?.clear(); } catch (_) {}
        this._quotePoolCache = null;
        this._quotePoolCacheSavedAt = 0;
        this._quotePoolBuildingPromise = null;
        try { localStorage.removeItem(TH_KEY_SHUFFLER_POOL_CACHE); } catch (_) {}
        this._invalidateRwCollectionHandleCache();
        /* Day index is durable (sync-maintained + Path B); do not wipe here. */
    }

    _emptyHighlightsDayIndex() {
        return { v: 1, updatedAt: 0, complete: false, entries: Object.create(null) };
    }

    _hydrateHighlightsDayIndexFromStorage() {
        try {
            const raw = localStorage.getItem(TH_KEY_HIGHLIGHTS_BY_DAY);
            if (!raw) {
                this._highlightsDayIndex = this._emptyHighlightsDayIndex();
                return;
            }
            const parsed = JSON.parse(raw);
            if (!parsed || parsed.v !== 1 || !parsed.entries || typeof parsed.entries !== 'object') {
                this._highlightsDayIndex = this._emptyHighlightsDayIndex();
                return;
            }
            this._highlightsDayIndex = parsed;
        } catch (_) {
            this._highlightsDayIndex = this._emptyHighlightsDayIndex();
        }
    }

    _dayIndexEntryCount() {
        const entries = this._highlightsDayIndex?.entries;
        if (!entries || typeof entries !== 'object') return 0;
        try {
            return Object.keys(entries).length;
        } catch (_) {
            return 0;
        }
    }

    /**
     * After Path B applies `th_highlights_by_day_v1` into localStorage, refresh memory.
     * onLoad often hydrated an empty index on fresh mobile browsers; lookup must not keep that forever.
     */
    _rehydrateDayIndexAfterPathB() {
        const beforeKeys = this._dayIndexEntryCount();
        const beforeComplete = !!this._highlightsDayIndex?.complete;
        this._hydrateHighlightsDayIndexFromStorage();
        const afterKeys = this._dayIndexEntryCount();
        const afterComplete = !!this._highlightsDayIndex?.complete;
        if (afterKeys > beforeKeys || (afterComplete && !beforeComplete)) {
            try { this._thRefQueryCache?.clear(); } catch (_) {}
        }
    }

    /** One-shot background rebuild — only from an explicit user command, never from navigation. */
    _scheduleDayIndexRebuildOnce() {
        /* Intentionally no-op on the auto path. Full rebuild freezes mobile for minutes;
         * use command palette "Rebuild highlights index" when the user chooses. */
    }

    _notifyDayIndexMissingOnce() {
        if (this._dayIndexMissingToasted || this._rwUnloaded) return;
        this._dayIndexMissingToasted = true;
        try {
            this._toast(
                'Highlights index not on this device yet. Reload after desktop has synced it, or run “Readwise Ref: Rebuild highlights index” when you can wait.'
            );
        } catch (_) {}
    }

    _persistHighlightsDayIndex() {
        const idx = this._highlightsDayIndex || this._emptyHighlightsDayIndex();
        idx.updatedAt = Date.now();
        this._highlightsDayIndex = idx;
        try {
            localStorage.setItem(TH_KEY_HIGHLIGHTS_BY_DAY, JSON.stringify(idx));
        } catch (_) {}
        this._highlightsDayIndexDirty = false;
        this._scheduleDayIndexPathBSync();
    }

    _scheduleDayIndexPathBSync() {
        if (this._pluginSettingsSyncMode !== 'synced') return;
        if (this._dayIndexSyncTimer) {
            try { clearTimeout(this._dayIndexSyncTimer); } catch (_) {}
        }
        this._dayIndexSyncTimer = setTimeout(() => {
            this._dayIndexSyncTimer = null;
            const ps = globalThis.ThymerPluginSettings;
            if (!ps?.flushNow || !this.data || !this._pluginSettingsPluginId) return;
            ps.flushNow(this.data, this._pluginSettingsPluginId, this._pathBMirrorKeys()).catch(() => {});
        }, TH_DAY_INDEX_SYNC_IDLE_MS);
    }

    _dayIndexClear() {
        this._highlightsDayIndex = this._emptyHighlightsDayIndex();
        this._highlightsDayIndexDirty = true;
    }

    /**
     * Replace all indexed highlights for one Reference guid from a highlight-row array
     * (same shape as sync `docHL`).
     */
    _dayIndexReplaceGuid(guid, meta, docHL, exportByHlId) {
        if (!guid) return;
        if (!this._highlightsDayIndex) this._hydrateHighlightsDayIndexFromStorage();
        const idx = this._highlightsDayIndex || this._emptyHighlightsDayIndex();
        const days = Object.create(null);
        const exMap = exportByHlId && typeof exportByHlId.get === 'function' ? exportByHlId : null;
        const { byDay } = this._groupHighlightsByLocalDay(docHL || []);
        for (const [isoKey, pack] of byDay.entries()) {
            const ymd = String(isoKey || '').replace(/-/g, '');
            if (!/^\d{8}$/.test(ymd)) continue;
            const rows = [];
            for (const h of pack.highlights || []) {
                const text = this._highlightBody(h);
                if (!String(text || '').trim()) continue;
                const ex = exMap
                    ? (exMap.get(String(h.id)) || exMap.get(String(h.external_id != null ? h.external_id : '')))
                    : null;
                rows.push([
                    String(text),
                    String(this._highlightNote(h) || ''),
                    String(this._readwiseHighlightOpenLink(h, ex) || ''),
                ]);
            }
            if (rows.length) days[ymd] = rows;
        }
        if (Object.keys(days).length === 0) {
            if (idx.entries[guid]) {
                delete idx.entries[guid];
                this._highlightsDayIndexDirty = true;
            }
        } else {
            idx.entries[guid] = {
                st: String(meta?.source_title || '').slice(0, 200),
                sa: String(meta?.source_author || '').slice(0, 120),
                cat: String(meta?.category || '').slice(0, 80),
                d: days,
            };
            this._highlightsDayIndexDirty = true;
        }
        this._highlightsDayIndex = idx;
    }

    _dayIndexLookup(yyyymmdd) {
        if (!yyyymmdd) return null;
        if (!this._highlightsDayIndex) this._hydrateHighlightsDayIndexFromStorage();
        const entries = this._highlightsDayIndex?.entries;
        if (!entries || typeof entries !== 'object') return null;
        const keys = Object.keys(entries);
        if (!keys.length) return null;
        const out = [];
        for (const guid of keys) {
            const ent = entries[guid];
            const rows = ent?.d?.[yyyymmdd];
            if (!Array.isArray(rows) || !rows.length) continue;
            for (const row of rows) {
                const text = Array.isArray(row) ? row[0] : row?.text;
                if (!String(text || '').trim()) continue;
                out.push({
                    guid,
                    text: String(text || ''),
                    note: String((Array.isArray(row) ? row[1] : row?.note) || ''),
                    location: String((Array.isArray(row) ? row[2] : row?.location) || ''),
                    source_title: String(ent.st || 'Unknown'),
                    source_author: String(ent.sa || ''),
                    category: String(ent.cat || ''),
                });
            }
        }
        out.sort((a, b) => a.source_title.localeCompare(b.source_title));
        /* Incomplete index (pre–full-sync): only trust positive hits; empty may be a miss. */
        if (!this._highlightsDayIndex?.complete && out.length === 0) return null;
        return out;
    }

    _hydrateQuotePoolCacheFromStorage() {
        try {
            const raw = localStorage.getItem(TH_KEY_SHUFFLER_POOL_CACHE);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            const pool = Array.isArray(parsed?.pool) ? parsed.pool : [];
            const savedAt = Number(parsed?.savedAt || 0);
            if (!pool.length || !Number.isFinite(savedAt) || savedAt <= 0) return;
            this._quotePoolCache = pool;
            this._quotePoolCacheSavedAt = savedAt;
        } catch (_) {
            // ignore malformed cache
        }
    }

    _persistQuotePoolCache(pool) {
        const src = Array.isArray(pool) ? pool : [];
        const compact = [];
        for (const row of src.slice(0, 1500)) {
            compact.push({
                guid: String(row?.guid || ''),
                text: String(row?.text || ''),
                note: String(row?.note || '').slice(0, 240),
                location: String(row?.location || '').slice(0, 180),
                source_title: String(row?.source_title || '').slice(0, 140),
                source_author: String(row?.source_author || '').slice(0, 80),
                category: String(row?.category || '').slice(0, 80),
                _sig: String(row?._sig || ''),
            });
        }
        const payload = { savedAt: Date.now(), pool: compact };
        try { localStorage.setItem(TH_KEY_SHUFFLER_POOL_CACHE, JSON.stringify(payload)); } catch (_) {}
    }

    _isQuotePoolCacheStale() {
        if (!this._quotePoolCacheSavedAt) return true;
        return (Date.now() - this._quotePoolCacheSavedAt) > TH_SHUFFLER_POOL_CACHE_MAX_AGE_MS;
    }

    async _warmQuotePoolCache(onProgress) {
        if (this._quotePoolBuildingPromise) return this._quotePoolBuildingPromise;
        if (Array.isArray(this._quotePoolCache) && this._quotePoolCache.length && !this._isQuotePoolCacheStale()) return this._quotePoolCache;
        this._quotePoolBuildingPromise = this._rebuildQuoteShufflePoolFromReferences({ persist: true, onProgress })
            .catch(() => [])
            .finally(() => { this._quotePoolBuildingPromise = null; });
        return this._quotePoolBuildingPromise;
    }

    _toggleShowHighlightsPanel() {
        const next = !this._showHighlightsPanel();
        this._saveBool(TH_KEY_SHOW_HIGHLIGHTS, next);
        this._toast(next ? "Today's Highlights panel: on" : "Today's Highlights panel: off");
        this._rebuildAllJournalFooters();
    }

    _toggleShowShufflerPanel() {
        const next = !this._showShufflerPanel();
        this._saveBool(TH_KEY_SHOW_SHUFFLER, next);
        /*
         * When the Journal Footer Suite owns a shuffler dock it re-offers a mount on every
         * rebuild, so our flag alone cannot hide it — ask the suite to dismiss the dock too.
         */
        if (!next && typeof globalThis.__thymerJfsCloseQuoteShufflerDock === 'function') {
            try { globalThis.__thymerJfsCloseQuoteShufflerDock(); } catch (_) {}
        }
        this._toast(next ? 'Quote Shuffler panel: on' : 'Quote Shuffler panel: off');
        this._rebuildAllJournalFooters();
    }

    _toggleShufflerDetached() {
        const next = !this._showShufflerDetached();
        this._shufflerDetached = next;
        this._saveBool(TH_KEY_SHUFFLER_DETACHED, next);
        this._toast(next ? 'Quote Shuffler: detached glass' : 'Quote Shuffler: stacked under highlights');
        this._rebuildAllJournalFooters();
    }

    async _shuffleQuoteFromCommand() {
        let n = 0;
        for (const [, s] of (this._panelStates || new Map())) {
            const sec = (s.shufflerRootEl || s.rootEl)?.querySelector('[data-panel-section="shuffler"]');
            if (!sec) continue;
            const body = sec.querySelector('[data-role="body"]');
            if (!body || !s.journalDate) continue;
            await this._drawRandomQuoteForDay(s, body, s.journalDate, true);
            n++;
        }
        if (!n) this._toast('Open a journal page with the Quote Shuffler panel visible.');
    }

    _rebuildAllJournalFooters() {
        const snapshots = Array.from((this._panelStates || new Map()).values());
        for (const s of snapshots) {
            if (!this._panelStates?.get(s.panelId)) continue;
            const panel = s.panel;
            const panelEl = panel?.getElement?.();
            if (!panelEl) continue;
            const record = panel?.getActiveRecord?.();
            const journalDate = this._journalDateFromRecord(record);
            const suiteHi =
                typeof globalThis.__thymerJfsReadwiseGetHighlightsMountEl === 'function'
                    ? globalThis.__thymerJfsReadwiseGetHighlightsMountEl(s.panelId)
                    : null;
            const suiteSh =
                typeof globalThis.__thymerJfsReadwiseGetShufflerMountEl === 'function'
                    ? globalThis.__thymerJfsReadwiseGetShufflerMountEl(s.panelId)
                    : null;
            if (!this._showHighlightsPanel() && !this._showShufflerPanel()) {
                this._disposePanel(s.panelId);
                continue;
            }
            if (!journalDate) continue;
            const container = this._findContainer(panelEl);
            if (!container && !suiteHi && !suiteSh) continue;
            s.loaded = false;
            s.expandedSources = new Map();
            s.highlightsDataLoaded = false;
            s.shufflerDataLoaded = false;
            const rebuilt = this._mountFooter(s, panelEl, { suiteHi, suiteSh, container });
            if (rebuilt) s.loading = false;
            this._populate(s);
        }
    }

    _showTokenDialog() {
        document.getElementById('rwr-token-dialog')?.remove();
        const current = localStorage.getItem(RWR_TOKEN_KEY) || '';
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
        box.id = 'rwr-token-dialog';
        box.style.position = 'fixed';
        box.style.left = left + 'px';
        box.style.top = top + 'px';
        box.style.width = '350px';
        box.style.background = 'var(--cmdpal-bg-color, var(--panel-bg-color, #1d1915))';
        box.style.border = '1px solid var(--border-default, #3f3f46)';
        box.style.borderRadius = '10px';
        box.style.boxShadow = 'var(--cmdpal-box-shadow, 0 8px 32px rgba(0,0,0,0.5))';
        box.style.padding = '16px';
        box.style.zIndex = '99999';
        box.style.display = 'flex';
        box.style.flexDirection = 'column';
        box.style.gap = '10px';

        const lbl = document.createElement('div');
        lbl.textContent = 'Readwise Access Token (References)';
        lbl.style.fontWeight = '600';
        lbl.style.fontSize = '14px';
        const hint = document.createElement('div');
        hint.textContent = 'Get yours at readwise.io/access_token';
        hint.style.fontSize = '12px';
        hint.style.color = 'var(--text-muted, #888)';
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.placeholder = 'Paste token here...';
        inp.value = current;
        inp.style.width = '100%';
        inp.style.padding = '8px 10px';
        inp.style.borderRadius = '6px';
        inp.style.border = '1px solid var(--border-default, #3f3f46)';
        inp.style.background = 'var(--input-bg-color, #181511)';
        inp.style.color = 'inherit';
        inp.style.fontSize = '13px';
        inp.style.boxSizing = 'border-box';
        inp.style.outline = 'none';
        inp.style.fontFamily = 'monospace';
        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.gap = '8px';
        btnRow.style.justifyContent = 'flex-end';
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.padding = '7px 14px';
        cancelBtn.style.background = 'transparent';
        cancelBtn.style.color = 'inherit';
        cancelBtn.style.border = '1px solid var(--border-default, #3f3f46)';
        cancelBtn.style.borderRadius = '7px';
        cancelBtn.style.cursor = 'pointer';
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.style.padding = '7px 18px';
        saveBtn.style.background = 'var(--color-primary-500, #a78bfa)';
        saveBtn.style.color = '#fff';
        saveBtn.style.border = 'none';
        saveBtn.style.borderRadius = '7px';
        saveBtn.style.fontWeight = '700';
        saveBtn.style.cursor = 'pointer';
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
                try { localStorage.setItem(RWR_TOKEN_KEY, ''); } catch (_) {}
                this._toast('Token cleared.');
            } else {
                localStorage.setItem(RWR_TOKEN_KEY, token);
                this._toast('Token saved! Run "Readwise Ref: Full Sync".');
            }
            globalThis.ThymerPluginSettings?.scheduleFlush?.(this, () => this._pathBMirrorKeys());
        };
        saveBtn.addEventListener('click', () => done(true));
        cancelBtn.addEventListener('click', () => done(false));
        inp.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); done(true); }
            if (e.key === 'Escape') { e.preventDefault(); done(false); }
        });
        document.addEventListener('pointerdown', onOut, true);
        requestAnimationFrame(() => { inp.focus(); inp.select(); });
    }

    async _runSync(forceFullSync) {
        if (this._syncing) { this._toast('Sync already in progress...'); return; }
        const token = localStorage.getItem(RWR_TOKEN_KEY);
        if (!token) { this._toast('No token. Run "Readwise Ref: Set Token" first.'); return; }
        await this._rwAwaitPathBReady();
        this._syncing = true;
        this._toast(forceFullSync ? 'Readwise Ref full sync…' : 'Readwise Ref: syncing…');
        this._syncStatusShow(forceFullSync ? 'Full sync — checking token…' : 'Sync — checking token…');
        this._log('Nothing is written to References until the Reader list download (and export) finish — the table stays empty during "List page" logs.');
        try {
            const testResp = await fetch('https://readwise.io/api/v3/list/?limit=1', {
                headers: { 'Authorization': 'Token ' + token },
            });
            if (testResp.status === 401) throw new Error('Invalid token');
            if (testResp.status === 429) {
                const wait = this._rwrRetryAfterMs(testResp, 60000);
                this._toast('Rate limited — waiting ' + Math.round(wait / 1000) + 's…');
                this._syncStatusShow('Rate limited — waiting ' + Math.round(wait / 1000) + 's…');
                await this._sleep(wait);
                const retryResp = await fetch('https://readwise.io/api/v3/list/?limit=1', {
                    headers: { 'Authorization': 'Token ' + token },
                });
                if (retryResp.status === 401) throw new Error('Invalid token');
                if (retryResp.status === 429) {
                    const wait2 = this._rwrRetryAfterMs(retryResp, 120000);
                    this._toast('Still rate limited. Wait ~' + Math.round(wait2 / 1000) + 's and retry.');
                    this._syncing = false;
                    this._syncStatusHide();
                    return;
                }
                if (!retryResp.ok) throw new Error('Readwise API error ' + retryResp.status);
            }
            const result = await this._sync(token, forceFullSync);
            this._toast('Done: ' + result.summary);
            localStorage.setItem(RWR_LAST_RUN_KEY, new Date().toISOString());
            this._clearFooterDataCaches();
            globalThis.ThymerPluginSettings?.scheduleFlush?.(this, () => this._pathBMirrorKeys());
        } catch (e) {
            console.error('[ReadwiseRef]', e);
            if (this._lastSyncDiag) {
                this._lastSyncDiag.syncThrown = String(e && e.message ? e.message : e);
                this._persistSyncDiag({ ok: false, syncPhase: 'failed' });
            }
            this._toast('Sync failed: ' + e.message);
        } finally {
            this._syncStatusHide();
            this._syncing = false;
            /* After sync flag clears — so footers load from the new day index, not "Syncing…". */
            try { this._refreshAll(); } catch (_) {}
        }
    }

    async _fetchReadwiseListAll(token, since) {
        const allResults = [];
        let cursor = null;
        let retryCount = 0;
        const maxRetries = 3;
        const listRowCap = rwrDebugMaxListRows();
        if (listRowCap > 0) {
            this._log('DEBUG: readwise_references_debug_max_list_rows=' + listRowCap + ' — Reader list will stop after this many rows (re-paste plugin.js if list keeps growing past the cap).');
        }
        while (true) {
            let url = 'https://readwise.io/api/v3/list/?limit=100';
            if (since) url += '&updatedAfter=' + encodeURIComponent(since);
            if (cursor) url += '&pageCursor=' + encodeURIComponent(cursor);
            const resp = await fetch(url, { headers: { 'Authorization': 'Token ' + token } });
            if (resp.status === 429) {
                retryCount++;
                if (retryCount > maxRetries) throw new Error('Rate limited too many times');
                const fallback = (120 * Math.pow(2, retryCount - 1)) * 1000;
                const wait = this._rwrRetryAfterMs(resp, fallback);
                this._log('Rate limited (429). Waiting ' + Math.round(wait / 1000) + 's (Retry-After if present)…');
                await this._sleep(wait);
                continue;
            }
            if (!resp.ok) throw new Error('Readwise API error ' + resp.status);
            retryCount = 0;
            const data = await resp.json();
            const results = data.results || [];
            allResults.push(...results);
            this._log('List page: +' + results.length + ' (total ' + allResults.length + ')');
            if (listRowCap > 0 && allResults.length >= listRowCap) {
                if (allResults.length > listRowCap) allResults.splice(listRowCap);
                this._log('⚠️ DEBUG: readwise_references_debug_max_list_rows=' + listRowCap + ' — Reader list fetch truncated.');
                if (this._lastSyncDiag) this._lastSyncDiag.debugMaxListRowsApplied = listRowCap;
                break;
            }
            if (!data.nextPageCursor) break;
            cursor = data.nextPageCursor;
            /* Space requests to reduce 429; tune via localStorage readwise_references_list_delay_ms */
            await this._sleep(this._rwrListPageDelayMs());
        }
        return allResults;
    }

    async _fetchReadwiseExportResponse(url, token) {
        const networkRetries = 5;
        let lastErr;
        for (let attempt = 0; attempt < networkRetries; attempt++) {
            try {
                return await fetch(url, { headers: { 'Authorization': 'Token ' + token } });
            } catch (e) {
                lastErr = e;
                if (attempt < networkRetries - 1) {
                    const wait = Math.min(60000, 2000 * Math.pow(2, attempt));
                    await this._sleep(wait);
                }
            }
        }
        throw lastErr;
    }

    _rwrListPageDelayMs() {
        return rwrParseDelayMs('readwise_references_list_delay_ms', RWR_LIST_PAGE_DELAY_MS_DEFAULT);
    }

    _rwrExportPageDelayMs() {
        return rwrParseDelayMs('readwise_references_export_delay_ms', RWR_EXPORT_PAGE_DELAY_MS_DEFAULT);
    }

    _rwrIncludeRss() {
        return rwrIncludeRssFromStorage();
    }

    /**
     * Merge Kindle / library highlights from v2 export with Reader list rows (union by highlight id).
     */
    _mergeHighlightRowArrays(a, b) {
        const m = new Map();
        const put = (h) => {
            if (!h) return;
            const k = String(h.id ?? h.external_id ?? '');
            if (!k) return;
            const cur = m.get(k);
            if (!cur) {
                m.set(k, h);
                return;
            }
            const curBody = this._highlightBody(cur);
            const nextBody = this._highlightBody(h);
            const pick = (nextBody || '').length >= (curBody || '').length ? { ...cur, ...h } : { ...h, ...cur };
            if ((nextBody || '').length >= (curBody || '').length) {
                pick.text = h.text !== undefined ? h.text : pick.text;
                pick.content = h.content !== undefined ? h.content : pick.content;
            }
            m.set(k, pick);
        };
        for (const x of (a || [])) put(x);
        for (const x of (b || [])) put(x);
        return Array.from(m.values());
    }

    _preferRicherDoc(listLike, exportLike) {
        const a = listLike || {};
        const b = exportLike || {};
        const out = { ...a };
        const bt = b.title || b.readable_title;
        const at = a.title || a.readable_title;
        if (bt && (!at || String(bt).trim().length > String(at || '').trim().length)) out.title = bt;
        if (b.author && (!a.author || String(b.author).trim().length > String(a.author || '').trim().length)) {
            out.author = b.author;
        }
        if (b.category && !a.category) out.category = b.category;
        if (b.source && !a.source) out.source = b.source;
        const bu = b.source_url || b.unique_url;
        const au = a.source_url;
        if (bu && (!au || String(au).trim().length < String(bu).trim().length)) out.source_url = bu;
        if (b.cover_image_url || b.image_url) {
            out.cover_image_url = b.cover_image_url || out.cover_image_url;
            out.image_url = b.image_url || out.image_url;
        }
        if (b.created_at && !a.created_at) out.created_at = b.created_at;
        return out;
    }

    _exportBookToDoc(book) {
        const b = book || {};
        const idVal = b.external_id != null && String(b.external_id).trim() !== ''
            ? b.external_id
            : b.user_book_id;
        return {
            id: idVal,
            external_id: b.external_id != null ? b.external_id : null,
            title: b.title || b.readable_title || '',
            author: b.author || '',
            category: b.category || '',
            source: b.source || '',
            source_url: b.source_url || b.unique_url || '',
            created_at: b.created_at || b.updated_at || null,
            image_url: b.cover_image_url || b.image_url || '',
            cover_image_url: b.cover_image_url || '',
        };
    }

    _exportHighlightToUnifiedRow(hl, book) {
        const h = hl || {};
        const b = book || {};
        return {
            id: h.id != null ? h.id : h.external_id,
            external_id: h.external_id,
            content: h.text,
            text: h.text,
            highlighted_at: h.highlighted_at || h.updated_at,
            created_at: h.created_at,
            note: h.note,
            notes: h.notes,
            readwise_url: h.readwise_url,
            url: h.url,
            highlight_url: h.highlight_url,
            category: h.category || '',
            parent_document_id: b.external_id,
            document_title: b.title || b.readable_title,
        };
    }

    /** Stable external_id for References row — matches legacy `readwise_${id}` when external_id present. */
    _exportBookStableExtId(book) {
        const b = book || {};
        if (b.external_id != null && String(b.external_id).trim() !== '') {
            return 'readwise_' + String(b.external_id).trim();
        }
        if (b.user_book_id != null) return 'readwise_ub_' + String(b.user_book_id);
        const slug = String(b.title || b.readable_title || 'unknown').trim().slice(0, 48) || 'unknown';
        return 'readwise_exp_' + slug.replace(/\s+/g, '_');
    }

    _normalizeReadwiseAliasText(s) {
        return String(s || '')
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[“”‘’]/g, "'")
            .replace(/&/g, ' and ')
            .replace(/\([^)]*\)/g, ' ')
            .replace(/[^a-z0-9]+/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    _referenceWorkKeyForDoc(doc) {
        const d = doc || {};
        const cat = this._normalizeReadwiseCategoryChoiceId(d.category || '');
        if (cat !== 'books') return '';
        const title = this._normalizeReadwiseAliasText(this._resolveDocTitle(d));
        const author = this._normalizeReadwiseAliasText(d.author || '');
        if (!title || !author) return '';
        return cat + '|' + author + '|' + title;
    }

    _referenceWorkKeyForRecord(record) {
        if (!record) return '';
        const cat = this._normalizeReadwiseCategoryChoiceId(this._readwiseSourceCategoryLabel(record));
        if (cat !== 'books') return '';
        const title = this._normalizeReadwiseAliasText(this._sourceTitleLabel(record) || record.getName?.() || '');
        const author = this._normalizeReadwiseAliasText(this._authorLabel(record));
        if (!title || !author) return '';
        return cat + '|' + author + '|' + title;
    }

    _referenceExtIdRank(extId) {
        const s = String(extId || '').trim();
        if (!s) return 0;
        if (/^readwise_(?!ub_|exp_)/.test(s)) return 3;
        if (s.startsWith('readwise_ub_')) return 2;
        if (s.startsWith('readwise_exp_')) return 1;
        return 0;
    }

    _preferCanonicalReferenceExtId(a, b) {
        const ax = String(a || '').trim();
        const bx = String(b || '').trim();
        if (!ax) return bx;
        if (!bx) return ax;
        const ar = this._referenceExtIdRank(ax);
        const br = this._referenceExtIdRank(bx);
        if (br > ar) return bx;
        if (ar > br) return ax;
        return bx.length >= ax.length ? bx : ax;
    }

    _mergeReferenceEntriesByWorkKey(entries, exportByHlId) {
        const list = Array.isArray(entries) ? entries : [];
        if (list.length < 2) return list;
        const byWorkKey = new Map();
        const passThrough = [];
        let mergedAliases = 0;
        for (const entry of list) {
            if (!entry) continue;
            const workKey = this._referenceWorkKeyForDoc(entry.doc);
            if (!workKey) {
                passThrough.push(entry);
                continue;
            }
            const prev = byWorkKey.get(workKey);
            if (!prev) {
                byWorkKey.set(workKey, { ...entry });
                continue;
            }
            mergedAliases++;
            const extId = this._preferCanonicalReferenceExtId(prev.extId, entry.extId);
            const doc = extId === entry.extId
                ? this._preferRicherDoc(entry.doc, prev.doc)
                : this._preferRicherDoc(prev.doc, entry.doc);
            let docHL = this._mergeHighlightRowArrays(prev.docHL, entry.docHL);
            docHL = this._dedupeHighlightRowsByCanonicalKey(docHL, exportByHlId);
            docHL = this._dedupeIdenticalLongQuoteRows(docHL);
            docHL = this._dedupeRedundantNoteHighlightRows(docHL);
            byWorkKey.set(workKey, {
                ...prev,
                ...entry,
                extId,
                doc,
                docHL,
                synthFlag: (prev.synthFlag || 0) + (entry.synthFlag || 0),
                fromExport: !!(prev.fromExport || entry.fromExport),
                workKeyMerged: true,
            });
        }
        if (mergedAliases > 0 && this._lastSyncDiag) {
            this._lastSyncDiag.sameWorkAliasSourcesMerged =
                (this._lastSyncDiag.sameWorkAliasSourcesMerged || 0) + mergedAliases;
        }
        return passThrough.concat(Array.from(byWorkKey.values()));
    }

    /**
     * Reader list + export can both contain the *same* highlight with different `id` / `external_id`.
     * `_mergeHighlightRowArrays` only merges identical ids — merge duplicates by Readwise open URL + fallbacks.
     * Pass `exportByHlId` so list rows without URLs still resolve the same `readwise.io/open/…` as export rows.
     */
    _canonicalHighlightDedupeKey(h, exportByHlId) {
        let ex = null;
        if (exportByHlId && typeof exportByHlId.get === 'function' && h) {
            if (h.id != null) ex = exportByHlId.get(String(h.id)) || null;
            if (!ex && h.external_id != null) ex = exportByHlId.get(String(h.external_id)) || null;
        }
        const openUrl = this._readwiseHighlightOpenLink(h, ex);
        const m = openUrl && String(openUrl).match(/readwise\.io\/open\/([^/?#]+)/i);
        if (m) return 'open:' + decodeURIComponent(m[1]);
        const id = h.id ?? h.external_id;
        if (id != null && String(id).trim() !== '') return 'id:' + String(id).trim();
        if (openUrl) return 'url:' + String(openUrl).split('?')[0];
        const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
        return 'fp:' + norm(this._highlightBody(h)).slice(0, 180) + '|' + norm(this._highlightNote(h)).slice(0, 100);
    }

    _preferRicherHighlightRow(a, b) {
        const x = a || {};
        const y = b || {};
        const out = { ...x, ...y };
        const bx = this._highlightBody(x);
        const by = this._highlightBody(y);
        if ((by || '').length > (bx || '').length) {
            out.text = y.text !== undefined ? y.text : out.text;
            out.content = y.content !== undefined ? y.content : out.content;
        }
        const nx = this._highlightNote(x);
        const ny = this._highlightNote(y);
        if (String(ny || '').trim().length > String(nx || '').trim().length) {
            out.note = y.note !== undefined ? y.note : out.note;
            out.notes = y.notes !== undefined ? y.notes : out.notes;
        }
        return out;
    }

    _dedupeHighlightRowsByCanonicalKey(rows, exportByHlId) {
        if (!Array.isArray(rows) || rows.length < 2) return rows || [];
        const order = [];
        const byKey = new Map();
        let merged = 0;
        for (const h of rows) {
            const key = this._canonicalHighlightDedupeKey(h, exportByHlId);
            if (!byKey.has(key)) {
                byKey.set(key, h);
                order.push(key);
            } else {
                byKey.set(key, this._preferRicherHighlightRow(byKey.get(key), h));
                merged++;
            }
        }
        if (merged > 0 && this._lastSyncDiag) {
            this._lastSyncDiag.duplicateHighlightRowsMerged = (this._lastSyncDiag.duplicateHighlightRowsMerged || 0) + merged;
        }
        return order.map((k) => byKey.get(k));
    }

    /**
     * Same long quote + same note appearing twice (e.g. Reader vs export with mismatched open ids).
     * Keeps first occurrence in list order.
     */
    _dedupeIdenticalLongQuoteRows(rows) {
        if (!Array.isArray(rows) || rows.length < 2) return rows || [];
        const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const minBody = 48;
        const seen = new Set();
        const out = [];
        let dropped = 0;
        for (const h of rows) {
            const b = norm(this._highlightBody(h));
            const n = norm(this._highlightNote(h));
            if (b.length < minBody) {
                out.push(h);
                continue;
            }
            const key = b.slice(0, 500) + '\0' + n.slice(0, 280);
            if (seen.has(key)) {
                dropped++;
                continue;
            }
            seen.add(key);
            out.push(h);
        }
        if (dropped > 0 && this._lastSyncDiag) {
            this._lastSyncDiag.duplicateQuoteBodyMerged = (this._lastSyncDiag.duplicateQuoteBodyMerged || 0) + dropped;
        }
        return out;
    }

    /**
     * Drops Reader rows that echo another highlight's note as a standalone fake “quote” (duplicate loc URLs).
     */
    _dedupeRedundantNoteHighlightRows(rows) {
        if (!Array.isArray(rows) || rows.length < 2) return rows || [];
        const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const notesFromPeers = new Set();
        for (const h of rows) {
            const n = norm(this._highlightNote(h));
            if (n) notesFromPeers.add(n);
        }
        const out = [];
        let dropped = 0;
        for (const h of rows) {
            const body = norm(this._highlightBody(h));
            const nt = norm(this._highlightNote(h));
            const cat = String(h.category || '').toLowerCase();
            const url = String(h.readwise_url || h.url || '');
            let skip = false;
            if (body && notesFromPeers.has(body)) {
                const readerDup = /read\.readwise\.io\/read\//i.test(url);
                const echoNoteOnly = !nt || body === nt;
                const taggedNote = cat === 'note' || cat === 'reader_document_note';
                /** Note-only URL (or other string) echoed as its own “highlight” row (often sequential open ids). */
                const urlEchoBody = /^https?:\/\//i.test(body);
                if (echoNoteOnly && (readerDup || taggedNote || urlEchoBody)) skip = true;
            }
            if (skip) dropped++;
            else out.push(h);
        }
        if (dropped > 0 && this._lastSyncDiag) {
            this._lastSyncDiag.noteRowsDeduped = (this._lastSyncDiag.noteRowsDeduped || 0) + dropped;
        }
        return out;
    }

    /**
     * Reader list buckets + v2 export books → one entry per Reference (`extId`, `doc`, merged `docHL`).
     */
    _buildMergedReferenceEntries(allResults, exportBooks, exportByHlId) {
        const pageDocs = (allResults || []).filter((i) => {
            const p = i.parent_id ?? i.parent_document_id;
            return p == null || p === '';
        });
        const pageHLs = (allResults || []).filter((i) => {
            const p = i.parent_id ?? i.parent_document_id;
            return p != null && String(p).length > 0;
        });
        const docByIdStr = new Map();
        for (const d of pageDocs) {
            docByIdStr.set(String(d.id), d);
        }
        const allRowsById = new Map();
        for (const r of allResults || []) {
            if (r && r.id != null) allRowsById.set(String(r.id), r);
        }
        const grouped = this._groupPageHLsByOwningDocument(pageHLs, docByIdStr, allRowsById);
        const pageHLsByDoc = grouped.map;

        const merged = new Map();
        let syntheticParentCount = 0;

        for (const [parentIdStr, docHLraw] of pageHLsByDoc.entries()) {
            if (!docHLraw || docHLraw.length === 0) continue;
            let doc = docByIdStr.get(parentIdStr);
            let synth = 0;
            if (!doc) {
                const syn = this._syntheticParentDocFromHighlight(parentIdStr, docHLraw[0]);
                const t0 = this._resolveDocTitle(syn);
                if (/^(note|highlight)\s*\(untitled\)$/i.test(String(t0 || '').trim())) {
                    if (this._lastSyncDiag) this._lastSyncDiag.skippedOrphans++;
                    continue;
                }
                doc = syn;
                synth = 1;
                syntheticParentCount += synth;
            }
            const extId = 'readwise_' + String(doc.id);
            const rows = docHLraw;
            const prev = merged.get(extId);
            if (prev) {
                prev.docHL = this._mergeHighlightRowArrays(prev.docHL, rows);
                prev.doc = this._preferRicherDoc(prev.doc, doc);
                prev.synthFlag = prev.synthFlag || synth;
            } else {
                merged.set(extId, { extId, doc, docHL: rows, synthFlag: synth });
            }
        }

        const books = Array.isArray(exportBooks) ? exportBooks : [];
        if (this._lastSyncDiag) this._lastSyncDiag.exportBooksSeen = books.length;

        for (const book of books) {
            if (!book) continue;
            const rss = String(book.category || '').toLowerCase() === 'rss';
            if (rss && !this._rwrIncludeRss()) {
                if (this._lastSyncDiag) this._lastSyncDiag.skippedRss++;
                continue;
            }
            const exportDoc = this._exportBookToDoc(book);
            const rawHl = [];
            for (const hl of book.highlights || []) {
                if (hl.is_deleted) continue;
                rawHl.push(this._exportHighlightToUnifiedRow(hl, book));
            }
            if (rawHl.length === 0) continue;

            const keysToTry = [];
            if (book.external_id != null && String(book.external_id).trim() !== '') {
                keysToTry.push('readwise_' + String(book.external_id).trim());
            }
            let hit = null;
            for (const k of keysToTry) {
                if (merged.has(k)) {
                    hit = k;
                    break;
                }
            }
            if (!hit) {
                const hlIds = new Set(rawHl.map((h) => String(h.id ?? h.external_id)));
                for (const [eid, entry] of merged) {
                    const overlap = entry.docHL.some((h) => hlIds.has(String(h.id ?? h.external_id)));
                    if (overlap) {
                        hit = eid;
                        break;
                    }
                }
            }
            if (hit) {
                const ent = merged.get(hit);
                ent.docHL = this._mergeHighlightRowArrays(ent.docHL, rawHl);
                ent.doc = this._preferRicherDoc(ent.doc, exportDoc);
                ent.fromExport = true;
            } else {
                const extId = this._exportBookStableExtId(book);
                merged.set(extId, { extId, doc: exportDoc, docHL: rawHl, synthFlag: 0, fromExport: true });
            }
        }

        const exMap = exportByHlId && typeof exportByHlId.get === 'function' ? exportByHlId : null;
        let entries = Array.from(merged.values())
            .map((e) => {
                if (!e || !e.docHL) return e;
                let hl = this._dedupeHighlightRowsByCanonicalKey(e.docHL, exMap);
                hl = this._dedupeIdenticalLongQuoteRows(hl);
                hl = this._dedupeRedundantNoteHighlightRows(hl);
                return Object.assign({}, e, { docHL: hl });
            })
            .filter((e) => e && e.docHL && e.docHL.length > 0);
        entries = this._mergeReferenceEntriesByWorkKey(entries, exMap);
        return { entries, groupedMeta: grouped, pageDocsLen: pageDocs.length, pageHLsLen: pageHLs.length, syntheticParentCount };
    }

    /** v2 export: highlight enrichment + cover map + full book list (Kindle / library sources). */
    async _fetchReadwiseExportPayload(token, since) {
        const highlightById = new Map();
        const coverByDocId = new Map();
        const exportBooks = [];
        let cursor = null;
        let retryCount = 0;
        const maxRetries = 3;
        const exportPageCap = rwrDebugMaxExportPages();
        let exportPagesDone = 0;
        if (exportPageCap > 0) {
            this._log('DEBUG: readwise_references_debug_max_export_pages=' + exportPageCap + ' — export will stop after this many API pages (re-paste plugin.js if export keeps paging).');
        }
        while (true) {
            const params = new URLSearchParams();
            if (since) params.append('updatedAfter', since);
            if (cursor) params.append('pageCursor', cursor);
            const url = 'https://readwise.io/api/v2/export/' + (params.toString() ? '?' + params.toString() : '');
            const resp = await this._fetchReadwiseExportResponse(url, token);
            if (resp.status === 429) {
                retryCount++;
                if (retryCount > maxRetries) throw new Error('Export rate limited');
                const fallback = (120 * Math.pow(2, retryCount - 1)) * 1000;
                const wait = this._rwrRetryAfterMs(resp, fallback);
                this._log('Export rate limited (429). Waiting ' + Math.round(wait / 1000) + 's…');
                await this._sleep(wait);
                continue;
            }
            if (!resp.ok) throw new Error('Export API error ' + resp.status);
            retryCount = 0;
            const data = await resp.json();
            for (const book of data.results || []) {
                exportBooks.push(book);
                if (book.external_id != null && book.cover_image_url) {
                    coverByDocId.set(String(book.external_id), book.cover_image_url);
                }
                const cover = book.cover_image_url || '';
                for (const hl of book.highlights || []) {
                    if (hl.is_deleted) continue;
                    if (hl.external_id == null) continue;
                    const row = {
                        note: hl.note,
                        readwise_url: hl.readwise_url,
                        url: hl.url,
                        cover_image_url: cover,
                        image_url: hl.image_url,
                    };
                    highlightById.set(String(hl.external_id), row);
                    if (hl.id != null && String(hl.id) !== String(hl.external_id)) {
                        highlightById.set(String(hl.id), row);
                    }
                }
            }
            exportPagesDone++;
            if (exportPageCap > 0 && exportPagesDone >= exportPageCap) {
                if (data.nextPageCursor) {
                    this._log('⚠️ DEBUG: readwise_references_debug_max_export_pages=' + exportPageCap + ' — export fetch truncated (further pages skipped).');
                }
                if (this._lastSyncDiag) this._lastSyncDiag.debugMaxExportPagesApplied = exportPageCap;
                break;
            }
            if (!data.nextPageCursor) break;
            cursor = data.nextPageCursor;
            await this._sleep(this._rwrExportPageDelayMs());
        }
        return { highlightById, coverByDocId, exportBooks };
    }

    _persistSyncDiag(extra) {
        try {
            const payload = Object.assign({}, this._lastSyncDiag || {}, extra || {}, {
                savedAt: new Date().toISOString(),
            });
            localStorage.setItem(RWR_LAST_SYNC_DIAG_KEY, JSON.stringify(payload));
        } catch (_) {}
    }

    _logLastSyncDiagnostics() {
        let raw = '';
        try { raw = localStorage.getItem(RWR_LAST_SYNC_DIAG_KEY) || ''; } catch (_) {}
        if (!raw || !String(raw).trim()) {
            this._toast('No diagnostics yet — run a sync first.');
            return;
        }
        try {
            const o = JSON.parse(raw);
            this._log('LAST_SYNC_DIAGNOSTICS_JSON ' + raw);
            const h = o.highlightsWithoutDocKey || 0;
            const d = o.datelessHighlightsInBodies || 0;
            const oa = o.skippedOrphans || 0;
            const rss = o.skippedRss || 0;
            const inc = o.incremental ? 'incremental' : 'full';
            const eb = o.exportBooksSeen != null ? o.exportBooksSeen : '—';
            const nd = o.noteRowsDeduped != null ? o.noteRowsDeduped : '—';
            const dh = o.duplicateHighlightRowsMerged != null ? o.duplicateHighlightRowsMerged : '—';
            const dq = o.duplicateQuoteBodyMerged != null ? o.duplicateQuoteBodyMerged : '—';
            const br = o.bodiesRebuilt != null ? o.bodiesRebuilt : '—';
            const bs = o.bodiesSkippedUnchanged != null ? o.bodiesSkippedUnchanged : '—';
            this._toast('Diagnostics logged (console). ' + inc + ' · bodies rebuilt: ' + br + ' · skipped unchanged: ' + bs + ' · unmapped HL: ' + h + ' · rss skip: ' + rss);
        } catch (_) {
            this._toast('Diagnostics JSON is invalid.');
        }
    }

    /**
     * Survives refresh — logs workspace counts + last sync diag to console (`[ReadwiseRef]`).
     * Command palette: Readwise Ref: Workspace status report
     */
    async _readwiseRefStatusReport() {
        let diag = null;
        try {
            const raw = localStorage.getItem(RWR_LAST_SYNC_DIAG_KEY) || '';
            if (raw.trim()) diag = JSON.parse(raw);
        } catch (_) {}
        const lastRun = localStorage.getItem(RWR_LAST_RUN_KEY);
        const sigMap = rwrLoadBodySigMap();
        const bodySigCount = Object.keys(sigMap || {}).length;

        await this._ensureRwCollections();
        const refsColl = this._rwRefsColl;
        const peopleColl = this._rwPeopleColl;

        let refCount = 0;
        let janeRefs = [];
        let sampleTitles = [];
        if (refsColl) {
            try {
                const all = await refsColl.getAllRecords();
                refCount = all.length;
                for (const r of all) {
                    const title = typeof r.getName === 'function' ? String(r.getName() || '') : '';
                    const author = this._authorLabel(r);
                    let ext = '';
                    try { ext = r.text('external_id') || ''; } catch (_) {}
                    if (/jane\s*clapp/i.test(author) || /jane\s*clapp/i.test(title)) {
                        janeRefs.push({ title, author, external_id: ext });
                    }
                }
                sampleTitles = all.slice(0, 5).map((r) => (typeof r.getName === 'function' ? r.getName() : ''));
            } catch (e) {
                this._log('⚠️ Status report refs: ' + (e && e.message ? e.message : e));
            }
        }

        let readwiseAuthorPeople = 0;
        if (peopleColl) {
            try {
                for (const p of await peopleColl.getAllRecords()) {
                    if (this._hasReadwiseAuthorTag(p)) readwiseAuthorPeople++;
                }
            } catch (_) {}
        }

        const report = {
            savedAt: new Date().toISOString(),
            lastSuccessfulSync: lastRun || null,
            syncCompleted: diag && diag.syncPhase === 'complete' && diag.ok === true,
            syncPhase: diag && diag.syncPhase != null ? diag.syncPhase : null,
            syncSavedAt: diag && diag.savedAt ? diag.savedAt : null,
            referencesInWorkspace: refCount,
            highlightBodiesCached: bodySigCount,
            janeClappReferenceRows: janeRefs.length,
            janeClappTitles: janeRefs.map((x) => x.title),
            readwiseAuthorPeopleCount: readwiseAuthorPeople,
            lastSyncDiagSummary: diag ? {
                incremental: diag.incremental,
                forceFullSync: diag.forceFullSync,
                mergedSources: diag.mergedSources,
                docEntriesToWrite: diag.docEntriesToWrite,
                referencesWritten: diag.referencesWritten,
                createdRef: diag.createdRef,
                updatedRef: diag.updatedRef,
                bodiesRebuilt: diag.bodiesRebuilt,
                bodiesSkippedUnchanged: diag.bodiesSkippedUnchanged,
                skippedFailedCreate: diag.skippedFailedCreate,
                bodyRebuildErrors: diag.bodyRebuildErrors,
                skippedRss: diag.skippedRss,
                skippedOrphans: diag.skippedOrphans,
                highlightsWithoutDocKey: diag.highlightsWithoutDocKey,
                syncThrown: diag.syncThrown,
                progressDone: diag.progressDone,
                progressTotal: diag.progressTotal,
            } : null,
            sampleReferenceTitles: sampleTitles,
        };

        this._log('STATUS_REPORT ' + JSON.stringify(report, null, 2));
        const finished = report.syncCompleted ? 'yes' : 'no';
        this._toast(
            'Status in console. Refs: ' + refCount
            + ' · bodies cached: ' + bodySigCount
            + ' · Jane rows: ' + janeRefs.length
            + ' · last sync finished: ' + finished
        );
    }

    async _sync(token, forceFullSync) {
        this._loggedStructure = false;
        this._rwrWritten = 0;
        const lastRun = localStorage.getItem(RWR_LAST_RUN_KEY);
        const since = (lastRun && !forceFullSync) ? lastRun : null;
        this._log(since ? ('Incremental since ' + since) : 'Full sync');
        this._syncStatusShow(since ? 'Incremental — preparing…' : 'Full sync — preparing…');

        this._lastSyncDiag = {
            incremental: !!since,
            forceFullSync: !!forceFullSync,
            since: since || null,
            listRows: 0,
            pageDocs: 0,
            pageHLs: 0,
            parentBuckets: 0,
            docEntriesToWrite: 0,
            highlightsWithoutDocKey: 0,
            skippedOrphans: 0,
            skippedRss: 0,
            skippedFailedCreate: 0,
            bodyRebuildErrors: 0,
            datelessHighlightsInBodies: 0,
            body_getRecordReadyFail: 0,
            body_getLineItemsFail: 0,
            referencesWritten: 0,
            createdRef: 0,
            updatedRef: 0,
            exportRowsApprox: 0,
            exportError: null,
            exportBooksSeen: 0,
            noteRowsDeduped: 0,
            duplicateHighlightRowsMerged: 0,
            duplicateQuoteBodyMerged: 0,
            sameWorkAliasSourcesMerged: 0,
            mergedSources: 0,
            bodiesRebuilt: 0,
            bodiesSkippedUnchanged: 0,
            bodiesForcedEmptyRewrite: 0,
            bodiesOrphanRepaired: 0,
            bodiesOrphanFetchFailed: 0,
            bodiesMergedIncremental: 0,
            bodiesViaMarkdown: 0,
            bodiesViaLines: 0,
            listFetchSkipped: false,
            listFetchForced: false,
            pendingPeopleLinked: 0,
            dayIndexUpdated: 0,
            dateHeadingsLinked: 0,
            dateHeadingsPlainFallback: 0,
            dateHeadingsRelinked: 0,
            debugMaxSourcesApplied: null,
            debugMaxListRowsApplied: null,
            debugMaxExportPagesApplied: null,
            readwiseCategoryRawHistogram: null,
            readwiseCategoryMappedHistogram: null,
            readwiseListApiCategoryHistogram: null,
            readwiseListApiSourceHistogram: null,
            readwiseListDocCategoryHistogram: null,
            readwiseListHighlightCategoryHistogram: null,
            readwiseExportBookCategoryHistogram: null,
            readwiseExportBookSourceHistogram: null,
        };

        await this._ensureRwCollections();
        const refsColl = this._rwRefsColl;
        const peopleColl = this._rwPeopleColl;
        if (!refsColl) throw new Error('References collection not found');
        await this._ensureReferencesAuthorPeopleFilter(refsColl, peopleColl);
        /** So `readwise_references_last_sync_diag` is not mistaken for the previous run if the user refreshes mid-sync. */
        this._persistSyncDiag({ ok: null, syncPhase: 'started' });
        this._log('References: true  People: ' + (!!peopleColl));

        const peopleByKey = await this._buildPeopleByKeyIndex(peopleColl);

        const existingRef = await refsColl.getAllRecords();
        const refByExtId = new Map();
        const refByWorkKey = new Map();
        for (const r of existingRef) {
            let ext = '';
            try { ext = String(r.text('external_id') || '').trim(); } catch (_) { ext = ''; }
            if (ext) refByExtId.set(ext, r);
            const workKey = this._referenceWorkKeyForRecord(r);
            if (!workKey) continue;
            const prev = refByWorkKey.get(workKey);
            if (!prev) {
                refByWorkKey.set(workKey, r);
                continue;
            }
            let prevExt = '';
            try { prevExt = String(prev.text('external_id') || '').trim(); } catch (_) { prevExt = ''; }
            const keep = this._preferCanonicalReferenceExtId(prevExt, ext);
            if (keep === ext) refByWorkKey.set(workKey, r);
        }

        let createdRef = 0, updatedRef = 0;

        /* Export-first (Readwise recommended). Reader list is 20 req/min and was a multi-minute
         * sleep tax on large libraries — opt in via readwise_references_fetch_list=1. */
        let exportByHlId = new Map();
        let exportCoverByDocId = new Map();
        let exportBooks = [];
        try {
            this._syncStatusShow(since ? 'Fetching Readwise export (incremental)…' : 'Fetching Readwise export (v2)…');
            const enr = await this._fetchReadwiseExportPayload(token, since);
            exportByHlId = enr.highlightById;
            exportCoverByDocId = enr.coverByDocId;
            exportBooks = enr.exportBooks || [];
            this._lastSyncDiag.exportRowsApprox = exportByHlId.size;
            this._lastSyncDiag.exportBooksSeen = exportBooks.length;
            this._log('v2 export: ' + exportByHlId.size + ' highlight enrichments · ' + exportBooks.length + ' books/sources');
            try {
                const hExpCat = this._readwiseHistogramStrings(exportBooks, (b) => b && b.category);
                const hExpSrc = this._readwiseHistogramStrings(exportBooks, (b) => b && b.source);
                if (this._lastSyncDiag) {
                    this._lastSyncDiag.readwiseExportBookCategoryHistogram = hExpCat;
                    this._lastSyncDiag.readwiseExportBookSourceHistogram = hExpSrc;
                }
                this._log('Export API books — category: ' + JSON.stringify(hExpCat));
                this._log('Export API books — source: ' + JSON.stringify(hExpSrc));
            } catch (e2) {
                this._log('⚠️ Export histograms: ' + (e2 && e2.message ? e2.message : e2));
            }
        } catch (e) {
            this._lastSyncDiag.exportError = String(e && e.message ? e.message : e);
            this._log('⚠️ Export skipped: ' + e.message);
        }

        const wantList = rwrFetchListFromStorage();
        const exportEmpty = !exportBooks.length;
        const forceList = wantList || exportEmpty || !!this._lastSyncDiag.exportError;
        let allResults = [];
        if (forceList) {
            if (!wantList && exportEmpty) {
                this._log('Export empty/failed — falling back to Reader /api/v3/list/…');
                if (this._lastSyncDiag) this._lastSyncDiag.listFetchForced = true;
            } else if (wantList) {
                this._log('Reader list opted in (readwise_references_fetch_list=1)…');
            }
            this._syncStatusShow(since ? 'Downloading Reader list (incremental)…' : 'Downloading Reader list…');
            allResults = await this._fetchReadwiseListAll(token, since);
            this._lastSyncDiag.listRows = allResults.length;
            this._log('List download complete: ' + allResults.length + ' rows.');
            try {
                const listDocsApi = (allResults || []).filter((i) => {
                    const p = i.parent_id ?? i.parent_document_id;
                    return p == null || p === '';
                });
                const listHlApi = (allResults || []).filter((i) => {
                    const p = i.parent_id ?? i.parent_document_id;
                    return p != null && String(p).length > 0;
                });
                const hListCat = this._readwiseHistogramStrings(allResults, (r) => r && r.category);
                const hListSrc = this._readwiseHistogramStrings(allResults, (r) => r && r.source);
                const hDocCat = this._readwiseHistogramStrings(listDocsApi, (r) => r && r.category);
                const hHlCat = this._readwiseHistogramStrings(listHlApi, (r) => r && r.category);
                if (this._lastSyncDiag) {
                    this._lastSyncDiag.readwiseListApiCategoryHistogram = hListCat;
                    this._lastSyncDiag.readwiseListApiSourceHistogram = hListSrc;
                    this._lastSyncDiag.readwiseListDocCategoryHistogram = hDocCat;
                    this._lastSyncDiag.readwiseListHighlightCategoryHistogram = hHlCat;
                }
                this._log('Reader API list — category (all rows): ' + JSON.stringify(hListCat));
                this._log('Reader API list — source (all rows; epub/kindle often here): ' + JSON.stringify(hListSrc));
                this._log('Reader API list — category (document rows only): ' + JSON.stringify(hDocCat));
                this._log('Reader API list — category (highlight rows only): ' + JSON.stringify(hHlCat));
            } catch (e) {
                this._log('⚠️ List API histograms: ' + (e && e.message ? e.message : e));
            }
        } else {
            if (this._lastSyncDiag) this._lastSyncDiag.listFetchSkipped = true;
            this._log('Skipped Reader list (export-first). Opt in: localStorage readwise_references_fetch_list=1');
        }
        this._toast(forceList
            ? 'Readwise download done. Saving references…'
            : 'Export done. Saving references…');

        this._log('Merging ' + (forceList ? 'Reader list + ' : '') + 'export sources…');

        const mergedPack = this._buildMergedReferenceEntries(allResults, exportBooks, exportByHlId);
        try {
            const rawHist = {};
            const mappedHist = {};
            for (const ent of mergedPack.entries || []) {
                const rawKey = String((ent && ent.doc && ent.doc.category != null) ? ent.doc.category : '').trim() || '(empty)';
                rawHist[rawKey] = (rawHist[rawKey] || 0) + 1;
                const mid = this._normalizeReadwiseCategoryChoiceId(ent?.doc?.category);
                mappedHist[mid] = (mappedHist[mid] || 0) + 1;
            }
            if (this._lastSyncDiag) {
                this._lastSyncDiag.readwiseCategoryRawHistogram = rawHist;
                this._lastSyncDiag.readwiseCategoryMappedHistogram = mappedHist;
            }
            this._log('Readwise categories (raw counts): ' + JSON.stringify(rawHist));
            this._log('Readwise categories (→ Books/Articles/Podcasts): ' + JSON.stringify(mappedHist));
        } catch (e) {
            this._log('⚠️ Category histogram: ' + (e && e.message ? e.message : e));
        }
        let docEntries = mergedPack.entries;
        const mergedTotal = docEntries.length;
        const dbgCap = rwrDebugMaxSources();
        if (dbgCap > 0 && docEntries.length > dbgCap) {
            this._log('⚠️ DEBUG: readwise_references_debug_max_sources=' + dbgCap + ' — only first ' + dbgCap + ' of ' + mergedTotal + ' sources will be written this run.');
            docEntries = docEntries.slice(0, dbgCap);
            if (this._lastSyncDiag) this._lastSyncDiag.debugMaxSourcesApplied = dbgCap;
        }
        this._lastSyncDiag.pageDocs = mergedPack.pageDocsLen;
        this._lastSyncDiag.pageHLs = mergedPack.pageHLsLen;
        this._lastSyncDiag.highlightsWithoutDocKey = mergedPack.groupedMeta.highlightsWithoutDocKey;
        this._lastSyncDiag.parentBuckets = mergedPack.groupedMeta.map.size;
        this._lastSyncDiag.mergedSources = mergedTotal;

        /* Empty-body refs with highlight_count > 0 won't appear in an incremental updatedAfter
         * window — repair from this run's export payload (and a bounded single-doc fetch). */
        try {
            const repaired = await this._collectEmptyBodyOrphanEntries(
                token, existingRef, docEntries, exportBooks, exportByHlId);
            if (repaired.length) {
                docEntries = docEntries.concat(repaired);
                this._log('Empty-body repair: queued ' + repaired.length + ' reference(s) missing Highlights content.');
                if (this._lastSyncDiag) this._lastSyncDiag.bodiesOrphanRepaired = repaired.length;
            }
        } catch (e) {
            this._log('⚠️ Empty-body orphan scan: ' + (e && e.message ? e.message : e));
        }

        this._log('Grouped: ' + mergedPack.pageDocsLen + ' list docs, ' + mergedPack.pageHLsLen + ' list HL rows, '
            + mergedPack.groupedMeta.map.size + ' list parents, '
            + mergedPack.groupedMeta.highlightsWithoutDocKey + ' list HL rows with no document key · merged '
            + mergedTotal + ' reference sources (Reader + export)'
            + (docEntries.length !== mergedTotal ? ' · writing ' + docEntries.length + ' this run' : ''));

        let syntheticParentCount = mergedPack.syntheticParentCount;

        const docTotal = docEntries.length;
        this._lastSyncDiag.docEntriesToWrite = docTotal;
        const bodySigMap = rwrSkipUnchangedBodiesFromStorage() ? rwrLoadBodySigMap() : Object.create(null);
        let bodySigsDirty = false;
        const incremental = !!since;
        const syncConcurrency = rwrSyncConcurrencyFromStorage();
        const pendingPeopleLinks = [];
        if (!incremental) this._dayIndexClear();
        if (docTotal > 0) {
            this._syncStatusShow('Saving references 0/' + docTotal + '…');
        }
        for (let bi = 0; bi < docEntries.length; bi += syncConcurrency) {
            const batch = docEntries.slice(bi, bi + syncConcurrency);
            const batchOut = await Promise.all(batch.map(async (entry) => {
                const doc = entry.doc;
                let docHL = entry.docHL;
                const extId = entry.extId;
                const synthAdded = entry.synthFlag || 0;

                if (String(doc.category || '').toLowerCase() === 'rss' && !this._rwrIncludeRss()) {
                    if (this._lastSyncDiag) this._lastSyncDiag.skippedRss++;
                    return { created: 0, updated: 0, synth: 0, written: 0 };
                }

                const docTitle = this._resolveDocTitle(doc);

                let captureDate = null;
                if (doc.created_at) {
                    try {
                        captureDate = new Date(doc.created_at);
                        if (isNaN(captureDate.getTime())) captureDate = null;
                    } catch (_) { captureDate = null; }
                }

                let refBanner = this._coverImageUrlForDoc(doc)
                    || exportCoverByDocId.get(String(doc.id))
                    || exportCoverByDocId.get(String(doc.external_id || ''))
                    || '';
                const authorRaw = doc.author != null ? String(doc.author).trim() : '';
                let personForRef = null;
                /* Hot path: only link authors that already exist in the People index.
                 * New People stubs are created after the References write loop. */
                if (peopleColl && authorRaw) {
                    const pKey = this._normalizePeopleKey(authorRaw);
                    if (pKey) {
                        const hit = peopleByKey.get(pKey);
                        if (hit && this._peopleRecordIsAuthorLinkTarget(hit)) {
                            personForRef = this._resolveLiveRecord(hit) || hit;
                        }
                    }
                }

                const catLabel = String(doc.category || '').trim();
                const srcLabel = String(doc.source || '').trim();

                const workKey = this._referenceWorkKeyForDoc(doc);
                let refRecord = refByExtId.get(extId) || null;
                if (!refRecord && workKey) refRecord = refByWorkKey.get(workKey) || null;
                let existingExtId = '';
                if (refRecord) {
                    try { existingExtId = String(refRecord.text('external_id') || '').trim(); } catch (_) { existingExtId = ''; }
                }
                const canonicalExtId = this._preferCanonicalReferenceExtId(existingExtId, extId) || extId;

                const fields = {
                    external_id: canonicalExtId,
                    source_title: docTitle,
                    source_url: doc.source_url || '',
                    highlight_count: docHL.length,
                    synced_at: new Date(),
                };
                const catChoiceId = this._normalizeReadwiseCategoryChoiceId(catLabel);
                if (catChoiceId) fields.source_category = catChoiceId;
                fields.source_origin = this._normalizeReadwiseSourceOriginChoiceId(srcLabel);
                if (personForRef && personForRef.guid) {
                    fields.source_author = this._resolveLiveRecord(personForRef) || personForRef;
                } else if (peopleColl && !authorRaw) {
                    fields.source_author = null;
                }
                if (refBanner) fields.banner = refBanner;
                if (captureDate) fields.captured_at = captureDate;

                let created = 0;
                let updated = 0;
                if (refRecord) {
                    this._setFields(refRecord, fields);
                    refByExtId.set(extId, refRecord);
                    if (canonicalExtId) refByExtId.set(canonicalExtId, refRecord);
                    if (workKey) refByWorkKey.set(workKey, refRecord);
                    updated = 1;
                } else {
                    const r = await this._createRecord(refsColl, docTitle);
                    if (r) {
                        this._setFields(r, fields);
                        refByExtId.set(extId, r);
                        if (canonicalExtId) refByExtId.set(canonicalExtId, r);
                        if (workKey) refByWorkKey.set(workKey, r);
                        created = 1;
                        refRecord = r;
                    } else {
                        this._log('⚠️ Failed to create Reference: ' + extId);
                        if (this._lastSyncDiag) this._lastSyncDiag.skippedFailedCreate++;
                    }
                }

                if (refRecord && peopleColl && authorRaw && !personForRef) {
                    pendingPeopleLinks.push({ refRecord, authorRaw });
                }

                let written = 0;
                if (refRecord && refRecord.guid) {
                    const bodySig = this._referenceHighlightBodySig(docHL, exportByHlId);
                    const prevSig = bodySigMap[extId];
                    let skipBody = rwrSkipUnchangedBodiesFromStorage()
                        && updated === 1
                        && prevSig
                        && prevSig === bodySig;
                    /* Count says highlights exist, but the body has no Highlights section —
                     * usually a wipe+failed rewrite that still saved the body signature. */
                    if (skipBody && Array.isArray(docHL) && docHL.length > 0) {
                        try {
                            if (await this._referenceBodyMissingHighlights(refRecord)) {
                                skipBody = false;
                                if (this._lastSyncDiag) {
                                    this._lastSyncDiag.bodiesForcedEmptyRewrite =
                                        (this._lastSyncDiag.bodiesForcedEmptyRewrite || 0) + 1;
                                }
                            }
                        } catch (_) {}
                    }
                    const dayMeta = {
                        source_title: docTitle,
                        source_author: authorRaw || '',
                        category: catChoiceId || '',
                    };
                    let writtenHL = docHL;
                    if (skipBody) {
                        if (this._lastSyncDiag) this._lastSyncDiag.bodiesSkippedUnchanged++;
                        written = 1;
                        this._rwrWritten++;
                        if (this._lastSyncDiag) this._lastSyncDiag.referencesWritten++;
                        /* Full sync: API payload is complete — refresh day index even when body skipped. */
                        if (!incremental) {
                            this._dayIndexReplaceGuid(refRecord.guid, dayMeta, docHL, exportByHlId);
                            if (this._lastSyncDiag) this._lastSyncDiag.dayIndexUpdated++;
                        }
                        /* Bodies skipped still may have plain-text date headings — upgrade to journal refs. */
                        try {
                            await this._ensureDateHeadingsLinked(refRecord);
                        } catch (_) {}
                    } else {
                        try {
                            const bodyWasEmpty = await this._referenceBodyMissingHighlights(refRecord);
                            const mergeExisting = incremental && updated === 1 && !bodyWasEmpty;
                            writtenHL = await this._rebuildReferenceHighlightsBody(
                                refRecord, doc, docHL, exportByHlId, { mergeExisting });
                            if (!Array.isArray(writtenHL)) writtenHL = docHL;
                            /* Only stamp the skip key when the Highlights section actually landed. */
                            const stillMissing = await this._referenceBodyMissingHighlights(refRecord);
                            if (!stillMissing) {
                                bodySigMap[extId] = bodySig;
                                bodySigsDirty = true;
                                try { await this._ensureDateHeadingsLinked(refRecord); } catch (_) {}
                            } else if (bodySigMap[extId]) {
                                delete bodySigMap[extId];
                                bodySigsDirty = true;
                            }
                            if (this._lastSyncDiag) this._lastSyncDiag.bodiesRebuilt++;
                            if (this._lastSyncDiag.bodiesRebuilt % 20 === 0) {
                                rwrSaveBodySigMap(bodySigMap);
                                bodySigsDirty = false;
                            }
                            this._dayIndexReplaceGuid(refRecord.guid, dayMeta, writtenHL, exportByHlId);
                            if (this._lastSyncDiag) this._lastSyncDiag.dayIndexUpdated++;
                        } catch (e) {
                            this._log('⚠️ Body rebuild: ' + (e && e.message ? e.message : e));
                            if (this._lastSyncDiag) this._lastSyncDiag.bodyRebuildErrors++;
                        }
                        written = 1;
                        this._rwrWritten++;
                        if (this._lastSyncDiag) this._lastSyncDiag.referencesWritten++;
                    }
                    await this._yieldUi(refsColl);
                }
                return { created, updated, synth: synthAdded, written };
            }));
            for (const o of batchOut) {
                createdRef += o.created;
                updatedRef += o.updated;
                syntheticParentCount += o.synth;
            }
            const done = Math.min(bi + batch.length, docTotal);
            if (docTotal > 0) {
                this._syncStatusShow('Saving references ' + done + '/' + docTotal + '…');
            }
            if (done > 0 && done % 25 === 0) {
                this._persistSyncDiag({
                    syncPhase: 'writing',
                    progressDone: done,
                    progressTotal: docTotal,
                    referencesWritten: this._rwrWritten,
                    bodiesRebuilt: this._lastSyncDiag.bodiesRebuilt,
                    bodiesSkippedUnchanged: this._lastSyncDiag.bodiesSkippedUnchanged,
                });
            }
            await this._sleep(0);
        }

        if (peopleColl && pendingPeopleLinks.length) {
            this._syncStatusShow('Linking authors ' + pendingPeopleLinks.length + '…');
            for (const item of pendingPeopleLinks) {
                try {
                    const person = await this._ensurePeopleRecord(peopleColl, item.authorRaw, peopleByKey);
                    if (person && item.refRecord) {
                        this._setFields(item.refRecord, {
                            source_author: this._resolveLiveRecord(person) || person,
                        });
                        if (this._lastSyncDiag) this._lastSyncDiag.pendingPeopleLinked++;
                    }
                } catch (e) {
                    this._log('⚠️ Deferred People link: ' + (e && e.message ? e.message : e));
                }
            }
        }

        if (bodySigsDirty) rwrSaveBodySigMap(bodySigMap);
        if (!incremental && this._highlightsDayIndex) {
            this._highlightsDayIndex.complete = true;
            this._highlightsDayIndexDirty = true;
        }
        if (this._highlightsDayIndexDirty) this._persistHighlightsDayIndex();

        if (syntheticParentCount > 0) {
            this._log('Note: ' + syntheticParentCount + ' synthetic parent row(s).');
        }

        if (createdRef + updatedRef > 0) {
            this._log('Totals: ' + createdRef + ' created, ' + updatedRef + ' updated');
        }

        this._lastSyncDiag.createdRef = createdRef;
        this._lastSyncDiag.updatedRef = updatedRef;
        this._log('SYNC_DIAG ' + JSON.stringify(this._lastSyncDiag));
        this._persistSyncDiag({ ok: true, syncPhase: 'complete' });

        this._syncStatusShow('Refreshing workspace…');
        await this._tryRefreshRefsCollectionOnly(refsColl);
        this._clearFooterDataCaches();

        const parts = [
            createdRef > 0 ? createdRef + ' references added' : null,
            updatedRef > 0 ? updatedRef + ' references updated' : null,
        ].filter(Boolean);
        const d = this._lastSyncDiag;
        const warn = [];
        if (d && d.highlightsWithoutDocKey > 0) {
            warn.push(d.highlightsWithoutDocKey + ' list highlights not mapped to a document');
        }
        if (d && d.datelessHighlightsInBodies > 0) {
            warn.push(d.datelessHighlightsInBodies + ' highlights skipped in bodies (no date)');
        }
        if (d && d.skippedOrphans > 0) warn.push(d.skippedOrphans + ' orphan groups skipped');
        if (d && d.skippedRss > 0) warn.push(d.skippedRss + ' RSS sources skipped');
        if (d && d.incremental && (d.highlightsWithoutDocKey > 0 || d.skippedOrphans > 0)) {
            warn.push('incremental sync — run Full Sync if counts look wrong');
        }
        let summary = parts.length ? parts.join(', ') : 'No changes';
        if (warn.length) summary += ' · Note: ' + warn.join('; ');
        return { summary, diag: this._lastSyncDiag };
    }

    /**
     * Full rebuild of the Highlights section from API data.
     * @param {{ mergeExisting?: boolean }} [opts] — when true (incremental update), union API
     *   highlights with quotes already in the body so partial Reader deltas cannot wipe history.
     * @returns {Promise<Array|null>} highlight rows actually written (for day index / body sig)
     */
    async _rebuildReferenceHighlightsBody(refRecord, doc, docHL, exportByHlId, opts) {
        const mergeExisting = !!(opts && opts.mergeExisting);
        const record = await this._getRecordReady(refRecord.guid);
        if (!record) {
            if (this._lastSyncDiag) this._lastSyncDiag.body_getRecordReadyFail = (this._lastSyncDiag.body_getRecordReadyFail || 0) + 1;
            return null;
        }

        let items;
        try {
            items = await record.getLineItems();
        } catch (e) {
            if (this._lastSyncDiag) this._lastSyncDiag.body_getLineItemsFail = (this._lastSyncDiag.body_getLineItemsFail || 0) + 1;
            return null;
        }

        let writeHL = Array.isArray(docHL) ? docHL.slice() : [];
        if (mergeExisting) {
            try {
                const existingRows = await this._extractBodyHighlightsAsApiRows(record);
                if (existingRows.length) {
                    const before = writeHL.length;
                    writeHL = this._dedupeHighlightRowsByCanonicalKey(
                        (existingRows || []).concat(writeHL),
                        exportByHlId);
                    writeHL = this._dedupeIdenticalLongQuoteRows(writeHL);
                    if (writeHL.length > before && this._lastSyncDiag) {
                        this._lastSyncDiag.bodiesMergedIncremental =
                            (this._lastSyncDiag.bodiesMergedIncremental || 0) + 1;
                    }
                }
            } catch (e) {
                this._log('⚠️ Incremental body merge skipped: ' + (e && e.message ? e.message : e));
            }
        }

        await this._deleteAllLinesDeep(record);

        const { byDay, skippedNoDate } = this._groupHighlightsByLocalDay(writeHL);
        if (this._lastSyncDiag && skippedNoDate > 0) {
            this._lastSyncDiag.datelessHighlightsInBodies = (this._lastSyncDiag.datelessHighlightsInBodies || 0) + skippedNoDate;
        }

        /* Fast path: one insertFromMarkdown for the whole Highlights tree when nesting looks right.
         * Falls back to per-line creates (with segments in one call) on any failure. */
        if (rwrPreferMarkdownBodiesFromStorage()
            && typeof record.insertFromMarkdown === 'function') {
            try {
                const md = this._buildHighlightsMarkdown(byDay, exportByHlId);
                const ok = await record.insertFromMarkdown(md, null, null);
                if (ok && await this._verifyHighlightsBodyStructure(record)) {
                    if (this._lastSyncDiag) this._lastSyncDiag.bodiesViaMarkdown++;
                    return writeHL;
                }
                this._log('Markdown body path failed verification — falling back to line creates.');
                await this._deleteAllLinesDeep(record);
            } catch (e) {
                this._log('⚠️ Markdown body path: ' + (e && e.message ? e.message : e));
                try { await this._deleteAllLinesDeep(record); } catch (_) {}
            }
        }

        if (this._lastSyncDiag) this._lastSyncDiag.bodiesViaLines++;

        const sectionLine = await this._createLine(
            record, null, null, 'text',
            [{ type: 'text', text: READWISE_REF_HIGHLIGHTS_HEADER }]
        );
        if (!sectionLine) return writeHL;
        await this._applyLineHeading(sectionLine, 2);

        const dayKeys = Array.from(byDay.keys()).sort();

        let prevUnderSection = null;
        let dayIndex = 0;
        for (const dk of dayKeys) {
            if (dayIndex++ > 0) {
                /* Skip empty spacer lines — divider alone is enough between date groups. */
                const divLine = await this._createLine(
                    record, sectionLine, prevUnderSection, 'text',
                    [{ type: 'text', text: READWISE_REF_BETWEEN_DATE_DIVIDER_TEXT }]
                );
                if (divLine) prevUnderSection = divLine;
            }
            const { dayDate, highlights } = byDay.get(dk);
            const dateLabel = formatReadwiseRefDateHeading(dayDate);
            const jGuid = this._journalGuidForLocalDate(dayDate);
            let dateSegs;
            if (jGuid) {
                dateSegs = [{ type: 'ref', text: { guid: jGuid, title: dateLabel } }];
                if (this._lastSyncDiag) this._lastSyncDiag.dateHeadingsLinked++;
            } else {
                dateSegs = [{ type: 'text', text: dateLabel }];
                if (this._lastSyncDiag) this._lastSyncDiag.dateHeadingsPlainFallback++;
            }
            const dateLine = await this._createLine(record, sectionLine, prevUnderSection, 'text', dateSegs);
            if (!dateLine) continue;
            await this._applyLineHeading(dateLine, 3);
            prevUnderSection = dateLine;

            highlights.sort((a, b) => String(a.id).localeCompare(String(b.id)));

            let prevUnderDate = null;
            for (let hi = 0; hi < highlights.length; hi++) {
                if (RWR_BODY_YIELD_EVERY_HIGHLIGHTS > 0 && hi > 0 && hi % RWR_BODY_YIELD_EVERY_HIGHLIGHTS === 0) {
                    await this._sleep(0);
                }
                const h = highlights[hi];
                const body = this._highlightBody(h);
                const ex = exportByHlId.get(String(h.id)) || exportByHlId.get(String(h.external_id != null ? h.external_id : ''));
                let noteStr = this._highlightNote(h);
                if (ex && ex.note != null && String(ex.note).trim() !== '') noteStr = String(ex.note);
                const locUrl = this._readwiseHighlightOpenLink(h, ex);

                const quoteLine = await this._createLine(
                    record, dateLine, prevUnderDate, 'text',
                    [{ type: 'text', text: body || '' }]
                );
                if (!quoteLine) continue;
                prevUnderDate = quoteLine;

                let lastChild = null;
                if (noteStr && String(noteStr).trim()) {
                    const nt = String(noteStr).trim();
                    const noteLine = await this._createLine(
                        record, quoteLine, lastChild, 'text',
                        [
                            { type: 'bold', text: '📝 Note: ' },
                            { type: 'text', text: nt },
                        ]
                    );
                    if (noteLine) lastChild = noteLine;
                }
                if (locUrl) {
                    const locLine = await this._createLine(
                        record, quoteLine, lastChild, 'text',
                        [
                            { type: 'bold', text: '🌎 Loc: ' },
                            { type: 'link', text: locUrl },
                        ]
                    );
                    if (locLine) lastChild = locLine;
                }

                if (hi < highlights.length - 1) {
                    const sep = await this._createLine(
                        record, dateLine, quoteLine, 'text',
                        [{ type: 'text', text: READWISE_REF_QUOTE_SEPARATOR_TEXT }]
                    );
                    if (sep) prevUnderDate = sep;
                }
            }
        }
        return writeHL;
    }

    /**
     * Build a Markdown Highlights body. Date headings use plain labels; journal @ref upgrade
     * happens via _ensureDateHeadingsLinked after write.
     */
    _buildHighlightsMarkdown(byDay, exportByHlId) {
        const escapeMd = (s) => String(s || '')
            .replace(/\\/g, '\\\\')
            .replace(/\*/g, '\\*')
            .replace(/_/g, '\\_')
            .replace(/#/g, '\\#')
            .replace(/\[/g, '\\[')
            .replace(/\]/g, '\\]');
        const parts = ['## ' + READWISE_REF_HIGHLIGHTS_HEADER, ''];
        const dayKeys = Array.from(byDay.keys()).sort();
        for (let di = 0; di < dayKeys.length; di++) {
            if (di > 0) {
                parts.push(READWISE_REF_BETWEEN_DATE_DIVIDER_TEXT);
                parts.push('');
            }
            const { dayDate, highlights } = byDay.get(dayKeys[di]);
            const dateLabel = formatReadwiseRefDateHeading(dayDate);
            parts.push('### ' + dateLabel);
            parts.push('');
            const sorted = highlights.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
            for (let hi = 0; hi < sorted.length; hi++) {
                const h = sorted[hi];
                const body = this._highlightBody(h);
                const ex = exportByHlId && typeof exportByHlId.get === 'function'
                    ? (exportByHlId.get(String(h.id)) || exportByHlId.get(String(h.external_id != null ? h.external_id : '')))
                    : null;
                let noteStr = this._highlightNote(h);
                if (ex && ex.note != null && String(ex.note).trim() !== '') noteStr = String(ex.note);
                const locUrl = this._readwiseHighlightOpenLink(h, ex);
                parts.push(escapeMd(body));
                parts.push('');
                if (noteStr && String(noteStr).trim()) {
                    parts.push('**📝 Note:** ' + escapeMd(String(noteStr).trim()));
                    parts.push('');
                }
                if (locUrl) {
                    parts.push('**🌎 Loc:** ' + locUrl);
                    parts.push('');
                }
                if (hi < sorted.length - 1) {
                    parts.push(READWISE_REF_QUOTE_SEPARATOR_TEXT);
                    parts.push('');
                }
            }
        }
        return parts.join('\n');
    }

    /**
     * Confirm markdown insert produced the nested shape footer/day-index parsers expect:
     * Highlights header → date child → at least one quote child (when we expected highlights).
     */
    async _verifyHighlightsBodyStructure(record) {
        let items;
        try { items = await record.getLineItems(); } catch (_) { return false; }
        if (!items || !items.length) return false;
        const ordered = this._buildRecordDocumentOrder(record, items);
        const recId = record.guid;
        let sectionLine = null;
        for (const line of this._childrenInDocOrder(ordered, recId, recId)) {
            const plain = await this._linePlainText(line);
            if (this._isHighlightsSectionHeader(plain)) {
                sectionLine = line;
                break;
            }
        }
        if (!sectionLine) return false;
        const underSection = this._childrenInDocOrder(ordered, recId, sectionLine.guid)
            .filter((l) => l && l.type !== 'br');
        if (!underSection.length) return false;
        /* Prefer a date-like child that itself has children (nested quotes). */
        for (const dateLine of underSection) {
            const plain = (await this._linePlainText(dateLine)).trim();
            if (!plain || plain === READWISE_REF_BETWEEN_DATE_DIVIDER_TEXT) continue;
            if (this._isReadwiseRefSeparatorLine(plain)) continue;
            const kids = this._childrenInDocOrder(ordered, recId, dateLine.guid);
            if (kids.length > 0) return true;
        }
        return false;
    }

    /**
     * Parse existing Reference body into API-like highlight rows (for incremental merge).
     * Dates come from day headings; Loc URLs become `readwise_url` so canonical dedupe can match.
     */
    async _extractBodyHighlightsAsApiRows(record) {
        let items;
        try { items = await record.getLineItems(); } catch (_) { return []; }
        if (!items || !items.length) return [];

        const ordered = this._buildRecordDocumentOrder(record, items);
        const recId = record.guid;
        const roots = this._childrenInDocOrder(ordered, recId, recId);
        let sectionLine = null;
        for (const line of roots) {
            const plain = await this._linePlainText(line);
            if (this._isHighlightsSectionHeader(plain)) {
                sectionLine = line;
                break;
            }
        }
        if (!sectionLine) return [];

        const out = [];
        const dateBlocks = this._childrenInDocOrder(ordered, recId, sectionLine.guid);
        for (const dateLine of dateBlocks) {
            if (dateLine?.type === 'br') continue;
            const plainLo = (await this._linePlainText(dateLine)).trim();
            if (!plainLo) continue;
            if (plainLo === READWISE_REF_BETWEEN_DATE_DIVIDER_TEXT) continue;

            const ymd = await this._dateLineToYyyymmdd(dateLine);
            if (!ymd) continue;
            const y = parseInt(ymd.slice(0, 4), 10);
            const m = parseInt(ymd.slice(4, 6), 10) - 1;
            const d = parseInt(ymd.slice(6, 8), 10);
            const iso = new Date(y, m, d, 12, 0, 0, 0).toISOString();

            const merged = await this._mergeQuoteLinesUnderDateGroup(record, ordered, recId, dateLine);
            for (const row of merged) {
                const text = String(row.text || '').trim();
                if (!text) continue;
                out.push({
                    id: 'body:' + this._rwrHashStr(ymd + '\0' + text.slice(0, 120)),
                    content: text,
                    text,
                    note: row.note || '',
                    highlighted_at: iso,
                    created_at: iso,
                    readwise_url: row.loc || '',
                    url: row.loc || '',
                });
            }
        }
        return out;
    }

    async _dateLineToYyyymmdd(line) {
        const segs = await this._lineSegments(line);
        for (const seg of segs) {
            if (seg?.type !== 'ref' || !seg.text) continue;
            const g = typeof seg.text === 'string' ? seg.text : seg.text.guid;
            if (!g) continue;
            try {
                const rec = this.data.getRecord(typeof g === 'string' ? g : g);
                const jd = rec?.getJournalDetails?.();
                if (jd?.date instanceof Date && !isNaN(jd.date.getTime())) {
                    const y = jd.date.getFullYear();
                    const m = String(jd.date.getMonth() + 1).padStart(2, '0');
                    const day = String(jd.date.getDate()).padStart(2, '0');
                    return `${y}${m}${day}`;
                }
            } catch (_) {}
        }
        const plain = (await this._linePlainText(line)).trim();
        return parseReadwiseRefDateHeadingYmd(plain);
    }

    _readHighlightCountProp(record) {
        for (const read of [
            () => record.number?.('highlight_count'),
            () => record.prop?.('highlight_count')?.number?.(),
            () => record.prop?.('highlight_count')?.get?.(),
            () => record.text?.('highlight_count'),
        ]) {
            let v;
            try { v = read(); } catch (_) { continue; }
            if (v == null || v === '') continue;
            const n = typeof v === 'object' ? Number(v.value ?? v.number ?? NaN) : Number(v);
            if (Number.isFinite(n)) return n;
        }
        return 0;
    }

    /**
     * True when the record has no Highlights section header (and therefore no filed quotes).
     * Used to force a body rewrite when highlight_count / API payload say content should exist.
     */
    async _referenceBodyMissingHighlights(refRecord) {
        const record = refRecord?.guid ? (await this._getRecordReady(refRecord.guid)) || refRecord : refRecord;
        if (!record) return true;
        let items;
        try { items = await record.getLineItems(); } catch (_) { return true; }
        if (!items || !items.length) return true;
        try {
            const ordered = this._buildRecordDocumentOrder(record, items);
            for (const line of this._childrenInDocOrder(ordered, record.guid, record.guid)) {
                const plain = await this._linePlainText(line);
                if (this._isHighlightsSectionHeader(plain)) return false;
            }
        } catch (_) {
            return true;
        }
        return true;
    }

    _readerDocIdFromExtId(extId) {
        const s = String(extId || '').trim();
        if (!s.startsWith('readwise_')) return '';
        const rest = s.slice('readwise_'.length);
        /* Skip export-only / synthetic ids. */
        if (!rest || rest.startsWith('ub_') || rest.startsWith('exp_')) return '';
        return rest;
    }

    _exportBookEntryForExtId(exportBooks, exportByHlId, extId, hint) {
        const books = Array.isArray(exportBooks) ? exportBooks : [];
        const want = String(extId || '').trim();
        if (!want && !hint) return null;
        const readerId = this._readerDocIdFromExtId(want);
        const hintTitle = String(hint?.title || '').trim().toLowerCase();
        const hintUrl = String(hint?.source_url || hint?.url || '').trim().toLowerCase();

        let matched = null;
        for (const book of books) {
            if (!book) continue;
            const bookExt = this._exportBookStableExtId(book);
            const bookReader = book.external_id != null ? String(book.external_id).trim() : '';
            if (want && (bookExt === want || (readerId && bookReader === readerId))) {
                matched = book;
                break;
            }
        }
        if (!matched && (hintTitle || hintUrl)) {
            for (const book of books) {
                if (!book) continue;
                const t = String(book.title || book.readable_title || '').trim().toLowerCase();
                const u = String(book.source_url || book.unique_url || '').trim().toLowerCase();
                if (hintUrl && u && (u === hintUrl || u.includes(hintUrl) || hintUrl.includes(u))) {
                    matched = book;
                    break;
                }
                if (hintTitle && t && t === hintTitle) {
                    matched = book;
                    break;
                }
            }
        }
        if (!matched) return null;

        const rawHl = [];
        for (const hl of matched.highlights || []) {
            if (hl?.is_deleted) continue;
            rawHl.push(this._exportHighlightToUnifiedRow(hl, matched));
        }
        if (!rawHl.length) return null;
        let hl = this._dedupeHighlightRowsByCanonicalKey(rawHl, exportByHlId);
        hl = this._dedupeIdenticalLongQuoteRows(hl);
        hl = this._dedupeRedundantNoteHighlightRows(hl);
        if (!hl.length) return null;
        return {
            extId: want || this._exportBookStableExtId(matched),
            doc: this._exportBookToDoc(matched),
            docHL: hl,
            synthFlag: 0,
            fromExport: true,
            orphanRepair: true,
        };
    }

    /**
     * Resolve highlights for one Reference from the v2 export library.
     * `/api/v3/highlights/` is not a public Reader endpoint (404) — export is the reliable source.
     */
    async _resolveHighlightBundleFromExport(token, extId, hint, existingExport) {
        let exportBooks = existingExport?.exportBooks || [];
        let exportByHlId = existingExport?.highlightById || new Map();

        let bundle = this._exportBookEntryForExtId(exportBooks, exportByHlId, extId, hint);
        if (bundle) return { bundle, exportBooks, exportByHlId, fetchedFullExport: false };

        this._syncStatusShow('Downloading Readwise export to repair body…');
        this._log('Empty-body repair: incremental export missed ' + extId + ' — fetching full export…');
        const enr = await this._fetchReadwiseExportPayload(token, null);
        exportBooks = enr.exportBooks || [];
        exportByHlId = enr.highlightById || new Map();
        bundle = this._exportBookEntryForExtId(exportBooks, exportByHlId, extId, hint);
        return { bundle, exportBooks, exportByHlId, fetchedFullExport: true };
    }

    async _collectEmptyBodyOrphanEntries(token, existingRef, alreadyQueued, exportBooks, exportByHlId) {
        const queued = new Set((alreadyQueued || []).map((e) => e && e.extId).filter(Boolean));
        const out = [];
        const refs = Array.isArray(existingRef) ? existingRef : [];
        const orphans = [];

        for (const ref of refs) {
            if (!ref?.guid) continue;
            let extId = '';
            try { extId = String(ref.text?.('external_id') || '').trim(); } catch (_) { extId = ''; }
            if (!extId || queued.has(extId)) continue;
            const count = this._readHighlightCountProp(ref);
            if (!(count > 0)) continue;
            let missing = false;
            try { missing = await this._referenceBodyMissingHighlights(ref); } catch (_) { missing = true; }
            if (!missing) continue;

            let hint = null;
            try {
                hint = {
                    title: ref.getName?.() || ref.text?.('source_title') || '',
                    source_url: ref.text?.('source_url') || '',
                };
            } catch (_) { hint = null; }
            orphans.push({ ref, extId, hint });
        }

        if (!orphans.length) return out;
        this._syncStatusShow('Checking empty-body references (' + orphans.length + ')…');

        let books = Array.isArray(exportBooks) ? exportBooks : [];
        let byHl = exportByHlId && typeof exportByHlId.get === 'function' ? exportByHlId : new Map();
        let fetchedFull = false;

        for (let i = 0; i < orphans.length; i++) {
            const { ref, extId, hint } = orphans[i];
            this._syncStatusShow('Repairing empty body ' + (i + 1) + '/' + orphans.length + ': '
                + (ref.getName?.() || extId).slice(0, 40));

            let bundle = this._exportBookEntryForExtId(books, byHl, extId, hint);
            if (!bundle && !fetchedFull) {
                try {
                    const resolved = await this._resolveHighlightBundleFromExport(
                        token, extId, hint, { exportBooks: books, highlightById: byHl });
                    books = resolved.exportBooks;
                    byHl = resolved.exportByHlId;
                    fetchedFull = !!resolved.fetchedFullExport;
                    bundle = resolved.bundle;
                } catch (e) {
                    this._log('⚠️ Full export for orphan repair failed: ' + (e && e.message ? e.message : e));
                }
            } else if (!bundle && fetchedFull) {
                bundle = this._exportBookEntryForExtId(books, byHl, extId, hint);
            }

            if (!bundle || !bundle.docHL?.length) {
                if (this._lastSyncDiag) {
                    this._lastSyncDiag.bodiesOrphanFetchFailed =
                        (this._lastSyncDiag.bodiesOrphanFetchFailed || 0) + 1;
                }
                try {
                    const sigMap = rwrLoadBodySigMap();
                    if (sigMap && sigMap[extId]) {
                        delete sigMap[extId];
                        rwrSaveBodySigMap(sigMap);
                    }
                } catch (_) {}
                this._log('⚠️ Could not find export highlights for empty-body ref ' + extId);
                continue;
            }
            out.push(bundle);
            queued.add(extId);
        }
        return out;
    }

    _cancelStuckSync() {
        const was = !!this._syncing;
        const wasIdx = !!this._dayIndexRebuilding;
        this._syncing = false;
        this._dayIndexRebuildEpoch = (this._dayIndexRebuildEpoch || 0) + 1;
        this._dayIndexRebuilding = false;
        try { this._syncStatusHide(); } catch (_) {}
        this._toast(was || wasIdx
            ? 'Cleared stuck sync/index work. Safe to continue.'
            : 'No sync was marked running — status chip cleared anyway.');
    }

    /**
     * Rebuild Highlights body for the open Reference from the v2 export library.
     */
    async _rebuildActiveReferenceBody() {
        if (this._syncing) {
            this._toast('A sync is marked running — use “Cancel / clear stuck sync status” first if it is hung.');
            return;
        }
        const panel = this.ui.getActivePanel?.();
        const record = panel?.getActiveRecord?.();
        if (!record?.guid) {
            this._toast('Open a Reference record first.');
            return;
        }
        let extId = '';
        try { extId = String(record.text?.('external_id') || '').trim(); } catch (_) { extId = ''; }
        if (!extId) {
            this._toast('This record has no external_id.');
            return;
        }
        const token = localStorage.getItem(RWR_TOKEN_KEY);
        if (!token) {
            this._toast('Set your Readwise token first.');
            return;
        }

        let hint = null;
        try {
            hint = {
                title: record.getName?.() || record.text?.('source_title') || '',
                source_url: record.text?.('source_url') || '',
            };
        } catch (_) { hint = null; }

        this._syncing = true;
        this._syncStatusShow('Rebuilding body: ' + (record.getName?.() || extId).slice(0, 48));
        try {
            /* Warm journal GUID prefix so date headings become @ref links (not plain text). */
            try { this._ensureJournalGuidPrefix(); } catch (_) {}
            const { bundle, exportByHlId } = await this._resolveHighlightBundleFromExport(
                token, extId, hint, null);
            if (!bundle?.docHL?.length) {
                this._toast('No highlights for this document in your Readwise export. It may have been deleted upstream.');
                return;
            }
            const writtenHL = await this._rebuildReferenceHighlightsBody(
                record, bundle.doc, bundle.docHL, exportByHlId, { mergeExisting: false });
            const rows = Array.isArray(writtenHL) ? writtenHL : bundle.docHL;
            const stillMissing = await this._referenceBodyMissingHighlights(record);
            if (stillMissing) {
                this._toast('Rewrite ran but Highlights section still missing — check console.');
                return;
            }
            /* Safety net if rebuild fell back to plain dates (prefix cold mid-write). */
            try { await this._ensureDateHeadingsLinked(record); } catch (_) {}
            try {
                const sigMap = rwrLoadBodySigMap();
                sigMap[extId] = this._referenceHighlightBodySig(bundle.docHL, exportByHlId);
                rwrSaveBodySigMap(sigMap);
            } catch (_) {}
            try {
                this._dayIndexReplaceGuid(record.guid, {
                    source_title: this._resolveDocTitle(bundle.doc),
                    source_author: String(bundle.doc.author || ''),
                    category: this._normalizeReadwiseCategoryChoiceId(bundle.doc.category) || '',
                }, rows, exportByHlId);
                this._persistHighlightsDayIndex();
            } catch (_) {}
            this._setFields(record, {
                highlight_count: rows.length,
                synced_at: new Date(),
            });
            this._toast('Rebuilt body with ' + rows.length + ' highlight(s).');
            this._refreshAll();
        } catch (e) {
            console.error('[ReadwiseRef] rebuild body', e);
            this._toast('Rebuild failed: ' + (e?.message || e));
        } finally {
            this._syncing = false;
            this._syncStatusHide();
        }
    }

    /**
     * Report why the open Reference shows a Highlight Count with an empty body.
     * Compares the stored count against body lines, parsed highlight rows, and the day index.
     */
    async _diagnoseActiveReference() {
        const panel = this.ui.getActivePanel?.();
        const record = panel?.getActiveRecord?.();
        if (!record) {
            this._toast('Open a Reference record first.');
            return;
        }

        const name = record.getName?.() || '(untitled)';
        const extId = (() => {
            try { return record.text?.('external_id') || ''; } catch (_) { return ''; }
        })();
        const countProp = this._readHighlightCountProp(record);

        let lineCount = 0;
        let hasHeader = false;
        try {
            const items = await record.getLineItems();
            lineCount = items?.length || 0;
            const ordered = this._buildRecordDocumentOrder(record, items || []);
            for (const line of this._childrenInDocOrder(ordered, record.guid, record.guid)) {
                const plain = await this._linePlainText(line);
                if (this._isHighlightsSectionHeader(plain)) { hasHeader = true; break; }
            }
        } catch (e) {
            this._log('diagnose: getLineItems failed — ' + (e?.message || e));
        }

        let bodyRows = [];
        try { bodyRows = await this._extractBodyHighlightsAsApiRows(record); } catch (_) { bodyRows = []; }

        if (!this._highlightsDayIndex) this._hydrateHighlightsDayIndexFromStorage();
        const idxEntry = this._highlightsDayIndex?.entries?.[record.guid] || null;
        let idxRows = 0;
        for (const rows of Object.values(idxEntry?.d || {})) idxRows += (rows?.length || 0);

        const sigMap = rwrLoadBodySigMap();
        const hasSig = !!(extId && sigMap && sigMap[extId]);

        const report = {
            name,
            external_id: extId || '(none)',
            highlight_count_property: countProp,
            body_line_items: lineCount,
            has_highlights_header: hasHeader,
            highlight_rows_parsed_from_body: bodyRows.length,
            day_index_entry: !!idxEntry,
            day_index_rows: idxRows,
            body_signature_stored: hasSig,
        };
        this._log('Reference diagnosis: ' + JSON.stringify(report, null, 2));
        console.log('[Readwise Ref] diagnosis', report, record);

        const n = Number(countProp) || 0;
        let verdict;
        if (bodyRows.length > 0) {
            verdict = 'Body has ' + bodyRows.length + ' highlight(s) — looks fine.';
        } else if (n > 0 && hasHeader) {
            verdict = 'Header present, no dated highlights: Readwise sent ' + n
                + ' highlight(s) with no timestamp, so none could be filed under a date.';
        } else if (n > 0 && !hasHeader) {
            verdict = 'Body is missing the Highlights section while count is ' + n
                + '. Next incremental sync will force a rewrite.';
        } else {
            verdict = 'No highlights in body and count is ' + n + '.';
        }
        this._log('Verdict: ' + verdict);
        this._toast(verdict);
    }

    /** Highlights without a parseable local date are omitted from the body (`skippedNoDate`). */
    _groupHighlightsByLocalDay(docHL) {
        const byDay = new Map();
        let skippedNoDate = 0;
        for (const h of docHL) {
            const raw = h.highlighted_at || h.created_at;
            let dt = null;
            if (raw) {
                try {
                    dt = new Date(raw);
                    if (isNaN(dt.getTime())) dt = null;
                } catch (_) { dt = null; }
            }
            if (!dt) {
                skippedNoDate++;
                continue;
            }
            const y = dt.getFullYear();
            const m = dt.getMonth();
            const d = dt.getDate();
            const key = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
            if (!byDay.has(key)) {
                const dayStart = new Date(y, m, d, 0, 0, 0, 0);
                byDay.set(key, { dayDate: dayStart, highlights: [] });
            }
            byDay.get(key).highlights.push(h);
        }
        return { byDay, skippedNoDate };
    }

    /** Delete every line in document order (children before parents where possible). */
    async _deleteAllLinesDeep(record) {
        for (let pass = 0; pass < 120; pass++) {
            let items;
            try {
                items = await record.getLineItems();
            } catch (_) {
                break;
            }
            if (!items || items.length === 0) break;
            const ordered = this._buildRecordDocumentOrder(record, items);
            for (let i = ordered.length - 1; i >= 0; i--) {
                const line = ordered[i];
                try {
                    if (line && typeof line.delete === 'function') await line.delete();
                    else if (line && typeof line.remove === 'function') await line.remove();
                } catch (_) {}
            }
        }
    }

    _buildRecordDocumentOrder(record, items) {
        const recordGuid = record?.guid || null;
        const list = Array.isArray(items) ? items.filter(Boolean) : [];
        if (!recordGuid || list.length === 0) return list;
        const childrenByParent = new Map();
        const visited = new Set();
        const ordered = [];
        for (const item of list) {
            const guid = item?.guid || null;
            if (!guid) continue;
            const parentGuid = typeof item?.parent_guid === 'string' && item.parent_guid
                ? item.parent_guid
                : recordGuid;
            const key = parentGuid === recordGuid ? recordGuid : parentGuid;
            if (!childrenByParent.has(key)) childrenByParent.set(key, []);
            childrenByParent.get(key).push(item);
        }
        const walk = (parentGuid) => {
            const children = childrenByParent.get(parentGuid) || [];
            for (const item of children) {
                const guid = item?.guid || null;
                if (!guid || visited.has(guid)) continue;
                visited.add(guid);
                ordered.push(item);
                walk(guid);
            }
        };
        walk(recordGuid);
        for (const item of list) {
            const guid = item?.guid || null;
            if (!guid || visited.has(guid)) continue;
            visited.add(guid);
            ordered.push(item);
        }
        return ordered;
    }

    async _createLine(record, parent, afterSibling, type, segments) {
        const segs = Array.isArray(segments) ? segments : null;
        const tryCreate = async (after) => {
            if (segs) {
                try {
                    const line = await record.createLineItem(parent, after, type, segs, null);
                    if (line) return line;
                } catch (_) {}
            }
            try {
                const line = await record.createLineItem(parent, after, type);
                if (line && segs) {
                    try { await line.setSegments(segs); } catch (_) {}
                }
                return line;
            } catch (_) {
                return null;
            }
        };
        let line = await tryCreate(afterSibling);
        if (!line && afterSibling) line = await tryCreate(null);
        return line;
    }

    /** Map 2 → H2, 3 → H3 when the host supports `setHeadingSize` on line items. */
    async _applyLineHeading(line, level) {
        if (!line || typeof line.setHeadingSize !== 'function') return;
        try {
            await line.setHeadingSize(level);
        } catch (_) {
            try {
                line.setHeadingSize(level);
            } catch (_) {}
        }
    }

    async _getRecordReady(guid) {
        const attempts = this._syncing ? 25 : 90;
        const gapMs = this._syncing ? 50 : 120;
        for (let i = 0; i < attempts; i++) {
            const r = this.data?.getRecord?.(guid);
            if (r && typeof r.getLineItems === 'function' && typeof r.createLineItem === 'function') return r;
            await this._sleep(gapMs);
        }
        return null;
    }

    /** Thymer journal page for a calendar day (date headings link here when available). */
    _journalGuidForLocalDate(dayDate) {
        if (!dayDate || !(dayDate instanceof Date) || isNaN(dayDate.getTime())) return null;
        const y = dayDate.getFullYear();
        const m = dayDate.getMonth();
        const d = dayDate.getDate();
        // Noon avoids DST / UTC-midnight edge cases (SDK docs recommend date-only @ 12:00).
        const noon = new Date(y, m, d, 12, 0, 0, 0);
        const ymd = String(y)
            + String(m + 1).padStart(2, '0')
            + String(d).padStart(2, '0');

        try {
            if (this.data && typeof this.data.getJournalForDate === 'function') {
                const jr = this.data.getJournalForDate(noon);
                const guid = jr?.guid || null;
                if (guid) {
                    this._cacheJournalGuidPrefix(guid);
                    if (String(guid).endsWith(ymd)) return guid;
                }
            }
        } catch (_) {}

        const prefix = this._ensureJournalGuidPrefix();
        if (prefix) {
            const constructed = prefix + ymd;
            try {
                const rec = this.data?.getRecord?.(constructed);
                if (rec?.guid) return rec.guid;
            } catch (_) {}
            // Journal pages are virtual until opened — constructed GUID is still a valid link target.
            return constructed;
        }
        return null;
    }

    _cacheJournalGuidPrefix(guid) {
        const g = String(guid || '');
        const m = /^(.*-)(\d{8})$/.exec(g);
        if (m) this._journalGuidPrefix = m[1];
    }

    _ensureJournalGuidPrefix() {
        if (this._journalGuidPrefix) return this._journalGuidPrefix;
        try {
            const now = new Date();
            const noon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
            if (this.data && typeof this.data.getJournalForDate === 'function') {
                const jr = this.data.getJournalForDate(noon);
                if (jr?.guid) this._cacheJournalGuidPrefix(jr.guid);
            }
        } catch (_) {}
        if (this._journalGuidPrefix) return this._journalGuidPrefix;
        try {
            const rec = this.ui?.getActivePanel?.()?.getActiveRecord?.() || null;
            const jd = rec?.getJournalDetails?.();
            if (jd?.date && rec?.guid) this._cacheJournalGuidPrefix(rec.guid);
        } catch (_) {}
        return this._journalGuidPrefix || null;
    }

    /**
     * Upgrade plain-text date headings under ❣️ Highlights to journal `@ref` links
     * without wiping the rest of the body (used when body rebuild is skipped).
     */
    async _ensureDateHeadingsLinked(refRecord) {
        const guid = refRecord?.guid || '';
        if (!guid) return 0;
        const record = await this._getRecordReady(guid);
        if (!record) return 0;

        let items;
        try { items = await record.getLineItems(); } catch (_) { return 0; }
        if (!items || !items.length) return 0;

        const ordered = this._buildRecordDocumentOrder(record, items);
        const recId = record.guid;
        const roots = this._childrenInDocOrder(ordered, recId, recId);
        let sectionLine = null;
        for (const line of roots) {
            const plain = await this._linePlainText(line);
            if (this._isHighlightsSectionHeader(plain)) {
                sectionLine = line;
                break;
            }
        }
        if (!sectionLine) return 0;

        const underSection = this._childrenInDocOrder(ordered, recId, sectionLine.guid);
        let relinked = 0;
        for (const line of underSection) {
            if (!line || line.type === 'br') continue;
            const plain = (await this._linePlainText(line)).trim();
            if (!plain || plain === READWISE_REF_BETWEEN_DATE_DIVIDER_TEXT) continue;
            if (this._isReadwiseRefSeparatorLine(plain)) continue;

            const segs = await this._lineSegments(line);
            const hasRef = segs.some((s) => s?.type === 'ref');
            let ymd = null;
            if (hasRef) {
                ymd = await this._dateLineToYyyymmdd(line);
                // Already a journal link for a known day — leave alone.
                if (ymd) continue;
            } else {
                ymd = parseReadwiseRefDateHeadingYmd(plain);
            }
            if (!ymd || ymd.length !== 8) continue;

            const y = parseInt(ymd.slice(0, 4), 10);
            const mo = parseInt(ymd.slice(4, 6), 10) - 1;
            const d = parseInt(ymd.slice(6, 8), 10);
            const dayDate = new Date(y, mo, d, 12, 0, 0, 0);
            const jGuid = this._journalGuidForLocalDate(dayDate);
            if (!jGuid) continue;

            const dateLabel = formatReadwiseRefDateHeading(dayDate) || plain;
            if (typeof line.setSegments !== 'function') continue;
            try {
                await line.setSegments([{ type: 'ref', text: { guid: jGuid, title: dateLabel } }]);
            } catch (_) {
                try {
                    await line.setSegments([{ type: 'ref', text: jGuid }]);
                } catch (_) {
                    continue;
                }
            }
            relinked++;
            if (this._lastSyncDiag) this._lastSyncDiag.dateHeadingsRelinked++;
        }
        return relinked;
    }

    /**
     * Light pass: turn plain-text date headings into journal links across References.
     * Does not call Readwise and does not wipe/rebuild highlight bodies.
     */
    async _relinkAllDateHeadings() {
        if (this._syncing) {
            this._toast('Readwise sync already running — try again when it finishes.');
            return;
        }
        this._syncing = true;
        let scanned = 0;
        let touched = 0;
        let relinked = 0;
        try {
            this._toast('Linking date headings to journals…');
            this._syncStatusShow('Linking date headings…');
            await this._ensureRwCollections();
            const refsColl = this._rwRefsColl;
            if (!refsColl) {
                this._toast('No References collection found.');
                return;
            }
            let records = [];
            try { records = await refsColl.getAllRecords(); } catch (_) { records = []; }
            const total = records.length;
            for (let i = 0; i < records.length; i++) {
                const rec = records[i];
                scanned++;
                try {
                    const n = await this._ensureDateHeadingsLinked(rec);
                    if (n > 0) {
                        touched++;
                        relinked += n;
                    }
                } catch (_) {}
                if (i > 0 && i % 3 === 0) {
                    this._syncStatusShow('Linking date headings ' + (i + 1) + '/' + total + '…');
                    await this._sleep(0);
                    await new Promise((r) => requestAnimationFrame(() => r()));
                }
            }
            this._toast(`Date links: ${relinked} headings on ${touched}/${scanned} references`);
            this._log(`Date heading relink done — scanned ${scanned}, pages touched ${touched}, headings linked ${relinked}`);
            this._refreshAll();
        } finally {
            this._syncing = false;
            this._syncStatusHide();
        }
    }

    /**
     * One-time local pass: read existing Reference bodies into the day index and mark it complete
     * so Today's Highlights stops vault-scanning on every journal change. No Readwise download,
     * no body rewrite.
     *
     * @param {{ background?: boolean }} [opts] background: do not take `_syncing` (API sync) lock;
     *   yield more on coarse pointers so journal navigation stays usable.
     */
    async _rebuildDayIndexFromBodies(opts) {
        const background = !!(opts && opts.background);
        if (this._dayIndexRebuilding) {
            if (!background) this._toast('Highlights index rebuild already running…');
            return;
        }
        if (this._syncing) {
            this._toast('Readwise sync already running — try again when it finishes.');
            return;
        }
        const myEpoch = (this._dayIndexRebuildEpoch = (this._dayIndexRebuildEpoch || 0) + 1);
        this._dayIndexRebuilding = true;
        let scanned = 0;
        let withDays = 0;
        const coarse = this._rwPreferSlowStart() || rwrPreferDeferredHeavyWork();
        const cancelled = () =>
            this._rwUnloaded || this._dayIndexRebuildEpoch !== myEpoch;
        try {
            if (!background) this._toast('Building Today\'s Highlights index…');
            this._syncStatusShow('Building highlights index…');
            await this._ensureRwCollections();
            if (cancelled()) return;
            const refsColl = this._rwRefsColl;
            if (!refsColl) {
                if (!background) this._toast('No References collection found.');
                return;
            }
            let records = [];
            try { records = await refsColl.getAllRecords(); } catch (_) { records = []; }
            if (cancelled()) return;

            /* Build into a fresh object, then swap — keep any prior index readable until replace. */
            const next = this._emptyHighlightsDayIndex();
            this._highlightsDayIndex = next;
            this._highlightsDayIndexDirty = true;

            const total = records.length;
            for (let i = 0; i < records.length; i++) {
                if (cancelled()) return;
                const rec = records[i];
                scanned++;
                try {
                    const rows = await this._extractBodyHighlightsAsApiRows(rec);
                    if (rows.length) {
                        this._dayIndexReplaceGuid(rec.guid, {
                            source_title: this._sourceTitleLabel(rec),
                            source_author: this._authorLabel(rec),
                            category: this._readwiseSourceCategoryLabel(rec),
                        }, rows, null);
                        withDays++;
                    }
                } catch (_) {}
                const yieldEvery = coarse ? 1 : 2;
                if (i === 0 || (i % yieldEvery) === 0) {
                    this._syncStatusShow('Building highlights index ' + (i + 1) + '/' + total + '…');
                    await this._sleep(0);
                    await new Promise((r) => {
                        try { requestAnimationFrame(() => r()); }
                        catch (_) { r(); }
                    });
                    if (coarse) {
                        await new Promise((r) => {
                            try {
                                if (typeof requestIdleCallback === 'function') {
                                    requestIdleCallback(() => r(), { timeout: 180 });
                                } else {
                                    setTimeout(r, 32);
                                }
                            } catch (_) {
                                setTimeout(r, 32);
                            }
                        });
                    }
                }
            }

            if (cancelled()) return;
            if (!this._highlightsDayIndex) this._highlightsDayIndex = this._emptyHighlightsDayIndex();
            this._highlightsDayIndex.complete = true;
            this._highlightsDayIndexDirty = true;
            this._persistHighlightsDayIndex();
            try { this._thRefQueryCache?.clear(); } catch (_) {}

            this._toast(`Highlights index ready (${withDays}/${scanned} references)`);
            this._log(`Day index rebuild done — scanned ${scanned}, with day groups ${withDays}, complete=true, background=${background}`);
            this._refreshAll();
        } finally {
            if (this._dayIndexRebuildEpoch === myEpoch) this._dayIndexRebuilding = false;
            this._syncStatusHide();
        }
    }

    /**
     * Group list rows under the Reader **document** id (walks parent chain; prefers parent_document_id).
     * Highlights with no resolvable document key are counted in `highlightsWithoutDocKey` (otherwise silent drops).
     */
    _groupPageHLsByOwningDocument(pageHLs, docByIdStr, allRowsById) {
        const pageHLsByDoc = new Map();
        let highlightsWithoutDocKey = 0;
        for (const h of pageHLs) {
            const docKey = this._resolveDocKeyForListRow(h, docByIdStr, allRowsById);
            if (docKey == null) {
                highlightsWithoutDocKey++;
                if (this._lastSyncDiag) {
                    if (!this._lastSyncDiag.unmappedSampleIds) this._lastSyncDiag.unmappedSampleIds = [];
                    if (this._lastSyncDiag.unmappedSampleIds.length < 25 && h && h.id != null) {
                        this._lastSyncDiag.unmappedSampleIds.push(String(h.id));
                    }
                }
                continue;
            }
            if (!pageHLsByDoc.has(docKey)) pageHLsByDoc.set(docKey, []);
            pageHLsByDoc.get(docKey).push(h);
        }
        return { map: pageHLsByDoc, highlightsWithoutDocKey };
    }

    _resolveDocKeyForListRow(h, docByIdStr, allRowsById) {
        const pd = h.parent_document_id ?? h.document_id ?? h.reader_document_id;
        if (pd != null && String(pd).length > 0) {
            const pds = String(pd);
            if (docByIdStr.has(pds)) return pds;
            const up = this._resolveOwningDocumentIdFromListRows(pds, docByIdStr, allRowsById);
            if (up) return up;
        }
        const rawParent = h.parent_id ?? h.parent_document_id;
        if (rawParent == null || String(rawParent).length === 0) return null;
        const pid = String(rawParent);
        if (docByIdStr.has(pid)) return pid;
        const resolved = this._resolveOwningDocumentIdFromListRows(pid, docByIdStr, allRowsById);
        return resolved || pid;
    }

    _resolveOwningDocumentIdFromListRows(startId, docByIdStr, byId) {
        const sid = String(startId);
        if (docByIdStr.has(sid)) return sid;
        let cur = byId.get(sid);
        for (let g = 0; g < 50 && cur; g++) {
            const cid = String(cur.id);
            if (docByIdStr.has(cid)) return cid;
            const p = cur.parent_id ?? cur.parent_document_id;
            if (p == null || p === '') return null;
            const ps = String(p);
            if (docByIdStr.has(ps)) return ps;
            cur = byId.get(ps);
        }
        return null;
    }

    _syntheticParentDocFromHighlight(parentIdStr, h) {
        const hl = h || {};
        const title = hl.title != null ? hl.title : (hl.document_title != null ? hl.document_title : '');
        return {
            id: parentIdStr,
            author: hl.author != null ? hl.author : '',
            category: hl.category != null ? hl.category : '',
            source_url: hl.source_url != null ? hl.source_url : '',
            title: title,
            created_at: hl.created_at != null ? hl.created_at : null,
            image_url: hl.image_url != null ? hl.image_url : '',
            cover_image_url: hl.cover_image_url != null ? hl.cover_image_url : '',
        };
    }

    _resolveDocTitle(doc) {
        if (!doc) return 'Untitled';
        const t = doc.title != null && String(doc.title).trim();
        if (t) return String(doc.title).trim();
        const u = doc.source_url != null && String(doc.source_url).trim();
        if (u) return String(doc.source_url).trim();
        if (doc.category) return String(doc.category) + ' (untitled)';
        return 'Untitled';
    }

    _highlightBody(h) {
        const t = h.content ?? h.text;
        return typeof t === 'string' ? t : '';
    }

    _rwrHashStr(s) {
        const str = String(s || '');
        let h = 5381;
        for (let i = 0; i < str.length; i++) {
            h = ((h << 5) + h) ^ str.charCodeAt(i);
        }
        return (h >>> 0).toString(36);
    }

    /** Stable hash of merged highlight payload — used to skip unchanged body rebuilds. */
    _referenceHighlightBodySig(docHL, exportByHlId) {
        const exMap = exportByHlId && typeof exportByHlId.get === 'function' ? exportByHlId : null;
        const chunks = [];
        for (const h of docHL || []) {
            const ex = exMap
                ? (exMap.get(String(h.id)) || exMap.get(String(h.external_id != null ? h.external_id : '')))
                : null;
            let noteStr = this._highlightNote(h);
            if (ex && ex.note != null && String(ex.note).trim() !== '') noteStr = String(ex.note);
            chunks.push([
                String(h.id ?? h.external_id ?? ''),
                this._highlightBody(h),
                noteStr,
                String(h.highlighted_at || h.created_at || ''),
                this._readwiseHighlightOpenLink(h, ex),
            ].join('\x1e'));
        }
        chunks.sort();
        return this._rwrHashStr(chunks.join('\x1f'));
    }

    _highlightNote(h) {
        const n = h.note ?? h.notes;
        if (n == null) return '';
        return typeof n === 'string' ? n : String(n);
    }

    _readwiseHighlightOpenLink(h, ex) {
        const tryUrl = (u) => {
            if (u == null || u === '') return '';
            let s = String(u).trim();
            if (/^\/\//.test(s)) s = 'https:' + s;
            return /^https?:\/\//i.test(s) ? s : '';
        };
        if (ex) {
            const u = tryUrl(ex.readwise_url) || tryUrl(ex.url);
            if (u) return u;
        }
        if (h) {
            const u = tryUrl(h.readwise_url) || tryUrl(h.url) || tryUrl(h.highlight_url)
                || tryUrl(h.reader_url) || tryUrl(h.location_url);
            if (u) return u;
            /** Reader rows often use a ULID `id` while `external_id` is the classic numeric open id. */
            const ext = h.external_id != null ? String(h.external_id).trim() : '';
            const idv = h.id != null ? String(h.id).trim() : '';
            const openId = (/^\d+$/.test(ext) && !/^\d+$/.test(idv)) ? ext : (idv || ext);
            if (openId.length > 0) {
                return 'https://readwise.io/open/' + encodeURIComponent(openId);
            }
        }
        return '';
    }

    _coverImageUrlForDoc(doc) {
        if (!doc) return '';
        return doc.image_url || doc.cover_image_url || '';
    }

    _normalizePeopleKey(name) {
        return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }

    _peopleTagsFieldId() {
        try {
            const o = localStorage.getItem('readwise_references_people_tags_field_id');
            if (o && String(o).trim()) return String(o).trim();
        } catch (_) {}
        return RWR_PEOPLE_TAGS_FIELD_ID_DEFAULT;
    }

    _readwiseAuthorTagValue() {
        try {
            const o = localStorage.getItem('readwise_references_people_author_tag');
            if (o && String(o).trim()) return String(o).trim().replace(/^#/, '');
        } catch (_) {}
        return RWR_PEOPLE_READWISE_AUTHOR_TAG_DEFAULT;
    }

    _peopleTagTexts(record) {
        if (!record) return [];
        const fieldId = this._peopleTagsFieldId();
        try {
            if (typeof record.texts === 'function') {
                const all = record.texts(fieldId);
                if (Array.isArray(all) && all.length) return all.map((t) => String(t || ''));
            }
        } catch (_) {}
        try {
            const prop = record.prop(fieldId);
            if (prop && typeof prop.texts === 'function') {
                const all = prop.texts();
                if (Array.isArray(all)) return all.map((t) => String(t || ''));
            }
        } catch (_) {}
        return [];
    }

    _hasReadwiseAuthorTag(record) {
        const want = this._readwiseAuthorTagValue().toLowerCase();
        if (!want) return false;
        for (const t of this._peopleTagTexts(record)) {
            if (String(t || '').trim().replace(/^#/, '').toLowerCase() === want) return true;
        }
        return false;
    }

    _peopleNotesFieldId() {
        try {
            const o = localStorage.getItem('readwise_references_people_notes_field_id');
            if (o && String(o).trim()) return String(o).trim();
        } catch (_) {}
        return RWR_PEOPLE_NOTES_FIELD_ID_DEFAULT;
    }

    _peopleGroupFieldId() {
        try {
            const o = localStorage.getItem('readwise_references_people_group_field_id');
            if (o && String(o).trim()) return String(o).trim();
        } catch (_) {}
        return RWR_PEOPLE_GROUP_FIELD_ID_DEFAULT;
    }

    /**
     * Only rename People rows that look like Readwise stubs — not contacts with other tags, notes, or Group.
     */
    _shouldSyncPeopleTitleFromReadwise(record) {
        if (!record) return false;
        if (this._hasReadwiseAuthorTag(record)) return true;
        const tagNorm = this._readwiseAuthorTagValue().toLowerCase();
        const tags = this._peopleTagTexts(record);
        const otherTags = tags.filter(
            (t) => String(t || '').trim().replace(/^#/, '').toLowerCase() !== tagNorm
        );
        if (otherTags.length > 0) return false;
        try {
            const notes = record.text?.(this._peopleNotesFieldId()) || '';
            if (String(notes).trim()) return false;
        } catch (_) {}
        try {
            const groupGuid = record.reference?.(this._peopleGroupFieldId());
            if (groupGuid) return false;
        } catch (_) {}
        return true;
    }

    /** Match Readwise display spelling when the normalized author key is unchanged. */
    _syncPeopleDisplayTitle(record, rawName) {
        const title = String(rawName || '').trim();
        if (!record || !title || !this._shouldSyncPeopleTitleFromReadwise(record)) return false;
        let current = '';
        try {
            current = typeof record.getName === 'function' ? String(record.getName() || '') : '';
        } catch (_) {}
        if (String(current).trim() === title) return false;
        try {
            const p = record.prop('title');
            if (p && typeof p.set === 'function') {
                p.set(title);
                return true;
            }
        } catch (e) {
            this._log('⚠️ People title: ' + (e && e.message ? e.message : e));
        }
        return false;
    }

    /** Tag People rows created/linked as Readwise authors (`#ReadwiseAuthor`). Idempotent. */
    _ensureReadwiseAuthorTag(record) {
        if (!record || this._hasReadwiseAuthorTag(record)) return false;
        const fieldId = this._peopleTagsFieldId();
        const tag = this._readwiseAuthorTagValue();
        try {
            const prop = record.prop(fieldId);
            if (!prop) {
                this._log('⚠️ People Tags field missing: ' + fieldId);
                return false;
            }
            if (typeof prop.addValue === 'function') {
                prop.addValue(tag);
                return true;
            }
            if (typeof prop.set === 'function') {
                const existing = this._peopleTagTexts(record);
                const merged = existing.slice();
                merged.push(tag);
                prop.set(merged);
                return true;
            }
        } catch (e) {
            this._log('⚠️ People tag: ' + (e && e.message ? e.message : e));
        }
        return false;
    }

    /**
     * Count distinct string values from API rows (`trim`; missing/blank → `(empty)`).
     * Used for diagnostics: see raw Readwise **category** vs **source** (e.g. `epub`, `kindle` often appear on **source**).
     */
    _readwiseHistogramStrings(rows, pick) {
        const h = Object.create(null);
        for (const r of rows || []) {
            let v = '';
            try {
                v = pick(r);
            } catch (_) {
                v = '';
            }
            const k = String(v != null ? v : '').trim() || '(empty)';
            h[k] = (h[k] || 0) + 1;
        }
        return h;
    }

    /**
     * Map Readwise `category` strings to `source_category` choice ids: **books** | **articles** | **podcasts** | **video**.
     * Defaults:
     *  - `books`, `supplementals`, `supplemental_books`, `epub` → **books**
     *  - `podcast`, `podcasts` → **podcasts**
     *  - `video`, `videos` → **video**
     *  - everything else (articles, article, email, rss, pdf, tweet, …) → **articles**
     * Override per workspace: `localStorage.readwise_references_category_map` JSON (see `rwrCategoryMapOverride` JSDoc).
     */
    _normalizeReadwiseCategoryChoiceId(raw) {
        const rawTrim = String(raw || '').trim();
        const rawKey = rawTrim || '(empty)';
        let k = rawTrim.toLowerCase().replace(/\s+/g, '_');
        const aliases = {
            supplementalbooks: 'supplemental_books',
            supplementals: 'supplemental_books',
            supplemental: 'supplemental_books',
            podcast: 'podcasts',
            videos: 'video',
            reader_document: 'reader',
            reader_documents: 'reader',
            feed: 'rss',
            feeds: 'rss',
        };
        if (aliases[k]) k = aliases[k];
        const over = rwrCategoryMapOverride();
        if (over) {
            let spec = null;
            if (over[rawKey] != null) spec = over[rawKey];
            else if (k && over[k] != null) spec = over[k];
            if (spec != null) {
                const t = String(spec).trim().toLowerCase();
                if (t === 'books' || t === 'articles' || t === 'podcasts' || t === 'video') return t;
            }
        }
        if (k === 'books' || k === 'supplemental_books' || k === 'epub') return 'books';
        if (k === 'podcasts') return 'podcasts';
        if (k === 'video') return 'video';
        return 'articles';
    }

    /** Label/id for footers & pool — `source_category` is a choice field. */
    _readwiseSourceCategoryLabel(record) {
        try {
            if (record && typeof record.choice === 'function') {
                const ch = record.choice('source_category');
                if (ch == null) return '';
                if (typeof ch === 'string') return ch;
                return String(ch.label || ch.id || '').trim();
            }
        } catch (_) {}
        return '';
    }

    /**
     * Map Readwise `doc.source` to `source_origin` choice id.
     * Empty / unknown source → `unknown`. Anything not aliased and not in `READWISE_SOURCE_ORIGIN_ALLOWED` → `other`.
     * Override: `localStorage.readwise_references_source_map` (see `rwrSourceMapOverride`).
     */
    _normalizeReadwiseSourceOriginChoiceId(raw) {
        const rawTrim = String(raw || '').trim();
        const rawKey = rawTrim || '(empty)';
        if (!rawTrim) return 'unknown';
        let k = rawTrim.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
        const aliases = {
            /** Reader sub-channels — collapse extra suffixes Readwise sometimes appends. */
            reader_mobile_app: 'reader_mobile',
            reader_web_app: 'reader_web',
            reader_share_sheet_android: 'reader_share_sheet',
            reader_share_sheet_ios: 'reader_share_sheet',
            reader_share_sheet_web: 'reader_share_sheet',
            reader_in_app_link_save: 'reader_in_app_save',
            reader_in_app_save: 'reader_in_app_save',
            reader_add_from_import_url: 'reader_import_url',
            reader_add_from_clipboard: 'reader_clipboard',
            /** Readwise alone is the original Readwise (non-Reader) account ingest. */
            readwise: 'reader',
            readwise_reader: 'reader',
            /** Uploads / files. */
            file: 'upload',
            files: 'upload',
            file_upload: 'upload',
            /** PDF as a Readwise book source = uploaded PDF. */
            pdf: 'pdf_upload',
        };
        if (aliases[k]) k = aliases[k];
        const over = rwrSourceMapOverride();
        if (over) {
            let spec = null;
            if (over[rawKey] != null) spec = over[rawKey];
            else if (over[rawTrim] != null) spec = over[rawTrim];
            else if (k && over[k] != null) spec = over[k];
            if (spec != null) {
                const t = String(spec).trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
                if (READWISE_SOURCE_ORIGIN_ALLOWED.has(t)) return t;
            }
        }
        if (READWISE_SOURCE_ORIGIN_ALLOWED.has(k)) return k;
        return 'other';
    }

    /** Label for `source_origin` choice field (chip / UI). */
    _readwiseSourceOriginLabel(record) {
        try {
            if (record && typeof record.choice === 'function') {
                const ch = record.choice('source_origin');
                if (ch == null) return '';
                if (typeof ch === 'string') return ch;
                return String(ch.label || ch.id || '').trim();
            }
        } catch (_) {}
        return '';
    }

    async _ensureReferencesAuthorPeopleFilter(refsColl, peopleColl) {
        if (!refsColl || !peopleColl) return;
        let peopleGuid = null;
        try {
            peopleGuid = peopleColl.getGuid?.() || peopleColl.guid || null;
        } catch (_) {}
        if (!peopleGuid) return;
        try {
            if (typeof refsColl.getConfiguration !== 'function' || typeof refsColl.saveConfiguration !== 'function') return;
            const base = refsColl.getConfiguration() || {};
            const fields = Array.isArray(base.fields) ? base.fields.map((f) => (f ? { ...f } : f)) : [];
            const idx = fields.findIndex((f) => f && f.id === 'source_author');
            if (idx < 0) return;
            const cur = fields[idx];
            const hasFilter = !!(cur.filter_colguid && String(cur.filter_colguid).trim());
            const next = Object.assign({}, cur, { target_collection_id: 'People' });
            if (!hasFilter) next.filter_colguid = peopleGuid;
            if (cur.target_collection_id === next.target_collection_id && cur.filter_colguid === next.filter_colguid) return;
            fields[idx] = next;
            const merged = Object.assign({}, base, { fields });
            const ok = await refsColl.saveConfiguration(merged);
            if (ok !== false) {
                this._log(hasFilter
                    ? 'References Author field → target People (kept existing filter_colguid)'
                    : 'References Author field → People collection guid');
            }
        } catch (e) {
            this._log('⚠️ Author field filter_colguid: ' + (e && e.message ? e.message : e));
        }
    }

    _resolveLiveRecord(recordOrGuid) {
        const guid = recordOrGuid && typeof recordOrGuid === 'object'
            ? recordOrGuid.guid
            : recordOrGuid;
        if (!guid) return null;
        try {
            const live = this.data?.getRecord?.(guid);
            if (live && typeof live.getName === 'function') return live;
        } catch (_) {}
        return recordOrGuid && typeof recordOrGuid === 'object' ? recordOrGuid : null;
    }

    /** Skip trashed / stale snapshots from `getAllRecords` that break property backlinks. */
    _peopleRecordIsAuthorLinkTarget(record) {
        const live = this._resolveLiveRecord(record);
        if (!live || !live.guid) return false;
        try {
            if (typeof live.getLineItems !== 'function' || typeof live.createLineItem !== 'function') return false;
        } catch (_) {
            return false;
        }
        return true;
    }

    _shouldPreferPeopleRecord(candidate, incumbent) {
        if (!this._peopleRecordIsAuthorLinkTarget(incumbent)) return true;
        if (!this._peopleRecordIsAuthorLinkTarget(candidate)) return false;
        if (this._hasReadwiseAuthorTag(candidate) && !this._hasReadwiseAuthorTag(incumbent)) return true;
        if (!this._hasReadwiseAuthorTag(candidate) && this._hasReadwiseAuthorTag(incumbent)) return false;
        try {
            const cAt = candidate.getCreatedAt?.()?.getTime?.() || 0;
            const iAt = incumbent.getCreatedAt?.()?.getTime?.() || 0;
            if (cAt !== iAt) return cAt > iAt;
        } catch (_) {}
        return false;
    }

    async _buildPeopleByKeyIndex(peopleColl) {
        const peopleByKey = new Map();
        if (!peopleColl) return peopleByKey;
        try {
            for (const r of await peopleColl.getAllRecords()) {
                const n = typeof r.getName === 'function' ? r.getName() : '';
                const k = this._normalizePeopleKey(n);
                if (!k || !this._peopleRecordIsAuthorLinkTarget(r)) continue;
                const prev = peopleByKey.get(k);
                if (!prev || this._shouldPreferPeopleRecord(r, prev)) {
                    peopleByKey.set(k, this._resolveLiveRecord(r) || r);
                }
            }
        } catch (e) {
            this._log('⚠️ People index: ' + e.message);
        }
        return peopleByKey;
    }

    async _ensurePeopleMinimalBody(record) {
        const guid = record?.guid;
        if (!guid) return false;
        const ready = await this._getRecordReady(guid);
        if (!ready) return false;
        let items = [];
        try {
            items = await ready.getLineItems();
        } catch (_) {
            return false;
        }
        if (Array.isArray(items) && items.length > 0) return true;
        const line = await this._createLine(ready, null, null, 'text');
        if (!line) return false;
        try {
            await line.setSegments([{ type: 'text', text: '' }]);
        } catch (_) {
            try {
                await line.setSegments([{ type: 'text', text: ' ' }]);
            } catch (_) {}
        }
        return true;
    }

    /**
     * Link a record-type property to `targetGuid`. Uses the same fallback chain as legacy Readwise.
     * Does not use `prop.linkedRecord()` for verification — on read-only fields it often lags or
     * returns null even when `record.reference()` is correct, which flooded the console and
     * confused whether links were applied.
     */
    _linkRecordProperty(prop, targetGuid, fieldId, hostRecord) {
        const guid = String(targetGuid || '').trim();
        if (!prop || !guid) return false;
        const live = this.data?.getRecord?.(guid);
        const attempts = [];
        if (live && typeof prop.linkRecord === 'function') {
            attempts.push(() => prop.linkRecord(live));
        }
        if (live && typeof prop.link === 'function') {
            attempts.push(() => prop.link(live));
        }
        if (live && typeof prop.setRecord === 'function') {
            attempts.push(() => prop.setRecord(live));
        }
        if (typeof prop.set === 'function') {
            attempts.push(() => prop.set(guid));
        }
        let lastErr = null;
        for (let i = 0; i < attempts.length; i++) {
            try {
                attempts[i]();
            } catch (e) {
                lastErr = e;
                continue;
            }
            if (hostRecord && typeof hostRecord.reference === 'function') {
                try {
                    const got = hostRecord.reference(fieldId);
                    if (got && String(got).trim() === guid) return true;
                } catch (_) {}
            }
            return true;
        }
        if (lastErr) {
            this._log('⚠️ prop link ' + fieldId + ': ' + (lastErr && lastErr.message ? lastErr.message : lastErr));
        }
        return false;
    }

    async _ensurePeopleRecord(peopleColl, rawName, peopleByKey) {
        if (!peopleColl || !peopleByKey) return null;
        const key = this._normalizePeopleKey(rawName);
        if (!key) return null;
        let hit = peopleByKey.get(key);
        if (hit && !this._peopleRecordIsAuthorLinkTarget(hit)) {
            peopleByKey.delete(key);
            hit = null;
        }
        if (hit) {
            hit = this._resolveLiveRecord(hit) || hit;
            this._syncPeopleDisplayTitle(hit, rawName);
            this._ensureReadwiseAuthorTag(hit);
            peopleByKey.set(key, hit);
            return hit;
        }
        const title = String(rawName).trim() || 'Unknown';
        const r = await this._createRecord(peopleColl, title);
        if (r && r.guid) {
            const live = this._resolveLiveRecord(r) || r;
            await this._ensurePeopleMinimalBody(live);
            this._ensureReadwiseAuthorTag(live);
            peopleByKey.set(key, live);
            return live;
        }
        return null;
    }

    _clearRecordField(record, fieldId) {
        if (!record || !fieldId) return false;
        try {
            const prop = record.prop(fieldId);
            if (!prop) return false;
            if (typeof prop.unlink === 'function') {
                prop.unlink();
                return true;
            }
            if (typeof prop.set === 'function') {
                try {
                    prop.set(null);
                    return true;
                } catch (_) {}
                try {
                    prop.set('');
                    return true;
                } catch (_) {}
            }
            if (typeof prop.removeValue === 'function' && typeof prop.linkedRecord === 'function') {
                const linked = prop.linkedRecord();
                if (linked) {
                    prop.removeValue(linked);
                    return true;
                }
            }
        } catch (e) {
            this._log('⚠️ Clear field ' + fieldId + ': ' + (e && e.message ? e.message : e));
        }
        return false;
    }

    async _createRecord(coll, title) {
        const guid = coll.createRecord(title);
        if (!guid) {
            this._log('⚠️ createRecord null: ' + this._trunc(title, 40));
            return null;
        }
        /* Prefer data.getRecord — avoid N× getAllRecords polls (was a major sync stall). */
        for (let i = 0; i < 40; i++) {
            try {
                const r = this.data?.getRecord?.(guid);
                if (r && r.guid) return r;
            } catch (_) {}
            await this._sleep(i < 10 ? 40 : 100);
        }
        try {
            const all = await coll.getAllRecords();
            const record = all.find((r) => r.guid === guid);
            if (record) return record;
        } catch (_) {}
        return null;
    }

    _setFields(record, fields) {
        const failed = [];
        for (const [id, val] of Object.entries(fields)) {
            if (val === undefined) continue;
            if (val === null) {
                if (!this._clearRecordField(record, id)) failed.push(id + '(clear)');
                continue;
            }
            try {
                const prop = record.prop(id);
                if (!prop) {
                    failed.push(id);
                    continue;
                }
                if (val && typeof val === 'object' && val.guid) {
                    if (!this._linkRecordProperty(prop, val.guid, id, record)) failed.push(id + '(link)');
                } else if (val instanceof Date) {
                    if (!isNaN(val)) {
                        const dt = DateTime.dateOnly(val.getFullYear(), val.getMonth(), val.getDate());
                        prop.set(dt.value());
                    }
                } else if (typeof val === 'number') {
                    prop.set(val);
                } else if (typeof val === 'string') {
                    if (id === 'banner') {
                        try {
                            prop.set({ imgUrl: val });
                        } catch (_) {
                            prop.set(val);
                        }
                    } else if (id === 'source_url') {
                        prop.set(String(val).trim());
                    } else {
                        const ok = typeof prop.setChoice === 'function' ? prop.setChoice(val) : false;
                        if (!ok) prop.set(val);
                    }
                }
            } catch (e) {
                failed.push(id + '(' + e.message + ')');
            }
        }
        if (failed.length) this._log('⚠️ Fields: ' + failed.join(', '));
    }

    /** Cheap mid-sync: References collection only (does not fan out to all plugins). */
    async _tryRefreshRefsCollectionOnly(refsColl) {
        const names = ['refresh', 'reload', 'invalidate', 'notifyChange'];
        for (const n of names) {
            try {
                if (refsColl && typeof refsColl[n] === 'function') await refsColl[n]();
            } catch (_) {}
        }
    }

    /**
     * Full refresh: use at end of sync (or sparingly). Includes this.data / this.ui — expensive;
     * triggers overview panels, Today's Notes, etc.
     */
    async _tryHostCollectionRefresh(refsColl) {
        const tryOne = async (obj, names) => {
            if (!obj) return;
            for (const n of names) {
                try {
                    if (typeof obj[n] === 'function') await obj[n]();
                } catch (_) {}
            }
        };
        await this._tryRefreshRefsCollectionOnly(refsColl);
        await this._sleep(0);
        await tryOne(this.data, [
            'refresh', 'refreshAll', 'refreshCollections', 'reloadCollections',
            'invalidate', 'notifyDataChanged', 'notifyChange', 'sync',
        ]);
        await this._sleep(0);
        await tryOne(this.ui, ['refresh', 'refreshActivePanel', 'refreshCollections']);
    }

    async _yieldUi(refsColl) {
        if (RWR_UI_YIELD_EVERY > 0 && this._rwrWritten % RWR_UI_YIELD_EVERY === 0) {
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
            await this._sleep(0);
            const boot = globalThis.BootKernel || globalThis.__dawnBoot;
            if (boot?.shouldYield?.()) await boot.yieldToMain?.();
        }
        if (this._rwrWritten > 0 && RWR_UI_REFS_COLL_REFRESH_EVERY > 0
            && this._rwrWritten % RWR_UI_REFS_COLL_REFRESH_EVERY === 0) {
            await this._tryRefreshRefsCollectionOnly(refsColl);
            this._log('Progress: ' + this._rwrWritten + ' references written (References collection refresh only)');
        }
    }


    _deferHandlePanel(panel) {
        const panelId = panel?.getId?.();
        if (!panelId) return;
        const prev = this._navDeferTimers.get(panelId);
        if (prev) clearTimeout(prev);
        this._navDeferTimers.set(panelId, setTimeout(() => {
            this._navDeferTimers.delete(panelId);
            const run = () => {
                try {
                    this._handlePanel(panel);
                } catch (_) {}
            };
            try {
                if (typeof requestIdleCallback === 'function') {
                    requestIdleCallback(run, { timeout: 1200 });
                } else {
                    requestAnimationFrame(() => requestAnimationFrame(run));
                }
            } catch (_) {
                run();
            }
        }, RWR_PANEL_DEBOUNCE_MS));
    }

    /**
     * Drop stale async footer work when navigation beats slow highlights/shuffler awaits.
     * @param {HTMLElement|null} targetHiRoot — highlights `.th-journal-footer` (or combined single root)
     * @param {HTMLElement|null} targetShRoot — shuffler mount root; combined mode uses same as hi root
     */
    _isPopulateStillCurrent(state, seq, targetJournal, targetHiRoot, targetShRoot, targetGuid) {
        if (!state || state.populateSeq !== seq || state.journalDate !== targetJournal || state.recordGuid !== targetGuid) {
            return false;
        }
        if (targetHiRoot) {
            if (state.rootEl !== targetHiRoot || !state.rootEl?.isConnected) return false;
        }
        if (targetShRoot) {
            const cur = state.shufflerRootEl || state.rootEl;
            if (cur !== targetShRoot || !cur?.isConnected) return false;
        }
        return true;
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
        if (!panelEl) { this._disposePanel(panelId); return; }

        const suiteHi =
            typeof globalThis.__thymerJfsReadwiseGetHighlightsMountEl === 'function'
                ? globalThis.__thymerJfsReadwiseGetHighlightsMountEl(panelId)
                : null;
        const suiteSh =
            typeof globalThis.__thymerJfsReadwiseGetShufflerMountEl === 'function'
                ? globalThis.__thymerJfsReadwiseGetShufflerMountEl(panelId)
                : null;

        const container = this._findContainer(panelEl);
        if (!container) {
            let state = this._panelStates.get(panelId);
            if (!state) {
                state = {
                    panelId,
                    panel,
                    recordGuid: null,
                    journalDate: null,
                    rootEl: null,
                    shufflerRootEl: null,
                    observer: null,
                    loading: false,
                    loaded: false,
                    populateSeq: 0,
                    _pendingPopulate: false,
                    expandedSources: new Map(),
                    _containerWatcher: null,
                };
                this._panelStates.set(panelId, state);
                state._containerWatcher = new MutationObserver(() => {
                    try {
                        if (state._cwTimer) clearTimeout(state._cwTimer);
                    } catch (_) {}
                    state._cwTimer = setTimeout(() => {
                        state._cwTimer = null;
                        const c = this._findContainer(panelEl);
                        if (c) {
                            try { state._containerWatcher?.disconnect(); } catch (_) {}
                            state._containerWatcher = null;
                            this._deferHandlePanel(panel);
                        }
                    }, RWR_MUTATION_OBS_DEBOUNCE_MS);
                });
                try {
                    state._containerWatcher.observe(panelEl, { childList: true, subtree: true });
                } catch (_) {
                    state._containerWatcher = null;
                    this._disposePanel(panelId);
                }
            }
            return;
        }

        const record = panel?.getActiveRecord?.();
        if (!record)  { this._disposePanel(panelId); return; }

        const journalDate = this._journalDateFromRecord(record);
        if (!journalDate) { this._disposePanel(panelId); return; }

        if (!suiteHi && !suiteSh && !this._showHighlightsPanel() && !this._showShufflerPanel()) {
            this._disposePanel(panelId);
            return;
        }

        let state = this._panelStates.get(panelId);
        const wasPlaceholder =
            state && (state.journalDate == null || state.recordGuid == null);
        const dateChanged =
            state != null && state.journalDate != null && state.journalDate !== journalDate;
        const recordChanged =
            state != null && state.recordGuid != null && state.recordGuid !== record.guid;

        if (!state) {
            state = {
                panelId,
                panel,
                recordGuid: record.guid,
                journalDate,
                rootEl: null,
                shufflerRootEl: null,
                observer: null,
                loading: false,
                loaded: false,
                populateSeq: 0,
                _pendingPopulate: false,
                expandedSources: new Map(),
                _containerWatcher: null,
            };
            this._panelStates.set(panelId, state);
        } else {
            try { state._containerWatcher?.disconnect(); } catch (_) {}
            state._containerWatcher = null;
            try {
                if (state._cwTimer) clearTimeout(state._cwTimer);
            } catch (_) {}
            state._cwTimer = null;
            state.journalDate = journalDate;
            state.recordGuid = record.guid;
            state.panel = panel;
            if (typeof state._pendingPopulate !== 'boolean') state._pendingPopulate = false;
            if (typeof state.populateSeq !== 'number') state.populateSeq = 0;
            if (dateChanged || recordChanged || wasPlaceholder) {
                state.loaded = false;
                state.expandedSources = new Map();
                state.highlightsDataLoaded = false;
                state.shufflerDataLoaded = false;
            }
        }

        const rebuilt = this._mountFooter(state, panelEl, { suiteHi, suiteSh, container });
        if (rebuilt) {
            state.loading = false; // In-flight populate may target a removed root (same as Today's Notes)
            state.expandedSources = new Map();
            state.highlightsDataLoaded = false;
            state.shufflerDataLoaded = false;
        }
        const needPopulate = dateChanged || recordChanged || !state.loaded || rebuilt;
        if (needPopulate) {
            if (state.loading) state._pendingPopulate = true;
            else this._populate(state);
        }
    }

    _disposePanel(panelId) {
        if (!panelId) return;
        const t = this._navDeferTimers?.get(panelId);
        if (t) {
            try { clearTimeout(t); } catch (_) {}
            this._navDeferTimers.delete(panelId);
        }
        const s = this._panelStates.get(panelId);
        if (!s) return;
        try {
            if (s._mutObsTimer) clearTimeout(s._mutObsTimer);
        } catch (_) {}
        s._mutObsTimer = null;
        try {
            if (s._cwTimer) clearTimeout(s._cwTimer);
        } catch (_) {}
        s._cwTimer = null;
        try { s.observer?.disconnect(); } catch (_) {}
        try { s._containerWatcher?.disconnect(); } catch (_) {}
        try { clearTimeout(s._navTimer); } catch (_) {}
        try { s.rootEl?.remove(); } catch (_) {}
        try { s.shufflerRootEl?.remove(); } catch (_) {}
        this._panelStates.delete(panelId);
    }

    _refreshAll() {
        try {
            this._host?._hydrateProdDayIndex?.();
            this._host?._hydrateProdShuffle?.();
            this._host?._refreshAll?.();
        } catch (_) {}
    }

    // =========================================================================
    // DOM mounting (unused — Dawn Readwise owns footers; kept for prod parity)
    // =========================================================================

    /** Remove Readwise footer wrappers owned by `panelId` from each parent (suite + page). */
    _stripThJournalFooters(panelId, parents) {
        const seen = new Set();
        for (const par of parents) {
            if (!par || seen.has(par)) continue;
            seen.add(par);
            for (const el of par.querySelectorAll(':scope > .th-journal-footer, :scope > .th-shuffler-detached-host')) {
                if (el.dataset?.panelId === panelId) {
                    try { el.remove(); } catch (_) {}
                }
            }
        }
    }

    _ensureDetachedShufflerHost(container, panelId) {
        if (!container || !panelId) return null;
        let host = null;
        for (const el of container.querySelectorAll(':scope > .th-shuffler-detached-host')) {
            if (el.dataset?.panelId === panelId) { host = el; break; }
        }
        if (!host) {
            host = document.createElement('div');
            host.className = 'th-shuffler-detached-host';
            host.dataset.panelId = panelId;
            container.appendChild(host);
        }
        let shell = host.querySelector(':scope > .th-shuffler-detached-shell');
        if (!shell) {
            shell = document.createElement('div');
            shell.className = 'th-shuffler-detached-shell';
            host.appendChild(shell);
        }
        return shell;
    }

    // Returns true if the footer was (re)built — caller should re-populate and drop stale async work
    _mountFooter(state, panelEl, { suiteHi, suiteSh, container }) {
        /*
         * The user's on-page toggles are authoritative. A suite slot only decides *where* a
         * panel mounts — it must not force a panel the user switched off back on.
         */
        const wantHi = this._showHighlightsPanel();
        const wantSh = this._showShufflerPanel();
        if (!wantHi && !wantSh) return false;

        this._shufflerDetached = this._showShufflerDetached();
        // Suite still owns detach when present; otherwise use standalone detached glass.
        const useDetached = !!(wantSh && !suiteSh && container && this._shufflerDetached !== false);
        const hiParent = wantHi ? (suiteHi || container) : null;
        let shParent = wantSh ? (suiteSh || container) : null;
        if (useDetached) {
            shParent = this._ensureDetachedShufflerHost(container, state.panelId);
        }
        const combined = !!(wantHi && wantSh && hiParent && shParent && hiParent === shParent && !useDetached);

        const parents = [...new Set([container, suiteHi, suiteSh].filter(Boolean))];

        let fast = false;
        if (combined) {
            fast = !!(state.rootEl?.isConnected
                && state.rootEl.parentElement === hiParent
                && !state.shufflerRootEl
                && state.rootEl.querySelector('[data-panel-section="highlights"]')
                && state.rootEl.querySelector('[data-panel-section="shuffler"]')
                && state.observer);
        } else if (wantHi && wantSh) {
            fast = !!(state.rootEl?.isConnected
                && state.rootEl.parentElement === hiParent
                && !state.rootEl.querySelector('[data-panel-section="shuffler"]')
                && state.shufflerRootEl?.isConnected
                && state.shufflerRootEl.parentElement === shParent
                && state.observer);
        } else if (wantHi && !wantSh) {
            /*
             * A previously-combined shell holds both sections in `rootEl` with `shufflerRootEl`
             * null, so `!state.shufflerRootEl` alone would wrongly accept it and the shuffler
             * would survive being toggled off. Require the shuffler section to be gone too.
             */
            fast = !!(state.rootEl?.isConnected
                && state.rootEl.parentElement === hiParent
                && !state.shufflerRootEl
                && !state.rootEl.querySelector('[data-panel-section="shuffler"]')
                && state.observer);
        } else if (!wantHi && wantSh) {
            fast = !!(!state.rootEl
                && state.shufflerRootEl?.isConnected
                && state.shufflerRootEl.parentElement === shParent
                && state.observer);
        }
        if (fast) {
            if (!state.observer) {
                state.observer = this._createFooterObserver(state, panelEl, container, {
                    wide: !!(suiteHi || suiteSh),
                });
            }
            if (container) {
                if (state.rootEl?.parentElement === container) this._ensureFooterBottom(state, container);
                if (state.shufflerRootEl?.parentElement === container) this._ensureFooterBottom(state, container);
            }
            return false;
        }

        if (state.observer) {
            try { state.observer.disconnect(); } catch (_) {}
            state.observer = null;
        }
        try {
            if (state._mutObsTimer) clearTimeout(state._mutObsTimer);
        } catch (_) {}
        state._mutObsTimer = null;
        try { clearTimeout(state._navTimer); } catch (_) {}

        this._stripThJournalFooters(state.panelId, parents);

        state.rootEl = null;
        state.shufflerRootEl = null;

        if (combined) {
            state.rootEl = this._buildShell(state, false);
            if (state.rootEl) hiParent.appendChild(state.rootEl);
            this._ensureFooterBottom(state, hiParent);
        } else {
            if (wantHi) {
                let wrap;
                if (suiteHi) {
                    wrap = this._buildShell(state, true);
                } else {
                    wrap = document.createElement('div');
                    wrap.className = 'th-journal-footer';
                    wrap.dataset.panelId = state.panelId;
                    wrap.appendChild(this._buildHighlightsPanel(state));
                }
                if (wrap && wrap.childElementCount) {
                    hiParent.appendChild(wrap);
                    state.rootEl = wrap;
                }
            }
            if (wantSh) {
                const wrapSh = document.createElement('div');
                wrapSh.className = 'th-journal-footer';
                wrapSh.dataset.panelId = state.panelId;
                if (suiteSh) wrapSh.dataset.rwSuiteMount = 'shuffler';
                if (useDetached) wrapSh.dataset.rwDetachedMount = 'shuffler';
                wrapSh.appendChild(this._buildShufflerPanel(state));
                shParent.appendChild(wrapSh);
                if (!wantHi || hiParent !== shParent) state.shufflerRootEl = wrapSh;
                if (useDetached && container) {
                    const host = shParent.parentElement;
                    if (host?.classList?.contains('th-shuffler-detached-host') && host.parentElement === container) {
                        if (container.lastElementChild !== host) container.appendChild(host);
                    }
                }
            }
        }

        state.observer = this._createFooterObserver(state, panelEl, container, {
            wide: !!(suiteHi || suiteSh),
        });
        return true;
    }

    _ensureFooterBottom(state, container) {
        if (!container) return;
        if (state?.rootEl?.parentElement === container && state.rootEl.dataset?.rwSuiteMount !== 'highlights') {
            if (container.lastElementChild !== state.rootEl) container.appendChild(state.rootEl);
        }
        const shRoot = state?.shufflerRootEl;
        if (!shRoot) return;
        const host = shRoot.closest?.('.th-shuffler-detached-host');
        if (host?.parentElement === container) {
            if (container.lastElementChild !== host) container.appendChild(host);
            return;
        }
        if (shRoot.parentElement === container) {
            if (container.lastElementChild !== shRoot) container.appendChild(shRoot);
        }
    }

    /**
     * When footers mount under `.page-content` only (`wide:false`), observe that node with `subtree:false`
     * so header / editor mutations do not fire this observer. JFS mounts (`suiteHi` / `suiteSh`) still use
     * the full panel (wide) so we do not miss suite DOM.
     */
    _createFooterObserver(state, panelEl, containerEl, opts) {
        const wide = !!(opts && opts.wide);
        const obsRoot = wide
            ? panelEl
            : (containerEl && typeof containerEl.nodeType === 'number' && containerEl.nodeType === 1
                ? containerEl
                : panelEl);
        const narrow = !wide && obsRoot === containerEl && !!containerEl;
        const flush = () => {
            const lostHi = state.rootEl && !state.rootEl.isConnected;
            const lostSh = state.shufflerRootEl && !state.shufflerRootEl.isConnected;
            if (lostHi || lostSh) {
                try { clearTimeout(state._navTimer); } catch (_) {}
                state._navTimer = setTimeout(() => {
                    const stillLost = (state.rootEl && !state.rootEl.isConnected)
                        || (state.shufflerRootEl && !state.shufflerRootEl.isConnected);
                    if (state.panel && stillLost) this._deferHandlePanel(state.panel);
                }, 800);
            }
            const container = this._findContainer(panelEl);
            if (container) {
                if (state.rootEl?.parentElement === container && state.rootEl.dataset?.rwSuiteMount !== 'highlights') {
                    this._ensureFooterBottom(state, container);
                }
                if (state.shufflerRootEl?.parentElement === container) {
                    this._ensureFooterBottom(state, container);
                }
            }
        };
        const obs = new MutationObserver(() => {
            try {
                if (state._mutObsTimer) clearTimeout(state._mutObsTimer);
            } catch (_) {}
            state._mutObsTimer = setTimeout(() => {
                state._mutObsTimer = null;
                try {
                    flush();
                } catch (_) {}
            }, RWR_MUTATION_OBS_DEBOUNCE_MS);
        });
        try {
            obs.observe(obsRoot, narrow ? { childList: true, subtree: false } : { childList: true, subtree: true });
        } catch (_) {
            try {
                obs.observe(panelEl, { childList: true, subtree: true });
            } catch (_) {}
        }
        return obs;
    }

    /** Prefer the last matching node — after journal navigation Thymer may leave multiple layers; first match can be stale. */
    _findContainer(panelEl) {
        if (!panelEl) return null;
        for (const sel of ['.page-content', '.editor-wrapper', '.editor-panel', '#editor']) {
            if (panelEl.matches?.(sel)) return panelEl;
            const all = panelEl.querySelectorAll?.(sel);
            if (all && all.length) return all[all.length - 1];
        }
        return null;
    }

    /**
     * Wrapper for one or more journal footer cards (highlights + quote shuffler).
     * @param {boolean} suiteHighlightsOnly — Journal Footer Suite: mount only highlights into `.jfs-body`.
     */
    _buildShell(state, suiteHighlightsOnly) {
        const root = document.createElement('div');
        root.className       = 'th-journal-footer';
        root.dataset.panelId = state.panelId;

        if (suiteHighlightsOnly) {
            root.dataset.rwSuiteMount = 'highlights';
            root.appendChild(this._buildHighlightsPanel(state));
            return root.childElementCount ? root : null;
        }

        if (this._showHighlightsPanel()) {
            root.appendChild(this._buildHighlightsPanel(state));
        }
        if (this._showShufflerPanel()) {
            root.appendChild(this._buildShufflerPanel(state));
        }
        if (!root.childElementCount) return null;
        return root;
    }

    _buildHighlightsPanel(state) {
        const root = document.createElement('div');
        root.className              = 'th-footer th-footer--highlights th-footer--native';
        root.dataset.panelSection   = 'highlights';

        const header = document.createElement('div');
        header.className = 'th-header th-header--native';

        const headerMain = document.createElement('div');
        headerMain.className = 'th-header-main';

        const toggle = document.createElement('button');
        toggle.className   = 'th-toggle th-summary-pill button-none button-small button-minimal-hover';
        toggle.type        = 'button';
        toggle.title       = 'Collapse / expand';

        const icon = document.createElement('span');
        icon.className = 'th-title-icon';
        this._rwrAppendSvgIcon(icon, 'books', 15);

        const titleEl = document.createElement('div');
        titleEl.className   = 'th-title';
        titleEl.textContent = 'highlights';

        const countEl = document.createElement('div');
        countEl.className    = 'th-count';
        countEl.dataset.role = 'count';

        const caret = this._rwrBuildChevron(!this._collapsed, 'th-toggle-caret');

        toggle.appendChild(icon);
        toggle.appendChild(titleEl);
        toggle.appendChild(countEl);
        toggle.appendChild(caret);

        const actions = document.createElement('div');
        actions.className = 'th-header-actions th-header-controls';
        const quoteBtn = document.createElement('button');
        quoteBtn.type = 'button';
        quoteBtn.className = 'th-action th-hover-action th-quote-toggle button-none button-small button-minimal-hover';
        quoteBtn.title = this._showShufflerPanel() ? 'Hide Quote Shuffler' : 'Show Quote Shuffler';
        quoteBtn.setAttribute('aria-label', quoteBtn.title);
        quoteBtn.classList.toggle('is-active', this._showShufflerPanel());
        this._rwrAppendSvgIcon(quoteBtn, 'quote', 15);
        quoteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleShowShufflerPanel();
        });
        actions.appendChild(quoteBtn);

        const cogBtn = document.createElement('button');
        cogBtn.type = 'button';
        cogBtn.className = 'th-action th-hover-action th-settings-cog button-none button-small button-minimal-hover';
        cogBtn.title = 'Highlights settings';
        cogBtn.setAttribute('aria-label', cogBtn.title);
        this._rwrAppendSvgIcon(cogBtn, 'cog', 15);
        cogBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this._openHighlightsSettingsMenu(cogBtn);
        });
        actions.appendChild(cogBtn);

        headerMain.appendChild(toggle);
        header.appendChild(headerMain);
        header.appendChild(actions);

        const body = document.createElement('div');
        body.dataset.role  = 'body';
        body.className     = 'th-body th-body--native';
        body.style.display = this._collapsed ? 'none' : 'block';

        const syncChrome = () => {
            this._rwrSyncChevron(caret, !this._collapsed);
            body.style.display = this._collapsed ? 'none' : 'block';
            root.classList.toggle('th-footer--collapsed', !!this._collapsed);
        };
        syncChrome();

        toggle.addEventListener('click', () => {
            this._collapsed = !this._collapsed;
            this._saveBool('th_footer_collapsed', this._collapsed);
            syncChrome();
            if (!this._collapsed && !state.highlightsDataLoaded) {
                void this._populate(state);
            }
        });

        root.appendChild(header);
        root.appendChild(body);
        return root;
    }

    /** Small popup anchored under the highlights settings cog. */
    _openHighlightsSettingsMenu(anchorEl) {
        const existing = document.getElementById('th-hl-settings-menu');
        if (existing) {
            existing.remove();
            if (existing.dataset.anchorOpen === '1') return;
        }

        const menu = document.createElement('div');
        menu.id = 'th-hl-settings-menu';
        menu.className = 'th-menu';
        menu.dataset.anchorOpen = '1';

        const close = () => {
            try { menu.remove(); } catch (_) {}
            document.removeEventListener('mousedown', onDocDown, true);
            document.removeEventListener('keydown', onKey, true);
        };
        const onDocDown = (e) => {
            if (menu.contains(e.target)) return;
            if (anchorEl?.contains?.(e.target)) return;
            close();
        };
        const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };

        const addItem = (label, checked, onClick) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'th-menu-item button-none';
            const mark = document.createElement('span');
            mark.className = 'th-menu-check';
            mark.textContent = checked === true ? '✓' : '';
            const txt = document.createElement('span');
            txt.className = 'th-menu-label';
            txt.textContent = label;
            btn.appendChild(mark);
            btn.appendChild(txt);
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                close();
                onClick();
            });
            menu.appendChild(btn);
            return btn;
        };
        const addSep = () => {
            const sep = document.createElement('div');
            sep.className = 'th-menu-sep';
            menu.appendChild(sep);
        };

        addItem('Quote Shuffler', this._showShufflerPanel(), () => this._toggleShowShufflerPanel());
        addItem('Shuffler in its own glass frame', this._showShufflerDetached(), () => this._toggleShufflerDetached());
        addSep();
        addItem('Sync Readwise now', undefined, () => { void this._runSync(false); });
        addItem('Rebuild highlights index', undefined, () => { void this._rebuildDayIndexFromBodies(); });
        addSep();
        addItem("Hide today's highlights", undefined, () => this._toggleShowHighlightsPanel());

        document.body.appendChild(menu);
        try {
            const r = anchorEl.getBoundingClientRect();
            const w = menu.offsetWidth || 220;
            const left = Math.max(8, Math.min(window.innerWidth - w - 8, Math.round(r.right - w)));
            const top = Math.round(r.bottom + 6);
            menu.style.left = left + 'px';
            menu.style.top = top + 'px';
        } catch (_) {}

        setTimeout(() => {
            document.addEventListener('mousedown', onDocDown, true);
            document.addEventListener('keydown', onKey, true);
        }, 0);
    }

    /** Collapse/expand chrome + body for `.th-shuffler-shell` (Quote Shuffler). */
    _syncShufflerShellLayout(shufflerRoot) {
        if (!shufflerRoot?.classList?.contains?.('th-shuffler-shell')) return;
        const c = !!this._shufflerCollapsed;
        shufflerRoot.classList.toggle('th-shuffler-is-collapsed', c);
        const toggle = shufflerRoot.querySelector('.th-shuffler-chrome .th-toggle');
        const bodyEl = shufflerRoot.querySelector('.th-shuffler-body');
        if (toggle) toggle.textContent = c ? '+' : '−';
        if (bodyEl) bodyEl.style.display = c ? 'none' : 'block';
    }

    /** Hover-reveal collapse control (matches journal-header-suite random-memory row). */
    _appendShufflerCollapseMini(leftContentEl, bodyEl) {
        const topActions = document.createElement('div');
        topActions.className = 'th-shuffler-top-actions';
        const collapseMiniBtn = document.createElement('button');
        collapseMiniBtn.type = 'button';
        collapseMiniBtn.className = 'th-shuffler-collapse-mini button-none';
        const inSuite = !!bodyEl.closest('[data-rw-suite-mount="shuffler"]');
        const isDetached = !!bodyEl.closest('[data-rw-detached-mount="shuffler"]') || this._showShufflerDetached();
        collapseMiniBtn.title = (inSuite || isDetached)
            ? 'Hide Quote Shuffler'
            : 'Collapse Quote Shuffler';
        collapseMiniBtn.innerHTML = '<i class="ti ti-chevron-up" aria-hidden="true"></i>';
        collapseMiniBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (inSuite && typeof globalThis.__thymerJfsCloseQuoteShufflerDock === 'function') {
                globalThis.__thymerJfsCloseQuoteShufflerDock();
                return;
            }
            if (isDetached) {
                if (this._showShufflerPanel()) this._toggleShowShufflerPanel();
                return;
            }
            const shell = bodyEl.closest('.th-shuffler-shell');
            if (!shell) return;
            this._shufflerCollapsed = true;
            this._saveBool(TH_KEY_SHUFFLER_COLLAPSED, true);
            this._syncShufflerShellLayout(shell);
        });
        const hoverZone = document.createElement('div');
        hoverZone.className = 'th-shuffler-quote-hover-zone';
        hoverZone.appendChild(collapseMiniBtn);
        hoverZone.appendChild(leftContentEl);
        topActions.appendChild(hoverZone);
        return topActions;
    }

    _buildShufflerPanel(state) {
        const root = document.createElement('div');
        root.className            = 'th-footer th-footer--shuffler th-shuffler-shell';
        root.dataset.panelSection = 'shuffler';

        const chrome = document.createElement('div');
        chrome.className = 'th-shuffler-chrome';
        chrome.dataset.role = 'sh-chrome';

        const toggle = document.createElement('button');
        toggle.className = 'th-toggle button-none button-small button-minimal-hover';
        toggle.type = 'button';
        toggle.title = 'Collapse / expand';
        toggle.textContent = this._shufflerCollapsed ? '+' : '−';

        const titleIcon = document.createElement('span');
        titleIcon.className = 'th-title-icon th-shuffler-title-icon';
        this._rwrAppendSvgIcon(titleIcon, 'quotes', 15);

        const titleEl = document.createElement('div');
        titleEl.className = 'th-title th-shuffler-panel-title';
        titleEl.textContent = 'Quote Shuffler';

        chrome.appendChild(toggle);
        chrome.appendChild(titleIcon);
        chrome.appendChild(titleEl);

        const body = document.createElement('div');
        body.dataset.role = 'body';
        body.className = 'th-body th-shuffler-body';
        body.style.display = this._shufflerCollapsed ? 'none' : 'block';

        toggle.addEventListener('click', () => {
            this._shufflerCollapsed = !this._shufflerCollapsed;
            this._saveBool(TH_KEY_SHUFFLER_COLLAPSED, this._shufflerCollapsed);
            this._syncShufflerShellLayout(root);
            if (!this._shufflerCollapsed && !state.shufflerDataLoaded) {
                void this._populate(state);
            }
        });
        this._syncShufflerShellLayout(root);

        root.appendChild(chrome);
        root.appendChild(body);
        return root;
    }

    // =========================================================================
    // Data & rendering
    // =========================================================================

    /** Let Thymer paint journal chrome (e.g. Journal Header Suite) before References I/O. */
    async _yieldForJournalPaint() {
        await new Promise((r) => {
            try {
                requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)));
            } catch (_) {
                setTimeout(r, 0);
            }
        });
        try {
            if (typeof requestIdleCallback === 'function') {
                await new Promise((r) => requestIdleCallback(() => r(), { timeout: 500 }));
            }
        } catch (_) {}
    }

    async _populate(state) {
        if (state.loading) {
            state._pendingPopulate = true;
            return;
        }
        state.loading = true;
        /* Footers use local caches; don't block paint on Path B vault init. */
        void this._rwEnsurePathBReady();
        if (typeof state.populateSeq !== 'number') state.populateSeq = 0;
        const seq = ++state.populateSeq;

        const targetJournal = state.journalDate;
        const targetGuid    = state.recordGuid;

        const hiBody  = state.rootEl?.querySelector('[data-panel-section="highlights"] [data-role="body"]');
        const hiCount = state.rootEl?.querySelector('[data-panel-section="highlights"] [data-role="count"]');
        const shBody  = (state.shufflerRootEl || state.rootEl)?.querySelector('[data-panel-section="shuffler"] [data-role="body"]');

        const targetHiRoot = hiBody ? state.rootEl : null;
        const targetShRoot = shBody ? (state.shufflerRootEl || state.rootEl) : null;

        if (!hiBody && !shBody) {
            state.loaded = true;
            state.loading = false;
            this._flushPendingPopulate(state);
            return;
        }

        const wantHiLoad = !!(hiBody && !this._collapsed);
        const wantShLoad = !!(shBody && !this._shufflerCollapsed);
        const syncBusy = !!this._syncing;
        const indexBusy = !!this._dayIndexRebuilding;

        if (hiBody && !wantHiLoad) {
            hiBody.innerHTML = '<div class="th-empty th-empty--lazy">Expand to load highlights.</div>';
            if (hiCount) hiCount.textContent = '';
        } else if (hiBody && syncBusy) {
            hiBody.innerHTML = '<div class="th-empty">Syncing Readwise…</div>';
            if (hiCount) hiCount.textContent = '';
        } else if (hiBody && indexBusy) {
            hiBody.innerHTML = '<div class="th-empty">Building highlights index…</div>';
            if (hiCount) hiCount.textContent = '';
        } else if (hiBody) {
            hiBody.innerHTML = '<div class="th-loading">Loading highlights…</div>';
        }
        if (shBody && !wantShLoad) {
            shBody.innerHTML = '<div class="th-empty th-empty--lazy">Expand to load quote.</div>';
        } else if (shBody && syncBusy) {
            /* Sticky day pick is fine during sync; pool rebuild is not. */
        } else if (shBody) {
            shBody.innerHTML = '<div class="th-loading">Loading quote…</div>';
        }

        try {
            await this._yieldForJournalPaint();
            const jobs = [];
            /* Index rebuild must not block footer populate the way API `_syncing` does. */
            if (wantHiLoad && !syncBusy && !indexBusy) {
                jobs.push(this._populateHighlightsSection(
                    state, hiBody, hiCount, targetJournal, targetHiRoot, targetShRoot, targetGuid, seq));
            }
            if (wantShLoad) {
                jobs.push(this._populateShufflerSection(
                    state, shBody, targetJournal, targetHiRoot, targetShRoot, targetGuid, seq));
            }
            if (jobs.length) await Promise.all(jobs);

            if (!this._isPopulateStillCurrent(state, seq, targetJournal, targetHiRoot, targetShRoot, targetGuid)) {
                state.loading = false;
                this._flushPendingPopulate(state);
                return;
            }

            state.loaded = true;
        } catch (e) {
            console.error('[ReadwiseRef|TH]', e);
            if (this._isPopulateStillCurrent(state, seq, targetJournal, targetHiRoot, targetShRoot, targetGuid)) {
                if (hiBody) {
                    hiBody.innerHTML = '<div class="th-empty">Error loading highlights.</div>';
                }
                if (shBody) {
                    shBody.innerHTML = '<div class="th-empty">Error loading quote.</div>';
                }
            }
        }

        state.loading = false;
        this._flushPendingPopulate(state);
    }

    async _populateHighlightsSection(state, bodyEl, countEl, targetJournal, targetHiRoot, targetShRoot, targetGuid, seq) {
        const reportHi = (msg) => {
            if (!this._isPopulateStillCurrent(state, seq, targetJournal, targetHiRoot, targetShRoot, targetGuid)) return;
            const el = bodyEl.querySelector('.th-loading');
            if (el) el.textContent = msg;
        };
        const highlights = await this._getHighlightsForDate(targetJournal, reportHi);
        if (!this._isPopulateStillCurrent(state, seq, targetJournal, targetHiRoot, targetShRoot, targetGuid)) return;

        bodyEl.innerHTML = '';

        if (highlights.length === 0) {
            bodyEl.innerHTML = '<div class="th-empty">No highlights for this day.</div>';
            if (countEl) countEl.textContent = '0';
        } else {
            if (countEl) countEl.textContent = String(highlights.length);

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
        state.highlightsDataLoaded = true;
    }

    async _populateShufflerSection(state, shBody, targetJournal, targetHiRoot, targetShRoot, targetGuid, seq) {
        /* Prefer sticky day pick — no library scan. Pool warms only on draw/reshuffle. */
        const saved = this._loadDayShufflePick(targetJournal);
        if (saved && saved.guid && String(saved.text || '').trim()) {
            if (!this._isPopulateStillCurrent(state, seq, targetJournal, targetHiRoot, targetShRoot, targetGuid)) return;
            const pick = this._pickFromStored(saved);
            this._renderShufflerQuoteCard(state, shBody, pick, targetJournal);
            state.shufflerDataLoaded = true;
            return;
        }
        if (!this._isPopulateStillCurrent(state, seq, targetJournal, targetHiRoot, targetShRoot, targetGuid)) return;
        this._renderShufflerIdle(state, shBody, targetJournal);
        state.shufflerDataLoaded = true;
    }

    _getShufflerDayMap() {
        try {
            const raw = localStorage.getItem(TH_KEY_SHUFFLER_QUOTES_BY_DAY);
            if (!raw || !String(raw).trim()) return {};
            const o = JSON.parse(raw);
            return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
        } catch (_) {
            return {};
        }
    }

    _saveShufflerDayMap(map) {
        try {
            localStorage.setItem(TH_KEY_SHUFFLER_QUOTES_BY_DAY, JSON.stringify(map));
        } catch (_) {}
        this._scheduleShufflerDayMapPathBSync();
    }

    _scheduleShufflerDayMapPathBSync() {
        if (this._pluginSettingsSyncMode !== 'synced') return;
        if (this._shufflerDayMapSyncTimer) {
            try { clearTimeout(this._shufflerDayMapSyncTimer); } catch (_) {}
        }
        this._shufflerDayMapSyncTimer = setTimeout(() => {
            this._shufflerDayMapSyncTimer = null;
            const ps = globalThis.ThymerPluginSettings;
            if (!ps?.flushNow || !this.data || !this._pluginSettingsPluginId) return;
            ps.flushNow(this.data, this._pluginSettingsPluginId, this._pathBMirrorKeys()).catch(() => {});
        }, TH_SHUFFLER_DAYMAP_SYNC_IDLE_MS);
    }

    _loadDayShufflePick(yyyymmdd) {
        if (!yyyymmdd) return null;
        const m = this._getShufflerDayMap();
        const v = m[yyyymmdd];
        if (!v || typeof v !== 'object') return null;
        return v;
    }

    _persistDayShufflePick(yyyymmdd, pick) {
        if (!yyyymmdd || !pick) return;
        const map = this._getShufflerDayMap();
        map[yyyymmdd] = {
            sig:            pick._sig || this._shuffleSignature(pick),
            guid:           pick.guid,
            text:           pick.text || '',
            note:           pick.note || '',
            location:       pick.location || '',
            source_title:   pick.source_title || '',
            source_author:  pick.source_author || '',
        };
        const keys = Object.keys(map).sort();
        if (keys.length > 420) {
            for (const k of keys.slice(0, keys.length - 400)) {
                try { delete map[k]; } catch (_) {}
            }
        }
        this._saveShufflerDayMap(map);
    }

    _pickFromStored(stored) {
        return {
            guid:          stored.guid,
            text:          stored.text || '',
            note:          stored.note || '',
            location:      stored.location || '',
            source_title:  stored.source_title || '',
            source_author: stored.source_author || '',
            _sig:          stored.sig || this._shuffleSignatureFromParts(stored.guid, stored.text),
        };
    }

    /** How many leading characters of `a` and `b` match (byte-for-byte). */
    _lcpPrefixMatchLen(a, b) {
        const sa = String(a || '');
        const sb = String(b || '');
        const n = Math.min(sa.length, sb.length);
        let i = 0;
        while (i < n && sa.charCodeAt(i) === sb.charCodeAt(i)) i++;
        return i;
    }

    /** Replace truncated per-day fields when the shuffle pool has a longer row (same guid + sig, prefix, or near-prefix). */
    _mergeShufflePickWithPool(pick, pool) {
        if (!pick?.guid || !Array.isArray(pool) || !pool.length) return pick;
        const pt = String(pick.text || '');
        let row = pool.find(c => c && c.guid === pick.guid && c._sig === pick._sig);
        if (!row && pt) {
            const strict = pool.filter(c => {
                if (!c || c.guid !== pick.guid) return false;
                const ct = String(c.text || '');
                return ct.length > pt.length && ct.startsWith(pt);
            });
            if (strict.length) {
                row = strict.reduce((a, b) =>
                    (String(a.text || '').length >= String(b.text || '').length ? a : b));
            }
        }
        if (!row && pt.length >= 32) {
            const tailSlack = Math.max(36, Math.floor(pt.length * 0.06));
            const minLcp = Math.max(32, pt.length - tailSlack);
            let best = null;
            let bestLen = 0;
            for (const c of pool) {
                if (!c || c.guid !== pick.guid) continue;
                const ct = String(c.text || '');
                if (ct.length <= pt.length + 3) continue;
                const lcp = this._lcpPrefixMatchLen(pt, ct);
                if (lcp >= minLcp) {
                    if (ct.length > bestLen) {
                        best = c;
                        bestLen = ct.length;
                    }
                }
            }
            row = best;
        }
        if (!row) return pick;
        let changed = false;
        const out = { ...pick };
        const takeLonger = (a, b) => {
            const sa = String(a || '');
            const sb = String(b || '');
            if (sb.length > sa.length) { changed = true; return sb; }
            return sa;
        };
        out.text = takeLonger(out.text, row.text);
        out.note = takeLonger(out.note, row.note);
        out.location = takeLonger(out.location, row.location);
        out.source_title = takeLonger(out.source_title, row.source_title);
        out.source_author = takeLonger(out.source_author, row.source_author);
        if (changed) out._sig = row._sig || this._shuffleSignature(out);
        return changed ? out : pick;
    }

    _renderShufflerIdle(state, bodyEl, journalDate) {
        bodyEl.innerHTML = '';
        const idle = document.createElement('div');
        idle.className = 'th-shuffler-idle th-shuffler-idle--bare';

        const iconBtn = document.createElement('button');
        iconBtn.type = 'button';
        iconBtn.className = 'th-shuffler-draw-btn button-none button-small button-minimal-hover';
        iconBtn.title = 'Draw a random quote for this day';
        this._rwrAppendSvgIcon(iconBtn, 'quote', 28);
        iconBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            void this._drawRandomQuoteForDay(state, bodyEl, journalDate, true);
        });

        const cap = document.createElement('div');
        cap.className = 'th-shuffler-idle-caption';
        cap.textContent = 'Draw a quote for this day';

        idle.appendChild(this._appendShufflerCollapseMini(iconBtn, bodyEl));
        idle.appendChild(cap);
        bodyEl.appendChild(idle);
    }

    /**
     * @param {boolean} forceNew — true: new random (first draw or reshuffle). Avoids repeating the same quote for that day when possible.
     */
    async _drawRandomQuoteForDay(state, bodyEl, journalDate, forceNew) {
        let pool;
        try {
            pool = await this._getQuoteShufflePoolFromReferences();
        } catch (e) {
            console.error('[ReadwiseRef|Shuffle]', e);
            bodyEl.innerHTML = '<div class="th-empty">Could not load quotes.</div>';
            return;
        }

        if (!(state.shufflerRootEl || state.rootEl)?.isConnected) return;

        if (!pool.length) {
            bodyEl.innerHTML = '<div class="th-empty">No highlights in References yet.</div>';
            return;
        }

        let avoidSig = '';
        if (forceNew) {
            const cur = this._loadDayShufflePick(journalDate);
            if (cur && cur.sig) avoidSig = cur.sig;
        }

        const picked = this._pickRandomShuffleCandidate(pool, avoidSig);
        if (!picked) {
            bodyEl.innerHTML = '<div class="th-empty">No quote available.</div>';
            return;
        }

        this._persistDayShufflePick(journalDate, picked);
        this._renderShufflerQuoteCard(state, bodyEl, picked, journalDate);
    }

    _renderShufflerQuoteCard(state, bodyEl, picked, journalDate) {
        bodyEl.innerHTML = '';
        const view = document.createElement('div');
        view.className = 'th-shuffler-quote-view';

        const body = document.createElement('div');
        body.className = 'th-shuffler-quote-body';

        const markWrap = document.createElement('div');
        markWrap.className = 'th-shuffler-quote-mark';
        markWrap.setAttribute('aria-hidden', 'true');
        this._rwrAppendSvgIcon(markWrap, 'quote', 22);

        const quoteEl = document.createElement('div');
        quoteEl.className = 'th-shuffler-quote-display';
        quoteEl.textContent = picked.text || '';

        const markRow = this._appendShufflerCollapseMini(markWrap, bodyEl);
        markRow.classList.add('th-shuffler-quote-mark-row');
        body.appendChild(markRow);
        body.appendChild(quoteEl);

        const hasMeta = (picked.source_title && String(picked.source_title).trim())
            || (picked.source_author && String(picked.source_author).trim() && !this._rwrLooksLikeOpaqueId(picked.source_author))
            || (picked.note && String(picked.note).trim())
            || (picked.location && String(picked.location).trim());
        if (hasMeta) {
            const divider = document.createElement('div');
            divider.className = 'th-shuffler-ritual-divider';
            body.appendChild(divider);
        }

        if (picked.source_title && String(picked.source_title).trim()) {
            const src = document.createElement('div');
            src.className = 'th-shuffler-source';
            src.textContent = picked.source_title;
            body.appendChild(src);
        }
        if (picked.source_author && String(picked.source_author).trim() && !this._rwrLooksLikeOpaqueId(picked.source_author)) {
            const auth = document.createElement('div');
            auth.className = 'th-shuffler-author';
            auth.textContent = picked.source_author;
            body.appendChild(auth);
        }
        if (picked.note && String(picked.note).trim()) {
            const noteEl = document.createElement('div');
            noteEl.className = 'th-shuffler-note';
            noteEl.textContent = picked.note;
            body.appendChild(noteEl);
        }
        if (picked.location && String(picked.location).trim()) {
            const loc = document.createElement('div');
            loc.className = 'th-shuffler-loc';
            const locStr = String(picked.location).trim();
            if (/^https?:\/\//i.test(locStr)) {
                const a = document.createElement('a');
                a.href = locStr;
                a.textContent = locStr;
                a.rel = 'noopener noreferrer';
                a.target = '_blank';
                a.className = 'th-shuffler-loc-link';
                a.addEventListener('click', (e) => e.stopPropagation());
                loc.appendChild(a);
            } else {
                loc.textContent = locStr;
            }
            body.appendChild(loc);
        }

        const reshuffleWrap = document.createElement('div');
        reshuffleWrap.className = 'th-shuffler-quote-reshuffle-wrap';
        const reshuffle = document.createElement('button');
        reshuffle.type = 'button';
        reshuffle.className = 'th-shuffler-quote-reshuffle button-none button-small button-minimal-hover';
        reshuffle.title = 'Another random quote for this day';
        this._rwrAppendSvgIcon(reshuffle, 'shuffle', 14);
        reshuffle.addEventListener('click', (e) => {
            e.stopPropagation();
            void this._drawRandomQuoteForDay(state, bodyEl, journalDate, true);
        });
        reshuffleWrap.appendChild(reshuffle);
        body.appendChild(reshuffleWrap);

        body.addEventListener('click', (e) => {
            if (!picked.guid) return;
            void this._openRecord(state.panel, picked.guid, null, e);
        });

        view.appendChild(body);
        bodyEl.appendChild(view);
    }

    _shuffleSignatureFromParts(guid, text) {
        return (guid || '') + '\0' + String(text || '').slice(0, 280);
    }

    _shuffleSignature(h) {
        return this._shuffleSignatureFromParts(h.guid, h.text);
    }

    /**
     * All highlight quotes under a Reference body (every day under ❣️ Highlights), for shuffle pool.
     */
    async _extractAllHighlightsFromReferenceBody(record) {
        let items;
        try { items = await record.getLineItems(); } catch (_) { return []; }
        if (!items || !items.length) return [];

        const ordered = this._buildRecordDocumentOrder(record, items);
        const recId = record.guid;

        const roots = this._childrenInDocOrder(ordered, recId, recId);
        let sectionLine = null;
        for (const line of roots) {
            const plain = await this._linePlainText(line);
            if (this._isHighlightsSectionHeader(plain)) {
                sectionLine = line;
                break;
            }
        }
        if (!sectionLine) return [];

        const out = [];
        const dateBlocks = this._childrenInDocOrder(ordered, recId, sectionLine.guid);
        for (const dateLine of dateBlocks) {
            if (dateLine?.type === 'br') continue;
            const plainLo = (await this._linePlainText(dateLine)).trim();
            if (!plainLo) continue;
            if (plainLo === READWISE_REF_BETWEEN_DATE_DIVIDER_TEXT) continue;

            const merged = await this._mergeQuoteLinesUnderDateGroup(record, ordered, recId, dateLine);
            for (const row of merged) {
                out.push({ text: row.text, note: row.note, loc: row.loc });
            }
        }
        return out;
    }

    async _getQuoteShufflePoolFromReferences() {
        if (Array.isArray(this._quotePoolCache) && this._quotePoolCache.length) {
            if (this._isQuotePoolCacheStale()) void this._warmQuotePoolCache();
            return this._quotePoolCache;
        }
        if (this._quotePoolBuildingPromise) return this._quotePoolBuildingPromise;

        this._quotePoolBuildingPromise = this._rebuildQuoteShufflePoolFromReferences({ persist: true })
            .finally(() => { this._quotePoolBuildingPromise = null; });
        return this._quotePoolBuildingPromise;
    }

    async _rebuildQuoteShufflePoolFromReferences({ persist, onProgress }) {
        await this._ensureRwCollections();
        const refsColl = this._rwRefsColl;
        if (!refsColl) {
            this._quotePoolCache = [];
            this._quotePoolCacheSavedAt = Date.now();
            return this._quotePoolCache;
        }

        let records;
        try { records = await refsColl.getAllRecords(); }
        catch (_) {
            this._quotePoolCache = [];
            this._quotePoolCacheSavedAt = Date.now();
            return this._quotePoolCache;
        }

        const results = [];
        const total = records.length;
        for (let i = 0; i < records.length; i += TH_SHUFFLER_POOL_CONCURRENCY) {
            const chunk = records.slice(i, i + TH_SHUFFLER_POOL_CONCURRENCY);
            if (onProgress) {
                const upto = Math.min(i + chunk.length, total);
                try { onProgress(`Scanning quote library… ${upto}/${total}`); } catch (_) {}
            }
            const parsed = await Promise.all(chunk.map((record) =>
                this._extractAllHighlightsFromReferenceBody(record)));
            for (let j = 0; j < chunk.length; j++) {
                const record = chunk[j];
                for (const row of parsed[j]) {
                    const category = this._readwiseSourceCategoryLabel(record);
                    const guid = record.guid;
                    results.push({
                        guid,
                        record,
                        text:          row.text,
                        note:          row.note || '',
                        source_title:  this._sourceTitleLabel(record),
                        source_author: this._authorLabel(record),
                        location:      row.loc || '',
                        category,
                        _sig: this._shuffleSignatureFromParts(guid, row.text),
                    });
                }
            }
            await this._sleep(0);
        }

        this._quotePoolCache = results;
        this._quotePoolCacheSavedAt = Date.now();
        if (persist) this._persistQuotePoolCache(results);
        return results;
    }

    _pickRandomShuffleCandidate(pool, avoidSig) {
        if (!pool || pool.length === 0) return null;
        if (pool.length === 1) return pool[0];
        const avoid = (avoidSig && String(avoidSig).trim()) ? String(avoidSig) : '';
        for (let tries = 0; tries < 12; tries++) {
            const idx = Math.floor(Math.random() * pool.length);
            const c = pool[idx];
            if (!avoid || c._sig !== avoid) return c;
        }
        return pool[Math.floor(Math.random() * pool.length)];
    }

    _flushPendingPopulate(state) {
        if (state._pendingPopulate) {
            state._pendingPopulate = false;
            this._populate(state);
        }
    }

    /** References collection takes precedence when present (Readwise References Option B). */
    async _getHighlightsForDate(yyyymmdd, onProgress) {
        /* Memory / day-index hits — no collection I/O. */
        const hit = this._thRefQueryCache?.get(yyyymmdd);
        if (hit) return hit;
        const indexedEarly = this._dayIndexLookup(yyyymmdd);
        if (indexedEarly) {
            try { this._thRefQueryCache.set(yyyymmdd, indexedEarly); } catch (_) {}
            return indexedEarly;
        }

        /*
         * Mobile + incomplete index: do not touch References / Path B on the navigation path.
         * (Previously `_ensureRwCollections()` ran first and could stall day changes for minutes.)
         */
        const coarse = rwrPreferDeferredHeavyWork() || this._rwPreferSlowStart();
        if (coarse && !this._highlightsDayIndex?.complete) {
            void this._rwEnsurePathBReady();
            if (onProgress) {
                try {
                    onProgress(
                        this._dayIndexEntryCount() > 0
                            ? 'No highlights for this day.'
                            : 'Highlights index not on this device.'
                    );
                } catch (_) {}
            }
            if (this._dayIndexEntryCount() === 0) this._notifyDayIndexMissingOnce();
            const empty = [];
            try { this._thRefQueryCache.set(yyyymmdd, empty); } catch (_) {}
            return empty;
        }

        await this._ensureRwCollections();
        if (this._rwRefsColl) {
            return await this._getHighlightsFromReferencesForDate(yyyymmdd, onProgress);
        }
        return await this._getHighlightsFromHighlightsCollection(yyyymmdd, onProgress);
    }

    /**
     * Prefers the sync-maintained day index (O(day)); falls back to full vault scan when missing.
     * Desktop with a warm index returns on the first lookup and never waits.
     * Mobile (coarse): never block journal navigation on Path B hydrate / rebuild / body scan —
     * kick Path B in the background and return empty until the index is present.
     */
    async _getHighlightsFromReferencesForDate(yyyymmdd, onProgress) {
        const hit = this._thRefQueryCache?.get(yyyymmdd);
        if (hit) return hit;

        let indexed = this._dayIndexLookup(yyyymmdd);
        if (indexed) {
            try { this._thRefQueryCache.set(yyyymmdd, indexed); } catch (_) {}
            return indexed;
        }

        const coarse = rwrPreferDeferredHeavyWork() || this._rwPreferSlowStart();
        const incomplete = !this._highlightsDayIndex?.complete;

        /*
         * Coarse + incomplete: return immediately. Do NOT await Path B here — that was starving
         * the journal editor for minutes on every day change while chrome showed "No highlights…".
         */
        if (coarse && incomplete) {
            void this._rwEnsurePathBReady();
            if (onProgress) {
                try {
                    onProgress(
                        this._dayIndexEntryCount() > 0
                            ? 'No highlights for this day.'
                            : 'Highlights index not on this device.'
                    );
                } catch (_) {}
            }
            if (this._dayIndexEntryCount() === 0) this._notifyDayIndexMissingOnce();
            const empty = [];
            try { this._thRefQueryCache.set(yyyymmdd, empty); } catch (_) {}
            return empty;
        }

        /* Desktop / fine pointer: pull Path B vault mirror before an expensive body scan. */
        const needRemoteIndex = this._dayIndexEntryCount() === 0 || incomplete;
        if (needRemoteIndex && !this._rwPathBReadyDone) {
            if (onProgress) {
                try { onProgress('Syncing highlights index…'); } catch (_) {}
            }
            await this._rwAwaitPathBReady({ urgent: true });
            try { this._rehydrateDayIndexAfterPathB(); } catch (_) {}
            indexed = this._dayIndexLookup(yyyymmdd);
            if (indexed) {
                try { this._thRefQueryCache.set(yyyymmdd, indexed); } catch (_) {}
                return indexed;
            }
        }

        /* During API sync, never full-scan bodies — compete with writers and freeze the UI. */
        if (this._syncing) {
            if (onProgress) {
                try { onProgress('Syncing Readwise…'); } catch (_) {}
            }
            return [];
        }

        if (this._dayIndexRebuilding) {
            if (onProgress) {
                try { onProgress('Building highlights index…'); } catch (_) {}
            }
            return [];
        }

        const y = parseInt(yyyymmdd.slice(0, 4), 10);
        const m = parseInt(yyyymmdd.slice(4, 6), 10) - 1;
        const d = parseInt(yyyymmdd.slice(6, 8), 10);
        const targetLabel = formatReadwiseRefDateHeading(new Date(y, m, d));

        await this._ensureRwCollections();
        const refsColl = this._rwRefsColl;
        if (!refsColl) return [];

        let records;
        try { records = await refsColl.getAllRecords(); }
        catch (_) { return []; }

        const results = [];
        const CONCURRENCY = 24;
        const total = records.length;
        for (let i = 0; i < records.length; i += CONCURRENCY) {
            const chunk = records.slice(i, i + CONCURRENCY);
            if (onProgress) {
                const upto = Math.min(i + chunk.length, total);
                try { onProgress(`Scanning highlights… ${upto}/${total}`); } catch (_) {}
            }
            const parsed = await Promise.all(chunk.map((record) =>
                this._extractHighlightsFromReferenceBody(record, targetLabel, yyyymmdd)));
            for (let j = 0; j < chunk.length; j++) {
                const record = chunk[j];
                for (const row of parsed[j]) {
                    const category = this._readwiseSourceCategoryLabel(record);
                    results.push({
                        guid:          record.guid,
                        record,
                        text:          row.text,
                        note:          row.note || '',
                        source_title:  this._sourceTitleLabel(record),
                        source_author: this._authorLabel(record),
                        location:      row.loc || '',
                        category,
                    });
                }
            }
            await this._sleep(0);
        }

        results.sort((a, b) => a.source_title.localeCompare(b.source_title));
        try { this._thRefQueryCache.set(yyyymmdd, results); } catch (_) {}

        /* Backfill day index from this scan so the next open is instant (including empty→seed). */
        try {
            if (results.length) {
                const byGuid = new Map();
                for (const r of results) {
                    if (!byGuid.has(r.guid)) byGuid.set(r.guid, []);
                    byGuid.get(r.guid).push(r);
                }
                if (!this._highlightsDayIndex) this._hydrateHighlightsDayIndexFromStorage();
                const idx = this._highlightsDayIndex || this._emptyHighlightsDayIndex();
                for (const [guid, rows] of byGuid) {
                    const ent = idx.entries[guid] || {
                        st: String(rows[0].source_title || '').slice(0, 200),
                        sa: String(rows[0].source_author || '').slice(0, 120),
                        cat: String(rows[0].category || '').slice(0, 80),
                        d: Object.create(null),
                    };
                    ent.d[yyyymmdd] = rows.map((r) => [
                        String(r.text || ''),
                        String(r.note || ''),
                        String(r.location || ''),
                    ]);
                    idx.entries[guid] = ent;
                }
                this._highlightsDayIndex = idx;
                this._highlightsDayIndexDirty = true;
                this._persistHighlightsDayIndex();
            }
        } catch (_) {}

        return results;
    }

    async _extractHighlightsFromReferenceBody(record, targetDateLabel, yyyymmdd) {
        let items;
        try { items = await record.getLineItems(); } catch (_) { return []; }
        if (!items || !items.length) return [];

        const ordered = this._buildRecordDocumentOrder(record, items);
        const recId = record.guid;

        const roots = this._childrenInDocOrder(ordered, recId, recId);
        let sectionLine = null;
        for (const line of roots) {
            const plain = await this._linePlainText(line);
            if (this._isHighlightsSectionHeader(plain)) {
                sectionLine = line;
                break;
            }
        }
        if (!sectionLine) return [];

        const dateBlocks = this._childrenInDocOrder(ordered, recId, sectionLine.guid);
        let targetDateLine = null;
        for (const line of dateBlocks) {
            if (line?.type === 'br') continue;
            const plainLo = (await this._linePlainText(line)).trim();
            if (!plainLo) continue;
            if (plainLo === READWISE_REF_BETWEEN_DATE_DIVIDER_TEXT) continue;
            if (await this._dateLineMatchesJournalDay(line, yyyymmdd, targetDateLabel)) {
                targetDateLine = line;
                break;
            }
        }
        if (!targetDateLine) return [];

        const merged = await this._mergeQuoteLinesUnderDateGroup(record, ordered, recId, targetDateLine);
        const out = [];
        for (const row of merged) {
            out.push({ text: row.text, note: row.note, loc: row.loc });
        }
        return out;
    }

    _isHighlightsSectionHeader(plain) {
        const t = String(plain || '').trim();
        if (!t) return false;
        if (/^❣️/.test(t) && /highlights/i.test(t)) return true;
        return /highlights/i.test(t);
    }

    /** Between-quote separator from Readwise References (box-drawing / dash lines), not a highlight quote. */
    _isReadwiseRefSeparatorLine(t) {
        const s = String(t || '').trim();
        if (s.length < 8) return false;
        return /^[\u2500\u2501\u2014\u2013─\-\s·\u00B7]+$/.test(s);
    }

    /**
     * Date line may be plain text or a ref to the journal record (Readwise References sync).
     * Refs are checked first (exact calendar day). Plain text must include the year (new format) or parse to it;
     * yearless labels matched the first same weekday+month+day block across years and mis-attributed highlights.
     */
    async _dateLineMatchesJournalDay(line, yyyymmdd, targetDateLabel) {
        const segs = await this._lineSegments(line);
        for (const seg of segs) {
            if (seg?.type !== 'ref' || !seg.text) continue;
            const g = typeof seg.text === 'string' ? seg.text : seg.text.guid;
            if (!g) continue;
            try {
                const rec = this.data.getRecord(typeof g === 'string' ? g : g);
                const jd = rec?.getJournalDetails?.();
                if (jd?.date instanceof Date && !isNaN(jd.date.getTime())) {
                    const y = jd.date.getFullYear();
                    const m = String(jd.date.getMonth() + 1).padStart(2, '0');
                    const day = String(jd.date.getDate()).padStart(2, '0');
                    if (`${y}${m}${day}` === yyyymmdd) return true;
                }
            } catch (_) {}
        }
        const plain = (await this._linePlainText(line)).trim();
        if (plain === targetDateLabel) return true;
        const parsedYmd = parseReadwiseRefDateHeadingYmd(plain);
        if (parsedYmd === yyyymmdd) return true;
        return false;
    }

    async _parseNoteLocUnderQuote(record, ordered, quoteLine) {
        let note = '';
        let loc = '';
        const kids = this._childrenInDocOrder(ordered, record.guid, quoteLine.guid);
        for (const child of kids) {
            const raw = await this._linePlainText(child);
            const s = String(raw || '').trim();
            if (/^📝\s*Note:/i.test(s) || /^Note:/i.test(s)) {
                note = s.replace(/^📝\s*Note:\s*/i, '').replace(/^Note:\s*/i, '').trim();
            } else if (/^🌎\s*Loc:/i.test(s) || /^https?:\/\//i.test(s)) {
                loc = s.replace(/^🌎\s*Loc:\s*/i, '').trim();
            }
        }
        return { note, loc };
    }

    /**
     * Join consecutive sibling lines under one calendar heading until a quote-separator line.
     * Thymer may split a long highlight across several top-level lines; the sync format inserts
     * `READWISE_REF_QUOTE_SEPARATOR_TEXT` only between distinct highlights, not between fragments.
     */
    async _mergeQuoteLinesUnderDateGroup(record, ordered, recId, dateLine) {
        const underDay = this._childrenInDocOrder(ordered, recId, dateLine.guid);
        const out = [];
        const group = [];

        const emitGroup = () => {
            if (!group.length) return;
            const text = group.map(g => g.t).join('\n\n');
            let note = '';
            let loc = '';
            for (const g of group) {
                if (g.note && String(g.note).trim()) note = String(g.note).trim();
                if (g.loc && String(g.loc).trim()) loc = String(g.loc).trim();
            }
            out.push({ text, note, loc });
            group.length = 0;
        };

        for (const line of underDay) {
            if (line?.type === 'br') continue;
            const t = (await this._linePlainText(line)).trim();
            if (!t || t === '---') continue;

            if (this._isReadwiseRefSeparatorLine(t)) {
                emitGroup();
                continue;
            }

            const { note, loc } = await this._parseNoteLocUnderQuote(record, ordered, line);
            group.push({ t, note, loc });
        }
        emitGroup();
        return out;
    }

    _childrenInDocOrder(ordered, recId, parentGuid) {
        const out = [];
        for (const item of ordered) {
            const pg = typeof item.parent_guid === 'string' && item.parent_guid
                ? item.parent_guid
                : recId;
            if (pg === parentGuid) out.push(item);
        }
        return out;
    }

    async _linePlainText(line) {
        const segments = await this._lineSegments(line);
        return this._segmentsToPlainText(segments);
    }

    async _lineSegments(line) {
        if (!line) return [];
        if (Array.isArray(line.segments) && line.segments.length) return line.segments;
        if (typeof line.getSegments === 'function') {
            try {
                const s = await line.getSegments();
                return Array.isArray(s) ? s : [];
            } catch (_) {}
        }
        return [];
    }

    _segmentsToPlainText(segments) {
        if (!Array.isArray(segments) || segments.length === 0) return '';
        let out = '';
        for (const seg of segments) {
            if (!seg) continue;
            if (seg.type === 'text' || seg.type === 'bold' || seg.type === 'italic' || seg.type === 'code' || seg.type === 'link') {
                if (typeof seg.text === 'string') out += seg.text;
                continue;
            }
            if (seg.type === 'linkobj') {
                const link = seg.text?.link || '';
                const title = seg.text?.title || link;
                out += title;
                continue;
            }
            if (seg.type === 'hashtag') {
                const t = typeof seg.text === 'string' ? seg.text : '';
                if (!t) continue;
                out += t.startsWith('#') ? t : `#${t}`;
                continue;
            }
            if (seg.type === 'ref') {
                const guid = seg.text?.guid || null;
                let title = seg.text?.title || '';
                if (!title && guid) {
                    try {
                        const r = this.data.getRecord(guid);
                        if (r && typeof r.getName === 'function') title = r.getName() || '';
                    } catch (_) {}
                }
                out += title;
                continue;
            }
            if (typeof seg.text === 'string') out += seg.text;
        }
        return out;
    }

    /** Legacy: one Highlight record per Readwise highlight. */
    async _getHighlightsFromHighlightsCollection(yyyymmdd, onProgress) {
        const y = parseInt(yyyymmdd.slice(0, 4), 10);
        const m = parseInt(yyyymmdd.slice(4, 6), 10) - 1;
        const d = parseInt(yyyymmdd.slice(6, 8), 10);
        const dayStart = new Date(y, m, d,  0,  0,  0,   0);
        const dayEnd   = new Date(y, m, d, 23, 59, 59, 999);

        await this._ensureRwCollections();
        const highlightsColl = this._rwHighlightsColl;
        if (!highlightsColl) return [];

        let records;
        try { records = await highlightsColl.getAllRecords(); }
        catch (_) { return []; }

        const results = [];
        const total = records.length;
        let idx = 0;
        for (const record of records) {
            idx += 1;
            if (onProgress && (idx === 1 || idx % 120 === 0 || idx === total)) {
                try { onProgress(`Scanning highlights… ${idx}/${total}`); } catch (_) {}
            }
            const date = this._getDateValue(record, 'highlighted_at');
            if (!date) continue;
            if (date >= dayStart && date <= dayEnd) {
                results.push({
                    guid:         record.guid,
                    record,
                    text:         this._highlightQuoteLabel(record),
                    note:         record.text('note')         || '',
                    source_title: this._sourceTitleLabel(record),
                    source_author: this._authorLabel(record),
                    location:     record.text('location')     || '',
                    category:     this._readwiseSourceCategoryLabel(record),
                });
            }
            if (idx % 120 === 0) await this._sleep(0);
        }

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

    /**
     * Quote text: legacy `text` field, else record name / `title` (Readwise stores full quote in title).
     */
    _highlightQuoteLabel(record) {
        try {
            const legacy = record.text('text');
            if (legacy && String(legacy).trim()) return String(legacy).trim();
        } catch (_) {}
        try {
            if (typeof record.getName === 'function') {
                const n = record.getName();
                if (n && String(n).trim()) return String(n).trim();
            }
        } catch (_) {}
        try {
            const p = record.prop('title');
            if (p && typeof p.get === 'function') {
                const g = p.get();
                if (g != null && String(g).trim()) return String(g).trim();
            }
        } catch (_) {}
        return '';
    }

    /** `source_author` as People link or legacy text. */
    _authorLabel(record) {
        try {
            if (typeof record.reference === 'function') {
                const guid = record.reference('source_author');
                if (guid) {
                    const pr = this.data.getRecord(guid);
                    if (pr && typeof pr.getName === 'function') {
                        const n = pr.getName();
                        if (n && String(n).trim()) return String(n).trim();
                    }
                }
            }
        } catch (_) {}
        try {
            const t = record.text('source_author');
            if (t && String(t).trim()) return String(t).trim();
        } catch (_) {}
        return '';
    }

    /**
     * `source_title` may be `link_to_record` (GUID) or legacy plain text.
     */
    _sourceTitleLabel(record) {
        try {
            if (typeof record.reference === 'function') {
                const guid = record.reference('source_title');
                if (guid) {
                    const cap = this.data.getRecord(guid);
                    if (cap && typeof cap.getName === 'function') {
                        const n = cap.getName();
                        if (n && String(n).trim()) return String(n).trim();
                    }
                }
            }
        } catch (_) {}
        const legacy = record.text('source_title');
        if (legacy && String(legacy).trim()) return String(legacy).trim();
        return 'Unknown';
    }

    // =========================================================================
    // Record navigation (click = this panel, ⌘/Ctrl-click = new panel)
    // =========================================================================

    _wantsSidePanel(e) {
        if (!e || typeof e !== 'object') return false;
        return !!(e.metaKey || e.ctrlKey);
    }

    _navigatePanelToRecord(panel, recordGuid, lineGuid, workspaceGuid) {
        if (!panel || !recordGuid) return Promise.resolve(false);
        if (!lineGuid) {
            panel.navigateTo({
                type: 'edit_panel',
                rootId: recordGuid,
                subId: null,
                workspaceGuid,
            });
            return Promise.resolve(true);
        }
        try {
            const result = panel.navigateTo({ itemGuid: lineGuid, highlight: true });
            if (result && typeof result.then === 'function') {
                return result.then((found) => found !== false);
            }
            return Promise.resolve(result !== false);
        } catch (_) {
            return Promise.resolve(false);
        }
    }

    _waitForPanelNavigationFrame() {
        return new Promise((resolve) => {
            if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
            else setTimeout(resolve, 0);
        });
    }

    async _openRecord(panel, recordGuid, lineGuid, e) {
        const workspaceGuid = this.getWorkspaceGuid?.() || null;
        if (!workspaceGuid || !panel || !recordGuid) return;

        if (this._wantsSidePanel(e)) {
            try {
                const newPanel = await this.ui.createPanel({ afterPanel: panel });
                if (!newPanel) return;
                this.ui.setActivePanel?.(newPanel);
                await this._waitForPanelNavigationFrame();
                await this._navigatePanelToRecord(newPanel, recordGuid, null, workspaceGuid);
                if (lineGuid) {
                    await this._navigatePanelToRecord(newPanel, recordGuid, lineGuid, workspaceGuid);
                    await this._waitForPanelNavigationFrame();
                    await this._waitForPanelNavigationFrame();
                }
            } catch (_) {}
            return;
        }

        this._navigatePanelToRecord(panel, recordGuid, lineGuid || null, workspaceGuid);
        this.ui.setActivePanel?.(panel);
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
        sourceEl.className   = 'th-source-title th-source-title--link';
        sourceEl.textContent = sourceTitle;
        sourceEl.title       = 'Open reference (⌘/Ctrl-click for new panel)';
        const refGuid = items.length && items[0].guid ? items[0].guid : '';
        if (refGuid) {
            sourceEl.addEventListener('click', (e) => {
                e.stopPropagation();
                void this._openRecord(state.panel, refGuid, null, e);
            });
        }

        /* Fixed slot keeps every title on the same left edge, category icon or not. */
        const iconSlot = document.createElement('span');
        iconSlot.className = 'th-source-icon-slot';
        const catKind = this._rwrCategoryIconKind(items.find((h) => h && h.category)?.category);
        if (catKind) {
            const catIcon = this._rwrAppendSvgIcon(iconSlot, catKind, 14);
            catIcon.classList.add('th-source-icon');
        }

        const titleCluster = document.createElement('div');
        titleCluster.className = 'th-source-title-cluster';
        titleCluster.appendChild(iconSlot);
        titleCluster.appendChild(sourceEl);

        const hlCount = document.createElement('span');
        hlCount.className   = 'th-group-count';
        hlCount.textContent = items.length === 1 ? '1 highlight' : `${items.length} highlights`;

        const expandBtn = document.createElement('button');
        expandBtn.className = 'th-expand-btn button-none button-small button-minimal-hover';
        expandBtn.type      = 'button';
        expandBtn.title     = isExpanded ? 'Collapse' : 'Show highlights';
        expandBtn.classList.toggle('is-expanded', isExpanded);
        const expandCaret = this._rwrBuildChevron(isExpanded, 'th-expand-caret');
        expandBtn.appendChild(expandCaret);

        groupHeader.appendChild(expandBtn);
        groupHeader.appendChild(titleCluster);
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
            this._rwrSyncChevron(expandCaret, nowExpanded);
            expandBtn.classList.toggle('is-expanded', nowExpanded);
            expandBtn.title       = nowExpanded ? 'Collapse' : 'Show highlights';
        });

        group.appendChild(groupHeader);
        group.appendChild(preview);
        return group;
    }

    _buildHighlightRow(h, state) {
        const row = document.createElement('div');
        row.className = 'th-highlight-row';
        if (h.guid) {
            row.title = 'Open reference (⌘/Ctrl-click for new panel)';
        }

        // Quote bar + text
        const quoteEl = document.createElement('div');
        quoteEl.className   = 'th-highlight-text';
        quoteEl.textContent = h.text;

        const topRow = document.createElement('div');
        topRow.className = 'th-highlight-top';
        topRow.appendChild(quoteEl);
        row.appendChild(topRow);

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

        // Click → this panel; ⌘/Ctrl-click → new panel (same as core / Backreferences rows).
        row.addEventListener('click', (e) => {
            if (!h.guid) return;
            void this._openRecord(state.panel, h.guid, null, e);
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

    /** YYYYMMDD journal key from GUID suffix, or `getJournalDetails().date` when the host uses non-date GUIDs. */
    _journalDateFromRecord(record) {
        const fromGuid = this._journalDateFromGuid(record?.guid || '');
        if (fromGuid) return fromGuid;
        try {
            const jd = record?.getJournalDetails?.();
            const d = jd?.date;
            if (d instanceof Date && !isNaN(d.getTime())) {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}${m}${day}`;
            }
        } catch (_) {}
        return null;
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
        globalThis.ThymerPluginSettings?.scheduleFlush?.(this, () => this._pathBMirrorKeys());
    }

    /** Persist quickly when storage mode is synced (in addition to debounced flush). */
    _flushPathBNowBestEffort() {
        if (this._pluginSettingsSyncMode !== 'synced') return;
        const ps = globalThis.ThymerPluginSettings;
        if (!ps?.flushNow || !this.data || !this._pluginSettingsPluginId) return;
        ps.flushNow(this.data, this._pluginSettingsPluginId, this._pathBMirrorKeys()).catch(() => {});
    }

    // =========================================================================
    // CSS
    // =========================================================================

    _injectCSS() {
        this.ui.injectCSS(`
            /* ── Journal footer wrapper (one or two cards) ── */
            .th-journal-footer,
            .th-shuffler-detached-host {
                /* Same token chain as Backreferences so both footers read identically. */
                --th-text-default: var(--text-default, var(--text, inherit));
                --th-text-muted: var(--text-muted, var(--text-secondary, #8a7e6a));
                --th-text-faint: color-mix(in srgb, var(--th-text-muted) 72%, transparent);
                --th-border-color: var(--divider-color, var(--cmdpal-border-color, var(--border-subtle, rgba(255,255,255,0.08))));
                --th-editor-size: var(--editor-font-size, 15px);
                font-size: 13px;
            }
            .th-journal-footer {
                margin-top: 16px;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            .th-journal-footer > .th-footer {
                margin-top: 0;
            }

            /* Journal Footer Suite — one glass shell; highlights list only (no second title card). */
            .th-journal-footer[data-rw-suite-mount="highlights"] {
                margin-top: 0;
                gap: 0;
            }
            .th-journal-footer[data-rw-suite-mount="highlights"] > .th-footer--highlights {
                margin-top: 0;
                padding: 0;
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
                border-radius: 0;
            }
            .th-journal-footer[data-rw-suite-mount="highlights"] .th-footer--highlights > .th-header {
                display: none !important;
            }
            .th-journal-footer[data-rw-suite-mount="highlights"] .th-footer--highlights > .th-body {
                display: block !important;
                padding-bottom: 2px;
            }

            /* Journal Footer Suite — shuffler in dock / detached host (glass chrome stays in JFS header). */
            .th-journal-footer[data-rw-suite-mount="shuffler"] {
                margin-top: 0;
            }
            .th-journal-footer[data-rw-suite-mount="shuffler"] > .th-footer--shuffler {
                margin-top: 0;
                padding: 4px 2px 6px;
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
                border-radius: 0;
            }

            /* ── Outer card — glass only for Quote Shuffler; Highlights is native like Backreferences ── */
            .th-footer {
                margin-top: 16px;
                font-size: 13px;
                color: inherit;
            }

            .th-footer--highlights.th-footer--native {
                margin-top: 14px;
                padding: 0;
                background: transparent !important;
                border: none !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                -webkit-backdrop-filter: none !important;
                backdrop-filter: none !important;
                isolation: auto;
                overflow: visible;
            }

            .th-footer--highlights .th-header--native {
                display: flex;
                align-items: center;
                gap: 6px;
                min-height: 28px;
                margin-bottom: 0;
                padding: 0;
            }
            .th-footer--highlights .th-header-main {
                flex: 1 1 auto;
                min-width: 0;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .th-footer--highlights .th-header-controls {
                flex: 0 0 auto;
                display: inline-flex;
                align-items: center;
                gap: 4px;
            }

            .th-summary-pill {
                display: inline-flex !important;
                align-items: center;
                gap: 8px;
                width: auto;
                height: auto;
                max-width: 100%;
                padding: 4px 12px 4px 8px !important;
                min-height: 28px;
                border-radius: 999px !important;
                background: var(--button-minimal-bg-color, var(--bg-secondary, rgba(127,127,127,0.14))) !important;
                border: 1px solid var(--divider-color, var(--cmdpal-border-color, var(--border-subtle, rgba(255,255,255,0.08)))) !important;
                color: inherit;
            }
            .th-summary-pill .th-title-icon {
                opacity: 0.9;
                flex: 0 0 auto;
            }
            .th-summary-pill .th-title {
                flex: 0 1 auto;
                font-size: 13px;
                font-weight: 600;
                color: var(--th-text-default);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .th-summary-pill .th-count {
                flex: 0 0 auto;
                color: var(--th-text-muted);
                font-size: 12px;
                font-variant-numeric: tabular-nums;
            }
            .th-summary-pill .th-count:empty { display: none; }
            .th-summary-pill .th-toggle-caret {
                opacity: 0.85;
                flex: 0 0 auto;
            }

            /* Light chevron (matches the Backreferences fold caret); rotates instead of swapping glyphs. */
            .th-chevron {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                line-height: 0;
                color: var(--th-text-muted);
                transition: transform 0.12s ease;
                transform: rotate(0deg);
            }
            .th-chevron--open { transform: rotate(90deg); }
            .th-chevron svg { display: block; }

            /*
             * Header actions reveal on hover. Selectors are over-qualified on purpose so they
             * outrank the generic .th-footer--highlights .th-action opacity rules further down.
             */
            .th-footer .th-header .th-hover-action {
                opacity: 0;
                transition: opacity 0.12s;
            }
            .th-footer .th-header:hover .th-hover-action,
            .th-footer .th-header:focus-within .th-hover-action,
            .th-footer .th-header .th-hover-action:focus-visible {
                opacity: 1;
            }
            @media (hover: none), (pointer: coarse) {
                .th-footer .th-header .th-hover-action { opacity: 0.6; }
            }

            /* Settings cog popup */
            .th-menu {
                position: fixed;
                z-index: 100000;
                min-width: 220px;
                padding: 5px;
                border-radius: 10px;
                background: var(--cmdpal-bg-color, var(--panel-bg-color, #1d1915));
                border: 1px solid var(--divider-color, var(--cmdpal-border-color, rgba(255,255,255,0.1)));
                box-shadow: var(--cmdpal-box-shadow, 0 8px 32px rgba(0,0,0,0.45));
                display: flex;
                flex-direction: column;
                gap: 1px;
            }
            .th-menu-item {
                display: flex;
                align-items: center;
                gap: 8px;
                width: 100%;
                padding: 6px 8px;
                border-radius: 6px;
                background: transparent;
                border: none;
                color: var(--th-text-default);
                font-size: 13px;
                text-align: left;
                cursor: pointer;
            }
            .th-menu-item:hover {
                background: var(--button-normal-hover-color, rgba(255,255,255,0.07));
            }
            .th-menu-check {
                flex: 0 0 auto;
                width: 12px;
                color: var(--th-text-muted);
                font-size: 12px;
            }
            .th-menu-label { flex: 1 1 auto; }
            .th-menu-sep {
                height: 1px;
                margin: 4px 6px;
                background: var(--divider-color, rgba(255,255,255,0.08));
            }

            .th-footer--highlights .th-body--native {
                background: transparent !important;
                border: none;
                border-left: 1px solid var(--divider-color, var(--cmdpal-border-color, var(--border-subtle, rgba(255,255,255,0.08))));
                box-shadow: none !important;
                margin-left: 10px;
                padding: 6px 0 4px 14px;
            }
            .th-footer--highlights.th-footer--collapsed .th-body--native {
                display: none !important;
            }

            .th-shuffler-detached-host {
                margin-top: 22px;
            }
            .th-footer.th-footer--shuffler,
            .th-shuffler-detached-shell {
                isolation: isolate;
                border-radius: 10px;
                overflow: hidden;
                padding: 10px 12px 8px;
                background: rgba(22, 22, 28, 0.38);
                background: color-mix(in srgb, var(--panel-bg-color, rgb(24, 23, 28)) 38%, transparent);
                border: 1px solid rgba(255, 255, 255, 0.055);
                box-shadow:
                  inset 0 1px 0 rgba(255, 255, 255, 0.05),
                  0 4px 28px rgba(0, 0, 0, 0.16);
                -webkit-backdrop-filter: blur(22px) saturate(1.45);
                backdrop-filter: blur(22px) saturate(1.45);
            }
            .th-shuffler-detached-shell {
                padding: 10px 12px;
            }
            .th-journal-footer[data-rw-detached-mount="shuffler"] {
                margin-top: 0;
            }
            .th-journal-footer[data-rw-detached-mount="shuffler"] > .th-footer--shuffler {
                margin-top: 0;
                padding: 0;
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
                border-radius: 0;
                backdrop-filter: none;
                -webkit-backdrop-filter: none;
            }

            /* ── Header row ── */
            .th-header {
                display: flex;
                align-items: center;
                gap: 6px;
                min-height: 30px;
                margin-bottom: 6px;
            }
            .th-footer--highlights .th-header--native {
                margin-bottom: 0;
                min-height: 28px;
            }
            .th-header-actions {
                margin-left: auto;
                display: inline-flex;
                align-items: center;
                gap: 4px;
            }
            .th-footer--highlights .th-header-controls {
                margin-left: 0;
            }
            .th-action {
                opacity: 0;
                transition: opacity .12s, color .12s;
                color: var(--text-muted, currentColor);
                width: 24px;
                height: 22px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0;
            }
            .th-footer:hover .th-action { opacity: 1; }
            .th-action:hover { color: inherit; }
            .th-action.is-active { color: inherit; }
            /* .th-hover-action (highlights header) governs its own visibility above. */
            .th-footer--highlights .th-action:not(.th-hover-action) {
                opacity: 0.72;
            }
            .th-footer--highlights:hover .th-action:not(.th-hover-action) {
                opacity: 1;
            }
            .th-toggle {
                font-size: 13px;
                line-height: 1;
                color: var(--th-text-muted);
                cursor: pointer;
                padding: 0 4px;
                min-width: 18px;
                flex-shrink: 0;
            }
            .th-toggle.th-summary-pill {
                color: inherit;
                padding: 4px 12px 4px 8px !important;
                min-width: 0;
            }
            .th-title-icon {
                color: var(--th-text-muted);
                font-size: 14px;
                flex-shrink: 0;
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }
            .th-inline-svg-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                line-height: 0;
                color: inherit;
            }
            .th-inline-svg-icon svg {
                display: block;
            }
            .th-title {
                font-weight: 600;
                font-size: 13px;
                flex: 1;
                white-space: nowrap;
            }
            .th-count {
                color: var(--th-text-muted);
                font-size: 12px;
                white-space: nowrap;
                font-variant-numeric: tabular-nums;
            }

            /* ── Body ── */
            .th-body { padding-bottom: 4px; }

            .th-loading, .th-empty {
                font-size: 12px;
                color: var(--th-text-muted);
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
            .th-source-title-cluster {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                flex: 1 1 auto;
                min-width: 0;
            }
            /* Fixed slot keeps every title on the same left edge, icon or not. */
            .th-source-icon-slot {
                flex: 0 0 auto;
                width: 20px;
                display: inline-flex;
                align-items: center;
                justify-content: flex-start;
                color: var(--th-text-muted);
                opacity: 0.7;
            }
            .th-source-title {
                font-weight: 600;
                /* Same scale as the Backreferences row titles. */
                font-size: var(--th-editor-size, var(--editor-font-size, 15px));
                line-height: 1.7;
                color: var(--th-text-default);
                flex: 1 1 auto;
                min-width: 0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .th-source-title--link {
                cursor: pointer;
            }
            .th-source-title--link:hover {
                color: var(--th-text-default);
                text-decoration: underline;
            }
            .th-group-count {
                font-size: 13px;
                color: var(--th-text-muted);
                font-weight: 500;
                white-space: nowrap;
                flex-shrink: 0;
            }
            .th-expand-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: var(--th-text-muted);
                cursor: pointer;
                padding: 0;
                margin: 0;
                background: none;
                border: none;
                line-height: 1;
                flex-shrink: 0;
                transition: color 0.1s, opacity 0.12s;
                width: 16px;
                height: 16px;
                /* Hover-reveal like the Backreferences row caret. */
                opacity: 0;
            }
            .th-group-header:hover .th-expand-btn,
            .th-expand-btn:focus-visible,
            .th-expand-btn.is-expanded {
                opacity: 1;
            }
            @media (hover: none), (pointer: coarse) {
                .th-expand-btn { opacity: 0.65; }
            }
            .th-expand-btn:hover {
                color: var(--th-text-default);
            }
            .th-group-header {
                border-radius: 8px;
            }
            .th-group-header:hover {
                background: var(--button-normal-hover-color, var(--bg-hover, rgba(255,255,255,0.05)));
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
                display: flex;
                flex-wrap: wrap;
                align-items: flex-start;
                gap: 4px;
            }
            .th-highlight-top {
                display: flex;
                align-items: flex-start;
                gap: 4px;
                width: 100%;
            }
            .th-highlight-top .th-highlight-text {
                flex: 1 1 auto;
                min-width: 0;
            }
            .th-highlight-row .th-highlight-note,
            .th-highlight-row .th-highlight-meta {
                flex: 1 1 100%;
            }
            .th-highlight-row:hover {
                background: rgba(255,255,255,0.05);
            }
            .th-highlight-text {
                /* Matches the Backreferences linked-line snippets. */
                font-size: 13.5px;
                color: var(--th-text-default);
                line-height: 1.5;
                /* subtle left bar to signal "quote" */
            }
            .th-highlight-note {
                font-size: 12px;
                color: var(--th-text-muted);
                margin-top: 3px;
                font-style: italic;
            }
            .th-highlight-meta {
                font-size: 11px;
                color: var(--th-text-faint);
                margin-top: 2px;
            }

            /* Quote shuffler: collapsed = same header pattern as Today’s Highlights; expanded = float toggle only */
            .th-footer.th-footer--shuffler {
                position: relative;
                padding: 10px 14px 12px;
            }
            .th-shuffler-chrome {
                display: flex;
                align-items: center;
                gap: 6px;
                min-height: 30px;
                margin-bottom: 6px;
            }
            .th-shuffler-shell:not(.th-shuffler-is-collapsed) .th-shuffler-chrome {
                position: relative;
                min-height: 0;
                height: 0;
                margin: 0;
                padding: 0;
                overflow: visible;
            }
            .th-shuffler-shell:not(.th-shuffler-is-collapsed) .th-shuffler-chrome .th-shuffler-title-icon,
            .th-shuffler-shell:not(.th-shuffler-is-collapsed) .th-shuffler-chrome .th-shuffler-panel-title {
                display: none !important;
            }
            /* Expanded: collapse via hover chevron beside quote icon (see .th-shuffler-top-actions), not a floating −. */
            .th-shuffler-shell:not(.th-shuffler-is-collapsed) .th-shuffler-chrome .th-toggle {
                display: none !important;
            }
            .th-shuffler-shell.th-shuffler-is-collapsed .th-shuffler-chrome .th-toggle {
                position: static;
            }
            .th-shuffler-shell.th-shuffler-is-collapsed {
                min-height: 34px;
            }
            .th-shuffler-body {
                text-align: center;
                padding: 12px 8px 6px;
            }
            .th-shuffler-shell.th-shuffler-is-collapsed .th-shuffler-body {
                padding-top: 0;
            }

            /* Idle: no inner card — only panel background + centered prompt */
            .th-shuffler-idle {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 14px;
                max-width: 36em;
                margin: 0 auto;
            }
            .th-shuffler-idle--bare {
                border: none;
                background: none;
                padding: 10px 8px 8px;
                border-radius: 0;
            }
            .th-shuffler-idle-caption {
                font-family: var(--font-sans, system-ui, sans-serif);
                font-size: 13px;
                line-height: 1.65;
                color: var(--color-text-100, #eceff4);
                opacity: 0.42;
                text-align: center;
                max-width: 22em;
            }
            .th-shuffler-draw-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                line-height: 0;
                border: none;
                background: none;
                padding: 6px 8px;
                color: var(--color-text-100, #eceff4);
                opacity: 0.52;
                cursor: pointer;
                transition: opacity 0.12s;
            }
            .th-shuffler-draw-btn:hover {
                opacity: 0.92;
            }

            /* Quote glyph centered in panel; chevron sits just left (off-axis). Hover only on icon band (+ slim bridge to chevron). */
            .th-shuffler-top-actions {
                width: 100%;
                margin: 0 auto;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .th-shuffler-quote-hover-zone {
                position: relative;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 2px 4px;
            }
            /* Invisible strip so moving pointer toward the chevron does not drop :hover before click */
            .th-shuffler-quote-hover-zone::before {
                content: '';
                position: absolute;
                right: 100%;
                width: 20px;
                top: 0;
                bottom: 0;
            }
            .th-shuffler-collapse-mini {
                position: absolute;
                right: 100%;
                margin-right: 5px;
                top: 50%;
                transform: translateY(-50%);
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.12s ease;
                color: var(--th-text-muted);
                cursor: pointer;
                border: none;
                background: transparent;
                width: 18px;
                height: 18px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0;
                font-size: 10px;
                line-height: 1;
            }
            .th-shuffler-collapse-mini .ti {
                font-size: 14px;
                line-height: 1;
            }
            .th-shuffler-quote-hover-zone:hover .th-shuffler-collapse-mini,
            .th-shuffler-quote-hover-zone:focus-within .th-shuffler-collapse-mini {
                opacity: 1;
                pointer-events: auto;
            }
            .th-shuffler-collapse-mini:hover {
                color: var(--th-text-default);
            }
            .th-shuffler-quote-mark-row {
                margin-bottom: 12px;
            }
            .th-shuffler-quote-mark-row .th-shuffler-quote-mark {
                margin: 0;
            }

            /* Drawn quote: same surface as idle — no inner bordered card */
            .th-shuffler-quote-view {
                position: relative;
                margin: 2px auto 0;
                padding: 8px 6px 6px;
                max-width: 36em;
                border: none;
                background: none;
                border-radius: 0;
            }
            .th-shuffler-quote-reshuffle-wrap {
                display: flex;
                justify-content: center;
                align-items: center;
                margin-top: 18px;
                padding-top: 2px;
            }
            .th-shuffler-quote-reshuffle {
                padding: 4px 6px;
                line-height: 0;
                border: none;
                background: none;
                border-radius: 0;
                opacity: 0.48;
                cursor: pointer;
                color: var(--color-text-100, #eceff4);
                transition: opacity 0.12s;
            }
            .th-shuffler-quote-reshuffle:hover {
                opacity: 0.9;
            }
            .th-shuffler-quote-body {
                cursor: pointer;
                padding: 4px 8px 0 8px;
                text-align: center;
            }
            .th-shuffler-quote-body:hover {
                opacity: 0.97;
            }
            .th-shuffler-quote-mark {
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 12px;
                line-height: 0;
                color: var(--color-text-100, #eceff4);
                opacity: 0.48;
                pointer-events: none;
            }
            .th-shuffler-quote-display {
                font-family: var(--font-sans, system-ui, sans-serif);
                font-size: 15px;
                line-height: 1.82;
                color: var(--color-text-100, #eceff4);
                opacity: 0.88;
                font-style: normal;
                letter-spacing: 0.01em;
                text-align: center;
                margin: 0 auto;
            }
            .th-shuffler-ritual-divider {
                width: 32px;
                height: 1px;
                background: rgba(255,255,255,0.09);
                margin: 20px auto 0;
            }
            .th-shuffler-source {
                margin-top: 14px;
                font-family: var(--font-sans, system-ui, sans-serif);
                font-size: 14px;
                font-weight: 600;
                color: var(--color-text-100, #eceff4);
                opacity: 0.78;
                font-style: normal;
                text-align: center;
            }
            .th-shuffler-author {
                margin-top: 6px;
                font-size: 12px;
                color: var(--color-text-100, #eceff4);
                opacity: 0.45;
                font-style: normal;
                text-align: center;
            }
            .th-shuffler-note {
                margin-top: 14px;
                font-size: 12px;
                line-height: 1.55;
                color: var(--color-text-100, #eceff4);
                opacity: 0.48;
                font-style: italic;
                text-align: center;
                max-width: 32em;
                margin-left: auto;
                margin-right: auto;
            }
            .th-shuffler-loc {
                margin-top: 10px;
                font-size: 11px;
                color: var(--color-text-100, #eceff4);
                opacity: 0.38;
                word-break: break-all;
                text-align: center;
            }
            .th-shuffler-loc-link {
                color: var(--color-primary-400, #88c0d0);
                opacity: 0.85;
                text-decoration: none;
            }
            .th-shuffler-loc-link:hover {
                text-decoration: underline;
                opacity: 1;
            }
        `);
    }

    /**
     * Readwise sends `Retry-After` on 429 (seconds as integer, or HTTP-date). Falls back to `fallbackMs`.
     */
    _rwrRetryAfterMs(resp, fallbackMs) {
        const fb = Math.max(1000, Number(fallbackMs) || 60_000);
        try {
            const ra = resp && resp.headers && typeof resp.headers.get === 'function'
                ? resp.headers.get('Retry-After')
                : null;
            if (ra == null || String(ra).trim() === '') return fb;
            const t = String(ra).trim();
            const sec = parseInt(t, 10);
            if (Number.isFinite(sec) && sec > 0) return Math.min(sec * 1000, 600_000);
            const when = Date.parse(t);
            if (Number.isFinite(when)) {
                const delta = when - Date.now();
                if (delta > 500) return Math.min(delta, 600_000);
            }
        } catch (_) {}
        return fb;
    }

    _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    _trunc(s, max) { return s && s.length > max ? s.slice(0, max - 1) + '...' : (s || ''); }
    /**
     * Console output for sync / diagnostics. Default is `console.info` (visible when DevTools hides “Verbose” / `log`).
     *
     * `localStorage.readwise_references_console`:
     *   - `info` (default) — `console.info`
     *   - `log` — `console.log`
     *   - `warn` — `console.warn` (hardest to miss)
     *   - `both` — `log` + `info`
     *
     * `localStorage.readwise_references_console_mirror_top` = `1` — also emit from `window.top` (helps if the plugin runs in an iframe and your console context is “top”).
     */
    _log(msg) {
        const line = '[ReadwiseRef] ' + msg;
        let mode = 'info';
        let mirrorTop = false;
        try {
            mode = String(localStorage.getItem('readwise_references_console') || 'info').toLowerCase();
            const m = localStorage.getItem('readwise_references_console_mirror_top');
            mirrorTop = m === '1' || m === 'true' || m === 'on';
        } catch (_) {}

        const topEmit = (fnName) => {
            try {
                const t = typeof window !== 'undefined' ? window.top : null;
                if (!t || t === window || !t.console) return;
                const c = t.console;
                if (fnName === 'warn' && c.warn) c.warn(line);
                else if (fnName === 'log' && c.log) c.log(line);
                else if (c.info) c.info(line);
            } catch (_) {}
        };

        if (mode === 'warn') {
            try { console.warn(line); } catch (_) {}
            if (mirrorTop) topEmit('warn');
        } else if (mode === 'log') {
            try { console.log(line); } catch (_) {}
            if (mirrorTop) topEmit('log');
        } else if (mode === 'both') {
            try { console.log(line); } catch (_) {}
            try { console.info(line); } catch (_) {}
            if (mirrorTop) {
                topEmit('log');
                topEmit('info');
            }
        } else {
            try { console.info(line); } catch (_) {}
            if (mirrorTop) topEmit('info');
        }
    }
    /** Minimal HTML escape for status bar labels. */
    _syncStatusEscape(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
    _syncStatusShow(text) {
        try {
            if (typeof this.ui.addStatusBarItem !== 'function') return;
            const safe = this._syncStatusEscape(text);
            const html = '<span class="rwr-sync-status">' + safe + '</span>';
            const tip = 'Readwise References — ' + String(text || '').trim();
            if (!this._rwrSyncStatusItem) {
                this._rwrSyncStatusItem = this.ui.addStatusBarItem({
                    icon: 'ti-book-2',
                    htmlLabel: html,
                    tooltip: tip,
                });
            } else {
                this._rwrSyncStatusItem.setHtmlLabel?.(html);
                this._rwrSyncStatusItem.setTooltip?.(tip);
            }
        } catch (_) {}
    }
    _syncStatusHide() {
        try { this._rwrSyncStatusItem?.remove?.(); } catch (_) {}
        this._rwrSyncStatusItem = null;
    }
    _toast(msg) {
        this.ui.addToaster({ title: 'Readwise Ref', message: msg, dismissible: true, autoDestroyTime: 4000 });
    }
}


try {
  globalThis.DawnReadwiseSyncEngine = DawnReadwiseSyncEngine;
} catch (_) {}
// ==Plugin==
// @id: dawn-readwise
// @name: Readwise
// @description: Readwise footers — prod day-index paint + Quote Shuffler under Boot Kernel
// @icon: ti-book
// ==/Plugin==

/**
 * Dawn Readwise (parity deepen)
 *
 * CONTRACT:
 * - Today's Highlights + Quote Shuffler; both collapsed cold.
 * - Navigate: paint FROM CACHE only — never getAllRecords on panel.navigated.
 * - Darienx: hydrate prod `th_highlights_by_day_v1` (References body index). Do not
 *   getAllRecords Lab Highlights or References on idle.
 * - Quote Shuffler: sticky pick per journal day; pool from `th_shuffler_pool_cache_v4`.
 * - Network sync: prod References API path via readwise-sync-engine.js (onDemand only).
 *   Old Readwise References plugin stays Off — Dawn owns footers + sync.
 *
 * Deploy: cat readwise-sync-engine.js plugin.js > ../SAFE_MODE_PASTE/06-Dawn-Readwise.js
 */

const RW_LS_CFG = 'dawn_readwise_cfg_v2';
const RW_LS_IDX = 'dawn_readwise_index_v3';
const RW_LS_SHUFFLE_BY_DAY = 'dawn:shuffler_quotes_by_day_v1';
const RW_LS_SHUFFLE_PROD = 'th_shuffler_quotes_by_day';
const RW_LS_POOL_PROD = 'th_shuffler_pool_cache_v4';
const RW_LS_DAY_IDX_PROD = 'th_highlights_by_day_v1';
const RW_LS_TOKEN_PROD = 'readwise_references_token';
const RW_LS_LAST_RUN_PROD = 'readwise_references_last_run';
const REFS_PROD = { name: 'References', guid: '1YHFKPE56RZ2Q578VEFK54S4PA' };
const INDEX_TTL_MS = 10 * 60 * 1000;

class Plugin extends AppPlugin {
  onLoad() {
    this._unreg = null;
    this._navIds = [];
    this._panelStates = new Map();
    this._navGen = 0;
    this._navTimer = null;
    this._building = false;
    this._cssInjected = false;
    this._cfg = {
      highlightsCollapsed: true,
      shufflerCollapsed: false,
      showShuffler: true,
      shufflerDetached: true,
    };
    this._expandedSources = new Map();
    this._index = { items: [], byDay: {}, count: 0, builtAt: 0, ms: 0 };
    this._shuffleByDay = Object.create(null);
    this._quotePool = [];
    this._activeDayKey = null;
    this._rwSync = null;

    try {
      const Engine = globalThis.DawnReadwiseSyncEngine;
      if (Engine) {
        this._rwSync = new Engine();
        this._rwSync.attach(this);
      } else {
        console.error('[Dawn/Readwise] sync engine missing — deploy concatenated bundle');
      }
    } catch (e) {
      console.error('[Dawn/Readwise] sync engine init', e);
    }

    try {
      const raw = localStorage.getItem(RW_LS_CFG);
      if (raw) Object.assign(this._cfg, JSON.parse(raw) || {});
    } catch (_) {}
    // showShuffler = panel mounted; shufflerCollapsed = +/− within panel.
    if (typeof this._cfg.showShuffler !== 'boolean') {
      // Prior Dawn builds used shufflerCollapsed for hide-entirely.
      this._cfg.showShuffler = this._cfg.shufflerCollapsed === false;
      this._cfg.shufflerCollapsed = false;
    }
    if (typeof this._cfg.shufflerDetached !== 'boolean') this._cfg.shufflerDetached = true;
    this._loadIndex();
    this._hydrateProdDayIndex();
    this._loadShuffleByDay();
    this._hydrateProdShuffle();
    this._injectCss();
    this._initPathBPrefs();

    this._waitForBoot((boot) => {
      this._unreg = boot.register({
        id: 'dawn-readwise',
        tier: 'shell',
        mountShell: () => {},
        runIdle: () => {
          this._hydrateProdDayIndex();
          this._hydrateProdShuffle();
          this._refreshAll();
        },
        idleDelayMs: () => 400,
      });
    });

    try {
      this._cmdDraw = this.ui.addCommandPaletteCommand({
        label: 'Readwise: Draw quote',
        icon: 'ti-quotes',
        onSelected: () => {
          this._cfg.showShuffler = true;
          this._cfg.shufflerCollapsed = false;
          this._saveCfg();
          const day = this._activeDayKey;
          if (day) void this._drawQuoteForDay(day, { forcePool: false }).then(() => this._refreshAll());
          else this._refreshAll();
        },
      });
    } catch (_) {}
    try {
      this._cmdRebuild = this.ui.addCommandPaletteCommand({
        label: 'Readwise: Rebuild index',
        icon: 'ti-refresh',
        onSelected: () => void this._runReadwiseRebuildIndex?.(false),
      });
    } catch (_) {}
    try {
      this._cmdRebuildPool = this.ui.addCommandPaletteCommand({
        label: 'Readwise: Rebuild quote library',
        icon: 'ti-quotes',
        onSelected: () => void this._rebuildQuoteLibrary({ toast: true }),
      });
    } catch (_) {}
    try {
      this._cmdSetToken = this.ui.addCommandPaletteCommand({
        label: 'Readwise Ref: Set Token',
        icon: 'ti-key',
        onSelected: () => this._showTokenDialog?.(),
      });
    } catch (_) {}
    try {
      this._cmdSync = this.ui.addCommandPaletteCommand({
        label: 'Readwise Ref: Sync',
        icon: 'ti-book-2',
        onSelected: () => void this._runReadwiseSync?.(false),
      });
    } catch (_) {}
    try {
      this._cmdFullSync = this.ui.addCommandPaletteCommand({
        label: 'Readwise Ref: Full Sync',
        icon: 'ti-book-2',
        onSelected: () => void this._runReadwiseSync?.(true),
      });
    } catch (_) {}

    const schedule = (panel) => {
      clearTimeout(this._navTimer);
      const gen = ++this._navGen;
      this._navTimer = setTimeout(() => {
        if (gen !== this._navGen) return;
        this._handlePanel(panel);
      }, 220);
    };
    try {
      this._navIds.push(this.events.on('panel.navigated', (ev) => schedule(ev.panel)));
      this._navIds.push(this.events.on('panel.focused', (ev) => schedule(ev.panel)));
    } catch (_) {}
    try {
      const active = this.ui.getActivePanel?.();
      if (active) schedule(active);
    } catch (_) {}
  }

  _workspaceGuid() {
    try {
      if (typeof this.getWorkspaceGuid === 'function') return this.getWorkspaceGuid();
    } catch (_) {}
    try {
      return this.workspace?.guid || this.workspace?.getGuid?.() || null;
    } catch (_) {}
    return null;
  }

  async _openRecord(guid, panel, { newPanel } = {}) {
    if (!guid) return;
    const target = panel || this.ui.getActivePanel?.();
    const ws = this._workspaceGuid();
    const nav = (p) => {
      if (!p?.navigateTo) return false;
      p.navigateTo({
        type: 'edit_panel',
        rootId: guid,
        subId: guid,
        workspaceGuid: ws,
      });
      return true;
    };
    if (newPanel) {
      try {
        if (typeof target?.openRecordInNewPanel === 'function') {
          target.openRecordInNewPanel(guid);
          return;
        }
      } catch (_) {}
      try {
        const created = await this.ui.createPanel?.({ afterPanel: target });
        if (created) {
          this.ui.setActivePanel?.(created);
          if (nav(created)) return;
        }
      } catch (_) {}
    }
    try {
      if (nav(target)) {
        this.ui.setActivePanel?.(target);
        return;
      }
    } catch (_) {}
    try {
      if (typeof target?.openRecordInThisPanel === 'function') {
        target.openRecordInThisPanel(guid);
        return;
      }
    } catch (_) {}
    try {
      void this.data.getRecord?.(guid).then((rec) => {
        if (rec) (panel || this.ui.getActivePanel?.())?.navigateToRecord?.(rec);
      });
    } catch (_) {}
  }

  _panelNavSvg(kind) {
    const n = 14;
    if (kind === 'side') {
      return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="' +
        n +
        '" height="' +
        n +
        '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="1.5" opacity="0.35"/><path d="M14 5v14"/><path d="M7 12h4"/><path d="m9 10 2 2-2 2"/></svg>'
      );
    }
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="' +
      n +
      '" height="' +
      n +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>'
    );
  }

  _buildPanelNavActions(recordGuid, state) {
    const wrap = document.createElement('div');
    wrap.className = 'dawn-th-panel-nav-actions th-panel-nav-actions';
    const mk = (newPanel, label, kind) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'dawn-th-panel-nav-btn th-panel-nav-btn button-none button-small button-minimal-hover';
      btn.title = label;
      btn.setAttribute('aria-label', label);
      const icon = document.createElement('span');
      icon.className = 'dawn-th-panel-nav-icon th-panel-nav-icon';
      icon.innerHTML = this._panelNavSvg(kind);
      btn.appendChild(icon);
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        void this._openRecord(recordGuid, state.panel, { newPanel });
      });
      return btn;
    };
    wrap.appendChild(mk(false, 'Open in this panel', 'here'));
    wrap.appendChild(mk(true, 'Open in side panel', 'side'));
    return wrap;
  }

  onUnload() {
    clearTimeout(this._navTimer);
    try {
      this._rwSync?.detach?.();
    } catch (_) {}
    this._rwSync = null;
    try {
      this._unreg?.();
    } catch (_) {}
    for (const id of this._navIds || []) {
      try {
        this.events.off(id);
      } catch (_) {}
    }
    this._navIds = [];
    try {
      for (const id of [...(this._panelStates?.keys?.() || [])]) this._dispose(id);
    } catch (_) {}
    try {
      this._cmdDraw?.remove?.();
    } catch (_) {}
    try {
      this._cmdRebuild?.remove?.();
    } catch (_) {}
    try {
      this._cmdSetToken?.remove?.();
    } catch (_) {}
    try {
      this._cmdSync?.remove?.();
    } catch (_) {}
    try {
      this._cmdFullSync?.remove?.();
    } catch (_) {}
    try {
      this._chip?.remove?.();
    } catch (_) {}
    try {
      this._styleEl?.remove?.();
    } catch (_) {}
  }

  _showTokenDialog() {
    try {
      this._rwSync?._showTokenDialog?.();
    } catch (_) {}
  }

  _runReadwiseSync(forceFull) {
    const engine = this._rwSync;
    if (!engine?._runSync) {
      try {
        this.ui.showToaster?.({
          title: 'Readwise',
          message: 'Sync engine missing — redeploy concatenated bundle.',
          type: 'error',
        });
      } catch (_) {}
      return;
    }
    const boot = globalThis.BootKernel || globalThis.__dawnBoot;
    const run = () => engine._runSync(!!forceFull);
    if (boot?.enqueue) {
      boot.enqueue(run, { id: 'dawn-rw-sync', tier: 'onDemand' });
    } else {
      void run();
    }
  }

  _runReadwiseRebuildIndex(background) {
    const engine = this._rwSync;
    if (!engine?._rebuildDayIndexFromBodies) {
      this._hydrateProdDayIndex();
      this._hydrateProdShuffle();
      this._refreshAll();
      return;
    }
    const boot = globalThis.BootKernel || globalThis.__dawnBoot;
    const run = () => engine._rebuildDayIndexFromBodies({ background: !!background });
    if (boot?.enqueue) {
      boot.enqueue(run, { id: 'dawn-rw-reindex', tier: 'onDemand' });
    } else {
      void run();
    }
  }

  _waitForBoot(cb) {
    let n = 0;
    const tick = () => {
      const boot = globalThis.BootKernel || globalThis.__dawnBoot;
      if (boot?.register) {
        cb(boot);
        return;
      }
      if (++n > 240) return;
      setTimeout(tick, 40);
    };
    tick();
  }

  _mountShell() {}

  _prefsMirrorKeys() {
    return [RW_LS_CFG, RW_LS_TOKEN_PROD, RW_LS_LAST_RUN_PROD, RW_LS_DAY_IDX_PROD];
  }

  _initPathBPrefs() {
    let n = 0;
    const tick = () => {
      const api = globalThis.ThymerPluginSettings;
      if (api?.init && (api.__dawnPathBHost || !api.__pathBStub)) {
        try {
          api.init({
            plugin: this,
            pluginId: 'dawn-readwise',
            label: 'Readwise',
            data: this.data,
            mirrorKeys: () => this._prefsMirrorKeys(),
            onHydrated: () => {
              try {
                const raw = localStorage.getItem(RW_LS_CFG);
                if (raw) Object.assign(this._cfg, JSON.parse(raw) || {});
                this._hydrateProdDayIndex();
                this._hydrateProdShuffle();
                this._refreshAll?.();
              } catch (_) {}
            },
          });
        } catch (e) {
          console.warn('[Dawn/Readwise] PathB init', e);
        }
        return;
      }
      n += 1;
      if (n > 240) return;
      setTimeout(tick, 40);
    };
    tick();
  }

  _schedulePrefsFlush() {
    try {
      const api = globalThis.ThymerPluginSettings;
      if (!api?.scheduleFlush) return;
      if (!this._pluginSettingsPluginId) {
        this._pluginSettingsPluginId = 'dawn-readwise';
        this._pluginSettingsSyncMode = 'synced';
      }
      api.scheduleFlush(this, () => this._prefsMirrorKeys());
    } catch (_) {}
  }

  _saveCfg() {
    try {
      localStorage.setItem(RW_LS_CFG, JSON.stringify(this._cfg));
    } catch (_) {}
    this._schedulePrefsFlush();
  }

  _loadIndex() {
    try {
      const raw = localStorage.getItem(RW_LS_IDX);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (p?.items && p?.byDay) this._index = p;
    } catch (_) {}
  }

  _saveIndex() {
    try {
      localStorage.setItem(RW_LS_IDX, JSON.stringify(this._index));
    } catch (_) {}
  }

  _hydrateProdDayIndex() {
    try {
      const raw = localStorage.getItem(RW_LS_DAY_IDX_PROD);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const entries = parsed?.entries;
      if (!entries || typeof entries !== 'object') return false;
      this._prodDayIndex = parsed;
      const byDay = Object.create(null);
      let count = 0;
      for (const guid of Object.keys(entries)) {
        const ent = entries[guid];
        const days = ent?.d;
        if (!days || typeof days !== 'object') continue;
        for (const ymd of Object.keys(days)) {
          if (!/^\d{8}$/.test(ymd)) continue;
          const iso = ymd.slice(0, 4) + '-' + ymd.slice(4, 6) + '-' + ymd.slice(6, 8);
          const rows = days[ymd];
          if (!Array.isArray(rows) || !rows.length) continue;
          if (!byDay[iso]) byDay[iso] = [];
          for (const row of rows) {
            const text = Array.isArray(row) ? row[0] : row?.text;
            if (!String(text || '').trim()) continue;
            byDay[iso].push({
              guid,
              text: String(text || ''),
              note: String((Array.isArray(row) ? row[1] : row?.note) || ''),
              location: String((Array.isArray(row) ? row[2] : row?.location) || ''),
              source: String(ent.st || 'Unknown'),
              title: String(ent.st || ''),
              author: String(ent.sa || ''),
              category: String(ent.cat || ''),
              url: '',
            });
            count += 1;
          }
        }
      }
      if (!count) return false;
      this._index = {
        items: this._index.items || [],
        byDay,
        count,
        builtAt: Number(parsed.updatedAt) || Date.now(),
        ms: 0,
        complete: parsed.complete !== false,
      };
      return true;
    } catch (e) {
      console.warn('[Dawn/Readwise] prod day index', e);
      return false;
    }
  }

  _hydrateProdShuffle() {
    try {
      if (!Object.keys(this._shuffleByDay || {}).length) {
        const raw = localStorage.getItem(RW_LS_SHUFFLE_PROD);
        const o = raw ? JSON.parse(raw) : null;
        if (o && typeof o === 'object' && !Array.isArray(o)) {
          const mapped = Object.create(null);
          for (const k of Object.keys(o)) {
            const iso = /^\d{8}$/.test(k)
              ? k.slice(0, 4) + '-' + k.slice(4, 6) + '-' + k.slice(6, 8)
              : k;
            mapped[iso] = o[k];
          }
          this._shuffleByDay = mapped;
        }
      }
    } catch (_) {}
    try {
      const raw = localStorage.getItem(RW_LS_POOL_PROD);
      const parsed = raw ? JSON.parse(raw) : null;
      const pool = Array.isArray(parsed?.pool) ? parsed.pool : [];
      if (pool.length) {
        this._quotePool = pool
          .map((p) => ({
            guid: p.guid || p.id || '',
            text: p.text || p.quote || '',
            author: p.author || p.source_author || p.sa || '',
            source: p.source || p.source_title || p.st || p.title || '',
            title: p.title || p.source_title || p.st || '',
            note: p.note || '',
            location: p.location || p.loc || '',
            url: p.url || '',
            category: p.category || p.cat || '',
          }))
          .filter((p) => String(p.text || '').trim());
      }
    } catch (_) {}
  }

  _hitsForDay(dayKey) {
    if (!dayKey) return [];
    const cached = (this._index.byDay && this._index.byDay[dayKey]) || [];
    if (cached.length) return cached;
    return [];
  }

  async _runIdle() {
    this._hydrateProdDayIndex();
    this._hydrateProdShuffle();
    this._refreshAll();
  }

  async _buildIndex() {
    this._hydrateProdDayIndex();
    this._hydrateProdShuffle();
    this._refreshAll();
  }

  _propText(record, labels) {
    try {
      const props = record.getProperties?.() || {};
      for (const label of labels) {
        const v = props[label];
        if (typeof v === 'string' && v.trim()) return v.trim();
        if (Array.isArray(v) && typeof v[1] === 'string' && v[1].trim()) return v[1].trim();
      }
    } catch (_) {}
    for (const label of labels) {
      try {
        const t = record.text?.(label);
        if (typeof t === 'string' && t.trim()) return t.trim();
      } catch (_) {}
    }
    return '';
  }

  _propDateKey(record) {
    try {
      const props = record.getProperties?.() || {};
      let d = props['Highlight Date'] || props.highlighted_at || props.Date || null;
      if (d && typeof d === 'object' && d.d) {
        const s = String(d.d);
        if (/^\d{8}$/.test(s)) return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
      }
      if (d instanceof Date && !isNaN(d.getTime())) {
        return (
          d.getFullYear() +
          '-' +
          String(d.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(d.getDate()).padStart(2, '0')
        );
      }
      if (typeof d === 'string') {
        const m = d.match(/(\d{4}-\d{2}-\d{2})/);
        if (m) return m[1];
      }
    } catch (_) {}
    try {
      const dt =
        record.datetime?.('Highlight Date') || record.prop?.('Highlight Date')?.datetime?.();
      if (dt?.toDate) {
        const x = dt.toDate();
        if (x instanceof Date && !isNaN(x.getTime())) {
          return (
            x.getFullYear() +
            '-' +
            String(x.getMonth() + 1).padStart(2, '0') +
            '-' +
            String(x.getDate()).padStart(2, '0')
          );
        }
      }
    } catch (_) {}
    return null;
  }

  _svgIcon(kind, sizePx) {
    const n = sizePx || 15;
    if (kind === 'shuffle') {
      return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="' +
        n +
        '" height="' +
        n +
        '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>'
      );
    }
    if (kind === 'quote') {
      return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="' +
        n +
        '" height="' +
        n +
        '" viewBox="0 0 14 24" fill="currentColor" aria-hidden="true"><path d="M6 17h3l2-4V7H5v6h3z"/></svg>'
      );
    }
    if (kind === 'quotes') {
      return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="' +
        n +
        '" height="' +
        n +
        '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>'
      );
    }
    const stroke = (body, w) =>
      '<svg xmlns="http://www.w3.org/2000/svg" width="' +
      n +
      '" height="' +
      n +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' +
      (w || 2) +
      '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      body +
      '</svg>';
    if (kind === 'chevron') return stroke('<polyline points="9 6 15 12 9 18"/>', 1.75);
    if (kind === 'cog') {
      return stroke(
        '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
        1.75
      );
    }
    if (kind === 'cat-book') {
      return stroke(
        '<path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6l0 13"/><path d="M12 6l0 13"/><path d="M21 6l0 13"/>'
      );
    }
    if (kind === 'cat-article') {
      return stroke(
        '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="17" y2="13"/><line x1="7" y1="17" x2="13" y2="17"/>'
      );
    }
    if (kind === 'cat-podcast') {
      return stroke(
        '<rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="18" x2="12" y2="21.5"/>'
      );
    }
    if (kind === 'cat-video') {
      return stroke(
        '<rect x="2.5" y="5" width="13.5" height="14" rx="2"/><path d="M16 10.5 21.5 7v10L16 13.5z"/>'
      );
    }
    // Prod highlights pill calls kind "books" but falls through to quote stroke.
    return stroke(
      '<path d="M10 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5"/><path d="M19 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5"/>'
    );
  }

  _appendSvg(parent, kind, sizePx) {
    const wrap = document.createElement('span');
    wrap.className = 'dawn-th-inline-svg';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = this._svgIcon(kind, sizePx);
    parent.appendChild(wrap);
    return wrap;
  }

  _buildChevron(expanded) {
    const el = document.createElement('span');
    el.className = 'dawn-th-chevron dawn-th-toggle-caret';
    el.innerHTML = this._svgIcon('chevron', 14);
    el.setAttribute('aria-hidden', 'true');
    el.classList.toggle('dawn-th-chevron--open', !!expanded);
    return el;
  }

  _syncChevron(el, expanded) {
    if (!el?.classList) return;
    el.classList.toggle('dawn-th-chevron--open', !!expanded);
  }

  _showShuffler() {
    return this._cfg.showShuffler !== false;
  }

  _setShowShuffler(on) {
    this._cfg.showShuffler = !!on;
    if (on) this._cfg.shufflerCollapsed = false;
    this._saveCfg();
    this._refreshAll();
  }

  _buildHighlightsHeader() {
    const header = document.createElement('div');
    header.className = 'dawn-th-header dawn-th-header--native';
    const main = document.createElement('div');
    main.className = 'dawn-th-header-main';
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className =
      'dawn-th-pill button-none button-small button-minimal-hover';
    pill.title = 'Collapse / expand';
    const icon = document.createElement('span');
    icon.className = 'dawn-th-title-icon';
    this._appendSvg(icon, 'books', 15);
    const title = document.createElement('div');
    title.className = 'dawn-th-title';
    title.textContent = 'highlights';
    const count = document.createElement('div');
    count.className = 'dawn-th-count';
    count.dataset.role = 'count';
    const caret = this._buildChevron(!this._cfg.highlightsCollapsed);
    pill.appendChild(icon);
    pill.appendChild(title);
    pill.appendChild(count);
    pill.appendChild(caret);
    pill.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      this._cfg.highlightsCollapsed = !this._cfg.highlightsCollapsed;
      this._saveCfg();
      this._refreshAll();
    });
    main.appendChild(pill);

    const actions = document.createElement('div');
    actions.className = 'dawn-th-header-actions';

    // Prod order: quote toggle → settings cog
    const quoteBtn = document.createElement('button');
    quoteBtn.type = 'button';
    quoteBtn.className =
      'dawn-th-hover-action dawn-th-quote-toggle button-none button-small button-minimal-hover';
    quoteBtn.title = this._showShuffler() ? 'Hide Quote Shuffler' : 'Show Quote Shuffler';
    quoteBtn.setAttribute('aria-label', quoteBtn.title);
    quoteBtn.classList.toggle('is-active', this._showShuffler());
    this._appendSvg(quoteBtn, 'quote', 15);
    quoteBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (this._showShuffler()) this._setShowShuffler(false);
      else this._setShowShuffler(true);
    });
    actions.appendChild(quoteBtn);

    const cogBtn = document.createElement('button');
    cogBtn.type = 'button';
    cogBtn.className =
      'dawn-th-hover-action dawn-th-settings-cog button-none button-small button-minimal-hover';
    cogBtn.title = 'Highlights settings';
    cogBtn.setAttribute('aria-label', cogBtn.title);
    this._appendSvg(cogBtn, 'cog', 15);
    cogBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      this._openHighlightsSettingsMenu(cogBtn);
    });
    actions.appendChild(cogBtn);

    header.appendChild(main);
    header.appendChild(actions);
    return { header, pill, count, caret, quoteBtn, cogBtn };
  }

  _openHighlightsSettingsMenu(anchorEl) {
    const existing = document.getElementById('dawn-th-hl-settings-menu');
    if (existing) {
      existing.remove();
      return;
    }
    const menu = document.createElement('div');
    menu.id = 'dawn-th-hl-settings-menu';
    menu.className = 'dawn-th-menu';

    const close = () => {
      try {
        menu.remove();
      } catch (_) {}
      document.removeEventListener('mousedown', onDocDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
    const onDocDown = (e) => {
      if (menu.contains(e.target)) return;
      if (anchorEl?.contains?.(e.target)) return;
      close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };

    const addItem = (label, checked, onClick) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dawn-th-menu-item button-none';
      const mark = document.createElement('span');
      mark.className = 'dawn-th-menu-check';
      mark.textContent = checked ? '✓' : '';
      const txt = document.createElement('span');
      txt.textContent = label;
      btn.appendChild(mark);
      btn.appendChild(txt);
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        onClick();
        close();
      });
      menu.appendChild(btn);
    };

    const addSep = () => {
      const sep = document.createElement('div');
      sep.className = 'dawn-th-menu-sep';
      menu.appendChild(sep);
    };

    addItem('Quote Shuffler', this._showShuffler(), () => {
      this._setShowShuffler(!this._showShuffler());
    });
    addItem('Shuffler in its own glass frame', !!this._cfg.shufflerDetached, () => {
      this._cfg.shufflerDetached = !this._cfg.shufflerDetached;
      this._saveCfg();
      this._refreshAll();
    });
    addSep();
    addItem('Set Readwise token…', false, () => this._showTokenDialog?.());
    addItem('Sync Readwise now', false, () => void this._runReadwiseSync?.(false));
    addItem('Full Readwise sync', false, () => void this._runReadwiseSync?.(true));
    addItem('Rebuild highlights index', false, () => void this._runReadwiseRebuildIndex?.(false));
    addItem('Rebuild quote library', false, () => void this._rebuildQuoteLibrary({ toast: true }));
    addSep();
    addItem("Hide today's highlights", false, () => {
      this._cfg.highlightsCollapsed = true;
      this._saveCfg();
      this._refreshAll();
    });

    document.body.appendChild(menu);
    const r = anchorEl.getBoundingClientRect();
    const w = Math.max(220, menu.offsetWidth || 220);
    menu.style.top = Math.round(r.bottom + 6) + 'px';
    menu.style.left =
      Math.max(8, Math.min(window.innerWidth - w - 8, Math.round(r.right - w))) + 'px';
    document.addEventListener('mousedown', onDocDown, true);
    document.addEventListener('keydown', onKey, true);
  }

  _buildShufflerShell() {
    const root = document.createElement('div');
    root.className =
      'dawn-th-footer dawn-th-footer--shuffler' +
      (this._cfg.shufflerDetached ? ' is-detached' : '');
    root.setAttribute('data-dawn-readwise', 'shuffler');

    const chrome = document.createElement('div');
    chrome.className = 'dawn-th-shuffler-chrome';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className =
      'dawn-th-shuffler-toggle button-none button-small button-minimal-hover';
    toggle.title = 'Collapse / expand';
    toggle.textContent = this._cfg.shufflerCollapsed ? '+' : '−';
    toggle.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      this._cfg.shufflerCollapsed = !this._cfg.shufflerCollapsed;
      this._saveCfg();
      this._refreshAll();
    });

    const titleIcon = document.createElement('span');
    titleIcon.className = 'dawn-th-title-icon dawn-th-shuffler-title-icon';
    this._appendSvg(titleIcon, 'quotes', 15);

    const titleEl = document.createElement('div');
    titleEl.className = 'dawn-th-title dawn-th-shuffler-panel-title';
    titleEl.textContent = 'Quote Shuffler';

    chrome.appendChild(toggle);
    chrome.appendChild(titleIcon);
    chrome.appendChild(titleEl);

    const body = document.createElement('div');
    body.className = 'dawn-th-body dawn-th-shuffler-body';

    root.appendChild(chrome);
    root.appendChild(body);
    return { root, chrome, toggle, body };
  }

  _syncShufflerLayout(state) {
    if (!state.shRoot) return;
    const collapsed = !!this._cfg.shufflerCollapsed;
    state.shRoot.classList.toggle('is-collapsed', collapsed);
    state.shRoot.classList.toggle('dawn-th-shuffler-is-collapsed', collapsed);
    state.shRoot.classList.toggle('is-detached', !!this._cfg.shufflerDetached);
    state.shRoot.classList.toggle('is-in-detached-host', !!this._cfg.shufflerDetached);
    if (state.shToggle) state.shToggle.textContent = collapsed ? '+' : '−';
    if (state.shBody) state.shBody.style.display = collapsed ? 'none' : 'block';
  }

  _ensureDetachedShufflerHost(container, panelId) {
    if (!container || !panelId) return null;
    let host = null;
    for (const el of container.querySelectorAll(':scope > .dawn-shuffler-detached-host')) {
      if (el.dataset?.panelId === panelId) {
        host = el;
        break;
      }
    }
    if (!host) {
      host = document.createElement('div');
      host.className = 'dawn-shuffler-detached-host';
      host.dataset.panelId = panelId;
      container.appendChild(host);
    }
    let shell = host.querySelector(':scope > .dawn-shuffler-detached-shell');
    if (!shell) {
      shell = document.createElement('div');
      shell.className = 'dawn-shuffler-detached-shell';
      host.appendChild(shell);
    }
    const mobile =
      !!this._isMobile || !!(globalThis.BootKernel || globalThis.__dawnBoot)?.isMobile?.();
    shell.classList.toggle('is-mobile', mobile);
    return { host, shell };
  }

  _removeDetachedShufflerHost(state) {
    try {
      state?.detachedHostEl?.remove?.();
    } catch (_) {}
    if (state) state.detachedHostEl = null;
  }

  _shufflerMountMode() {
    if (!this._showShuffler()) return 'off';
    return this._cfg.shufflerDetached ? 'detached' : 'inline';
  }

  _injectCss() {
    if (this._cssInjected) return;
    try {
      document.querySelectorAll('style[data-dawn-readwise]').forEach((n) => n.remove());
    } catch (_) {}
    const el = document.createElement('style');
    el.setAttribute('data-dawn-readwise', '1');
    // Look-only port of production th-footer chrome (no Path B / scan logic).
    el.textContent = `
      .dawn-th-footer {
        margin: 14px 0 8px;
        font: inherit;
        color: inherit;
      }
      .dawn-th-footer--highlights {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        overflow: visible;
      }
      .dawn-th-header {
        display: flex; align-items: center; gap: 6px;
        justify-content: space-between;
        width: 100%;
        min-height: 28px; padding: 0; margin: 0 0 2px;
        user-select: none;
      }
      .dawn-th-header-main {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        flex: 0 1 auto;
      }
      .dawn-th-pill {
        appearance: none;
        display: inline-flex !important;
        align-items: center;
        gap: 8px;
        max-width: 100%;
        padding: 4px 12px 4px 8px !important;
        min-height: 28px;
        border-radius: 999px !important;
        background: var(--button-minimal-bg-color, var(--bg-secondary, rgba(127,127,127,0.14))) !important;
        border: 1px solid var(--divider-color, rgba(255,255,255,0.08)) !important;
        color: inherit;
        cursor: pointer;
        font: inherit;
      }
      .dawn-th-title-icon {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        opacity: 0.9;
        line-height: 0;
      }
      .dawn-th-inline-svg { display: inline-flex; line-height: 0; }
      .dawn-th-inline-svg svg { display: block; }
      .dawn-th-title {
        flex: 0 1 auto;
        font-size: 13px;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .dawn-th-count {
        flex: 0 0 auto;
        font-size: 12px;
        color: var(--text-muted, rgba(200,190,170,0.72));
        font-variant-numeric: tabular-nums;
      }
      .dawn-th-count:empty { display: none; }
      .dawn-th-chevron {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
        color: var(--text-muted, rgba(200,190,170,0.75));
        transition: transform 0.12s ease;
        transform: rotate(0deg);
        opacity: 0.85;
        flex: 0 0 auto;
      }
      .dawn-th-chevron--open { transform: rotate(90deg); }
      .dawn-th-chevron svg { display: block; }
      .dawn-th-header-actions {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        margin-left: auto;
        flex: 0 0 auto;
      }
      .dawn-th-hover-action {
        appearance: none;
        border: none;
        background: transparent;
        color: var(--text-muted, rgba(200,190,170,0.75));
        cursor: pointer;
        width: 22px;
        height: 22px;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.12s, color 0.12s;
        border-radius: 6px;
        line-height: 0;
      }
      .dawn-th-hover-action svg { display: block; }
      .dawn-th-header:hover .dawn-th-hover-action,
      .dawn-th-header:focus-within .dawn-th-hover-action,
      .dawn-th-hover-action:focus-visible { opacity: 1; }
      .dawn-th-hover-action:hover { color: inherit; background: rgba(255,255,255,0.06); }
      .dawn-th-hover-action.is-active { opacity: 1; color: inherit; }
      @media (hover: none), (pointer: coarse) {
        .dawn-th-hover-action { opacity: 0.6; }
      }
      .dawn-th-menu {
        position: fixed;
        z-index: 100000;
        min-width: 220px;
        padding: 5px;
        border-radius: 10px;
        background: var(--cmdpal-bg-color, var(--panel-bg-color, #1d1915));
        border: 1px solid var(--divider-color, rgba(255,255,255,0.1));
        box-shadow: 0 8px 32px rgba(0,0,0,0.45);
        display: flex;
        flex-direction: column;
        gap: 1px;
      }
      .dawn-th-menu-item {
        appearance: none;
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        border: none;
        background: transparent;
        color: inherit;
        font: inherit;
        font-size: 13px;
        padding: 7px 8px;
        border-radius: 7px;
        cursor: pointer;
        text-align: left;
      }
      .dawn-th-menu-item:hover { background: rgba(255,255,255,0.06); }
      .dawn-th-menu-check {
        width: 14px;
        text-align: center;
        opacity: 0.85;
        font-size: 12px;
      }
      .dawn-th-footer--highlights .dawn-th-body {
        background: transparent !important;
        border: none;
        border-left: 1px solid rgba(255,255,255,0.08);
        margin: 4px 0 4px 10px;
        padding: 6px 0 4px 14px;
      }
      .dawn-th-footer.is-collapsed .dawn-th-body { display: none; }
      .dawn-th-group {
        border-top: 1px solid rgba(255,255,255,0.06);
        padding-top: 6px;
        margin-top: 6px;
      }
      .dawn-th-group:first-child {
        border-top: none;
        margin-top: 0;
        padding-top: 2px;
      }
      .dawn-th-group-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 0;
        border-radius: 8px;
      }
      .dawn-th-group-header:hover {
        background: rgba(255,255,255,0.04);
      }
      .dawn-th-source-title-cluster {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        flex: 1 1 auto;
        min-width: 0;
      }
      .dawn-th-source-icon-slot {
        flex: 0 0 auto;
        width: 20px;
        display: inline-flex;
        align-items: center;
        justify-content: flex-start;
        color: var(--text-muted, rgba(200,190,170,0.75));
        opacity: 0.7;
        line-height: 0;
      }
      .dawn-th-source-title {
        font-weight: 600;
        font-size: 15px;
        line-height: 1.7;
        color: inherit;
        flex: 1 1 auto;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        cursor: pointer;
        background: none;
        border: none;
        padding: 0;
        font: inherit;
        font-weight: 600;
        text-align: left;
      }
      .dawn-th-source-title:hover { text-decoration: underline; }
      .dawn-th-group-count {
        font-size: 13px;
        color: var(--text-muted, rgba(200,190,170,0.72));
        font-weight: 500;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .dawn-th-expand-btn {
        appearance: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--text-muted, rgba(200,190,170,0.75));
        cursor: pointer;
        padding: 0;
        margin: 0;
        background: none;
        border: none;
        width: 16px;
        height: 16px;
        opacity: 0;
        flex-shrink: 0;
        transition: opacity 0.12s;
      }
      .dawn-th-group-header:hover .dawn-th-expand-btn,
      .dawn-th-expand-btn:focus-visible,
      .dawn-th-expand-btn.is-expanded { opacity: 1; }
      @media (hover: none), (pointer: coarse) {
        .dawn-th-expand-btn { opacity: 0.65; }
      }
      .dawn-th-preview {
        margin: 2px 0 4px 22px;
        padding-left: 10px;
        border-left: 2px solid rgba(255,255,255,0.08);
      }
      .dawn-th-highlight-top {
        display: flex;
        align-items: flex-start;
        gap: 6px;
      }
      .dawn-th-highlight-top .dawn-th-highlight-text { flex: 1 1 auto; min-width: 0; }
      .dawn-th-source-title--link {
        cursor: pointer;
        text-align: left;
      }
      .dawn-th-source-title--link:hover { text-decoration: underline; }
      .dawn-th-menu-sep {
        height: 1px;
        margin: 4px 6px;
        background: rgba(255,255,255,0.08);
      }
      .dawn-th-shuffler-loc {
        margin-top: 6px;
        font-size: 11.5px;
        color: var(--text-muted, rgba(200,190,170,0.72));
      }
      .dawn-th-shuffler-loc-link {
        color: inherit;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .dawn-shuffler-detached-host {
        margin-top: 22px;
      }
      .dawn-shuffler-detached-shell {
        isolation: isolate;
        border-radius: 10px;
        overflow: hidden;
        padding: 10px 12px;
        background: color-mix(in srgb, var(--panel-bg-color, rgba(24,23,28)) 38%, transparent);
        border: 1px solid rgba(255,255,255,0.1);
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.05),
          0 10px 36px rgba(0,0,0,0.35);
        backdrop-filter: blur(22px) saturate(1.45);
        -webkit-backdrop-filter: blur(22px) saturate(1.45);
      }
      .dawn-shuffler-detached-shell.is-mobile,
      .is-mobile .dawn-shuffler-detached-shell {
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
      }
      .dawn-th-footer--shuffler.is-in-detached-host {
        margin-top: 0 !important;
        padding: 0 !important;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        overflow: visible;
      }
      .dawn-th-highlight-row {
        padding: 6px 2px 8px;
        cursor: pointer;
        border-radius: 6px;
      }
      .dawn-th-highlight-row:hover {
        background: rgba(255,255,255,0.04);
      }
      .dawn-th-panel-nav-actions {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        flex: 0 0 auto;
        opacity: 0;
        margin-left: 6px;
        transition: opacity 120ms ease;
      }
      .dawn-th-group-header:hover .dawn-th-panel-nav-actions,
      .dawn-th-group-header:focus-within .dawn-th-panel-nav-actions,
      .dawn-th-highlight-row:hover .dawn-th-panel-nav-actions,
      .dawn-th-highlight-row:focus-within .dawn-th-panel-nav-actions {
        opacity: 1;
      }
      @media (hover: none), (pointer: coarse) {
        .dawn-th-panel-nav-actions { opacity: 0.75; }
      }
      .dawn-th-panel-nav-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        padding: 0;
        border-radius: 5px;
        color: var(--text-muted, rgba(200,190,170,0.75));
        line-height: 1;
      }
      .dawn-th-panel-nav-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 14px;
        height: 14px;
      }
      .dawn-th-panel-nav-icon svg {
        display: block;
        width: 14px;
        height: 14px;
      }
      .dawn-th-panel-nav-btn:hover {
        color: inherit;
        background: rgba(255,255,255,0.08);
      }
      .dawn-th-highlight-text {
        font-size: 13.5px;
        line-height: 1.55;
        color: inherit;
        opacity: 0.9;
      }
      .dawn-th-highlight-meta {
        margin-top: 3px;
        font-size: 11px;
        color: var(--text-muted, rgba(200,190,170,0.7));
      }
      .dawn-th-empty {
        opacity: .65; padding: 4px 0;
        font-style: italic;
        font-size: 12px;
        color: var(--text-muted, inherit);
      }


      .dawn-th-highlight-note {
        margin-top: 4px;
        font-size: 12px;
        color: var(--text-muted, rgba(200,190,170,0.78));
        font-style: italic;
        line-height: 1.35;
      }
      .dawn-th-shuffler-note {
        margin-top: 8px;
        padding-left: 10px;
        border-left: 2px solid rgba(255,255,255,0.12);
        font-size: 12px;
        color: var(--text-muted, rgba(200,190,170,0.78));
        font-style: italic;
        line-height: 1.35;
      }

      .dawn-th-footer--shuffler {
        isolation: isolate;
        position: relative;
        border-radius: 10px;
        overflow: hidden;
        padding: 10px 14px 12px;
        margin-top: 18px;
        background: color-mix(in srgb, var(--panel-bg-color, rgba(24,23,28)) 38%, transparent);
        border: 1px solid rgba(255,255,255,0.055);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 28px rgba(0,0,0,0.16);
        backdrop-filter: blur(22px) saturate(1.45);
        -webkit-backdrop-filter: blur(22px) saturate(1.45);
      }
      .dawn-th-footer--shuffler.is-mobile,
      .is-mobile .dawn-th-footer--shuffler {
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
      }
      .dawn-th-shuffler-chrome {
        display: flex;
        align-items: center;
        gap: 6px;
        min-height: 30px;
        margin-bottom: 6px;
      }
      .dawn-th-footer--shuffler:not(.dawn-th-shuffler-is-collapsed) .dawn-th-shuffler-chrome {
        position: relative;
        min-height: 0;
        height: 0;
        margin: 0;
        padding: 0;
        overflow: visible;
      }
      .dawn-th-footer--shuffler:not(.dawn-th-shuffler-is-collapsed) .dawn-th-shuffler-title-icon,
      .dawn-th-footer--shuffler:not(.dawn-th-shuffler-is-collapsed) .dawn-th-shuffler-panel-title,
      .dawn-th-footer--shuffler:not(.dawn-th-shuffler-is-collapsed) .dawn-th-shuffler-toggle {
        display: none !important;
      }
      .dawn-th-footer--shuffler.dawn-th-shuffler-is-collapsed {
        min-height: 34px;
      }
      .dawn-th-shuffler-toggle {
        appearance: none;
        border: none;
        background: transparent;
        color: inherit;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        padding: 2px 6px;
        opacity: 0.7;
      }
      .dawn-th-shuffler-body {
        text-align: center;
        padding: 12px 8px 6px;
        border: none;
        margin: 0;
      }
      .dawn-th-footer--shuffler.dawn-th-shuffler-is-collapsed .dawn-th-shuffler-body {
        padding-top: 0;
      }

      .dawn-th-shuffler-idle {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 14px;
        max-width: 36em;
        margin: 0 auto;
        border: none;
        background: none;
        padding: 10px 8px 8px;
      }
      .dawn-th-shuffler-idle-caption {
        font-size: 13px;
        line-height: 1.65;
        opacity: 0.42;
        text-align: center;
        max-width: 22em;
      }
      .dawn-th-shuffler-draw-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
        border: none;
        background: none;
        padding: 6px 8px;
        color: inherit;
        opacity: 0.52;
        cursor: pointer;
        transition: opacity 0.12s;
      }
      .dawn-th-shuffler-draw-btn:hover { opacity: 0.92; }

      .dawn-th-shuffler-top-actions {
        width: 100%;
        margin: 0 auto;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .dawn-th-shuffler-quote-hover-zone {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 2px 4px;
      }
      .dawn-th-shuffler-quote-hover-zone::before {
        content: '';
        position: absolute;
        right: 100%;
        width: 20px;
        top: 0;
        bottom: 0;
      }
      .dawn-th-shuffler-collapse-mini {
        position: absolute;
        right: 100%;
        margin-right: 5px;
        top: 50%;
        transform: translateY(-50%);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.12s ease;
        color: var(--text-muted, rgba(200,190,170,0.75));
        cursor: pointer;
        border: none;
        background: transparent;
        width: 18px;
        height: 18px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        font-size: 14px;
        line-height: 1;
      }
      .dawn-th-shuffler-quote-hover-zone:hover .dawn-th-shuffler-collapse-mini,
      .dawn-th-shuffler-quote-hover-zone:focus-within .dawn-th-shuffler-collapse-mini {
        opacity: 1;
        pointer-events: auto;
      }
      .dawn-th-shuffler-quote-mark-row { margin-bottom: 12px; }
      .dawn-th-shuffler-quote-mark {
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0;
        line-height: 0;
        opacity: 0.48;
        pointer-events: none;
      }
      .dawn-th-shuffler-quote-view {
        position: relative;
        margin: 2px auto 0;
        padding: 8px 6px 6px;
        max-width: 36em;
      }
      .dawn-th-shuffler-quote-body {
        cursor: pointer;
        padding: 4px 8px 0;
        text-align: center;
      }
      .dawn-th-shuffler-quote-display {
        font-size: 15px;
        line-height: 1.82;
        opacity: 0.88;
        letter-spacing: 0.01em;
        text-align: center;
        margin: 0 auto;
      }
      .dawn-th-shuffler-ritual-divider {
        width: 32px;
        height: 1px;
        background: rgba(255,255,255,0.09);
        margin: 20px auto 0;
      }
      .dawn-th-shuffler-source {
        margin-top: 14px;
        font-size: 14px;
        font-weight: 600;
        opacity: 0.78;
        text-align: center;
      }
      .dawn-th-shuffler-author {
        margin-top: 6px;
        font-size: 12px;
        opacity: 0.45;
        text-align: center;
      }
      .dawn-th-shuffler-quote-reshuffle-wrap {
        display: flex;
        justify-content: center;
        align-items: center;
        margin-top: 18px;
        padding-top: 2px;
      }
      .dawn-th-shuffler-quote-reshuffle {
        padding: 4px 6px;
        line-height: 0;
        border: none;
        background: none;
        opacity: 0.48;
        cursor: pointer;
        color: inherit;
        transition: opacity 0.12s;
      }
      .dawn-th-shuffler-quote-reshuffle:hover { opacity: 0.9; }
    `;
    document.documentElement.appendChild(el);
    this._styleEl = el;
    this._cssInjected = true;
  }

  _findContainer(panelEl) {
    if (!panelEl) return null;
    let last = null;
    for (const sel of ['.page-content', '.editor-wrapper', '.editor-panel', '#editor']) {
      const nodes = panelEl.querySelectorAll?.(sel);
      if (nodes?.length) last = nodes[nodes.length - 1];
    }
    return last || panelEl;
  }

  _mountHighlightsInContainer(container, hi) {
    if (!container || !hi) return;
    const bl =
      container.querySelector('[data-dawn-backlinks="1"]') ||
      container.querySelector('.dawn-tlr-footer');
    if (bl) {
      if (bl.nextElementSibling !== hi) container.insertBefore(hi, bl.nextSibling);
      return;
    }
    if (hi.parentElement !== container) container.appendChild(hi);
  }

  _isJournal(record) {
    try {
      if (record?.getJournalDetails?.()?.date) return true;
    } catch (_) {}
    try {
      return /(?:^|[-_:])\d{8}$/.test(String(record?.guid || ''));
    } catch (_) {}
    return false;
  }

  _dayKey(record) {
    try {
      const d = record?.getJournalDetails?.()?.date;
      if (d instanceof Date && !isNaN(d.getTime())) {
        return (
          d.getFullYear() +
          '-' +
          String(d.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(d.getDate()).padStart(2, '0')
        );
      }
      if (typeof d === 'string') {
        const m = d.match(/(\d{4}-\d{2}-\d{2})/);
        if (m) return m[1];
      }
    } catch (_) {}
    try {
      const m = String(record?.guid || '').match(/(\d{8})$/);
      if (m) {
        const s = m[1];
        return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
      }
    } catch (_) {}
    return null;
  }

  _loadShuffleByDay() {
    try {
      const raw = localStorage.getItem(RW_LS_SHUFFLE_BY_DAY);
      if (!raw) return;
      const o = JSON.parse(raw);
      if (o && typeof o === 'object' && !Array.isArray(o)) this._shuffleByDay = o;
    } catch (_) {}
  }

  _saveShuffleByDay() {
    try {
      localStorage.setItem(RW_LS_SHUFFLE_BY_DAY, JSON.stringify(this._shuffleByDay));
    } catch (_) {}
  }

  _stickyForDay(dayKey) {
    if (!dayKey) return null;
    const saved = this._shuffleByDay[dayKey];
    if (!saved || !saved.guid || !String(saved.text || '').trim()) return null;
    return saved;
  }

  /** Resolve sticky from map; refresh text from index if available. */
  _quoteForDay(dayKey) {
    const saved = this._stickyForDay(dayKey);
    if (!saved) return null;
    const live =
      (this._index.items || []).find((x) => x.guid === saved.guid) ||
      (this._quotePool || []).find((x) => x.guid === saved.guid);
    if (live) {
      return {
        guid: live.guid,
        text: live.text || live.title,
        author: live.author,
        source: live.source,
        title: live.title,
        note: live.note || '',
        location: live.location || '',
        url: live.url || '',
        category: live.category || '',
      };
    }
    return {
      guid: saved.guid,
      text: saved.text,
      author: saved.author || '',
      source: saved.source || '',
      title: saved.title || '',
      note: saved.note || '',
      location: saved.location || '',
      url: saved.url || '',
      category: saved.category || '',
    };
  }

  _poolForDraw() {
    if (Array.isArray(this._quotePool) && this._quotePool.length) return this._quotePool;
    if (Array.isArray(this._index.items) && this._index.items.length) return this._index.items;
    const byDay = this._index.byDay || {};
    const out = [];
    for (const k of Object.keys(byDay)) {
      const rows = byDay[k];
      if (Array.isArray(rows)) out.push(...rows);
    }
    return out;
  }

  _applyEnginePoolRows(pool) {
    const rows = Array.isArray(pool) ? pool : [];
    this._quotePool = rows
      .map((p) => ({
        guid: p.guid || p.id || '',
        text: p.text || p.quote || '',
        author: p.author || p.source_author || p.sa || '',
        source: p.source || p.source_title || p.st || p.title || '',
        title: p.title || p.source_title || p.st || '',
        note: p.note || '',
        location: p.location || p.loc || '',
        url: p.url || '',
        category: p.category || p.cat || '',
      }))
      .filter((p) => String(p.text || '').trim());
    return this._quotePool;
  }

  /**
   * Ensure Quote Shuffler draws from References (prod pool cache), not a thin day-index fallback.
   * Heavy scan is onDemand only (draw / explicit rebuild) — never on panel.navigated.
   */
  async _ensureQuotePool({ force = false } = {}) {
    this._hydrateProdShuffle();
    const eng = this._rwSync;
    if (!eng) return this._poolForDraw();

    const cached = Array.isArray(this._quotePool) ? this._quotePool.length : 0;
    const needRebuild = force || cached === 0 || (typeof eng._isQuotePoolCacheStale === 'function' && eng._isQuotePoolCacheStale());

    if (!needRebuild) return this._quotePool;

    try {
      if (force) {
        try {
          localStorage.removeItem(RW_LS_POOL_PROD);
        } catch (_) {}
        eng._quotePoolCache = null;
        eng._quotePoolCacheSavedAt = 0;
      } else {
        try {
          eng._hydrateQuotePoolCacheFromStorage?.();
        } catch (_) {}
      }

      const toast = (msg) => {
        try {
          this.ui?.showToaster?.({ title: 'Readwise', message: String(msg), type: 'info' });
        } catch (_) {}
      };
      const onProgress = (msg) => {
        if (msg) toast(String(msg));
      };

      const pool = force
        ? await eng._rebuildQuoteShufflePoolFromReferences({ persist: true, onProgress })
        : await eng._getQuoteShufflePoolFromReferences();

      this._hydrateProdShuffle();
      if (!(this._quotePool && this._quotePool.length) && Array.isArray(pool) && pool.length) {
        this._applyEnginePoolRows(pool);
      }
    } catch (e) {
      console.warn('[Dawn/Readwise] quote pool ensure', e);
    }
    return this._poolForDraw();
  }

  async _rebuildQuoteLibrary({ toast = false } = {}) {
    const pool = await this._ensureQuotePool({ force: true });
    if (toast) {
      const n = Array.isArray(pool) ? pool.length : 0;
      try {
        this.ui?.showToaster?.({
          title: 'Readwise',
          message: n
            ? `Quote library rebuilt (${n} highlights).`
            : 'Quote library empty — sync Readwise first.',
          type: n ? 'success' : 'warning',
        });
      } catch (_) {}
    }
    this._refreshAll();
    return pool;
  }

  async _drawQuoteForDay(dayKey, { forcePool = false } = {}) {
    if (!dayKey) return null;
    const items = await this._ensureQuotePool({ force: forcePool });
    if (!items.length) return null;
    const prev = this._stickyForDay(dayKey);
    let pick = items[Math.floor(Math.random() * items.length)];
    if (items.length > 1 && prev?.guid && pick.guid === prev.guid) {
      pick = items[(items.indexOf(pick) + 1) % items.length];
    }
    // Prefer avoiding same source repeatedly when the library is large enough.
    if (items.length > 8 && prev?.source) {
      const prevSrc = String(prev.source || prev.title || '').trim().toLowerCase();
      for (let i = 0; i < 6; i++) {
        const cand = items[Math.floor(Math.random() * items.length)];
        const src = String(cand.source || cand.title || '').trim().toLowerCase();
        if (src && prevSrc && src === prevSrc) continue;
        if (prev?.guid && cand.guid === prev.guid) continue;
        pick = cand;
        break;
      }
    }
    const stored = {
      guid: pick.guid,
      text: pick.text || pick.title || '',
      author: pick.author || '',
      source: pick.source || '',
      title: pick.title || '',
      note: pick.note || '',
      location: pick.location || '',
      url: pick.url || '',
      category: pick.category || '',
      at: Date.now(),
    };
    this._shuffleByDay[dayKey] = stored;
    this._saveShuffleByDay();
    return stored;
  }

  _handlePanel(panel) {
    const panelId = panel?.getId?.();
    if (!panelId) return;
    const record = panel?.getActiveRecord?.();
    if (!this._isJournal(record)) {
      this._dispose(panelId);
      return;
    }
    const dayKey = this._dayKey(record);
    if (!dayKey) {
      this._dispose(panelId);
      return;
    }
    let state = this._panelStates.get(panelId);
    if (!state) {
      state = { panelId };
      this._panelStates.set(panelId, state);
    }
    state.panel = panel;
    state.dayKey = dayKey;
    this._activeDayKey = dayKey;
    const container = this._findContainer(panel?.getElement?.());
    if (!container) return;

    // Backlinks stays above highlights when both footers are present.
    if (!state.hiRoot || !state.hiRoot.isConnected || !state.hiCount) {
      try {
        state.hiRoot?.remove?.();
      } catch (_) {}
      const hi = document.createElement('div');
      hi.className =
        'dawn-th-footer dawn-th-footer--highlights dawn-th-footer--native th-footer--native';
      hi.setAttribute('data-dawn-readwise', 'highlights');
      const built = this._buildHighlightsHeader();
      const body = document.createElement('div');
      body.className = 'dawn-th-body';
      hi.appendChild(built.header);
      hi.appendChild(body);
      this._mountHighlightsInContainer(container, hi);
      state.hiRoot = hi;
      state.hiPill = built.pill;
      state.hiCount = built.count;
      state.hiCaret = built.caret;
      state.quoteBtn = built.quoteBtn;
      state.hiBody = body;
    } else {
      this._mountHighlightsInContainer(container, state.hiRoot);
    }

    const mountMode = this._shufflerMountMode();
    if (mountMode === 'off') {
      try {
        state.shRoot?.remove?.();
      } catch (_) {}
      this._removeDetachedShufflerHost(state);
      state.shRoot = null;
      state.shToggle = null;
      state.shBody = null;
      state.shufflerMountMode = 'off';
    } else {
      const wantDetached = mountMode === 'detached';
      const modeChanged = state.shufflerMountMode !== mountMode;
      let shParent = container;
      if (wantDetached) {
        const host = this._ensureDetachedShufflerHost(container, panelId);
        shParent = host?.shell || container;
        state.detachedHostEl = host?.host || null;
      } else {
        this._removeDetachedShufflerHost(state);
      }

      if (!state.shRoot || !state.shRoot.isConnected || !state.shToggle || modeChanged) {
        try {
          state.shRoot?.remove?.();
        } catch (_) {}
        const sh = this._buildShufflerShell();
        shParent.appendChild(sh.root);
        state.shRoot = sh.root;
        state.shToggle = sh.toggle;
        state.shBody = sh.body;
      } else if (state.shRoot.parentElement !== shParent) {
        shParent.appendChild(state.shRoot);
      }
      if (state.shRoot) {
        const mobile =
          !!this._isMobile || !!(globalThis.BootKernel || globalThis.__dawnBoot)?.isMobile?.();
        state.shRoot.classList.toggle('is-mobile', mobile);
      }
      state.shufflerMountMode = mountMode;
    }

    this._paint(state);
  }

  _appendShufflerCollapseMini(centerEl) {
    const top = document.createElement('div');
    top.className = 'dawn-th-shuffler-top-actions';
    const zone = document.createElement('div');
    zone.className = 'dawn-th-shuffler-quote-hover-zone';
    const mini = document.createElement('button');
    mini.type = 'button';
    mini.className = 'dawn-th-shuffler-collapse-mini';
    mini.title = 'Collapse Quote Shuffler';
    mini.setAttribute('aria-label', 'Collapse Quote Shuffler');
    mini.innerHTML = '<i class="ti ti-chevron-up" aria-hidden="true"></i>';
    mini.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      this._cfg.shufflerCollapsed = true;
      this._saveCfg();
      this._refreshAll();
    });
    zone.appendChild(mini);
    zone.appendChild(centerEl);
    top.appendChild(zone);
    return top;
  }

  _paintShufflerBody(state) {
    const body = state.shBody;
    if (!body) return;
    body.innerHTML = '';
    const q = this._quoteForDay(state.dayKey);
    if (!q) {
      const idle = document.createElement('div');
      idle.className = 'dawn-th-shuffler-idle';
      const iconBtn = document.createElement('button');
      iconBtn.type = 'button';
      iconBtn.className =
        'dawn-th-shuffler-draw-btn button-none button-small button-minimal-hover';
      iconBtn.title = 'Draw a random quote for this day';
      this._appendSvg(iconBtn, 'quote', 28);
      iconBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        body.innerHTML = '<div class="dawn-th-empty">Loading quote library…</div>';
        void this._drawQuoteForDay(state.dayKey, { forcePool: !(this._quotePool && this._quotePool.length) })
          .then((picked) => {
            if (!picked) {
              body.innerHTML =
                '<div class="dawn-th-empty">No quotes yet — sync Readwise, then try again.</div>';
              return;
            }
            this._refreshAll();
          })
          .catch(() => {
            body.innerHTML = '<div class="dawn-th-empty">Could not load quotes.</div>';
          });
      });
      const cap = document.createElement('div');
      cap.className = 'dawn-th-shuffler-idle-caption';
      cap.textContent =
        this._index.count || this._quotePool?.length
          ? 'Draw a quote for this day'
          : 'Draw a quote (builds library on first use)';
      idle.appendChild(this._appendShufflerCollapseMini(iconBtn));
      idle.appendChild(cap);
      body.appendChild(idle);
      return;
    }

    const view = document.createElement('div');
    view.className = 'dawn-th-shuffler-quote-view';
    const qBody = document.createElement('div');
    qBody.className = 'dawn-th-shuffler-quote-body';

    const markWrap = document.createElement('div');
    markWrap.className = 'dawn-th-shuffler-quote-mark';
    markWrap.setAttribute('aria-hidden', 'true');
    this._appendSvg(markWrap, 'quote', 22);
    const markRow = this._appendShufflerCollapseMini(markWrap);
    markRow.classList.add('dawn-th-shuffler-quote-mark-row');
    qBody.appendChild(markRow);

    const quoteEl = document.createElement('div');
    quoteEl.className = 'dawn-th-shuffler-quote-display';
    quoteEl.textContent = q.text || q.title || '';
    qBody.appendChild(quoteEl);

    const hasMeta =
      (q.source && String(q.source).trim()) ||
      (q.title && String(q.title).trim()) ||
      (q.author && String(q.author).trim());
    if (hasMeta) {
      const divider = document.createElement('div');
      divider.className = 'dawn-th-shuffler-ritual-divider';
      qBody.appendChild(divider);
    }
    const srcText = (q.source || q.title || '').trim();
    if (srcText) {
      const src = document.createElement('div');
      src.className = 'dawn-th-shuffler-source';
      src.textContent = srcText;
      qBody.appendChild(src);
    }
    if (q.author && String(q.author).trim() && !this._looksLikeOpaqueId(q.author)) {
      const auth = document.createElement('div');
      auth.className = 'dawn-th-shuffler-author';
      auth.textContent = q.author;
      qBody.appendChild(auth);
    }
    if (q.note) {
      const noteEl = document.createElement('div');
      noteEl.className = 'dawn-th-shuffler-note';
      noteEl.textContent = q.note;
      qBody.appendChild(noteEl);
    }
    if (q.location && String(q.location).trim()) {
      const loc = document.createElement('div');
      loc.className = 'dawn-th-shuffler-loc';
      const locText = String(q.location).trim();
      if (q.url && /^https?:\/\//i.test(String(q.url))) {
        const a = document.createElement('a');
        a.className = 'dawn-th-shuffler-loc-link';
        a.href = String(q.url);
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = locText;
        a.addEventListener('click', (ev) => ev.stopPropagation());
        loc.appendChild(a);
      } else {
        loc.textContent = locText;
      }
      qBody.appendChild(loc);
    }

    const reshuffleWrap = document.createElement('div');
    reshuffleWrap.className = 'dawn-th-shuffler-quote-reshuffle-wrap';
    const reshuffle = document.createElement('button');
    reshuffle.type = 'button';
    reshuffle.className =
      'dawn-th-shuffler-quote-reshuffle button-none button-small button-minimal-hover';
    reshuffle.title = 'Another random quote for this day';
    this._appendSvg(reshuffle, 'shuffle', 14);
    reshuffle.addEventListener('click', (ev) => {
      ev.stopPropagation();
      reshuffle.disabled = true;
      void this._drawQuoteForDay(state.dayKey, {
        forcePool: !(this._quotePool && this._quotePool.length > 20),
      })
        .then(() => this._refreshAll())
        .finally(() => {
          reshuffle.disabled = false;
        });
    });
    reshuffleWrap.appendChild(reshuffle);
    qBody.appendChild(reshuffleWrap);

    qBody.addEventListener('click', (ev) => {
      if (ev.target?.closest?.('button')) return;
      if (!q.guid) return;
      this._openRecord(q.guid, state.panel);
    });

    view.appendChild(qBody);
    body.appendChild(view);
  }

  _categoryIconKind(category) {
    const k = String(category || '').trim().toLowerCase();
    if (!k) return '';
    if (k.startsWith('book')) return 'cat-book';
    if (k.startsWith('article') || k === 'rss' || k.startsWith('email')) return 'cat-article';
    if (k.startsWith('podcast')) return 'cat-podcast';
    if (k.startsWith('video') || k.startsWith('tweet')) return 'cat-video';
    return '';
  }

  _looksLikeOpaqueId(s) {
    const t = String(s || '').trim();
    if (t.length < 18) return false;
    if (/^[0-9A-Fa-f]{32}$/.test(t)) return true;
    if (/^[0-9A-Z]{24,}$/.test(t) && !/\s/.test(t)) return true;
    return false;
  }

  _buildHighlightGroup(sourceTitle, items, state) {
    const key = sourceTitle || 'Unknown source';
    const isExpanded = this._expandedSources.get(key) === true;

    const group = document.createElement('div');
    group.className = 'dawn-th-group' + (isExpanded ? ' is-expanded' : '');

    const header = document.createElement('div');
    header.className = 'dawn-th-group-header';

    const expandBtn = document.createElement('button');
    expandBtn.type = 'button';
    expandBtn.className =
      'dawn-th-expand-btn button-none button-small button-minimal-hover' +
      (isExpanded ? ' is-expanded' : '');
    expandBtn.title = isExpanded ? 'Collapse' : 'Show highlights';
    const caret = this._buildChevron(isExpanded);
    caret.classList.add('dawn-th-expand-caret');
    expandBtn.appendChild(caret);

    const cluster = document.createElement('div');
    cluster.className = 'dawn-th-source-title-cluster';
    const iconSlot = document.createElement('span');
    iconSlot.className = 'dawn-th-source-icon-slot';
    const catKind = this._categoryIconKind(items[0]?.category);
    if (catKind) this._appendSvg(iconSlot, catKind, 14);
    const sourceTitleEl = document.createElement('span');
    sourceTitleEl.className = 'dawn-th-source-title dawn-th-source-title--link';
    sourceTitleEl.textContent = key;
    sourceTitleEl.title = 'Open reference (⌘/Ctrl-click for new panel when supported)';
    const refGuid = items[0]?.guid || '';
    sourceTitleEl.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (!refGuid) return;
      this._openRecord(refGuid, state.panel, {
        newPanel: !!(ev.metaKey || ev.ctrlKey),
      });
    });
    cluster.appendChild(iconSlot);
    cluster.appendChild(sourceTitleEl);
    if (refGuid) cluster.appendChild(this._buildPanelNavActions(refGuid, state));

    const count = document.createElement('span');
    count.className = 'dawn-th-group-count';
    count.textContent =
      items.length === 1 ? '1 highlight' : items.length + ' highlights';

    header.appendChild(expandBtn);
    header.appendChild(cluster);
    header.appendChild(count);

    const preview = document.createElement('div');
    preview.className = 'dawn-th-preview';
    preview.style.display = isExpanded ? 'block' : 'none';
    for (const h of items) {
      const row = document.createElement('div');
      row.className = 'dawn-th-highlight-row';
      row.title = 'Open highlight';
      const top = document.createElement('div');
      top.className = 'dawn-th-highlight-top';
      const quote = document.createElement('div');
      quote.className = 'dawn-th-highlight-text';
      quote.textContent = h.text || h.title || '';
      top.appendChild(quote);
      if (h.guid) top.appendChild(this._buildPanelNavActions(h.guid, state));
      row.appendChild(top);
      if (h.note) {
        const noteEl = document.createElement('div');
        noteEl.className = 'dawn-th-highlight-note';
        noteEl.textContent = '✎ ' + h.note;
        row.appendChild(noteEl);
      }
      if (h.location && String(h.location).trim()) {
        const meta = document.createElement('div');
        meta.className = 'dawn-th-highlight-meta';
        meta.textContent = String(h.location).trim();
        row.appendChild(meta);
      }
      row.addEventListener('click', (ev) => {
        if (ev.target?.closest?.('.dawn-th-panel-nav-actions')) return;
        ev.stopPropagation();
        if (!h.guid) return;
        void this._openRecord(h.guid, state.panel, {
          newPanel: !!(ev.metaKey || ev.ctrlKey),
        });
      });
      preview.appendChild(row);
    }

    expandBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const next = !this._expandedSources.get(key);
      this._expandedSources.set(key, next);
      group.classList.toggle('is-expanded', next);
      preview.style.display = next ? 'block' : 'none';
      this._syncChevron(caret, next);
      expandBtn.classList.toggle('is-expanded', next);
      expandBtn.title = next ? 'Collapse' : 'Show highlights';
    });

    group.appendChild(header);
    group.appendChild(preview);
    return group;
  }

  _paint(state) {
    const hits = (this._index.byDay && this._index.byDay[state.dayKey]) || [];

    if (state.hiRoot) {
      state.hiRoot.classList.toggle('is-collapsed', !!this._cfg.highlightsCollapsed);
      this._syncChevron(state.hiCaret, !this._cfg.highlightsCollapsed);
      if (state.quoteBtn) {
        state.quoteBtn.classList.toggle('is-active', this._showShuffler());
        state.quoteBtn.title = this._showShuffler()
          ? 'Hide Quote Shuffler'
          : 'Show Quote Shuffler';
        state.quoteBtn.setAttribute('aria-label', state.quoteBtn.title);
      }
      if (state.hiCount) {
        state.hiCount.textContent = this._index.count ? String(hits.length) : '';
      }
      if (this._cfg.highlightsCollapsed && state.hiBody) {
        state.hiBody.innerHTML = '';
      } else if (!this._cfg.highlightsCollapsed && state.hiBody) {
        state.hiBody.innerHTML = '';
        if (!this._index.count) {
          state.hiBody.innerHTML =
            '<div class="dawn-th-empty">No highlights indexed on this device.</div>';
        } else if (!hits.length) {
          state.hiBody.innerHTML =
            '<div class="dawn-th-empty">No highlights for this day.</div>';
        } else {
          const groups = new Map();
          for (const h of hits) {
            const key = (h.source || h.title || 'Unknown source').trim() || 'Unknown source';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(h);
          }
          const sorted = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
          for (const [sourceTitle, items] of sorted) {
            state.hiBody.appendChild(this._buildHighlightGroup(sourceTitle, items, state));
          }
        }
      }
    }

    if (state.shRoot && this._showShuffler()) {
      state.shRoot.classList.toggle('is-detached', !!this._cfg.shufflerDetached);
      this._syncShufflerLayout(state);
      if (!this._cfg.shufflerCollapsed) this._paintShufflerBody(state);
    }
  }

  _dispose(panelId) {
    const state = this._panelStates.get(panelId);
    if (!state) return;
    try {
      state.hiRoot?.remove?.();
    } catch (_) {}
    try {
      state.shRoot?.remove?.();
    } catch (_) {}
    this._removeDetachedShufflerHost(state);
    this._panelStates.delete(panelId);
  }

  _refreshAll() {
    for (const s of this._panelStates.values()) {
      if (s.panel) this._handlePanel(s.panel);
    }
  }
}
