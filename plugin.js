// @generated BEGIN thymer-plugin-settings (source: plugins/public repo/plugin-settings/ThymerPluginSettingsRuntime.js — run: npm run embed-plugin-settings)
/**
 * ThymerPluginSettings — workspace **Plugin Backend** collection + optional localStorage mirror
 * for global plugins that do not own a collection. (Legacy name **Plugin Settings** is still found until renamed.)
 *
 * Edit this file, then from repo root: npm run embed-plugin-settings
 *
 * Debug: console filter `[ThymerExt/PluginBackend]`. Off by default; to enable:
 *   localStorage.setItem('thymerext_debug_collections', '1'); location.reload();
 *
 * Create dedupe: Web Locks + **per-workspace** localStorage lease/recent-create keys (workspaceGuid from
 * `data.getActiveUsers()[0]`), plus abort if an exact-named Plugin Backend collection already exists.
 *
 * Rows:
 * - **Vault** (`record_kind` = `vault`): one per `plugin_id` — holds synced localStorage payload JSON.
 * - **Other rows** (`record_kind` = `log`, `config`, …): same **Plugin** field (`plugin`) for filtering;
 *   use a **distinct** `plugin_id` per row (e.g. `habit-tracker:log:2026-04-24`) so vault lookup stays unambiguous.
 *
 * API: ThymerPluginSettings.init({ plugin, pluginId, modeKey, mirrorKeys, label, data, ui })
 *      ThymerPluginSettings.scheduleFlush(plugin, mirrorKeys)
 *      ThymerPluginSettings.flushNow(data, pluginId, mirrorKeys)
 *      ThymerPluginSettings.openStorageDialog({ plugin, pluginId, modeKey, mirrorKeys, label, data, ui })
 *      ThymerPluginSettings.listRows(data, { pluginSlug, recordKind? })
 *      ThymerPluginSettings.createDataRow(data, { pluginSlug, recordKind, rowPluginId, recordTitle?, settingsDoc? })
 *      ThymerPluginSettings.upgradeCollectionSchema(data) — merge missing `plugin` / `record_kind` fields into existing collection
 *      ThymerPluginSettings.registerPluginSlug(data, { slug, label? }) — ensure `plugin` choice includes this slug (call once per plugin)
 */
(function pluginSettingsRuntime(g) {
  if (g.ThymerPluginSettings) return;

  const COL_NAME = 'Plugin Backend';
  const COL_NAME_LEGACY = 'Plugin Settings';
  const KIND_VAULT = 'vault';
  const FIELD_PLUGIN = 'plugin';
  const FIELD_KIND = 'record_kind';
  const q = [];
  let busy = false;

  /**
   * Collection ensure diagnostics (read browser console for `[ThymerExt/PluginBackend]`.
   * Opt-in: `localStorage.setItem('thymerext_debug_collections','1')` then reload.
   * Opt-out: remove the key or set to `0` / `off` / `false`.
   */
  const DEBUG_COLLECTIONS = (() => {
    try {
      const o = localStorage.getItem('thymerext_debug_collections');
      if (o === '0' || o === 'off' || o === 'false') return false;
      return o === '1' || o === 'true' || o === 'on';
    } catch (_) {}
    return false;
  })();
  const DEBUG_PATHB_ID =
    'pb-' + (Date.now() & 0xffffffff).toString(16) + '-' + Math.random().toString(36).slice(2, 7);

  /** If true, Thymer ignores programmatic field updates — force off on every schema save. */
  const MANAGED_UNLOCK = { fields: false, views: false, sidebar: false };

  /**
   * Ensure Plugin Backend collection without duplicate `createCollection` calls.
   * Sibling **plugin iframes** are often not `window` siblings — walking `parent` can stop at
   * each plugin’s *own* frame, so a promise on “hierarchy best” is **not** one shared object.
   * **`window.top` is the same** for all same-tab iframes and, when not cross-origin, is the
   * one place to attach a cross-iframe lock. Fallback: walk the parent chain for opaque frames.
   */
  function getSharedDeduplicationWindow() {
    try {
      if (typeof window === 'undefined') return g;
      const t = window.top;
      if (t) {
        void t.document;
        return t;
      }
    } catch (_) {
      /* cross-origin top */
    }
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

  const PB_ENSURE_GLOBAL_P = '__thymerPluginBackendEnsureGlobalP';
  const SERIAL_DATA_CREATE_P = '__thymerExtSerializedDataCreateP_v1';
  /** `getAllCollections` can briefly return [] (host UI / race) after a valid non-empty read — refuse create in that window. */
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

  function chainPluginBackendEnsure(data, work) {
    const root = getSharedDeduplicationWindow();
    try {
      if (!root[PB_ENSURE_GLOBAL_P]) root[PB_ENSURE_GLOBAL_P] = Promise.resolve();
    } catch (_) {
      return Promise.resolve().then(work);
    }
    root[PB_ENSURE_GLOBAL_P] = root[PB_ENSURE_GLOBAL_P].catch(() => {}).then(work);
    return root[PB_ENSURE_GLOBAL_P];
  }

  function withUnlockedManaged(base) {
    return { ...(base && typeof base === 'object' ? base : {}), managed: MANAGED_UNLOCK };
  }

  /** Index of the “Plugin” column (`id` **plugin**, or legacy label match). */
  function findPluginColumnFieldIndex(fields) {
    const arr = Array.isArray(fields) ? fields : [];
    let i = arr.findIndex((f) => f && f.id === FIELD_PLUGIN);
    if (i >= 0) return i;
    i = arr.findIndex(
      (f) =>
        f &&
        String(f.label || '')
          .trim()
          .toLowerCase() === 'plugin' &&
        (f.type === 'text' || f.type === 'plaintext' || f.type === 'string')
    );
    return i;
  }

  /** Keep internal column identity when replacing field shape (text → choice). */
  function copyStableFieldKeys(prev, next) {
    if (!prev || !next || typeof prev !== 'object' || typeof next !== 'object') return;
    for (const k of ['guid', 'colguid', 'colGuid', 'field_guid']) {
      if (prev[k] != null && next[k] == null) next[k] = prev[k];
    }
  }

  function getPluginFieldDef(coll) {
    if (!coll || typeof coll.getConfiguration !== 'function') return null;
    try {
      const fields = coll.getConfiguration()?.fields || [];
      const i = findPluginColumnFieldIndex(fields);
      return i >= 0 ? fields[i] : null;
    } catch (_) {
      return null;
    }
  }

  function pluginColumnPropId(coll, requestedId) {
    if (requestedId !== FIELD_PLUGIN || !coll) return requestedId;
    const f = getPluginFieldDef(coll);
    return (f && f.id) || FIELD_PLUGIN;
  }

  function cloneFieldDef(f) {
    if (!f || typeof f !== 'object') return f;
    try {
      return structuredClone(f);
    } catch (_) {
      try {
        return JSON.parse(JSON.stringify(f));
      } catch (__) {
        return { ...f };
      }
    }
  }

  const PLUGIN_SETTINGS_SHAPE = {
    ver: 1,
    name: COL_NAME,
    icon: 'ti-adjustments',
    color: null,
    home: false,
    page_field_ids: [FIELD_PLUGIN, FIELD_KIND, 'plugin_id', 'created_at', 'updated_at', 'settings_json'],
    item_name: 'Setting, Config, or Log',
    description: 'Workspace storage for plugins: Use the Plugin column to filter by plugin.',
    show_sidebar_items: true,
    show_cmdpal_items: false,
    fields: [
      {
        icon: 'ti-apps',
        id: FIELD_PLUGIN,
        label: 'Plugin',
        type: 'choice',
        read_only: false,
        active: true,
        many: false,
        choices: [
          { id: 'quick-notes', label: 'quick-notes', color: '0', active: true },
          { id: 'habit-tracker', label: 'Habit Tracker', color: '0', active: true },
          { id: 'ynab', label: 'ynab', color: '0', active: true },
        ],
      },
      {
        icon: 'ti-category',
        id: FIELD_KIND,
        label: 'Record kind',
        type: 'text',
        read_only: false,
        active: true,
        many: false,
      },
      {
        icon: 'ti-id',
        id: 'plugin_id',
        label: 'Plugin ID',
        type: 'text',
        read_only: false,
        active: true,
        many: false,
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
        icon: 'ti-clock-edit',
        id: 'updated_at',
        label: 'Modified',
        many: false,
        read_only: true,
        active: true,
        type: 'datetime',
      },
      {
        icon: 'ti-code',
        id: 'settings_json',
        label: 'Settings JSON',
        type: 'text',
        read_only: false,
        active: true,
        many: false,
      },
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
    managed: { fields: false, views: false, sidebar: false },
    custom: {},
    views: [
      {
        id: 'V0YBPGDDZ0MHRSQ',
        shown: true,
        icon: 'ti-table',
        label: 'All',
        description: '',
        field_ids: ['title', FIELD_PLUGIN, FIELD_KIND, 'plugin_id', 'created_at', 'updated_at'],
        type: 'table',
        read_only: false,
        group_by_field_id: null,
        sort_dir: 'desc',
        sort_field_id: 'updated_at',
        opts: {},
      },
      {
        id: 'VPGAWVGVKZD57C9',
        shown: true,
        icon: 'ti-layout-kanban',
        label: 'By Plugin...',
        description: '',
        field_ids: ['title', FIELD_KIND, 'created_at', 'updated_at'],
        type: 'board',
        read_only: false,
        group_by_field_id: FIELD_PLUGIN,
        sort_dir: 'desc',
        sort_field_id: 'updated_at',
        opts: {},
      },
    ],
  };

  function cloneShape() {
    try {
      return structuredClone(PLUGIN_SETTINGS_SHAPE);
    } catch (_) {
      return JSON.parse(JSON.stringify(PLUGIN_SETTINGS_SHAPE));
    }
  }

  /** Append default views from the canonical shape when the workspace collection is missing them (by view `id`). */
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

  /** Slug before first colon, else whole id (e.g. `habit-tracker:log:2026-04-24` → `habit-tracker`). */
  function inferPluginSlugFromPid(pid) {
    if (!pid) return '';
    const s = String(pid).trim();
    const i = s.indexOf(':');
    if (i <= 0) return s;
    return s.slice(0, i);
  }

  function inferRecordKindFromPid(pid, slug) {
    if (!pid || !slug) return '';
    const p = String(pid);
    if (p === slug) return KIND_VAULT;
    if (p === `${slug}:config`) return 'config';
    if (p.startsWith(`${slug}:log:`)) return 'log';
    return '';
  }

  function colorForSlug(slug) {
    const colors = ['0', '1', '2', '3', '4', '5', '6', '7'];
    let h = 0;
    const s = String(slug || '');
    for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * (i + 1)) % colors.length;
    return colors[h];
  }

  /** Normalize Thymer choice option (object or legacy string). */
  function normalizeChoiceOption(c) {
    if (c == null) return null;
    if (typeof c === 'string') {
      const s = c.trim();
      if (!s) return null;
      return { id: s, label: s, color: colorForSlug(s), active: true };
    }
    const id = String(c.id ?? c.label ?? '')
      .trim();
    if (!id) return null;
    return {
      id,
      label: String(c.label ?? id).trim() || id,
      color: String(c.color != null ? c.color : colorForSlug(id)),
      active: c.active !== false,
    };
  }

  /**
   * Fresh choice field object (no legacy keys). Thymer often ignores `type` changes when merging
   * onto an existing text field’s full config — same pattern as markdown importer choice fields.
   */
  function cleanPluginChoiceField(prev, desiredPlugin, choicesList) {
    const fieldId = (prev && prev.id) || FIELD_PLUGIN;
    const next = {
      id: fieldId,
      label: (prev && prev.label) || desiredPlugin.label || 'Plugin',
      icon: (prev && prev.icon) || desiredPlugin.icon || 'ti-apps',
      type: 'choice',
      many: false,
      read_only: false,
      active: prev ? prev.active !== false : true,
      choices: Array.isArray(choicesList) ? choicesList : [],
    };
    copyStableFieldKeys(prev, next);
    return next;
  }

  /**
   * Ensure the `plugin` field is a choice field and its options cover every slug
   * already present on rows (migrates legacy `type: 'text'` definitions).
   */
  async function reconcilePluginFieldAsChoice(coll, curFields, desired) {
    const desiredPlugin = desired.fields.find((f) => f && f.id === FIELD_PLUGIN);
    if (!desiredPlugin) return { fields: curFields, changed: false };

    const idx = findPluginColumnFieldIndex(curFields);
    const prev = idx >= 0 ? curFields[idx] : null;

    const choices = [];
    const seen = new Set();
    const pushOpt = (opt) => {
      const n = normalizeChoiceOption(opt);
      if (!n || seen.has(n.id)) return;
      seen.add(n.id);
      choices.push(n);
    };

    if (prev && prev.type === 'choice' && Array.isArray(prev.choices)) {
      for (const c of prev.choices) pushOpt(c);
    }

    let records = [];
    try {
      records = await coll.getAllRecords();
    } catch (_) {}

    const plugCol = pluginColumnPropId(coll, FIELD_PLUGIN);
    const slugSet = new Set();
    for (const r of records) {
      const a = rowField(r, plugCol);
      if (a) slugSet.add(a.trim());
      const inf = inferPluginSlugFromPid(rowField(r, 'plugin_id'));
      if (inf) slugSet.add(inf);
    }
    for (const slug of [...slugSet].sort()) {
      if (!slug) continue;
      pushOpt({ id: slug, label: slug, color: colorForSlug(slug), active: true });
    }

    const useClean = !prev || prev.type !== 'choice';
    const nextPluginField = useClean
      ? cleanPluginChoiceField(prev, desiredPlugin, choices)
      : (() => {
          const merged = {
            ...desiredPlugin,
            type: 'choice',
            choices,
            icon: (prev && prev.icon) || desiredPlugin.icon,
            label: (prev && prev.label) || desiredPlugin.label,
            id: (prev && prev.id) || desiredPlugin.id || FIELD_PLUGIN,
          };
          copyStableFieldKeys(prev, merged);
          return merged;
        })();

    let changed = false;
    if (idx < 0) {
      curFields.push(nextPluginField);
      changed = true;
    } else if (JSON.stringify(prev) !== JSON.stringify(nextPluginField)) {
      curFields[idx] = nextPluginField;
      changed = true;
    }

    return { fields: curFields, changed };
  }

  async function registerPluginSlug(data, { slug, label } = {}) {
    const id = (slug || '').trim();
    if (!id || !data) return;
    await ensurePluginSettingsCollection(data);
    const coll = await findColl(data);
    if (!coll || typeof coll.getConfiguration !== 'function' || typeof coll.saveConfiguration !== 'function') return;
    await upgradePluginSettingsSchema(data, coll);
    let slugRegisterSavedOk = false;
    try {
      const base = coll.getConfiguration() || {};
      const fields = Array.isArray(base.fields) ? [...base.fields] : [];
      const idx = findPluginColumnFieldIndex(fields);
      if (idx < 0) {
        await rewritePluginChoiceCells(coll);
        return;
      }
      const prev = fields[idx];
      if (prev.type !== 'choice') {
        await rewritePluginChoiceCells(coll);
        return;
      }
      const prevChoices = Array.isArray(prev.choices) ? prev.choices : [];
      const normalized = prevChoices.map((c) => normalizeChoiceOption(c)).filter(Boolean);
      const byId = new Map(normalized.map((c) => [c.id, c]));
      const existing = byId.get(id);
      if (existing) {
        if (label && String(existing.label) !== String(label)) {
          byId.set(id, { ...existing, label: String(label) });
        } else {
          await rewritePluginChoiceCells(coll);
          return;
        }
      } else {
        byId.set(id, { id, label: label || id, color: colorForSlug(id), active: true });
      }
      const prevOrder = normalized.map((c) => c.id);
      const out = [];
      const used = new Set();
      for (const pid of prevOrder) {
        if (byId.has(pid) && !used.has(pid)) {
          out.push(byId.get(pid));
          used.add(pid);
        }
      }
      for (const [pid, opt] of byId) {
        if (!used.has(pid)) {
          out.push(opt);
          used.add(pid);
        }
      }
      const next = { ...prev, type: 'choice', choices: out };
      if (JSON.stringify(prev) !== JSON.stringify(next)) {
        fields[idx] = next;
        const ok = await coll.saveConfiguration(withUnlockedManaged({ ...base, fields }));
        if (ok === false) console.warn('[ThymerPluginSettings] registerPluginSlug: saveConfiguration returned false');
        else slugRegisterSavedOk = true;
      }
    } catch (e) {
      console.error('[ThymerPluginSettings] registerPluginSlug', e);
    }
    if (slugRegisterSavedOk) await rewritePluginChoiceCells(coll);
  }

  /**
   * Merge missing field definitions into the Plugin Backend collection
   * (e.g. after Thymer auto-created a minimal schema, or older two-field configs).
   */
  async function upgradePluginSettingsSchema(data, collOpt) {
    await ensurePluginSettingsCollection(data);
    const coll = collOpt || (await findColl(data));
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
        if (!f || !f.id || curIds.has(f.id)) continue;
        if (f.id === FIELD_PLUGIN && findPluginColumnFieldIndex(curFields) >= 0) continue;
        curFields.push(cloneFieldDef(f));
        curIds.add(f.id);
        changed = true;
      }
      const rec = await reconcilePluginFieldAsChoice(coll, curFields, desired);
      if (rec.changed) changed = true;
      const finalFields = rec.fields;

      const vMerge = mergeViewsArray(base.views, desired.views);
      if (vMerge.changed) changed = true;
      const finalViews = vMerge.views;

      const curPages = [...(base.page_field_ids || [])];
      const wantPages = [...(desired.page_field_ids || [])];
      const mergedPages = [...new Set([...wantPages, ...curPages])];
      if (JSON.stringify(curPages) !== JSON.stringify(mergedPages)) changed = true;
      if ((base.description || '') !== desired.description) changed = true;
      if ((base.item_name || '') !== (desired.item_name || '')) changed = true;
      if (String(base.name || '').trim() !== COL_NAME) changed = true;
      if (changed) {
        const merged = withUnlockedManaged({
          ...base,
          name: COL_NAME,
          description: desired.description,
          fields: finalFields,
          page_field_ids: mergedPages.length ? mergedPages : wantPages,
          item_name: desired.item_name || base.item_name,
          icon: desired.icon || base.icon,
          color: desired.color !== undefined ? desired.color : base.color,
          home: desired.home !== undefined ? desired.home : base.home,
          views: finalViews,
          sidebar_record_sort_field_id: desired.sidebar_record_sort_field_id || base.sidebar_record_sort_field_id,
          sidebar_record_sort_dir: desired.sidebar_record_sort_dir || base.sidebar_record_sort_dir,
        });
        const ok = await coll.saveConfiguration(merged);
        if (ok === false) console.warn('[ThymerPluginSettings] saveConfiguration returned false (schema not applied?)');
        else {
          try {
            const pf = getPluginFieldDef(coll);
            if (pf && pf.type !== 'choice') {
              console.error(
                '[ThymerPluginSettings] saveConfiguration succeeded but "plugin" field is still type',
                pf.type,
                '— check collection General tab or re-import plugins/public repo/plugin-settings/Plugin Backend.json.'
              );
            }
          } catch (_) {}
        }
      }
      if (changed) await rewritePluginChoiceCells(coll);
    } catch (e) {
      console.error('[ThymerPluginSettings] upgrade schema', e);
    }
  }

  /** Re-apply `plugin` via setChoice so rows are not stuck as “(Other)” after text→choice migration. */
  async function rewritePluginChoiceCells(coll) {
    if (!coll || typeof coll.getAllRecords !== 'function') return;
    try {
      const pluginField = getPluginFieldDef(coll);
      if (!pluginField || pluginField.type !== 'choice') return;
    } catch (_) {
      return;
    }
    let records = [];
    try {
      records = await coll.getAllRecords();
    } catch (_) {
      return;
    }
    for (const r of records) {
      let slug = inferPluginSlugFromPid(rowField(r, 'plugin_id'));
      if (!slug) slug = rowField(r, pluginColumnPropId(coll, FIELD_PLUGIN));
      if (!slug) continue;
      setRowField(r, FIELD_PLUGIN, slug, coll);
      // Rows written while setRowField wrongly skipped p.set() for plugin_id (setChoice branch).
      const pidNow = rowField(r, 'plugin_id').trim();
      if (!pidNow) {
        const kind = (rowField(r, FIELD_KIND) || '').trim();
        let legacyVault = false;
        if (!kind) {
          try {
            const raw = rowField(r, 'settings_json');
            if (raw && String(raw).includes('"storageMode"')) legacyVault = true;
          } catch (_) {}
        }
        if (kind === KIND_VAULT || legacyVault) {
          setRowField(r, 'plugin_id', slug, coll);
        } else if (kind === 'config') {
          setRowField(r, 'plugin_id', `${slug}:config`, coll);
        } else if (kind === 'log') {
          let ds = '';
          try {
            const raw = rowField(r, 'settings_json');
            if (raw) {
              const j = JSON.parse(raw);
              if (j && j.date) ds = String(j.date).trim();
            }
          } catch (_) {}
          if (!/^\d{4}-\d{2}-\d{2}$/.test(ds) && typeof r.getName === 'function') {
            ds = String(r.getName() || '').trim();
          }
          if (/^\d{4}-\d{2}-\d{2}$/.test(ds)) {
            setRowField(r, 'plugin_id', `${slug}:log:${ds}`, coll);
          }
        }
      }
    }
  }

  function rowField(r, id) {
    if (!r) return '';
    try {
      const p = r.prop?.(id);
      if (p && typeof p.choice === 'function') {
        const c = p.choice();
        if (c != null && String(c).trim() !== '') return String(c).trim();
      }
    } catch (_) {}
    let v = '';
    try {
      v = r.text?.(id);
    } catch (_) {}
    if (v != null && String(v).trim() !== '') return String(v).trim();
    try {
      const p = r.prop?.(id);
      if (p && typeof p.get === 'function') {
        const g = p.get();
        return g == null ? '' : String(g).trim();
      }
      if (p && typeof p.text === 'function') {
        const t = p.text();
        return t == null ? '' : String(t).trim();
      }
    } catch (_) {}
    return '';
  }

  /** Thymer `setChoice` matches option **label** (see YNAB plugins); return label for slug `id`, else slug. */
  function pluginChoiceSetName(coll, slug) {
    const s = String(slug || '').trim();
    if (!s || !coll || typeof coll.getConfiguration !== 'function') return s;
    try {
      const f = getPluginFieldDef(coll);
      if (!f || f.type !== 'choice' || !Array.isArray(f.choices)) return s;
      const opt = f.choices.find((c) => c && String(c.id || '').trim() === s);
      if (opt && opt.label != null && String(opt.label).trim() !== '') return String(opt.label).trim();
    } catch (_) {}
    return s;
  }

  /**
   * @param coll Optional collection — pass when writing `plugin` so setChoice uses the correct option **label**.
   */
  function setRowField(r, id, value, coll = null) {
    if (!r) return;
    const raw = value == null ? '' : String(value);
    const s = raw.trim();
    const propId = pluginColumnPropId(coll, id);
    try {
      const p = r.prop?.(propId);
      if (!p) return;
      // Thymer exposes setChoice on many property types; it returns false for non-choice fields.
      // Only use setChoice for the Plugin **slug** column — otherwise we return early and never p.set().
      const isPluginChoiceCol = id === FIELD_PLUGIN;
      if (isPluginChoiceCol && typeof p.setChoice === 'function') {
        if (!s) {
          if (typeof p.set === 'function') p.set('');
          return;
        }
        const nameTry = coll != null ? pluginChoiceSetName(coll, s) : s;
        if (p.setChoice(nameTry)) return;
        if (nameTry !== s && p.setChoice(s)) return;
        if (typeof p.set === 'function') {
          try {
            p.set(s);
            return;
          } catch (_) {
            /* continue to warn */
          }
        }
        console.warn('[ThymerPluginSettings] setChoice: no option matched field', id, 'slug', s, 'tried', nameTry);
        return;
      }
      if (typeof p.set === 'function') p.set(raw);
    } catch (e) {
      console.warn('[ThymerPluginSettings] setRowField', id, e);
    }
  }

  /** True for the single mirror row per logical plugin (plugin_id === pluginId and kind vault or legacy). */
  function isVaultRow(r, pluginId) {
    const pid = rowField(r, 'plugin_id');
    if (pid !== pluginId) return false;
    const kind = rowField(r, FIELD_KIND);
    if (kind === KIND_VAULT) return true;
    if (!kind) return true;
    return false;
  }

  function findVaultRecord(records, pluginId) {
    if (!records) return null;
    for (const x of records) {
      if (isVaultRow(x, pluginId)) return x;
    }
    return null;
  }

  function applyVaultRowMeta(r, pluginId, coll) {
    setRowField(r, 'plugin_id', pluginId);
    setRowField(r, FIELD_PLUGIN, pluginId, coll);
    setRowField(r, FIELD_KIND, KIND_VAULT);
  }

  function drain() {
    if (busy || !q.length) return;
    busy = true;
    const job = q.shift();
    Promise.resolve(typeof job === 'function' ? job() : job)
      .catch((e) => console.error('[ThymerPluginSettings]', e))
      .finally(() => {
        busy = false;
        if (q.length) setTimeout(drain, 450);
      });
  }

  function enqueue(job) {
    q.push(job);
    drain();
  }

  /** Sidebar / command palette title may be `getName()` or only `getConfiguration().name`. */
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

  /** Configured collection name only (avoids duplicating `collectionDisplayName` fallbacks). */
  function collectionBackendConfiguredTitle(c) {
    if (!c) return '';
    try {
      return String(c.getConfiguration?.()?.name || '').trim();
    } catch (_) {
      return '';
    }
  }

  /**
   * When plugin iframes are opaque (blob/sandbox), `navigator.locks` and `window.top` globals do not
   * dedupe across realms. First `localStorage` we can reach on the Thymer app origin is shared.
   */
  function getSharedThymerLocalStorage() {
    const seen = new Set();
    const tryWin = (w) => {
      if (!w || seen.has(w)) return null;
      seen.add(w);
      try {
        const ls = w.localStorage;
        void ls.length;
        return ls;
      } catch (_) {
        return null;
      }
    };
    try {
      const t = tryWin(window.top);
      if (t) return t;
    } catch (_) {}
    try {
      const t = tryWin(window);
      if (t) return t;
    } catch (_) {}
    try {
      let w = window;
      for (let i = 0; i < 10 && w; i++) {
        const t = tryWin(w);
        if (t) return t;
        if (w === w.parent) break;
        w = w.parent;
      }
    } catch (_) {}
    return null;
  }

  /** Unscoped keys (legacy); runtime uses {@link scopedPbLsKey} per workspace. */
  const LS_CREATE_LEASE_BASE = 'thymerext_plugin_backend_create_lease_v1';
  const LS_RECENT_CREATE_BASE = 'thymerext_plugin_backend_recent_create_v1';
  const LS_RECENT_CREATE_ATTEMPT_BASE = 'thymerext_plugin_backend_recent_create_attempt_v1';

  function workspaceSlugFromData(data) {
    try {
      const u = data && typeof data.getActiveUsers === 'function' ? data.getActiveUsers() : null;
      const g = u && u[0] && u[0].workspaceGuid;
      const s = g != null ? String(g).trim() : '';
      if (s) return s.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 120);
    } catch (_) {}
    return '_unknown_ws';
  }

  function scopedPbLsKey(base, data) {
    return `${base}__${workspaceSlugFromData(data)}`;
  }

  /** Count collections whose sidebar/title name is exactly Plugin Backend (or legacy). */
  async function countExactPluginBackendNamedCollections(data) {
    let all;
    try {
      all = await data.getAllCollections();
    } catch (_) {
      return 0;
    }
    if (!Array.isArray(all)) return 0;
    let n = 0;
    for (const c of all) {
      try {
        const nm = collectionDisplayName(c);
        if (nm === COL_NAME || nm === COL_NAME_LEGACY) n += 1;
      } catch (_) {}
    }
    return n;
  }

  /**
   * Cross-realm mutex for `createCollection` + first `saveConfiguration` only.
   * Lease keys are **per workspace** so switching workspaces does not inherit another vault’s lease / cooldown.
   * @returns {{ denied: boolean, release: () => void }}
   */
  async function acquirePluginBackendCreationLease(maxWaitMs, data) {
    const locksOk =
      typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function';
    const noop = { denied: false, release() {} };
    const ls = getSharedThymerLocalStorage();
    if (!ls) {
      if (locksOk) return noop;
      if (DEBUG_COLLECTIONS) {
        dlogPathB('lease_denied_no_localstorage_no_locks', { ws: workspaceSlugFromData(data) });
      }
      return { denied: true, release() {} };
    }
    const leaseKey = scopedPbLsKey(LS_CREATE_LEASE_BASE, data);
    const holder =
      (typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID()) ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    const deadline = Date.now() + (Number(maxWaitMs) > 0 ? maxWaitMs : 12000);
    let acquired = false;
    let sawContention = false;
    while (Date.now() < deadline) {
      try {
        const raw = ls.getItem(leaseKey);
        let busy = false;
        if (raw) {
          let j = null;
          try {
            j = JSON.parse(raw);
          } catch (_) {
            j = null;
          }
          if (j && typeof j.exp === 'number' && j.h !== holder && j.exp > Date.now()) busy = true;
        }
        if (busy) {
          sawContention = true;
          await new Promise((r) => setTimeout(r, 40 + Math.floor(Math.random() * 70)));
          continue;
        }
        const exp = Date.now() + 45000;
        const payload = JSON.stringify({ h: holder, exp });
        ls.setItem(leaseKey, payload);
        await new Promise((r) => setTimeout(r, 0));
        if (ls.getItem(leaseKey) === payload) {
          acquired = true;
          if (DEBUG_COLLECTIONS) dlogPathB('lease_acquired', { via: 'localStorage', sawContention, leaseKey });
          break;
        }
      } catch (_) {
        return locksOk ? noop : { denied: true, release() {} };
      }
      await new Promise((r) => setTimeout(r, 30 + Math.floor(Math.random() * 50)));
    }
    if (!acquired) {
      if (DEBUG_COLLECTIONS) dlogPathB('lease_timeout_abort_create', { sawContention, leaseKey });
      return { denied: true, release() {} };
    }
    return {
      denied: false,
      release() {
        if (!acquired) return;
        acquired = false;
        try {
          const cur = ls.getItem(leaseKey);
          if (!cur) return;
          let j = null;
          try {
            j = JSON.parse(cur);
          } catch (_) {
            return;
          }
          if (j && j.h === holder) ls.removeItem(leaseKey);
        } catch (_) {}
      },
    };
  }

  function noteRecentPluginBackendCreate(data) {
    const ls = getSharedThymerLocalStorage();
    if (!ls || !data) return;
    try {
      ls.setItem(scopedPbLsKey(LS_RECENT_CREATE_BASE, data), String(Date.now()));
    } catch (_) {}
  }

  function getRecentPluginBackendCreateAgeMs(data) {
    const ls = getSharedThymerLocalStorage();
    if (!ls || !data) return null;
    try {
      const raw = ls.getItem(scopedPbLsKey(LS_RECENT_CREATE_BASE, data));
      const ts = Number(raw);
      if (!Number.isFinite(ts) || ts <= 0) return null;
      return Date.now() - ts;
    } catch (_) {
      return null;
    }
  }

  function noteRecentPluginBackendCreateAttempt(data) {
    const ls = getSharedThymerLocalStorage();
    if (!ls || !data) return;
    try {
      ls.setItem(scopedPbLsKey(LS_RECENT_CREATE_ATTEMPT_BASE, data), String(Date.now()));
    } catch (_) {}
  }

  function getRecentPluginBackendCreateAttemptAgeMs(data) {
    const ls = getSharedThymerLocalStorage();
    if (!ls || !data) return null;
    try {
      const raw = ls.getItem(scopedPbLsKey(LS_RECENT_CREATE_ATTEMPT_BASE, data));
      const ts = Number(raw);
      if (!Number.isFinite(ts) || ts <= 0) return null;
      return Date.now() - ts;
    } catch (_) {
      return null;
    }
  }

  /** When Thymer omits names on `getAllCollections()` entries, match our Path B schema. */
  function pathBCollectionScore(c) {
    if (!c) return 0;
    try {
      const conf = c.getConfiguration?.() || {};
      const fields = Array.isArray(conf.fields) ? conf.fields : [];
      const ids = new Set(fields.map((f) => f && f.id).filter(Boolean));
      if (!ids.has('plugin_id') || !ids.has('settings_json')) return 0;
      let s = 2;
      if (ids.has(FIELD_PLUGIN)) s += 2;
      if (ids.has(FIELD_KIND)) s += 1;
      const nm = collectionDisplayName(c).toLowerCase();
      if (nm && (nm.includes('plugin') && (nm.includes('backend') || nm.includes('setting')))) s += 1;
      return s;
    } catch (_) {
      return 0;
    }
  }

  function pickPathBCollectionHeuristic(all) {
    const list = Array.isArray(all) ? all : [];
    const cands = [];
    let bestS = 0;
    for (const c of list) {
      const sc = pathBCollectionScore(c);
      if (sc > bestS) {
        bestS = sc;
        cands.length = 0;
        cands.push(c);
      } else if (sc === bestS && sc >= 2) {
        cands.push(c);
      }
    }
    if (!cands.length) return null;
    const named = cands.find((c) => {
      const n = collectionDisplayName(c);
      const cfg = collectionBackendConfiguredTitle(c);
      return n === COL_NAME || n === COL_NAME_LEGACY || cfg === COL_NAME || cfg === COL_NAME_LEGACY;
    });
    return named || cands[0];
  }

  function pickCollFromAll(all) {
    try {
      const pick = (allIn) => {
        const list = Array.isArray(allIn) ? allIn : [];
        return (
          list.find((c) => collectionDisplayName(c) === COL_NAME) ||
          list.find((c) => collectionDisplayName(c) === COL_NAME_LEGACY) ||
          list.find((c) => collectionBackendConfiguredTitle(c) === COL_NAME) ||
          list.find((c) => collectionBackendConfiguredTitle(c) === COL_NAME_LEGACY) ||
          null
        );
      };
      return pick(all) || pickPathBCollectionHeuristic(all) || null;
    } catch (_) {
      return null;
    }
  }

  function hasPluginBackendInAll(all) {
    if (!Array.isArray(all) || all.length === 0) return false;
    for (const c of all) {
      const nm = collectionDisplayName(c);
      if (nm === COL_NAME || nm === COL_NAME_LEGACY) return true;
      const cfg = collectionBackendConfiguredTitle(c);
      if (cfg === COL_NAME || cfg === COL_NAME_LEGACY) return true;
    }
    return !!pickPathBCollectionHeuristic(all);
  }

  async function findColl(data) {
    try {
      const all = await data.getAllCollections();
      return pickCollFromAll(all);
    } catch (_) {
      return null;
    }
  }

  /** Brute list scan — catches a Backend another iframe just created if `findColl` lags. */
  async function hasPluginBackendOnWorkspace(data) {
    let all;
    try {
      all = await data.getAllCollections();
    } catch (_) {
      return false;
    }
    return hasPluginBackendInAll(all);
  }

  const PB_LOCK_NAME = 'thymer-ext-plugin-backend-ensure-v1';
  const DATA_ENSURE_P = '__thymerExtDataPluginBackendEnsureP';
  /** Per-workspace: Plugin Backend already ensured — skip repeat bodies (avoids getAllCollections / lock storms). */
  const WS_ENSURE_OK_MAP = '__thymerExtPbWorkspaceEnsureOkMap_v1';

  function markWorkspacePluginBackendEnsureDone(data) {
    try {
      const slug = workspaceSlugFromData(data);
      const h = getSharedDeduplicationWindow();
      if (!h[WS_ENSURE_OK_MAP] || typeof h[WS_ENSURE_OK_MAP] !== 'object') h[WS_ENSURE_OK_MAP] = Object.create(null);
      h[WS_ENSURE_OK_MAP][slug] = true;
    } catch (_) {}
  }

  function isWorkspacePluginBackendEnsureDone(data) {
    try {
      const slug = workspaceSlugFromData(data);
      const h = getSharedDeduplicationWindow();
      const m = h[WS_ENSURE_OK_MAP];
      return !!(m && m[slug]);
    } catch (_) {
      return false;
    }
  }

  function dlogPathB(phase, extra) {
    if (!DEBUG_COLLECTIONS) return;
    try {
      const row = { runId: DEBUG_PATHB_ID, phase, t: (typeof performance !== 'undefined' && performance.now) ? +performance.now().toFixed(1) : 0, ...extra };
      console.info('[ThymerExt/PluginBackend]', row);
    } catch (_) {
      void 0;
    }
  }

  function pathBWindowSnapshot() {
    const snap = { runId: DEBUG_PATHB_ID, topReadable: null, hasLocks: null };
    try {
      if (typeof window !== 'undefined' && window.top) {
        void window.top.document;
        snap.topReadable = true;
      }
    } catch (e) {
      snap.topReadable = false;
      try {
        snap.topErr = String((e && e.name) || e) || 'top-doc-threw';
      } catch (_) {
        snap.topErr = 'top-doc-threw';
      }
    }
    const host = getSharedDeduplicationWindow();
    try {
      snap.hasLocks = !!(typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request);
    } catch (_) {
      snap.hasLocks = 'err';
    }
    try {
      snap.locationHref = typeof location !== 'undefined' ? String(location.href) : '';
    } catch (_) {
      snap.locationHref = '';
    }
    try {
      snap.hasSelf = typeof self !== 'undefined' && self === window;
      snap.selfIsTop = typeof window !== 'undefined' && window === window.top;
      snap.hostIsTop = host === (typeof window !== 'undefined' ? window.top : null);
      snap.hostIsSelf = host === (typeof window !== 'undefined' ? window : null);
      snap.hostType = (host && host.constructor && host.constructor.name) || '';
    } catch (_) {
      void 0;
    }
    try {
      snap.gHasPbP = host && host[PB_ENSURE_GLOBAL_P] != null;
      snap.gHasCreateQ = host && host[SERIAL_DATA_CREATE_P] != null;
    } catch (_) {
      void 0;
    }
    return snap;
  }

  function queueDataCreateOnSharedWindow(factory) {
    const host = getSharedDeduplicationWindow();
    if (DEBUG_COLLECTIONS) {
      dlogPathB('queueDataCreate_enter', { ...pathBWindowSnapshot() });
    }
    try {
      if (!host[SERIAL_DATA_CREATE_P] || typeof host[SERIAL_DATA_CREATE_P].then !== 'function') {
        host[SERIAL_DATA_CREATE_P] = Promise.resolve();
      }
      const out = (host[SERIAL_DATA_CREATE_P] = host[SERIAL_DATA_CREATE_P].catch(() => {}).then(factory));
      if (DEBUG_COLLECTIONS) dlogPathB('queueDataCreate_chained', { gHasCreateQ: !!host[SERIAL_DATA_CREATE_P] });
      return out;
    } catch (e) {
      if (DEBUG_COLLECTIONS) dlogPathB('queueDataCreate_fallback', { err: String((e && e.message) || e) });
      return factory();
    }
  }

  async function runPluginBackendEnsureBody(data) {
    if (data && isWorkspacePluginBackendEnsureDone(data)) return;
    if (DEBUG_COLLECTIONS) {
      dlogPathB('ensureBody_start', { pathB: pathBWindowSnapshot() });
      try {
        if (data && data.getAllCollections) {
          const a = await data.getAllCollections();
          const list = Array.isArray(a) ? a : [];
          const collNames = list.map((c) => {
            try { return String(collectionDisplayName(c) || '').trim() || '(no-name)'; } catch (__) { return '(err)'; }
          });
          dlogPathB('ensureBody_collections', { count: (collNames && collNames.length) || 0, names: (collNames || []).slice(0, 40) });
          if (data && data.getAllCollections) touchGetAllSanityFromCount((collNames && collNames.length) || 0);
          const dupExact = list.filter((c) => {
            try {
              const nm = collectionDisplayName(c);
              return nm === COL_NAME || nm === COL_NAME_LEGACY;
            } catch (__) {
              return false;
            }
          });
          if (dupExact.length > 1) {
            dlogPathB('duplicate_plugin_backend_named_collections', {
              count: dupExact.length,
              guids: dupExact.map((c) => {
                try {
                  return c.getGuid?.() || null;
                } catch (__) {
                  return null;
                }
              }),
              doc: 'docs/PLUGIN_BACKEND_DUPLICATE_HYGIENE.md',
            });
          }
        }
      } catch (e) {
        dlogPathB('ensureBody_getAll_failed', { err: String((e && e.message) || e) });
      }
    }
    try {
      const markPbOk = () => markWorkspacePluginBackendEnsureDone(data);
      let existing = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        let allAttempt;
        try {
          allAttempt = await data.getAllCollections();
        } catch (_) {
          allAttempt = null;
        }
        if (allAttempt != null) {
          existing = pickCollFromAll(allAttempt);
          if (existing) {
            markPbOk();
            return;
          }
          if (hasPluginBackendInAll(allAttempt)) {
            markPbOk();
            return;
          }
        } else {
          existing = await findColl(data);
          if (existing) {
            markPbOk();
            return;
          }
          if (await hasPluginBackendOnWorkspace(data)) {
            markPbOk();
            return;
          }
        }
        if (attempt < 3) await new Promise((r) => setTimeout(r, 50 + attempt * 50));
      }
      let allPost;
      try {
        allPost = await data.getAllCollections();
      } catch (_) {
        allPost = null;
      }
      if (allPost != null) {
        existing = pickCollFromAll(allPost);
        if (existing) {
          markPbOk();
          return;
        }
        if (hasPluginBackendInAll(allPost)) {
          markPbOk();
          return;
        }
      } else {
        existing = await findColl(data);
        if (existing) {
          markPbOk();
          return;
        }
        if (await hasPluginBackendOnWorkspace(data)) {
          markPbOk();
          return;
        }
      }
      await new Promise((r) => setTimeout(r, 120));
      let allAfterWait;
      try {
        allAfterWait = await data.getAllCollections();
      } catch (_) {
        allAfterWait = null;
      }
      if (allAfterWait != null) {
        if (pickCollFromAll(allAfterWait)) {
          markPbOk();
          return;
        }
        if (hasPluginBackendInAll(allAfterWait)) {
          markPbOk();
          return;
        }
      } else {
        if (await findColl(data)) {
          markPbOk();
          return;
        }
        if (await hasPluginBackendOnWorkspace(data)) {
          markPbOk();
          return;
        }
      }
      let preCreateLen = 0;
      try {
        if (data && data.getAllCollections) {
          const all0 = await data.getAllCollections();
          preCreateLen = Array.isArray(all0) ? all0.length : 0;
          if (preCreateLen > 0) touchGetAllSanityFromCount(preCreateLen);
        }
        if (preCreateLen === 0) {
          await new Promise((r) => setTimeout(r, 150));
          if (data && data.getAllCollections) {
            const all1 = await data.getAllCollections();
            preCreateLen = Array.isArray(all1) ? all1.length : 0;
            if (preCreateLen > 0) touchGetAllSanityFromCount(preCreateLen);
          }
        }
        if (preCreateLen > 0) {
          let allPre;
          try {
            allPre = await data.getAllCollections();
          } catch (_) {
            allPre = null;
          }
          if (allPre != null) {
            if (pickCollFromAll(allPre)) {
              markPbOk();
              return;
            }
            if (hasPluginBackendInAll(allPre)) {
              markPbOk();
              return;
            }
          } else {
            if (await findColl(data)) {
              markPbOk();
              return;
            }
            if (await hasPluginBackendOnWorkspace(data)) {
              markPbOk();
              return;
            }
          }
        }
        if (isSuspiciousEmptyAfterRecentNonEmptyList(preCreateLen) && preCreateLen === 0) {
          if (DEBUG_COLLECTIONS) {
            try {
              const h = getSharedDeduplicationWindow();
              dlogPathB('refuse_create_flaky_getall_empty', { pathB: pathBWindowSnapshot(), s: h[GETALL_COLLECTIONS_SANITY] || null });
            } catch (_) {
              dlogPathB('refuse_create_flaky_getall_empty', { pathB: pathBWindowSnapshot() });
            }
          }
          return;
        }
      } catch (_) {
        void 0;
      }
      if (DEBUG_COLLECTIONS) dlogPathB('ensureBody_about_to_create', { pathB: pathBWindowSnapshot() });
      const lease = await acquirePluginBackendCreationLease(14000, data);
      if (lease.denied) return;
      try {
        let allLease;
        try {
          allLease = await data.getAllCollections();
        } catch (_) {
          allLease = null;
        }
        if (allLease != null) {
          if (pickCollFromAll(allLease)) {
            markPbOk();
            return;
          }
          if (hasPluginBackendInAll(allLease)) {
            markPbOk();
            return;
          }
        } else {
          if (await findColl(data)) {
            markPbOk();
            return;
          }
          if (await hasPluginBackendOnWorkspace(data)) {
            markPbOk();
            return;
          }
        }
        const recentAttemptAge = getRecentPluginBackendCreateAttemptAgeMs(data);
        if (recentAttemptAge != null && recentAttemptAge >= 0 && recentAttemptAge < 120000) {
          // Another plugin iframe attempted creation very recently. Avoid burst duplicate creates.
          for (let i = 0; i < 10; i++) {
            await new Promise((r) => setTimeout(r, 130 + i * 70));
            let allCont;
            try {
              allCont = await data.getAllCollections();
            } catch (_) {
              allCont = null;
            }
            if (allCont != null) {
              if (pickCollFromAll(allCont)) {
                markPbOk();
                return;
              }
              if (hasPluginBackendInAll(allCont)) {
                markPbOk();
                return;
              }
            } else {
              if (await findColl(data)) {
                markPbOk();
                return;
              }
              if (await hasPluginBackendOnWorkspace(data)) {
                markPbOk();
                return;
              }
            }
          }
          return;
        }
        const recentAge = getRecentPluginBackendCreateAgeMs(data);
        if (recentAge != null && recentAge >= 0 && recentAge < 90000) {
          // Another plugin/runtime likely just created it; let collection list/indexing settle first.
          for (let i = 0; i < 8; i++) {
            await new Promise((r) => setTimeout(r, 120 + i * 60));
            let allSettle;
            try {
              allSettle = await data.getAllCollections();
            } catch (_) {
              allSettle = null;
            }
            if (allSettle != null) {
              if (pickCollFromAll(allSettle)) {
                markPbOk();
                return;
              }
              if (hasPluginBackendInAll(allSettle)) {
                markPbOk();
                return;
              }
            } else {
              if (await findColl(data)) {
                markPbOk();
                return;
              }
              if (await hasPluginBackendOnWorkspace(data)) {
                markPbOk();
                return;
              }
            }
          }
        }
        noteRecentPluginBackendCreateAttempt(data);
        const exactN = await countExactPluginBackendNamedCollections(data);
        if (exactN >= 1) {
          if (DEBUG_COLLECTIONS) {
            dlogPathB('abort_create_exact_backend_name_exists', { exactN, ws: workspaceSlugFromData(data) });
          }
          markPbOk();
          return;
        }
        const coll = await queueDataCreateOnSharedWindow(() => data.createCollection());
        if (!coll || typeof coll.getConfiguration !== 'function' || typeof coll.saveConfiguration !== 'function') {
          return;
        }
        const conf = cloneShape();
        const base = coll.getConfiguration();
        if (base && typeof base.ver === 'number') conf.ver = base.ver;
        let ok = await coll.saveConfiguration(conf);
        if (ok === false) {
          // Transient host races can reject the first save; retry before giving up.
          await new Promise((r) => setTimeout(r, 180));
          ok = await coll.saveConfiguration(conf);
        }
        if (ok === false) return;
        noteRecentPluginBackendCreate(data);
        markPbOk();
        await new Promise((r) => setTimeout(r, 250));
      } finally {
        try {
          lease.release();
        } catch (_) {}
      }
    } catch (e) {
      console.error('[ThymerPluginSettings] ensure collection', e);
    }
  }

  function runPluginBackendEnsureWithLocksOrChain(data) {
    try {
      if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
        if (DEBUG_COLLECTIONS) dlogPathB('ensure_route', { via: 'locks', lockName: PB_LOCK_NAME, pathB: pathBWindowSnapshot() });
        return navigator.locks.request(PB_LOCK_NAME, () => runPluginBackendEnsureBody(data));
      }
    } catch (e) {
      if (DEBUG_COLLECTIONS) dlogPathB('ensure_locks_threw', { err: String((e && e.message) || e) });
    }
    if (DEBUG_COLLECTIONS) dlogPathB('ensure_route', { via: 'hierarchyChain', pathB: pathBWindowSnapshot() });
    return chainPluginBackendEnsure(data, () => runPluginBackendEnsureBody(data));
  }

  function ensurePluginSettingsCollection(data) {
    if (!data || typeof data.getAllCollections !== 'function' || typeof data.createCollection !== 'function') {
      return Promise.resolve();
    }
    if (isWorkspacePluginBackendEnsureDone(data)) {
      return Promise.resolve();
    }
    if (DEBUG_COLLECTIONS) {
      let dHint = 'no-data';
      try {
        dHint = data
          ? `ctor=${(data && data.constructor && data.constructor.name) || '?'},eqPrev=${(data && data === g.__th_lastDataPb) || false},keys=${
            Object.keys(data).filter((k) => k && (k.includes('thymer') || k.includes('__'))).length
          }`
          : 'null';
        g.__th_lastDataPb = data;
      } catch (_) {
        dHint = 'err';
      }
      dlogPathB('ensurePluginSettingsCollection', { dataHint: dHint, dataExpand: (() => { try { if (!data) return { ok: false }; return { hasDataEnsure: !!data[DATA_ENSURE_P] }; } catch (_) { return { ok: 'throw' }; } })(), pathB: pathBWindowSnapshot() });
    }
    try {
      if (!data[DATA_ENSURE_P] || typeof data[DATA_ENSURE_P].then !== 'function') {
        data[DATA_ENSURE_P] = Promise.resolve();
      }
      if (DEBUG_COLLECTIONS) dlogPathB('data_ensure_p_chained', { hasPriorTail: true });
      const next = data[DATA_ENSURE_P]
        .catch(() => {})
        .then(() => runPluginBackendEnsureWithLocksOrChain(data));
      data[DATA_ENSURE_P] = next;
      return next;
    } catch (e) {
      if (DEBUG_COLLECTIONS) dlogPathB('data_ensure_p_throw', { err: String((e && e.message) || e) });
      return runPluginBackendEnsureWithLocksOrChain(data);
    }
  }

  async function readDoc(data, pluginId) {
    const coll = await findColl(data);
    if (!coll) return null;
    let records;
    try {
      records = await coll.getAllRecords();
    } catch (_) {
      return null;
    }
    const r = findVaultRecord(records, pluginId);
    if (!r) return null;
    let raw = '';
    try {
      raw = r.text?.('settings_json') || '';
    } catch (_) {}
    if (!raw || !String(raw).trim()) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  async function writeDoc(data, pluginId, doc) {
    const coll = await findColl(data);
    if (!coll) return;
    await upgradePluginSettingsSchema(data, coll);
    const json = JSON.stringify(doc);
    let records;
    try {
      records = await coll.getAllRecords();
    } catch (_) {
      return;
    }
    let r = findVaultRecord(records, pluginId);
    if (!r) {
      let guid = null;
      try {
        guid = coll.createRecord?.(pluginId);
      } catch (_) {}
      if (guid) {
        for (let i = 0; i < 30; i++) {
          await new Promise((res) => setTimeout(res, i < 8 ? 100 : 200));
          try {
            const again = await coll.getAllRecords();
            r = again.find((x) => x.guid === guid) || findVaultRecord(again, pluginId);
            if (r) break;
          } catch (_) {}
        }
      }
    }
    if (!r) return;
    applyVaultRowMeta(r, pluginId, coll);
    try {
      const pj = r.prop?.('settings_json');
      if (pj && typeof pj.set === 'function') pj.set(json);
    } catch (_) {}
  }

  async function listRows(data, { pluginSlug, recordKind } = {}) {
    const slug = (pluginSlug || '').trim();
    if (!slug) return [];
    const coll = await findColl(data);
    if (!coll) return [];
    let records;
    try {
      records = await coll.getAllRecords();
    } catch (_) {
      return [];
    }
    const plugCol = pluginColumnPropId(coll, FIELD_PLUGIN);
    return records.filter((r) => {
      const pid = rowField(r, 'plugin_id');
      let rowSlug = rowField(r, plugCol);
      if (!rowSlug) rowSlug = inferPluginSlugFromPid(pid);
      if (rowSlug !== slug) return false;
      if (recordKind != null && String(recordKind) !== '') {
        const rk = rowField(r, FIELD_KIND) || inferRecordKindFromPid(pid, slug);
        return rk === String(recordKind);
      }
      return true;
    });
  }

  async function createDataRow(data, { pluginSlug, recordKind, rowPluginId, recordTitle, settingsDoc } = {}) {
    const ps = (pluginSlug || '').trim();
    const rid = (rowPluginId || '').trim();
    const kind = (recordKind || '').trim();
    if (!ps || !rid || !kind) {
      console.warn('[ThymerPluginSettings] createDataRow: pluginSlug, recordKind, and rowPluginId are required');
      return null;
    }
    if (rid === ps && kind !== KIND_VAULT) {
      console.warn('[ThymerPluginSettings] createDataRow: rowPluginId must differ from plugin slug unless record_kind is vault');
    }
    await ensurePluginSettingsCollection(data);
    const coll = await findColl(data);
    if (!coll) return null;
    await upgradePluginSettingsSchema(data, coll);
    const title = (recordTitle || rid).trim() || rid;
    let guid = null;
    try {
      guid = coll.createRecord?.(title);
    } catch (e) {
      console.error('[ThymerPluginSettings] createDataRow createRecord', e);
      return null;
    }
    if (!guid) return null;
    let r = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((res) => setTimeout(res, i < 8 ? 100 : 200));
      try {
        const again = await coll.getAllRecords();
        r = again.find((x) => x.guid === guid) || again.find((x) => rowField(x, 'plugin_id') === rid);
        if (r) break;
      } catch (_) {}
    }
    if (!r) return null;
    setRowField(r, 'plugin_id', rid);
    setRowField(r, FIELD_PLUGIN, ps, coll);
    setRowField(r, FIELD_KIND, kind);
    const json =
      settingsDoc !== undefined && settingsDoc !== null
        ? typeof settingsDoc === 'string'
          ? settingsDoc
          : JSON.stringify(settingsDoc)
        : '{}';
    try {
      const pj = r.prop?.('settings_json');
      if (pj && typeof pj.set === 'function') pj.set(json);
    } catch (_) {}
    return r;
  }

  function showFirstRunDialog(ui, label, preferred, onPick) {
    const id = 'thymerext-ps-first-' + Math.random().toString(36).slice(2);
    const box = document.createElement('div');
    box.id = id;
    box.style.cssText =
      'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:16px;';
    const card = document.createElement('div');
    card.style.cssText =
      'max-width:420px;width:100%;background:var(--panel-bg-color,#1d1915);border:1px solid var(--border-default,#3f3f46);border-radius:12px;padding:20px;box-shadow:0 8px 32px rgba(0,0,0,0.5);';
    const title = document.createElement('div');
    title.textContent = label + ' — where to store settings?';
    title.style.cssText = 'font-weight:700;font-size:15px;margin-bottom:10px;';
    const hint = document.createElement('div');
    hint.textContent = 'Change later via Command Palette → “Storage location…”';
    hint.style.cssText = 'font-size:12px;color:var(--text-muted,#888);margin-bottom:16px;line-height:1.45;';
    const mk = (t, sub, prim) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.cssText =
        'display:block;width:100%;text-align:left;padding:12px 14px;margin-bottom:10px;border-radius:8px;cursor:pointer;font-size:14px;border:1px solid var(--border-default,#3f3f46);background:' +
        (prim ? 'rgba(167,139,250,0.25)' : 'transparent') +
        ';color:inherit;';
      const x = document.createElement('div');
      x.textContent = t;
      x.style.fontWeight = '600';
      b.appendChild(x);
      if (sub) {
        const s = document.createElement('div');
        s.textContent = sub;
        s.style.cssText = 'font-size:11px;opacity:0.75;margin-top:4px;line-height:1.35;';
        b.appendChild(s);
      }
      return b;
    };
    const bLoc = mk('This device only', 'Browser localStorage only.', preferred === 'local');
    const bSyn = mk(
      'Sync across devices',
      'Store in the workspace “' + COL_NAME + '” collection (same account on any browser).',
      preferred === 'synced'
    );
    const fin = (m) => {
      try {
        box.remove();
      } catch (_) {}
      onPick(m);
    };
    bLoc.addEventListener('click', () => fin('local'));
    bSyn.addEventListener('click', () => fin('synced'));
    card.appendChild(title);
    card.appendChild(hint);
    card.appendChild(bLoc);
    card.appendChild(bSyn);
    box.appendChild(card);
    document.body.appendChild(box);
  }

  g.ThymerPluginSettings = {
    COL_NAME,
    COL_NAME_LEGACY,
    FIELD_PLUGIN,
    FIELD_RECORD_KIND: FIELD_KIND,
    RECORD_KIND_VAULT: KIND_VAULT,
    enqueue,
    rowField,
    findVaultRecord,
    listRows,
    createDataRow,
    upgradeCollectionSchema: (data) => upgradePluginSettingsSchema(data),
    registerPluginSlug,

    async init(opts) {
      const { plugin, pluginId, modeKey, mirrorKeys, label, data, ui } = opts;

      let mode = null;
      try {
        mode = localStorage.getItem(modeKey);
      } catch (_) {}

      const remote = await readDoc(data, pluginId);
      if (!mode && remote && (remote.storageMode === 'synced' || remote.storageMode === 'local')) {
        mode = remote.storageMode;
        try {
          localStorage.setItem(modeKey, mode);
        } catch (_) {}
      }

      if (!mode) {
        const coll = await findColl(data);
        const preferred = coll ? 'synced' : 'local';
        await new Promise((r) => {
          requestAnimationFrame(() => requestAnimationFrame(() => r()));
        });
        await new Promise((outerResolve) => {
          enqueue(async () => {
            const picked = await new Promise((r) => {
              showFirstRunDialog(ui, label, preferred, r);
            });
            try {
              localStorage.setItem(modeKey, picked);
            } catch (_) {}
            outerResolve(picked);
          });
        });
        try {
          mode = localStorage.getItem(modeKey);
        } catch (_) {}
      }

      plugin._pluginSettingsSyncMode = mode === 'synced' ? 'synced' : 'local';
      plugin._pluginSettingsPluginId = pluginId;
      const keys = typeof mirrorKeys === 'function' ? mirrorKeys() : mirrorKeys;

      if (plugin._pluginSettingsSyncMode === 'synced' && remote && remote.payload && typeof remote.payload === 'object') {
        for (const k of keys) {
          const v = remote.payload[k];
          if (typeof v === 'string') {
            try {
              localStorage.setItem(k, v);
            } catch (_) {}
          }
        }
      }

      if (plugin._pluginSettingsSyncMode === 'synced') {
        try {
          await g.ThymerPluginSettings.flushNow(data, pluginId, keys);
        } catch (_) {}
      }
    },

    scheduleFlush(plugin, mirrorKeys) {
      if (plugin._pluginSettingsSyncMode !== 'synced') return;
      const keys = typeof mirrorKeys === 'function' ? mirrorKeys() : mirrorKeys;
      if (plugin._pluginSettingsFlushTimer) clearTimeout(plugin._pluginSettingsFlushTimer);
      plugin._pluginSettingsFlushTimer = setTimeout(() => {
        plugin._pluginSettingsFlushTimer = null;
        const pdata = plugin.data;
        const pid = plugin._pluginSettingsPluginId;
        if (!pid || !pdata) return;
        g.ThymerPluginSettings.flushNow(pdata, pid, keys).catch((e) => console.error('[ThymerPluginSettings] flush', e));
      }, 500);
    },

    async flushNow(data, pluginId, mirrorKeys) {
      await ensurePluginSettingsCollection(data);
      await upgradePluginSettingsSchema(data);
      const keys = typeof mirrorKeys === 'function' ? mirrorKeys() : mirrorKeys;
      const payload = {};
      for (const k of keys) {
        try {
          const v = localStorage.getItem(k);
          if (v !== null) payload[k] = v;
        } catch (_) {}
      }
      const doc = {
        v: 1,
        storageMode: 'synced',
        updatedAt: new Date().toISOString(),
        payload,
      };
      await writeDoc(data, pluginId, doc);
    },

    async openStorageDialog(opts) {
      const { plugin, pluginId, modeKey, mirrorKeys, label, data, ui } = opts;
      const cur = plugin._pluginSettingsSyncMode === 'synced' ? 'synced' : 'local';
      const pick = await new Promise((resolve) => {
        const close = (v) => {
          try {
            box.remove();
          } catch (_) {}
          resolve(v);
        };
        const box = document.createElement('div');
        box.style.cssText =
          'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:16px;';
        box.addEventListener('click', (e) => {
          if (e.target === box) close(null);
        });
        const card = document.createElement('div');
        card.style.cssText =
          'max-width:400px;width:100%;background:var(--panel-bg-color,#1d1915);border:1px solid var(--border-default,#3f3f46);border-radius:12px;padding:18px;';
        card.addEventListener('click', (e) => e.stopPropagation());
        const t = document.createElement('div');
        t.textContent = label + ' — storage';
        t.style.cssText = 'font-weight:700;margin-bottom:12px;';
        const b1 = document.createElement('button');
        b1.type = 'button';
        b1.textContent = 'This device only';
        const b2 = document.createElement('button');
        b2.type = 'button';
        b2.textContent = 'Sync across devices';
        [b1, b2].forEach((b) => {
          b.style.cssText =
            'display:block;width:100%;padding:10px 12px;margin-bottom:8px;border-radius:8px;cursor:pointer;border:1px solid var(--border-default,#3f3f46);background:transparent;color:inherit;text-align:left;';
        });
        b1.addEventListener('click', () => close('local'));
        b2.addEventListener('click', () => close('synced'));
        const bx = document.createElement('button');
        bx.type = 'button';
        bx.textContent = 'Cancel';
        bx.style.cssText =
          'margin-top:8px;padding:8px 14px;border-radius:8px;cursor:pointer;border:1px solid var(--border-default,#3f3f46);background:transparent;color:inherit;';
        bx.addEventListener('click', () => close(null));
        card.appendChild(t);
        card.appendChild(b1);
        card.appendChild(b2);
        card.appendChild(bx);
        box.appendChild(card);
        document.body.appendChild(box);
      });
      if (!pick || pick === cur) return;
      try {
        localStorage.setItem(modeKey, pick);
      } catch (_) {}
      plugin._pluginSettingsSyncMode = pick === 'synced' ? 'synced' : 'local';
      const keyList = typeof mirrorKeys === 'function' ? mirrorKeys() : mirrorKeys;
      if (pick === 'synced') await g.ThymerPluginSettings.flushNow(data, pluginId, keyList);
      ui.addToaster?.({
        title: label,
        message: pick === 'synced' ? 'Settings will sync across devices.' : 'Settings stay on this device only.',
        dismissible: true,
        autoDestroyTime: 3500,
      });
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
// @generated END thymer-plugin-settings

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
 * `formatReadwiseRefDateHeading`). Notes and Readwise URLs are child blocks under each quote.
 *
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

/** Journal footer panels — persisted (localStorage + Path B when synced). */
const TH_KEY_SHOW_HIGHLIGHTS   = 'th_panel_show_highlights';
const TH_KEY_SHOW_SHUFFLER     = 'th_panel_show_shuffler';
const TH_KEY_SHUFFLER_COLLAPSED = 'th_shuffler_collapsed';
/** JSON object: { [YYYYMMDD]: { sig, guid, text, note, location, source_title, source_author } } */
const TH_KEY_SHUFFLER_QUOTES_BY_DAY = 'th_shuffler_quotes_by_day';
const TH_KEY_SHUFFLER_POOL_CACHE = 'th_shuffler_pool_cache_v4';
/** Debounced cross-device sync for per-day shuffle picks (avoid workspace-wide flashes on every click). */
const TH_SHUFFLER_DAYMAP_SYNC_IDLE_MS = 15000;
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
/** Coalesce `record.created` → `_refreshAll` (habit logs etc. can fire in bursts). */
const RWR_RECORD_CREATED_DEBOUNCE_MS = 1500;

/**
 * How many source documents to process concurrently during full sync.
 * Body rebuild is sync-line heavy on the main thread; parallel >1 makes Thymer feel frozen for long runs.
 */
const RWR_SYNC_CONCURRENCY = 1;

/** 0 = no yields inside the per-highlight body loop (fastest body rebuild). */
const RWR_BODY_YIELD_EVERY_HIGHLIGHTS = 0;

/**
 * Reader `/api/v3/list/` — official Reader API default is **20 requests/minute/token** (~3000 ms between requests).
 * Override: `readwise_references_list_delay_ms` (set lower at your own 429 risk).
 */
const RWR_LIST_PAGE_DELAY_MS_DEFAULT = 3000;
/**
 * v2 `/api/v2/export/` — main Readwise API docs cite **240 requests/minute/token** for most endpoints (~250 ms spacing).
 * (Highlight LIST / Book LIST are 20/min — export paging is not those.) Override: `readwise_references_export_delay_ms`.
 */
const RWR_EXPORT_PAGE_DELAY_MS_DEFAULT = 250;

/** `localStorage.setItem('readwise_references_include_rss','1')` — sync RSS feeds as References (default off). */
function rwrIncludeRssFromStorage() {
    try {
        const o = localStorage.getItem('readwise_references_include_rss');
        return o === '1' || o === 'true' || o === 'on';
    } catch (_) {
        return false;
    }
}

function rwrParseDelayMs(key, defaultMs) {
    try {
        const v = parseInt(localStorage.getItem(key), 10);
        if (Number.isFinite(v) && v >= 0) return v;
    } catch (_) {}
    return defaultMs;
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

/**
 * Canonical date line under each day group (e.g. "Sat Apr 18"). Used by sync and journal footer parser.
 * @param {Date} d
 */
function formatReadwiseRefDateHeading(d) {
    if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
    const wk = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return wk[d.getDay()] + ' ' + mo[d.getMonth()] + ' ' + d.getDate();
}

class Plugin extends AppPlugin {
    /** Workspace-scoped cache for named collections (one `getAllCollections` until cleared). */
    _rwCollsKey = null;
    _rwCollsResolved = false;
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
        this._rwPeopleColl = all.find((c) => c.getName() === 'People') || null;
        this._rwHighlightsColl = all.find((c) => c.getName() === 'Highlights') || null;
        this._rwCollsKey = key;
        this._rwCollsResolved = true;
    }

    _invalidateRwCollectionHandleCache() {
        this._rwCollsKey = null;
        this._rwCollsResolved = false;
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

    /** `registerPluginSlug` + `init` are heavy (Plugin Backend / worker); run after idle so other globals (e.g. Journal Header Suite) can mount first. */
    async _rwRunDeferredPathB() {
        try {
            await new Promise((r) => {
                try {
                    if (typeof requestIdleCallback === 'function') {
                        requestIdleCallback(() => r(), { timeout: 5000 });
                    } else {
                        setTimeout(r, 900);
                    }
                } catch (_) {
                    setTimeout(r, 900);
                }
            });
            if (this._rwUnloaded) return;
            try {
                await globalThis.ThymerPluginSettings?.registerPluginSlug?.(this.data, {
                    slug: 'readwise-references',
                    label: 'Readwise References',
                });
            } catch (_) {}
            if (this._rwUnloaded) return;
            await new Promise((r) => {
                try {
                    requestAnimationFrame(() => setTimeout(r, 0));
                } catch (_) {
                    setTimeout(r, 0);
                }
            });
            if (this._rwUnloaded) return;
            await (globalThis.ThymerPluginSettings?.init?.({
                plugin: this,
                pluginId: 'readwise-references',
                modeKey: 'thymerext_ps_mode_readwise_references',
                mirrorKeys: () => this._pathBMirrorKeys(),
                label: 'Readwise References',
                data: this.data,
                ui: this.ui,
            }) ?? (console.warn('[Readwise Ref] ThymerPluginSettings runtime missing (redeploy full plugin .js from repo).'), Promise.resolve()));
            try {
                this._scheduleReferencesBootstrapDeferred();
            } catch (_) {}
        } catch (e) {
            try {
                console.warn('[Readwise Ref] deferred Path B init', e);
            } catch (_) {}
        } finally {
            try {
                if (typeof this._rwPathBReadyResolve === 'function') this._rwPathBReadyResolve();
            } catch (_) {}
            this._rwPathBReadyResolve = null;
        }
    }

    async _rwAwaitPathBReady() {
        const p = this._rwPathBReadyPromise;
        if (p) await p.catch(() => {});
    }

    async onLoad() {
        this._rwUnloaded = false;
        this._rwDupLoadSeq = (this._rwDupLoadSeq | 0) + 1;
        this._rwDupDiagLog('onLoad_enter', { loadSeq: this._rwDupLoadSeq });
        this._rwPathBReadyPromise = new Promise((resolve) => {
            this._rwPathBReadyResolve = resolve;
        });
        // Let the host paint before Path B work. Avoid duplicate upgradeCollectionSchema here:
        // registerPluginSlug already runs upgradePluginSettingsSchema (and may rewrite Plugin rows once).
        await new Promise((r) => {
            try {
                requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)));
            } catch (_) {
                setTimeout(r, 0);
            }
        });
        void this._rwRunDeferredPathB();
        this._syncing = false;
        this._cmdSetToken = this.ui.addCommandPaletteCommand({
            label: 'Readwise Ref: Set Token',
            icon: 'key',
            onSelected: () => this._showTokenDialog(),
        });
        this._cmdSync = this.ui.addCommandPaletteCommand({
            label: 'Readwise Ref: Sync',
            icon: 'ti-book-2',
            onSelected: () => this._runSync(false),
        });
        this._cmdFullSync = this.ui.addCommandPaletteCommand({
            label: 'Readwise Ref: Full Sync',
            icon: 'ti-book-2',
            onSelected: () => this._runSync(true),
        });
        this._cmdSyncDiag = this.ui.addCommandPaletteCommand({
            label: 'Readwise Ref: Log last sync diagnostics',
            icon: 'ti-stethoscope',
            onSelected: () => this._logLastSyncDiagnostics(),
        });
        this._cmdStorage = this.ui.addCommandPaletteCommand({
            label: 'Readwise Ref: Storage location…',
            icon: 'ti-database',
            onSelected: async () => {
                await this._rwAwaitPathBReady();
                globalThis.ThymerPluginSettings?.openStorageDialog?.({
                    plugin: this,
                    pluginId: 'readwise-references',
                    modeKey: 'thymerext_ps_mode_readwise_references',
                    mirrorKeys: () => this._pathBMirrorKeys(),
                    label: 'Readwise References',
                    data: this.data,
                    ui: this.ui,
                });
            },
        });
        this._cmdToggleHighlights = this.ui.addCommandPaletteCommand({
            label: "Readwise Ref: Toggle Today's Highlights panel",
            icon: 'ti-layout-list',
            onSelected: () => this._toggleShowHighlightsPanel(),
        });
        this._cmdToggleShuffler = this.ui.addCommandPaletteCommand({
            label: 'Readwise Ref: Toggle Quote Shuffler panel',
            icon: 'ti-arrows-shuffle',
            onSelected: () => this._toggleShowShufflerPanel(),
        });
        this._cmdShuffleQuote = this.ui.addCommandPaletteCommand({
            label: 'Readwise Ref: Shuffle Quote',
            icon: 'ti-arrows-shuffle',
            onSelected: () => { void this._shuffleQuoteFromCommand(); },
        });

        this._panelStates = new Map();
        this._eventHandlerIds = [];
        this._navDeferTimers = new Map();
        this._collapsed = this._loadBool('th_footer_collapsed', false);
        this._shufflerCollapsed = this._loadBool(TH_KEY_SHUFFLER_COLLAPSED, false);
        this._thRefQueryCache = new Map();
        this._quotePoolCache = null;
        this._quotePoolCacheSavedAt = 0;
        this._quotePoolBuildingPromise = null;
        this._hydrateQuotePoolCacheFromStorage();
        this._injectCSS();
        this._eventHandlerIds.push(this.events.on('panel.navigated', ev => this._deferHandlePanel(ev.panel)));
        this._eventHandlerIds.push(this.events.on('panel.focused',   ev => this._deferHandlePanel(ev.panel)));
        this._eventHandlerIds.push(this.events.on('panel.closed',    ev => this._disposePanel(ev.panel?.getId?.())));
        this._eventHandlerIds.push(this.events.on('record.created', () => {
            this._clearFooterDataCaches();
            try {
                if (this._rwRecordCreatedRefreshTimer) clearTimeout(this._rwRecordCreatedRefreshTimer);
            } catch (_) {}
            this._rwRecordCreatedRefreshTimer = setTimeout(() => {
                this._rwRecordCreatedRefreshTimer = null;
                try {
                    this._refreshAll();
                } catch (_) {}
            }, RWR_RECORD_CREATED_DEBOUNCE_MS);
        }));
        /**
         * Journal Footer Suite calls with `{ panels: Panel[] }` so every journal view that has a
         * mounted shell is refreshed — `getActivePanel()` is often not that panel during load/split UI.
         * Callers with no args keep the legacy active-panel + cached `_panelStates` path.
         */
        this._readwiseJfsNotifyBound = (opts) => {
            const fromSuite = opts && Array.isArray(opts.panels) ? opts.panels.filter(Boolean) : null;
            const seen = new Set();
            const kick = (panel) => {
                const id = panel?.getId?.();
                if (!id || seen.has(id)) return;
                seen.add(id);
                this._deferHandlePanel(panel);
            };
            if (fromSuite && fromSuite.length) {
                requestAnimationFrame(() => {
                    for (const p of fromSuite) kick(p);
                });
                return;
            }
            let activeId = null;
            try {
                const p = this.ui.getActivePanel?.() || this.ui.getCurrentPanel?.();
                if (p?.getId) {
                    activeId = p.getId();
                    this._deferHandlePanel(p);
                }
            } catch (_) {}
            for (const [, s] of this._panelStates || []) {
                const pid = s?.panel?.getId?.();
                if (s?.panel && pid && pid !== activeId) kick(s.panel);
            }
        };
        globalThis.__thymerReadwiseJfsSuiteNotify = this._readwiseJfsNotifyBound;
        try {
            const p0 = this.ui.getActivePanel();
            if (p0) this._deferHandlePanel(p0);
        } catch (_) {}
        setTimeout(() => {
            const p = this.ui.getActivePanel();
            if (p) this._deferHandlePanel(p);
        }, 900);
        /** Quote pool warms only when the shuffler populates (see `_populateShufflerSection`) — no journal-load scan. */
    }

    onUnload() {
        this._rwUnloaded = true;
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
        this._syncStatusHide();

        if (globalThis.__thymerReadwiseJfsSuiteNotify === this._readwiseJfsNotifyBound) {
            try { delete globalThis.__thymerReadwiseJfsSuiteNotify; } catch (_) {
                globalThis.__thymerReadwiseJfsSuiteNotify = undefined;
            }
        }

        this._cmdSetToken?.remove();
        this._cmdSync?.remove();
        this._cmdFullSync?.remove();
        this._cmdSyncDiag?.remove();
        this._cmdStorage?.remove();
        this._cmdToggleHighlights?.remove();
        this._cmdToggleShuffler?.remove();
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
            TH_KEY_SHUFFLER_QUOTES_BY_DAY,
        ];
    }

    _showHighlightsPanel() {
        return this._loadBool(TH_KEY_SHOW_HIGHLIGHTS, false);
    }

    _showShufflerPanel() {
        return this._loadBool(TH_KEY_SHOW_SHUFFLER, false);
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
        /* “books” intent: open book silhouette, reads clearly at 16px */
        return '<svg xmlns="http://www.w3.org/2000/svg" width="' + n + '" height="' + n + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';
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
        this._toast(next ? 'Quote Shuffler panel: on' : 'Quote Shuffler panel: off');
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
            if (!suiteHi && !suiteSh && !this._showHighlightsPanel() && !this._showShufflerPanel()) {
                this._disposePanel(s.panelId);
                continue;
            }
            if (!journalDate) continue;
            const container = this._findContainer(panelEl);
            if (!container && !suiteHi && !suiteSh) continue;
            s.loaded = false;
            s.expandedSources = new Map();
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
                this._toast('Rate limited. Wait and retry.');
                this._syncing = false;
                this._syncStatusHide();
                return;
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
        }
        this._syncing = false;
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
        const entries = Array.from(merged.values())
            .map((e) => {
                if (!e || !e.docHL) return e;
                let hl = this._dedupeHighlightRowsByCanonicalKey(e.docHL, exMap);
                hl = this._dedupeIdenticalLongQuoteRows(hl);
                hl = this._dedupeRedundantNoteHighlightRows(hl);
                return Object.assign({}, e, { docHL: hl });
            })
            .filter((e) => e && e.docHL && e.docHL.length > 0);
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
            this._toast('Diagnostics logged (console). ' + inc + ' · unmapped HL: ' + h + ' · dateless in body: ' + d + ' · orphan skip: ' + oa + ' · rss skip: ' + rss + ' · export books: ' + eb + ' · note dedupe: ' + nd + ' · HL dup merge: ' + dh + ' · same-quote merge: ' + dq);
        } catch (_) {
            this._toast('Diagnostics JSON is invalid.');
        }
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
            mergedSources: 0,
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
        /** So `readwise_references_last_sync_diag` is not mistaken for the previous run if the user refreshes mid-sync. */
        this._persistSyncDiag({ ok: null, syncPhase: 'started' });
        this._log('References: true  People: ' + (!!peopleColl));

        const peopleByKey = new Map();
        if (peopleColl) {
            try {
                for (const r of await peopleColl.getAllRecords()) {
                    const n = typeof r.getName === 'function' ? r.getName() : '';
                    const k = this._normalizePeopleKey(n);
                    if (k) peopleByKey.set(k, r);
                }
            } catch (e) {
                this._log('⚠️ People index: ' + e.message);
            }
        }

        const existingRef = await refsColl.getAllRecords();
        const refByExtId = new Map(existingRef.map(r => [r.text('external_id'), r]));

        let createdRef = 0, updatedRef = 0;

        this._syncStatusShow(since ? 'Downloading Reader list (incremental)…' : 'Downloading Reader list (full)…');
        const allResults = await this._fetchReadwiseListAll(token, since);
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
        this._toast('Readwise list done. Fetching export + saving references…');

        let exportByHlId = new Map();
        let exportCoverByDocId = new Map();
        let exportBooks = [];
        try {
            this._syncStatusShow('Fetching Readwise export (v2, full library)…');
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

        this._log('Merging Reader list + export sources…');

        const mergedPack = this._buildMergedReferenceEntries(allResults, exportBooks, exportByHlId);
        try {
            const rawHist = {};
            const mappedHist = {};
            for (const ent of mergedPack.entries || []) {
                const rawKey = String(ent?.doc?.category ?? '').trim() || '(empty)';
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

        this._log('Grouped: ' + mergedPack.pageDocsLen + ' list docs, ' + mergedPack.pageHLsLen + ' list HL rows, '
            + mergedPack.groupedMeta.map.size + ' list parents, '
            + mergedPack.groupedMeta.highlightsWithoutDocKey + ' list HL rows with no document key · merged '
            + mergedTotal + ' reference sources (Reader + export)'
            + (docEntries.length !== mergedTotal ? ' · writing ' + docEntries.length + ' this run (debug cap)' : ''));

        let syntheticParentCount = mergedPack.syntheticParentCount;

        const docTotal = docEntries.length;
        this._lastSyncDiag.docEntriesToWrite = docTotal;
        if (docTotal > 0) {
            this._syncStatusShow('Saving references 0/' + docTotal + '…');
        }
        for (let bi = 0; bi < docEntries.length; bi += RWR_SYNC_CONCURRENCY) {
            const batch = docEntries.slice(bi, bi + RWR_SYNC_CONCURRENCY);
            const batchOut = await Promise.all(batch.map(async (entry) => {
                const doc = entry.doc;
                const docHL = entry.docHL;
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
                let personForRef = null;
                if (peopleColl) {
                    personForRef = await this._ensurePeopleRecord(peopleColl, doc.author || '', peopleByKey);
                }

                const catLabel = String(doc.category || '').trim();
                const srcLabel = String(doc.source || '').trim();

                const fields = {
                    external_id: extId,
                    source_title: docTitle,
                    source_url: doc.source_url || '',
                    highlight_count: docHL.length,
                    synced_at: new Date(),
                };
                const catChoiceId = this._normalizeReadwiseCategoryChoiceId(catLabel);
                if (catChoiceId) fields.source_category = catChoiceId;
                fields.source_origin = this._normalizeReadwiseSourceOriginChoiceId(srcLabel);
                if (personForRef && personForRef.guid) fields.source_author = personForRef;
                if (refBanner) fields.banner = refBanner;
                if (captureDate) fields.captured_at = captureDate;

                let refRecord = null;
                let created = 0;
                let updated = 0;
                const existing = refByExtId.get(extId);
                if (existing) {
                    this._setFields(existing, fields);
                    refByExtId.set(extId, existing);
                    updated = 1;
                    refRecord = existing;
                } else {
                    const r = await this._createRecord(refsColl, docTitle);
                    if (r) {
                        this._setFields(r, fields);
                        refByExtId.set(extId, r);
                        created = 1;
                        refRecord = r;
                    } else {
                        this._log('⚠️ Failed to create Reference: ' + extId);
                        if (this._lastSyncDiag) this._lastSyncDiag.skippedFailedCreate++;
                    }
                }

                let written = 0;
                if (refRecord && refRecord.guid) {
                    try {
                        await this._rebuildReferenceHighlightsBody(refRecord, doc, docHL, exportByHlId);
                    } catch (e) {
                        this._log('⚠️ Body rebuild: ' + (e && e.message ? e.message : e));
                        if (this._lastSyncDiag) this._lastSyncDiag.bodyRebuildErrors++;
                    }
                    written = 1;
                    this._rwrWritten++;
                    if (this._lastSyncDiag) this._lastSyncDiag.referencesWritten++;
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
            await this._sleep(0);
        }

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
        await this._tryHostCollectionRefresh(refsColl);
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
     * Full rebuild of the Highlights section from API data (v1).
     */
    async _rebuildReferenceHighlightsBody(refRecord, doc, docHL, exportByHlId) {
        const record = await this._getRecordReady(refRecord.guid);
        if (!record) {
            if (this._lastSyncDiag) this._lastSyncDiag.body_getRecordReadyFail = (this._lastSyncDiag.body_getRecordReadyFail || 0) + 1;
            return;
        }

        let items;
        try {
            items = await record.getLineItems();
        } catch (e) {
            if (this._lastSyncDiag) this._lastSyncDiag.body_getLineItemsFail = (this._lastSyncDiag.body_getLineItemsFail || 0) + 1;
            return;
        }

        await this._deleteAllLinesDeep(record);

        const sectionLine = await this._createLine(record, null, null, 'text');
        if (!sectionLine) return;
        try {
            await sectionLine.setSegments([{ type: 'text', text: READWISE_REF_HIGHLIGHTS_HEADER }]);
        } catch (_) {
            await sectionLine.setSegments([{ type: 'text', text: READWISE_REF_HIGHLIGHTS_HEADER }]);
        }
        await this._applyLineHeading(sectionLine, 2);

        const { byDay, skippedNoDate } = this._groupHighlightsByLocalDay(docHL);
        if (this._lastSyncDiag && skippedNoDate > 0) {
            this._lastSyncDiag.datelessHighlightsInBodies = (this._lastSyncDiag.datelessHighlightsInBodies || 0) + skippedNoDate;
        }
        const dayKeys = Array.from(byDay.keys()).sort();

        let prevUnderSection = null;
        let dayIndex = 0;
        for (const dk of dayKeys) {
            if (dayIndex++ > 0) {
                const gapBefore = await this._createLine(record, sectionLine, prevUnderSection, 'text');
                if (gapBefore) {
                    try {
                        await gapBefore.setSegments([{ type: 'text', text: '' }]);
                    } catch (_) {}
                    prevUnderSection = gapBefore;
                }
                const divLine = await this._createLine(record, sectionLine, prevUnderSection, 'text');
                if (divLine) {
                    try {
                        await divLine.setSegments([{ type: 'text', text: READWISE_REF_BETWEEN_DATE_DIVIDER_TEXT }]);
                    } catch (_) {}
                    prevUnderSection = divLine;
                }
                const gapAfter = await this._createLine(record, sectionLine, prevUnderSection, 'text');
                if (gapAfter) {
                    try {
                        await gapAfter.setSegments([{ type: 'text', text: '' }]);
                    } catch (_) {}
                    prevUnderSection = gapAfter;
                }
            }
            const { dayDate, highlights } = byDay.get(dk);
            const dateLabel = formatReadwiseRefDateHeading(dayDate);
            const dateLine = await this._createLine(record, sectionLine, prevUnderSection, 'text');
            if (!dateLine) continue;
            try {
                const jGuid = this._journalGuidForLocalDate(dayDate);
                if (jGuid) {
                    try {
                        await dateLine.setSegments([{ type: 'ref', text: { guid: jGuid, title: dateLabel } }]);
                    } catch (_) {
                        await dateLine.setSegments([{ type: 'ref', text: jGuid }]);
                    }
                } else {
                    await dateLine.setSegments([{ type: 'text', text: dateLabel }]);
                }
            } catch (_) {
                try {
                    await dateLine.setSegments([{ type: 'text', text: dateLabel }]);
                } catch (_) {}
            }
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
                const ex = exportByHlId.get(String(h.id)) || exportByHlId.get(String(h.external_id ?? ''));
                let noteStr = this._highlightNote(h);
                if (ex && ex.note != null && String(ex.note).trim() !== '') noteStr = String(ex.note);
                const locUrl = this._readwiseHighlightOpenLink(h, ex);

                const quoteLine = await this._createLine(record, dateLine, prevUnderDate, 'text');
                if (!quoteLine) continue;
                try {
                    await quoteLine.setSegments([{ type: 'text', text: body }]);
                } catch (_) {}
                prevUnderDate = quoteLine;

                let lastChild = null;
                if (noteStr && String(noteStr).trim()) {
                    const nt = String(noteStr).trim();
                    const noteLine = await this._createLine(record, quoteLine, lastChild, 'text');
                    if (noteLine) {
                        lastChild = noteLine;
                        try {
                            await noteLine.setSegments([
                                { type: 'bold', text: '📝 Note: ' },
                                { type: 'text', text: nt },
                            ]);
                        } catch (_) {
                            await noteLine.setSegments([{ type: 'text', text: '📝 Note: ' + nt }]);
                        }
                    }
                }
                if (locUrl) {
                    const locLine = await this._createLine(record, quoteLine, lastChild, 'text');
                    if (locLine) {
                        try {
                            await locLine.setSegments([
                                { type: 'bold', text: '🌎 Loc: ' },
                                { type: 'text', text: locUrl },
                            ]);
                        } catch (_) {
                            await locLine.setSegments([{ type: 'text', text: '🌎 Loc: ' + locUrl }]);
                        }
                    }
                }

                if (hi < highlights.length - 1) {
                    const sep = await this._createLine(record, dateLine, quoteLine, 'text');
                    if (sep) {
                        try {
                            await sep.setSegments([{ type: 'text', text: READWISE_REF_QUOTE_SEPARATOR_TEXT }]);
                        } catch (_) {}
                        prevUnderDate = sep;
                    }
                }
            }
        }
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

    async _createLine(record, parent, afterSibling, type) {
        try {
            return await record.createLineItem(parent, afterSibling, type);
        } catch (e) {
            try {
                return await record.createLineItem(parent, null, type);
            } catch (e2) {
                return null;
            }
        }
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
        const attempts = 90;
        const gapMs = 120;
        for (let i = 0; i < attempts; i++) {
            const r = this.data?.getRecord?.(guid);
            if (r && typeof r.getLineItems === 'function' && typeof r.createLineItem === 'function') return r;
            await this._sleep(gapMs);
        }
        return null;
    }

    /** Thymer journal page for a calendar day (date headings link here when available). */
    _journalGuidForLocalDate(dayDate) {
        try {
            if (!this.data || typeof this.data.getJournalForDate !== 'function') return null;
            const jr = this.data.getJournalForDate(dayDate);
            return jr?.guid || null;
        } catch (_) {
            return null;
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
            const k = String(v ?? '').trim() || '(empty)';
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

    async _ensurePeopleRecord(peopleColl, rawName, peopleByKey) {
        if (!peopleColl || !peopleByKey) return null;
        const key = this._normalizePeopleKey(rawName);
        if (!key) return null;
        const hit = peopleByKey.get(key);
        if (hit) return hit;
        const title = String(rawName).trim() || 'Unknown';
        const r = await this._createRecord(peopleColl, title);
        if (r && r.guid) {
            peopleByKey.set(key, r);
            return r;
        }
        return null;
    }

    async _createRecord(coll, title) {
        const guid = coll.createRecord(title);
        if (!guid) {
            this._log('⚠️ createRecord null: ' + this._trunc(title, 40));
            return null;
        }
        for (let i = 0; i < 30; i++) {
            await this._sleep(i < 5 ? 120 : 200);
            try {
                const all = await coll.getAllRecords();
                const record = all.find(r => r.guid === guid);
                if (record) return record;
            } catch (_) {}
        }
        return null;
    }

    _setFields(record, fields) {
        const failed = [];
        for (const [id, val] of Object.entries(fields)) {
            if (val === null || val === undefined) continue;
            try {
                const prop = record.prop(id);
                if (!prop) {
                    failed.push(id);
                    continue;
                }
                if (val && typeof val === 'object' && val.guid) {
                    if (typeof prop.link === 'function') prop.link(val);
                    else if (typeof prop.linkRecord === 'function') prop.linkRecord(val);
                    else prop.set(val.guid);
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
            }
        }

        const rebuilt = this._mountFooter(state, panelEl, { suiteHi, suiteSh, container });
        if (rebuilt) {
            state.loading = false; // In-flight populate may target a removed root (same as Today's Notes)
            state.expandedSources = new Map();
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
        for (const [, s] of (this._panelStates || new Map())) {
            s.loaded = false;
            this._populate(s);
        }
    }

    // =========================================================================
    // DOM mounting
    // =========================================================================

    /** Remove Readwise footer wrappers owned by `panelId` from each parent (suite + page). */
    _stripThJournalFooters(panelId, parents) {
        const seen = new Set();
        for (const par of parents) {
            if (!par || seen.has(par)) continue;
            seen.add(par);
            for (const el of par.querySelectorAll(':scope > .th-journal-footer')) {
                if (el.dataset?.panelId === panelId) {
                    try { el.remove(); } catch (_) {}
                }
            }
        }
    }

    // Returns true if the footer was (re)built — caller should re-populate and drop stale async work
    _mountFooter(state, panelEl, { suiteHi, suiteSh, container }) {
        const wantHi = !!suiteHi || this._showHighlightsPanel();
        const wantSh = !!suiteSh || this._showShufflerPanel();
        if (!wantHi && !wantSh) return false;

        const hiParent = wantHi ? (suiteHi || container) : null;
        const shParent = wantSh ? (suiteSh || container) : null;
        const combined = !!(wantHi && wantSh && hiParent && shParent && hiParent === shParent);

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
                && state.shufflerRootEl?.isConnected
                && state.shufflerRootEl.parentElement === shParent
                && state.observer);
        } else if (wantHi && !wantSh) {
            fast = !!(state.rootEl?.isConnected
                && state.rootEl.parentElement === hiParent
                && !state.shufflerRootEl
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
                wrapSh.appendChild(this._buildShufflerPanel(state));
                shParent.appendChild(wrapSh);
                if (!wantHi || hiParent !== shParent) state.shufflerRootEl = wrapSh;
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
        if (state?.shufflerRootEl?.parentElement === container) {
            if (container.lastElementChild !== state.shufflerRootEl) container.appendChild(state.shufflerRootEl);
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
        root.className              = 'th-footer th-footer--highlights';
        root.dataset.panelSection   = 'highlights';

        const header = document.createElement('div');
        header.className = 'th-header';

        const toggle = document.createElement('button');
        toggle.className   = 'th-toggle button-none button-small button-minimal-hover';
        toggle.type        = 'button';
        toggle.title       = 'Collapse / expand';
        toggle.textContent = this._collapsed ? '+' : '−';

        const icon = document.createElement('span');
        icon.className = 'th-title-icon';
        this._rwrAppendSvgIcon(icon, 'books', 16);

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
        collapseMiniBtn.title = inSuite
            ? 'Hide Quote Shuffler (same as footer header quote icon)'
            : 'Collapse Quote Shuffler';
        collapseMiniBtn.innerHTML = '<i class="ti ti-chevron-up" aria-hidden="true"></i>';
        collapseMiniBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (inSuite && typeof globalThis.__thymerJfsCloseQuoteShufflerDock === 'function') {
                globalThis.__thymerJfsCloseQuoteShufflerDock();
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
        if (state.loading) return;
        state.loading = true;
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

        if (hiBody) hiBody.innerHTML = '<div class="th-loading">Scanning highlights…</div>';
        if (shBody) shBody.innerHTML = '<div class="th-loading">Loading quote library…</div>';

        try {
            await this._yieldForJournalPaint();
            const jobs = [];
            if (hiBody) {
                jobs.push(this._populateHighlightsSection(
                    state, hiBody, hiCount, targetJournal, targetHiRoot, targetShRoot, targetGuid, seq));
            }
            if (shBody) {
                jobs.push(this._populateShufflerSection(
                    state, shBody, targetJournal, targetHiRoot, targetShRoot, targetGuid, seq));
            }
            await Promise.all(jobs);

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
            if (countEl) countEl.textContent = '';
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
    }

    async _populateShufflerSection(state, shBody, targetJournal, targetHiRoot, targetShRoot, targetGuid, seq) {
        const reportPool = (msg) => {
            if (!this._isPopulateStillCurrent(state, seq, targetJournal, targetHiRoot, targetShRoot, targetGuid)) return;
            const el = shBody.querySelector('.th-loading');
            if (el) el.textContent = msg;
        };
        await this._warmQuotePoolCache(reportPool);
        if (!this._isPopulateStillCurrent(state, seq, targetJournal, targetHiRoot, targetShRoot, targetGuid)) return;
        const pool = Array.isArray(this._quotePoolCache) ? this._quotePoolCache : [];
        const saved = this._loadDayShufflePick(targetJournal);
        if (saved && saved.guid && String(saved.text || '').trim()) {
            let pick = this._pickFromStored(saved);
            const merged = this._mergeShufflePickWithPool(pick, pool);
            if (merged !== pick) {
                pick = merged;
                this._persistDayShufflePick(targetJournal, pick);
            }
            this._renderShufflerQuoteCard(state, shBody, pick, targetJournal);
        } else {
            this._renderShufflerIdle(state, shBody, targetJournal);
        }
        if (!this._isPopulateStillCurrent(state, seq, targetJournal, targetHiRoot, targetShRoot, targetGuid)) return;
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

        body.addEventListener('click', () => {
            const wsGuid = this.getWorkspaceGuid?.() || this.data?.getActiveUsers?.()[0]?.workspaceGuid;
            if (!wsGuid || !picked.guid) return;
            state.panel?.navigateTo({
                workspaceGuid: wsGuid,
                type:   'edit_panel',
                rootId: picked.guid,
                subId:  picked.guid,
            });
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
        await this._ensureRwCollections();
        if (this._rwRefsColl) {
            return await this._getHighlightsFromReferencesForDate(yyyymmdd, onProgress);
        }
        return await this._getHighlightsFromHighlightsCollection(yyyymmdd, onProgress);
    }

    /**
     * Parse Reference record bodies: Highlights section → date heading → quote blocks (+ note/loc children).
     */
    async _getHighlightsFromReferencesForDate(yyyymmdd, onProgress) {
        const hit = this._thRefQueryCache?.get(yyyymmdd);
        if (hit) return hit;

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
     * Date line may be plain text (legacy) or a ref to the journal record (Readwise References sync).
     */
    async _dateLineMatchesJournalDay(line, yyyymmdd, targetDateLabel) {
        const plain = (await this._linePlainText(line)).trim();
        if (plain === targetDateLabel) return true;
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
        sourceEl.title       = 'Open reference';
        if (items.length && items[0].guid) {
            sourceEl.addEventListener('click', (e) => {
                e.stopPropagation();
                const wsGuid = this.getWorkspaceGuid?.() || this.data?.getActiveUsers?.()[0]?.workspaceGuid;
                if (!wsGuid) return;
                state.panel?.navigateTo({
                    workspaceGuid: wsGuid,
                    type:   'edit_panel',
                    rootId: items[0].guid,
                    subId:  items[0].guid,
                });
            });
        }

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
            .th-source-title--link {
                cursor: pointer;
            }
            .th-source-title--link:hover {
                color: #f5efe4;
                text-decoration: underline;
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
                color: #8a7e6a;
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
                color: #e8e0d0;
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
