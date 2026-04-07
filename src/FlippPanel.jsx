import { useState, useEffect } from "react";
import { fetchStoreItems } from "./flippApi";
import { findTopMatches } from "./fuzzyMatch";

const STORES = [
  { key: "costco", label: "COSTCO" },
  { key: "maxi",   label: "MAXI" },
  { key: "superc", label: "SUPER C" },
];

const CATEGORIES = [
  "Viandes", "Produits laitiers", "Épicerie sèche",
  "Fruits & légumes", "Surgelés", "Hygiène/Maison", "Autre",
];

// ── Build the pending-match list ──────────────────────────────────────────────

function buildPending(products, flyerItems, memory) {
  const rows = [];
  const matchedIds = {}; // { storeKey: Set<itemId> }

  for (const { key: storeKey, label: storeLabel } of STORES) {
    const items = flyerItems[storeKey] ?? [];
    matchedIds[storeKey] = new Set();

    for (const product of products) {
      const memKey = `${product.id}_${storeKey}`;
      const mem    = memory[memKey];

      let suggestions = findTopMatches(product.name, items);
      let selectedIdx = null;
      let fromMemory  = false;

      if (mem) {
        const memPos = items.findIndex(i => i.id === mem.flippId);
        if (memPos >= 0) {
          const memItem  = items[memPos];
          const memScore = suggestions.find(s => s.item.id === mem.flippId)?.score ?? 1;
          suggestions = [
            { item: memItem, score: memScore },
            ...suggestions.filter(s => s.item.id !== mem.flippId),
          ].slice(0, 3);
          selectedIdx = 0;
          fromMemory  = true;
        }
      }

      suggestions.forEach(s => matchedIds[storeKey].add(s.item.id));

      rows.push({
        productId: product.id, productName: product.name,
        storeKey, storeLabel, suggestions,
        selectedIdx, fromMemory, remember: true,
      });
    }
  }

  // Items from the circular that didn't match any existing product
  const unmatched = {};
  for (const { key } of STORES) {
    const items = flyerItems[key] ?? [];
    unmatched[key] = items.filter(i => !matchedIds[key]?.has(i.id));
  }

  return { rows, unmatched };
}

// ── Styles ────────────────────────────────────────────────────────────────────

const card = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: "12px", padding: "12px 14px", marginBottom: "8px",
};

const radioBtn = (selected) => ({
  display: "flex", alignItems: "center", gap: 8,
  padding: "7px 10px", borderRadius: "8px", cursor: "pointer",
  background: selected ? "rgba(99,102,241,0.15)" : "transparent",
  border: `1px solid ${selected ? "rgba(99,102,241,0.4)" : "transparent"}`,
  marginBottom: 3,
});

const tag = (color) => ({
  fontSize: "9px", fontFamily: "monospace", fontWeight: 700,
  padding: "2px 6px", borderRadius: "99px",
  background: color === "yellow" ? "rgba(251,191,36,0.15)"
            : color === "green"  ? "rgba(134,239,172,0.15)"
            :                      "rgba(99,102,241,0.15)",
  color: color === "yellow" ? "#fbbf24"
       : color === "green"  ? "#86efac"
       :                      "#a5b4fc",
  letterSpacing: "0.05em",
});

const inBtn = (active, danger) => ({
  flex: 1, padding: "10px", borderRadius: "9px", cursor: "pointer",
  fontFamily: "monospace", fontWeight: 700, fontSize: "12px", border: "1px solid",
  background: danger ? "rgba(239,68,68,0.1)" : active ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.04)",
  borderColor: danger ? "rgba(239,68,68,0.3)" : active ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.1)",
  color: danger ? "#f87171" : active ? "#a5b4fc" : "#6b7280",
});

const inputSt = {
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px", padding: "7px 10px", color: "#f1f5f9",
  fontSize: "12px", fontFamily: "'DM Mono', monospace", outline: "none",
};

function pct(score) { return `${Math.round(score * 100)}%`; }

function formatPrice(item) {
  if (item.price_text) return item.price_text;
  const p = item.current_price ?? item.price;
  return p != null ? `$${Number(p).toFixed(2)}` : "?";
}

function numericPrice(item) {
  const p = item.current_price ?? item.price ?? null;
  return p != null ? Number(p) : null;
}

function emptyStore() {
  return { regular: null, promo: null, qty: null, unit: "unité", desc: null };
}

// ── MatchRow ──────────────────────────────────────────────────────────────────

function MatchRow({ match, idx, onChange, onAddCreate, toCreate }) {
  return (
    <div style={card}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {match.fromMemory && <span style={tag("green")}>🧠 MÉMOIRE</span>}
          <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "14px", color: "#f1f5f9" }}>
            {match.productName}
          </span>
          <span style={{ fontSize: "10px", fontFamily: "monospace", color: "#4b5563" }}>
            → {match.storeLabel}
          </span>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: "11px", fontFamily: "monospace", color: "#6b7280" }}>
          <input type="checkbox" checked={match.remember}
            onChange={e => onChange(idx, "remember", e.target.checked)}
            style={{ accentColor: "#818cf8" }} />
          Se souvenir
        </label>
      </div>

      {/* Suggestions */}
      {match.suggestions.map((s, si) => {
        const alreadyQueued = toCreate.some(c => c.flippItem.id === s.item.id && c.storeKey === match.storeKey);
        return (
          <div key={s.item.id ?? si} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <div
              style={{ ...radioBtn(match.selectedIdx === si), flex: 1, margin: 0 }}
              onClick={() => onChange(idx, "selected", si)}
            >
              <div style={{
                width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                border: `2px solid ${match.selectedIdx === si ? "#818cf8" : "#374151"}`,
                background: match.selectedIdx === si ? "#818cf8" : "transparent",
              }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: "12px", color: "#e2e8f0", fontFamily: "monospace" }}>{s.item.name}</span>
              </div>
              <span style={{ fontSize: "12px", color: "#fbbf24", fontFamily: "monospace", marginRight: 6 }}>
                {formatPrice(s.item)}
              </span>
              <span style={{ fontSize: "10px", fontFamily: "monospace", color: "#4b5563" }}>
                {pct(s.score)}
              </span>
            </div>

            {/* + Créer button */}
            <button
              onClick={() => onAddCreate(s.item, match.storeKey, match.storeLabel)}
              title={alreadyQueued ? "Déjà dans la liste de création" : "Créer un nouvel item"}
              style={{
                flexShrink: 0, width: 26, height: 26, borderRadius: "6px", border: "1px solid",
                cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center",
                background: alreadyQueued ? "rgba(134,239,172,0.15)" : "rgba(255,255,255,0.05)",
                borderColor: alreadyQueued ? "rgba(134,239,172,0.4)" : "rgba(255,255,255,0.1)",
                color: alreadyQueued ? "#86efac" : "#6b7280",
              }}
            >
              {alreadyQueued ? "✓" : "+"}
            </button>
          </div>
        );
      })}

      {/* Aucune correspondance */}
      <div style={radioBtn(match.selectedIdx === null)} onClick={() => onChange(idx, "selected", null)}>
        <div style={{
          width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
          border: `2px solid ${match.selectedIdx === null ? "#f87171" : "#374151"}`,
          background: match.selectedIdx === null ? "#f87171" : "transparent",
        }} />
        <span style={{ fontSize: "11px", color: "#6b7280", fontFamily: "monospace" }}>Aucune correspondance</span>
      </div>
    </div>
  );
}

// ── ToCreateSection ───────────────────────────────────────────────────────────

function ToCreateSection({ toCreate, onUpdate, onRemove }) {
  if (!toCreate.length) return null;
  return (
    <div style={{ margin: "0 16px 12px", padding: "12px 14px", background: "rgba(134,239,172,0.04)", border: "1px solid rgba(134,239,172,0.15)", borderRadius: "12px" }}>
      <div style={{ fontSize: "10px", fontFamily: "monospace", letterSpacing: "0.1em", color: "#86efac", marginBottom: 10 }}>
        ── NOUVEAUX ITEMS À CRÉER ({toCreate.length}) ─────────────
      </div>
      {toCreate.map(item => (
        <div key={item.tempId} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: "9px", fontFamily: "monospace", color: "#4b5563", width: 48, flexShrink: 0 }}>
            {item.storeLabel}
          </span>
          <input
            value={item.name}
            onChange={e => onUpdate(item.tempId, "name", e.target.value)}
            style={{ ...inputSt, flex: 2, minWidth: 120 }}
            placeholder="Nom du produit"
          />
          <select
            value={item.category}
            onChange={e => onUpdate(item.tempId, "category", e.target.value)}
            style={{ ...inputSt, flex: 1, minWidth: 100 }}
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            onClick={() => onRemove(item.tempId)}
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "6px", padding: "5px 8px", color: "#f87171", cursor: "pointer", fontSize: "12px" }}
          >✕</button>
        </div>
      ))}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function FlippPanel({ products, memory, onConfirm, onClose }) {
  const [postalCode, setPostalCode] = useState(() => localStorage.getItem("postalCode") || "H2X1Y4");
  const [status,    setStatus]    = useState("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [pending,   setPending]   = useState([]);
  const [toCreate,   setToCreate]   = useState([]);
  const [unmatched,  setUnmatched]  = useState({});
  const [inlineEdit, setInlineEdit] = useState({}); // { [id_storeKey]: { name, category } }

  // Auto-start search on mount
  useEffect(() => { handleSearch(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Search ──────────────────────────────────────────────────────────────────

  const handleSearch = async () => {
    localStorage.setItem("postalCode", postalCode);
    setStatus("loading");
    setToCreate([]);
    setInlineEdit({});
    const items = {};

    const errors = [];
    for (const { key, label } of STORES) {
      setStatusMsg(`Chargement de ${label}...`);
      try { items[key] = await fetchStoreItems(postalCode, key); }
      catch (e) { items[key] = []; errors.push(`${label}: ${e.message}`); }
    }

    const { rows, unmatched: unmatchedItems } = buildPending(products, items, memory);
    setPending(rows);
    setUnmatched(unmatchedItems);
    setStatus("ready");
    const autoCount = rows.filter(r => r.fromMemory).length;
    const unmatchedCount = Object.values(unmatchedItems).reduce((s, a) => s + a.length, 0);
    const totalItems = Object.values(items).reduce((s, a) => s + a.length, 0);
    const errMsg = errors.length ? ` ⚠️ ${errors.join(" | ")}` : "";
    setStatusMsg(`${totalItems} items Flipp · ${rows.filter(r=>r.suggestions.length>0).length} matchés · ${unmatchedCount} non matchés${errMsg}`);
  };

  // ── Row changes ─────────────────────────────────────────────────────────────

  const handleChange = (idx, field, value) => {
    setPending(prev => prev.map((m, i) => {
      if (i !== idx) return m;
      if (field === "selected") return { ...m, selectedIdx: value, fromMemory: false };
      if (field === "remember") return { ...m, remember: value };
      return m;
    }));
  };

  // ── Create queue ────────────────────────────────────────────────────────────

  const handleAddCreate = (flippItem, storeKey, storeLabel, customName) => {
    setToCreate(prev => {
      // Toggle: if already queued, remove it
      if (prev.some(c => c.flippItem.id === flippItem.id && c.storeKey === storeKey)) {
        return prev.filter(c => !(c.flippItem.id === flippItem.id && c.storeKey === storeKey));
      }
      return [...prev, {
        tempId: `${Date.now()}_${Math.random()}`,
        flippItem,
        storeKey,
        storeLabel,
        name: customName ?? flippItem.name ?? "",
        category: "Épicerie sèche",
      }];
    });
  };

  // ── Inline edit (unmatched list) ─────────────────────────────────────────────

  const handleInlineOpen = (item, storeKey) => {
    const ek = `${item.id}_${storeKey}`;
    setInlineEdit(prev => ({ ...prev, [ek]: { name: item.name ?? "", category: "Épicerie sèche" } }));
  };

  const handleInlineUpdate = (ek, field, value) => {
    setInlineEdit(prev => ({ ...prev, [ek]: { ...prev[ek], [field]: value } }));
  };

  const handleInlineConfirm = (ek, item, storeKey, storeLabel) => {
    const edit = inlineEdit[ek];
    if (!edit || !edit.name.trim()) return;
    setToCreate(prev => [...prev, {
      tempId: `${Date.now()}_${Math.random()}`,
      flippItem: item, storeKey, storeLabel,
      name: edit.name.trim(), category: edit.category,
    }]);
    setInlineEdit(prev => { const p = { ...prev }; delete p[ek]; return p; });
  };

  const handleInlineCancel = (ek) => {
    setInlineEdit(prev => { const p = { ...prev }; delete p[ek]; return p; });
  };

  const handleUpdateCreate = (tempId, field, value) => {
    setToCreate(prev => prev.map(c => c.tempId === tempId ? { ...c, [field]: value } : c));
  };

  const handleRemoveCreate = (tempId) => {
    setToCreate(prev => prev.filter(c => c.tempId !== tempId));
  };

  // ── Confirm ─────────────────────────────────────────────────────────────────

  const handleConfirm = () => {
    const newMemory = { ...memory };
    const promoMap  = {};

    // Build promo updates for existing products
    for (const match of pending) {
      if (match.selectedIdx === null) continue;
      const sugg  = match.suggestions[match.selectedIdx];
      if (!sugg) continue;
      const price = numericPrice(sugg.item);
      if (price == null) continue;

      if (!promoMap[match.productId]) promoMap[match.productId] = {};
      promoMap[match.productId][match.storeKey] = { price, desc: sugg.item.name ?? null };

      if (match.remember) {
        newMemory[`${match.productId}_${match.storeKey}`] = {
          flippId: sugg.item.id, flippName: sugg.item.name,
        };
      }
    }

    const updatedProducts = products.map(p => {
      const upd = promoMap[p.id];
      if (!upd) return p;
      return {
        ...p,
        costco: upd.costco ? { ...p.costco, promo: upd.costco.price, desc: upd.costco.desc } : p.costco,
        maxi:   upd.maxi   ? { ...p.maxi,   promo: upd.maxi.price,   desc: upd.maxi.desc   } : p.maxi,
        superc: upd.superc ? { ...p.superc,  promo: upd.superc.price, desc: upd.superc.desc } : p.superc,
      };
    });

    // Build new products from toCreate
    const newProducts = toCreate
      .filter(c => c.name.trim())
      .map(c => {
        const price = numericPrice(c.flippItem);
        const storeData = { regular: price, promo: null, qty: 1, unit: "unité", desc: c.flippItem.name ?? null };
        return {
          id: Date.now() + Math.random(),
          name: c.name.trim(),
          category: c.category,
          costco: c.storeKey === "costco" ? storeData : emptyStore(),
          maxi:   c.storeKey === "maxi"   ? storeData : emptyStore(),
          superc: c.storeKey === "superc" ? storeData : emptyStore(),
        };
      });

    onConfirm([...updatedProducts, ...newProducts], newMemory);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const byStore = STORES.map(s => ({ ...s, rows: pending.filter(r => r.storeKey === s.key) }));
  const selectedCount = pending.filter(r => r.selectedIdx !== null).length;
  const totalActions  = selectedCount + toCreate.length;

  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(129,140,248,0.03)" }}>
      {/* Header */}
      <div style={{ padding: "14px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, fontFamily: "monospace", color: "#a5b4fc" }}>
          🏷️ SYNC PROMOS FLIPP
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "16px" }}>✕</button>
      </div>

      {/* Search bar */}
      <div style={{ padding: "0 16px 12px", display: "flex", gap: 8 }}>
        <input
          placeholder="Code postal (ex: H2X1Y4)"
          value={postalCode}
          onChange={e => setPostalCode(e.target.value.toUpperCase())}
          style={{ ...inputSt, flex: 1, padding: "8px 12px", fontSize: "13px" }}
          disabled={status === "loading"}
        />
        <button
          onClick={handleSearch}
          disabled={status === "loading"}
          style={{ ...inBtn(true), flex: "0 0 auto", padding: "8px 16px", opacity: status === "loading" ? 0.6 : 1 }}
        >
          {status === "loading" ? "⟳ …" : "▶ Chercher"}
        </button>
      </div>

      {/* Status */}
      {statusMsg && (
        <div style={{ padding: "0 16px 10px", fontSize: "11px", fontFamily: "monospace", color: "#6b7280" }}>
          {statusMsg}
        </div>
      )}

      {/* Results */}
      {status === "ready" && (
        <>
          <div style={{ padding: "0 16px", maxHeight: "50vh", overflowY: "auto" }}>
            {byStore.map(({ key, label, rows }) => rows.length > 0 && (
              <div key={key} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "10px", fontFamily: "monospace", letterSpacing: "0.1em", color: "#4b5563", marginBottom: 8, paddingLeft: 2 }}>
                  ── {label} ─────────────────────
                </div>
                {rows.map(match => (
                  <MatchRow
                    key={`${match.productId}_${key}`}
                    match={match}
                    idx={pending.indexOf(match)}
                    onChange={handleChange}
                    onAddCreate={handleAddCreate}
                    toCreate={toCreate}
                  />
                ))}
              </div>
            ))}
            {pending.length === 0 && (
              <div style={{ textAlign: "center", padding: "24px 0", color: "#4b5563", fontFamily: "monospace", fontSize: "12px" }}>
                Aucune correspondance trouvée pour tes produits.
              </div>
            )}
          </div>

          {/* Items Flipp non matchés */}
          {(() => {
            const totalUnmatched = Object.values(unmatched).reduce((s, a) => s + a.length, 0);
            if (!totalUnmatched) return null;
            return (
              <div style={{ margin: "0 16px 12px", padding: "12px 14px", background: "rgba(251,191,36,0.03)", border: "1px solid rgba(251,191,36,0.12)", borderRadius: "12px" }}>
                <div style={{ fontSize: "10px", fontFamily: "monospace", letterSpacing: "0.1em", color: "#fbbf24", marginBottom: 10 }}>
                  ── {totalUnmatched} ITEMS FLIPP SANS CORRESPONDANCE ─────────────
                </div>
                <div style={{ maxHeight: "320px", overflowY: "auto" }}>
                  {STORES.map(({ key, label }) => {
                    const items = unmatched[key] ?? [];
                    if (!items.length) return null;
                    return (
                      <div key={key}>
                        <div style={{ fontSize: "9px", fontFamily: "monospace", color: "#4b5563", padding: "8px 0 4px", letterSpacing: "0.1em" }}>
                          {label} — {items.length} items
                        </div>
                        {items.map((item, i) => {
                          const ek = `${item.id}_${key}`;
                          const queued = toCreate.some(c => c.flippItem.id === item.id && c.storeKey === key);
                          const editing = !!inlineEdit[ek];

                          if (queued) {
                            return (
                              <div key={item.id ?? i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 4px", borderBottom: "1px solid rgba(255,255,255,0.04)", opacity: 0.45 }}>
                                <span style={{ fontSize: "12px", color: "#86efac" }}>✓</span>
                                <span style={{ flex: 1, fontSize: "11px", color: "#86efac", fontFamily: "monospace", textDecoration: "line-through" }}>{item.name}</span>
                              </div>
                            );
                          }

                          if (editing) {
                            const edit = inlineEdit[ek];
                            return (
                              <div key={item.id ?? i} style={{ padding: "8px 4px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(99,102,241,0.05)", borderRadius: "6px", marginBottom: 2 }}>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                                  <input
                                    value={edit.name}
                                    onChange={e => handleInlineUpdate(ek, "name", e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter") handleInlineConfirm(ek, item, key, label); if (e.key === "Escape") handleInlineCancel(ek); }}
                                    style={{ ...inputSt, flex: 2, minWidth: 140 }}
                                    autoFocus
                                  />
                                  <select
                                    value={edit.category}
                                    onChange={e => handleInlineUpdate(ek, "category", e.target.value)}
                                    style={{ ...inputSt, flex: 1, minWidth: 110 }}
                                  >
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                  <button
                                    onClick={() => handleInlineConfirm(ek, item, key, label)}
                                    style={{ flexShrink: 0, padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(134,239,172,0.4)", background: "rgba(134,239,172,0.1)", color: "#86efac", cursor: "pointer", fontSize: "13px" }}
                                  >✓</button>
                                  <button
                                    onClick={() => handleInlineCancel(ek)}
                                    style={{ flexShrink: 0, padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#f87171", cursor: "pointer", fontSize: "13px" }}
                                  >✕</button>
                                </div>
                                <div style={{ fontSize: "10px", color: "#6b7280", fontFamily: "monospace", marginTop: 4, paddingLeft: 2 }}>
                                  {formatPrice(item)} · Flipp: {item.name}
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={item.id ?? i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 4px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              <span style={{ flex: 1, fontSize: "12px", color: "#94a3b8", fontFamily: "monospace" }}>{item.name}</span>
                              <span style={{ fontSize: "12px", color: "#fbbf24", fontFamily: "monospace", flexShrink: 0 }}>{formatPrice(item)}</span>
                              <button
                                onClick={() => handleInlineOpen(item, key)}
                                style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.04)", color: "#6b7280" }}
                              >+</button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Items à créer */}
          <ToCreateSection
            toCreate={toCreate}
            onUpdate={handleUpdateCreate}
            onRemove={handleRemoveCreate}
          />

          {/* Footer */}
          {totalActions > 0 && (
            <div style={{ padding: "12px 16px", display: "flex", gap: 8, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <button onClick={onClose} style={inBtn(false, true)}>Annuler</button>
              <button onClick={handleConfirm} style={{ ...inBtn(true), flex: 2 }}>
                ✓ Appliquer
                {selectedCount > 0 && ` ${selectedCount} promo${selectedCount > 1 ? "s" : ""}`}
                {selectedCount > 0 && toCreate.length > 0 && " +"}
                {toCreate.length > 0 && ` ${toCreate.length} nouveau${toCreate.length > 1 ? "x" : ""}`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
