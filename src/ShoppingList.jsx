import { useState, useMemo } from "react";

const STORES = ["costco", "maxi", "superc"];
const STORE_LABELS = { costco: "Costco", maxi: "Maxi", superc: "Super C" };
const STORE_COLORS = { costco: "#818cf8", maxi: "#fb923c", superc: "#34d399" };

function getPrice(storeData) {
  if (!storeData) return null;
  const p = storeData.promo ?? storeData.regular ?? null;
  return p != null ? Number(p) : null;
}

function getBestStore(product) {
  let best = null, bestPrice = Infinity;
  for (const s of STORES) {
    const p = getPrice(product[s]);
    if (p != null && p < bestPrice) { best = s; bestPrice = p; }
  }
  return best;
}

function calcStoreTotals(activeItems, products) {
  return STORES.map(store => {
    let total = 0;
    let complete = true;
    for (const item of activeItems) {
      const product = products.find(p => p.id === item.productId);
      if (!product) continue;
      const price = getPrice(product[store]);
      if (price == null) { complete = false; continue; }
      total += price * item.qty;
    }
    return { store, total, complete };
  });
}

// ── ListItem ──────────────────────────────────────────────────────────────────

function ListItem({ item, product, onToggle, onRemove, onQty }) {
  const bestStore = item.checked ? null : getBestStore(product);
  const bestPrice = bestStore ? getPrice(product[bestStore]) : null;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
      opacity: item.checked ? 0.4 : 1,
    }}>
      <input
        type="checkbox" checked={item.checked} onChange={onToggle}
        style={{ cursor: "pointer", accentColor: "#86efac", width: 16, height: 16, flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: "13px", color: "#e2e8f0", fontFamily: "'DM Mono', monospace",
          textDecoration: item.checked ? "line-through" : "none",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {product.name}
        </div>
        {bestStore && (
          <div style={{ fontSize: "10px", color: STORE_COLORS[bestStore], fontFamily: "monospace" }}>
            {STORE_LABELS[bestStore]} · ${(bestPrice * item.qty).toFixed(2)}
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button onClick={() => onQty(item.qty - 1)}
          style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: "5px", width: 24, height: 24, color: "#94a3b8", cursor: "pointer", fontSize: "16px", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          −
        </button>
        <span style={{ fontSize: "12px", color: "#94a3b8", fontFamily: "monospace", minWidth: 18, textAlign: "center" }}>
          {item.qty}
        </span>
        <button onClick={() => onQty(item.qty + 1)}
          style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: "5px", width: 24, height: 24, color: "#94a3b8", cursor: "pointer", fontSize: "16px", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          +
        </button>
      </div>
      <button onClick={onRemove}
        style={{ background: "none", border: "none", color: "#374151", cursor: "pointer", fontSize: "14px", padding: "0 2px", flexShrink: 0 }}>
        ✕
      </button>
    </div>
  );
}

// ── ShoppingList ──────────────────────────────────────────────────────────────

export default function ShoppingList({ products, list, onChange, onClose }) {
  const [search, setSearch] = useState("");

  const activeItems  = list.filter(i => !i.checked);
  const checkedItems = list.filter(i => i.checked);

  const suggestions = products.filter(p =>
    !list.find(i => i.productId === p.id) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const totals = useMemo(() => calcStoreTotals(activeItems, products), [activeItems, products]);
  const bestTotal = totals
    .filter(t => t.complete && activeItems.length > 0)
    .reduce((best, t) => (!best || t.total < best.total ? t : best), null);

  const addItem = (product) => {
    onChange([...list, { id: Date.now(), productId: product.id, qty: 1, checked: false }]);
    setSearch("");
  };
  const removeItem   = (id) => onChange(list.filter(i => i.id !== id));
  const toggleItem   = (id) => onChange(list.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  const updateQty    = (id, qty) => onChange(list.map(i => i.id === id ? { ...i, qty: Math.max(1, qty) } : i));
  const clearChecked = () => onChange(list.filter(i => !i.checked));
  const clearAll     = () => onChange([]);

  return (
    <div style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(10,18,32,0.95)" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "14px", color: "#a5b4fc", letterSpacing: "0.04em" }}>
          LISTE D'ÉPICERIE
          {activeItems.length > 0 && (
            <span style={{ fontSize: "11px", color: "#6b7280", fontWeight: 400, marginLeft: 8, fontFamily: "monospace" }}>
              {activeItems.length} article{activeItems.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {checkedItems.length > 0 && (
            <button onClick={clearChecked}
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "7px", padding: "4px 10px", color: "#f87171", cursor: "pointer", fontSize: "11px", fontFamily: "monospace" }}>
              Effacer cochés ({checkedItems.length})
            </button>
          )}
          {list.length > 0 && (
            <button onClick={clearAll}
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "7px", padding: "4px 10px", color: "#6b7280", cursor: "pointer", fontSize: "11px", fontFamily: "monospace" }}>
              Vider
            </button>
          )}
          <button onClick={onClose}
            style={{ background: "rgba(255,255,255,0.05)", border: "none", borderRadius: "7px", padding: "5px 10px", color: "#6b7280", cursor: "pointer", fontSize: "12px" }}>
            ✕
          </button>
        </div>
      </div>

      {/* Search / Add */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <input
          placeholder="+ Ajouter un produit..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: "100%", background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(99,102,241,0.3)", borderRadius: "8px",
            padding: "9px 12px", color: "#f1f5f9", fontSize: "13px",
            fontFamily: "'DM Mono', monospace", outline: "none", boxSizing: "border-box",
          }}
        />
        {search && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
            background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px", zIndex: 20, maxHeight: "200px", overflowY: "auto",
          }}>
            {suggestions.length === 0 ? (
              <div style={{ padding: "10px 12px", fontSize: "12px", color: "#4b5563", fontFamily: "monospace" }}>
                Aucun produit trouvé
              </div>
            ) : suggestions.slice(0, 8).map(p => (
              <div key={p.id} onClick={() => addItem(p)}
                style={{ padding: "9px 12px", cursor: "pointer", fontSize: "13px", color: "#e2e8f0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontFamily: "monospace" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(99,102,241,0.15)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                {p.name}
                <span style={{ fontSize: "10px", color: "#6b7280", marginLeft: 8 }}>{p.category}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Items */}
      {list.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px 0", color: "#374151", fontFamily: "monospace", fontSize: "12px" }}>
          Aucun article — recherche un produit ci-dessus
        </div>
      ) : (
        <div>
          {activeItems.map(item => {
            const product = products.find(p => p.id === item.productId);
            if (!product) return null;
            return (
              <ListItem key={item.id} item={item} product={product}
                onToggle={() => toggleItem(item.id)}
                onRemove={() => removeItem(item.id)}
                onQty={qty => updateQty(item.id, qty)}
              />
            );
          })}

          {checkedItems.length > 0 && (
            <>
              <div style={{ fontSize: "10px", color: "#374151", fontFamily: "monospace", marginTop: 10, marginBottom: 4, letterSpacing: "0.08em" }}>
                COCHÉS
              </div>
              {checkedItems.map(item => {
                const product = products.find(p => p.id === item.productId);
                if (!product) return null;
                return (
                  <ListItem key={item.id} item={item} product={product}
                    onToggle={() => toggleItem(item.id)}
                    onRemove={() => removeItem(item.id)}
                    onQty={qty => updateQty(item.id, qty)}
                  />
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Store totals */}
      {activeItems.length > 0 && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14, marginTop: 12 }}>
          <div style={{ fontSize: "10px", color: "#6b7280", fontFamily: "monospace", marginBottom: 8, letterSpacing: "0.08em" }}>
            TOTAL PAR MAGASIN
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {totals.map(({ store, total, complete }) => {
              const isBest = bestTotal?.store === store;
              return (
                <div key={store} style={{
                  flex: 1, background: isBest ? "rgba(134,239,172,0.1)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${isBest ? "rgba(134,239,172,0.4)" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: "10px", padding: "10px 8px", textAlign: "center", position: "relative",
                }}>
                  {isBest && (
                    <span style={{
                      position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)",
                      background: "#86efac", color: "#052e16", fontSize: "8px", fontWeight: 700,
                      padding: "2px 6px", borderRadius: "99px", whiteSpace: "nowrap",
                    }}>MEILLEUR</span>
                  )}
                  <div style={{ fontSize: "9px", color: "#6b7280", fontFamily: "monospace", marginBottom: 4 }}>
                    {STORE_LABELS[store].toUpperCase()}
                  </div>
                  <div style={{ fontSize: "17px", fontWeight: 700, color: isBest ? "#86efac" : "#f1f5f9", fontFamily: "'Syne', sans-serif" }}>
                    {complete ? `$${total.toFixed(2)}` : "—"}
                  </div>
                  {!complete && (
                    <div style={{ fontSize: "9px", color: "#4b5563", fontFamily: "monospace" }}>incomplet</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
