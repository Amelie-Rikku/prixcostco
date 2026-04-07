import { useState, useEffect, useRef } from "react";
import FlippPanel from "./FlippPanel";

const CATEGORIES = ["Tous", "Viandes", "Produits laitiers", "Épicerie sèche", "Fruits & légumes", "Surgelés", "Hygiène/Maison", "Autre"];
const UNITS = ["100g", "100ml", "unité", "kg", "litre", "portion", "g", "ml", "lb"];
const GIST_FILENAME = "prixQC.json";
const MEMORY_FILENAME = "prixQC-memory.json";

const SAMPLE_DATA = [
  { id: 1, name: "Parmesan râpé", category: "Produits laitiers", costco: { regular: 14.99, promo: null, qty: 1000, unit: "100g" }, maxi: { regular: 5.49, promo: null, qty: 200, unit: "100g" }, superc: { regular: 5.29, promo: 3.99, qty: 200, unit: "100g" } },
  { id: 2, name: "Huile d'olive extra vierge", category: "Épicerie sèche", costco: { regular: 16.99, promo: null, qty: 2000, unit: "100ml" }, maxi: { regular: 8.99, promo: null, qty: 500, unit: "100ml" }, superc: { regular: 8.49, promo: 6.99, qty: 500, unit: "100ml" } },
  { id: 3, name: "Amandes nature", category: "Épicerie sèche", costco: { regular: 18.99, promo: null, qty: 1360, unit: "100g" }, maxi: { regular: 7.99, promo: null, qty: 200, unit: "100g" }, superc: { regular: 7.49, promo: null, qty: 200, unit: "100g" } },
  { id: 4, name: "Saumon Atlantique", category: "Viandes", costco: { regular: 9.99, promo: null, qty: 100, unit: "100g" }, maxi: { regular: 3.99, promo: null, qty: 100, unit: "100g" }, superc: { regular: 3.79, promo: 2.99, qty: 100, unit: "100g" } },
];

// ── Gist API helpers ──────────────────────────────────────────────────────────

async function gistLoad(token, gistId) {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`Gist load failed: ${res.status}`);
  const data = await res.json();
  const content = data.files?.[GIST_FILENAME]?.content;
  if (!content) throw new Error("Fichier prixQC.json introuvable dans le Gist");
  return JSON.parse(content);
}

async function gistCreate(token, products) {
  const res = await fetch("https://api.github.com/gists", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/vnd.github+json" },
    body: JSON.stringify({
      description: "prixQC — données comparateur de prix",
      public: false,
      files: { [GIST_FILENAME]: { content: JSON.stringify(products, null, 2) } },
    }),
  });
  if (!res.ok) throw new Error(`Gist create failed: ${res.status}`);
  const data = await res.json();
  return data.id;
}

async function gistSave(token, gistId, products) {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/vnd.github+json" },
    body: JSON.stringify({
      files: { [GIST_FILENAME]: { content: JSON.stringify(products, null, 2) } },
    }),
  });
  if (!res.ok) throw new Error(`Gist save failed: ${res.status}`);
}

async function memoryLoad(token, gistId) {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) return {};
  const data = await res.json();
  const content = data.files?.[MEMORY_FILENAME]?.content;
  return content ? JSON.parse(content) : {};
}

async function memorySave(token, gistId, memory) {
  await fetch(`https://api.github.com/gists/${gistId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/vnd.github+json" },
    body: JSON.stringify({
      files: { [MEMORY_FILENAME]: { content: JSON.stringify(memory, null, 2) } },
    }),
  });
}

// ── Utility ───────────────────────────────────────────────────────────────────

function normalizeUnitPrice(price, qty, unit) {
  const p = Number(price);
  if (!p || !qty) return { perPrice: null, perLabel: null };
  const raw = p / qty;
  if (unit === "litre") return { perPrice: raw / 1000, perLabel: "ml" };
  if (unit === "kg") return { perPrice: raw / 1000, perLabel: "g" };
  if (unit === "100g") return { perPrice: raw / 100, perLabel: "g" };
  if (unit === "100ml") return { perPrice: raw / 100, perLabel: "ml" };
  if (unit === "lb") return { perPrice: raw / 453.592, perLabel: "g" };
  if (unit === "g") return { perPrice: raw, perLabel: "g" };
  if (unit === "ml") return { perPrice: raw, perLabel: "ml" };
  return { perPrice: raw, perLabel: "unité" };
}

function calcUnitPrice(price, qty, unit) {
  return normalizeUnitPrice(price, qty, unit).perPrice;
}

function getBestDeal(item) {
  const prices = [
    { store: "Costco", unit: calcUnitPrice(item.costco?.promo || item.costco?.regular, item.costco?.qty, item.costco?.unit) },
    { store: "Maxi", unit: calcUnitPrice(item.maxi?.promo || item.maxi?.regular, item.maxi?.qty, item.maxi?.unit) },
    { store: "Super C", unit: calcUnitPrice(item.superc?.promo || item.superc?.regular, item.superc?.qty, item.superc?.unit) },
  ].filter(p => p.unit !== null);
  if (!prices.length) return null;
  return prices.reduce((a, b) => a.unit < b.unit ? a : b).store;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PriceTag({ label, price, qty, unit, isPromo, isBest, desc }) {
  const numPrice = price != null ? Number(price) : null;
  const { perPrice, perLabel } = normalizeUnitPrice(numPrice, qty, unit);
  return (
    <div style={{
      background: isBest ? "rgba(134,239,172,0.15)" : "rgba(255,255,255,0.04)",
      border: `1px solid ${isBest ? "rgba(134,239,172,0.5)" : "rgba(255,255,255,0.08)"}`,
      borderRadius: "10px", padding: "10px 12px", minWidth: "90px", flex: 1, position: "relative",
    }}>
      {isBest && (
        <span style={{ position: "absolute", top: -8, right: 8, background: "#86efac", color: "#052e16", fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: "99px", letterSpacing: "0.05em", fontFamily: "monospace" }}>
          MEILLEUR
        </span>
      )}
      <div style={{ fontSize: "10px", color: "#9ca3af", marginBottom: 4, fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em" }}>{label}</div>
      {numPrice ? (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
            <span style={{ fontSize: "18px", fontWeight: 700, color: isPromo ? "#fbbf24" : "#f1f5f9", fontFamily: "'Syne', sans-serif" }}>${numPrice.toFixed(2)}</span>
            {isPromo && <span style={{ fontSize: "9px", color: "#fbbf24", fontFamily: "monospace" }}>PROMO</span>}
          </div>
          {desc && (
            <div style={{ fontSize: "9px", color: "#94a3b8", fontFamily: "monospace", marginTop: 2, lineHeight: "1.3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={desc}>
              {desc}
            </div>
          )}
          <div style={{ fontSize: "10px", color: "#6b7280", marginTop: 2 }}>
            {qty}{unit} · <span style={{ color: isBest ? "#86efac" : "#94a3b8" }}>${perPrice?.toFixed(4)}/{perLabel}</span>
          </div>
        </>
      ) : (
        <div style={{ fontSize: "13px", color: "#4b5563", fontFamily: "monospace" }}>? <span style={{ fontSize: "10px" }}>inconnu</span></div>
      )}
    </div>
  );
}

function ProductCard({ item, onEdit, onDelete }) {
  const best = getBestDeal(item);
  return (
    <div
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "16px", marginBottom: "12px", transition: "border-color 0.2s" }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 700, color: "#f1f5f9" }}>{item.name}</div>
          <div style={{ fontSize: "11px", color: "#6b7280", fontFamily: "monospace", marginTop: 2 }}>{item.category}</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => onEdit(item)} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: "7px", padding: "5px 10px", color: "#94a3b8", cursor: "pointer", fontSize: "12px" }}>✏️</button>
          <button onClick={() => onDelete(item.id)} style={{ background: "rgba(239,68,68,0.1)", border: "none", borderRadius: "7px", padding: "5px 10px", color: "#f87171", cursor: "pointer", fontSize: "12px" }}>✕</button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <PriceTag label="COSTCO" price={item.costco?.promo || item.costco?.regular} qty={item.costco?.qty} unit={item.costco?.unit || "100g"} isPromo={!!item.costco?.promo} isBest={best === "Costco"} />
        <PriceTag label="MAXI" price={item.maxi?.promo || item.maxi?.regular} qty={item.maxi?.qty} unit={item.maxi?.unit || "100g"} isPromo={!!item.maxi?.promo} isBest={best === "Maxi"} />
        <PriceTag label="SUPER C" price={item.superc?.promo || item.superc?.regular} qty={item.superc?.qty} unit={item.superc?.unit || "100g"} isPromo={!!item.superc?.promo} isBest={best === "Super C"} />
      </div>
    </div>
  );
}

const inputStyle = {
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px", padding: "8px 10px", color: "#f1f5f9", fontSize: "13px",
  fontFamily: "'DM Mono', monospace", width: "100px", outline: "none",
};

function InputRow({ label, storeKey, form, setForm }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: "11px", color: "#9ca3af", fontFamily: "monospace", marginBottom: 6, letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input type="number" placeholder="Prix ($)" step="0.01"
          value={form[storeKey]?.price || ""}
          onChange={e => setForm(f => ({ ...f, [storeKey]: { ...f[storeKey], price: e.target.value } }))}
          style={inputStyle}
        />
        <input type="number" placeholder="Promo ($)" step="0.01"
          value={form[storeKey]?.promo || ""}
          onChange={e => setForm(f => ({ ...f, [storeKey]: { ...f[storeKey], promo: e.target.value } }))}
          style={{ ...inputStyle, borderColor: "rgba(251,191,36,0.3)" }}
        />
        <input type="number" placeholder="Qté"
          value={form[storeKey]?.qty || ""}
          onChange={e => setForm(f => ({ ...f, [storeKey]: { ...f[storeKey], qty: e.target.value } }))}
          style={{ ...inputStyle, width: "70px" }}
        />
        <select value={form[storeKey]?.unit || "100g"}
          onChange={e => setForm(f => ({ ...f, [storeKey]: { ...f[storeKey], unit: e.target.value } }))}
          style={{ ...inputStyle, width: "80px" }}
        >
          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
    </div>
  );
}

const emptyForm = {
  name: "", category: "Épicerie sèche",
  costco: { price: "", promo: "", qty: "", unit: "100g" },
  maxi: { price: "", promo: "", qty: "", unit: "100g" },
  superc: { price: "", promo: "", qty: "", unit: "100g" },
};

// ── Settings panel ────────────────────────────────────────────────────────────

function SettingsPanel({ onClose, onSaved }) {
  const [token, setToken] = useState(() => localStorage.getItem("gistToken") || "");
  const [gistId, setGistId] = useState(() => localStorage.getItem("gistId") || "");

  const handleSave = () => {
    localStorage.setItem("gistToken", token.trim());
    localStorage.setItem("gistId", gistId.trim());
    onSaved(token.trim(), gistId.trim());
    onClose();
  };

  const handleClear = () => {
    localStorage.removeItem("gistToken");
    localStorage.removeItem("gistId");
    setToken("");
    setGistId("");
    onSaved("", "");
  };

  return (
    <div style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(99,102,241,0.04)" }}>
      <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: 14, color: "#a5b4fc", fontFamily: "monospace", display: "flex", justifyContent: "space-between" }}>
        <span>⚙️ SYNC GITHUB GIST</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "14px" }}>✕</button>
      </div>

      <div style={{ fontSize: "11px", color: "#6b7280", fontFamily: "monospace", marginBottom: 12, lineHeight: 1.6 }}>
        Crée un token sur <span style={{ color: "#a5b4fc" }}>github.com → Settings → Developer settings → Personal access tokens</span> avec la permission <code style={{ color: "#86efac" }}>gist</code>.
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: "10px", color: "#9ca3af", fontFamily: "monospace", marginBottom: 4, letterSpacing: "0.08em" }}>GITHUB TOKEN (gist scope)</div>
        <input
          type="password"
          placeholder="ghp_xxxxxxxxxxxx"
          value={token}
          onChange={e => setToken(e.target.value)}
          style={{ ...inputStyle, width: "100%", fontSize: "12px" }}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: "10px", color: "#9ca3af", fontFamily: "monospace", marginBottom: 4, letterSpacing: "0.08em" }}>GIST ID (laisser vide pour en créer un nouveau)</div>
        <input
          type="text"
          placeholder="abc123def456..."
          value={gistId}
          onChange={e => setGistId(e.target.value)}
          style={{ ...inputStyle, width: "100%", fontSize: "12px" }}
        />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleSave} style={{ flex: 1, background: "rgba(99,102,241,0.25)", border: "1px solid rgba(99,102,241,0.5)", borderRadius: "8px", padding: "9px", color: "#a5b4fc", cursor: "pointer", fontSize: "12px", fontFamily: "monospace", fontWeight: 700 }}>
          ✓ Enregistrer
        </button>
        <button onClick={handleClear} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", padding: "9px 14px", color: "#f87171", cursor: "pointer", fontSize: "12px", fontFamily: "monospace" }}>
          Effacer
        </button>
      </div>
    </div>
  );
}

// ── SyncStatus badge ──────────────────────────────────────────────────────────

const SYNC_STYLES = {
  idle:    { color: "#4b5563", label: "" },
  syncing: { color: "#fbbf24", label: "⟳ sync..." },
  saved:   { color: "#86efac", label: "✓ Gist" },
  error:   { color: "#f87171", label: "✗ erreur" },
  notoken: { color: "#4b5563", label: "☁ non connecté" },
};

function SyncBadge({ status }) {
  const s = SYNC_STYLES[status] || SYNC_STYLES.idle;
  if (!s.label) return null;
  return (
    <span style={{ fontSize: "10px", fontFamily: "monospace", color: s.color, transition: "color 0.3s" }}>{s.label}</span>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [products, setProducts] = useState(() => {
    try { const s = localStorage.getItem("prixQC"); return s ? JSON.parse(s) : SAMPLE_DATA; }
    catch { return SAMPLE_DATA; }
  });

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Tous");
  const [showForm, setShowForm] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFlipp, setShowFlipp] = useState(false);
  const [matchMemory, setMatchMemory] = useState(() => {
    try { const s = localStorage.getItem("prixQC-memory"); return s ? JSON.parse(s) : {}; }
    catch { return {}; }
  });
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);

  const [gistToken, setGistToken] = useState(() => localStorage.getItem("gistToken") || "");
  const [gistId, setGistId] = useState(() => localStorage.getItem("gistId") || "");
  const [syncStatus, setSyncStatus] = useState(gistToken ? "notoken" : "notoken");

  const saveTimer = useRef(null);
  const isFirstLoad = useRef(true);

  // Load from Gist on mount if credentials exist
  useEffect(() => {
    if (!gistToken || !gistId) { setSyncStatus("notoken"); return; }
    setSyncStatus("syncing");
    gistLoad(gistToken, gistId)
      .then(data => { setProducts(data); setSyncStatus("saved"); })
      .catch(() => setSyncStatus("error"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist to localStorage on every change
  useEffect(() => {
    try { localStorage.setItem("prixQC", JSON.stringify(products)); } catch {}
  }, [products]);

  // Auto-save to Gist (debounced 1.5s) whenever products change
  useEffect(() => {
    if (isFirstLoad.current) { isFirstLoad.current = false; return; }
    if (!gistToken) { setSyncStatus("notoken"); return; }

    clearTimeout(saveTimer.current);
    setSyncStatus("syncing");

    saveTimer.current = setTimeout(async () => {
      try {
        if (!gistId) {
          const newId = await gistCreate(gistToken, products);
          setGistId(newId);
          localStorage.setItem("gistId", newId);
        } else {
          await gistSave(gistToken, gistId, products);
        }
        setSyncStatus("saved");
      } catch {
        setSyncStatus("error");
      }
    }, 1500);

    return () => clearTimeout(saveTimer.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  const handleSettingsSaved = (newToken, newGistId) => {
    setGistToken(newToken);
    setGistId(newGistId);
    if (!newToken) { setSyncStatus("notoken"); return; }
    // If gistId given, pull data from it
    if (newGistId) {
      setSyncStatus("syncing");
      gistLoad(newToken, newGistId)
        .then(data => { setProducts(data); setSyncStatus("saved"); })
        .catch(() => setSyncStatus("error"));
    } else {
      setSyncStatus("notoken");
    }
  };

  const filtered = products.filter(p =>
    (category === "Tous" || p.category === category) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = () => {
    if (!form.name.trim()) return;
    const toNum = v => v ? parseFloat(v) : null;
    const product = {
      id: editId || Date.now(),
      name: form.name,
      category: form.category,
      costco: { regular: toNum(form.costco.price), promo: toNum(form.costco.promo), qty: toNum(form.costco.qty), unit: form.costco.unit },
      maxi: { regular: toNum(form.maxi.price), promo: toNum(form.maxi.promo), qty: toNum(form.maxi.qty), unit: form.maxi.unit },
      superc: { regular: toNum(form.superc.price), promo: toNum(form.superc.promo), qty: toNum(form.superc.qty), unit: form.superc.unit },
    };
    setProducts(prev => editId ? prev.map(p => p.id === editId ? product : p) : [...prev, product]);
    setForm(emptyForm);
    setShowForm(false);
    setEditId(null);
  };

  const handleEdit = (item) => {
    setForm({
      name: item.name, category: item.category,
      costco: { price: item.costco?.regular || "", promo: item.costco?.promo || "", qty: item.costco?.qty || "", unit: item.costco?.unit || "100g" },
      maxi: { price: item.maxi?.regular || "", promo: item.maxi?.promo || "", qty: item.maxi?.qty || "", unit: item.maxi?.unit || "100g" },
      superc: { price: item.superc?.regular || "", promo: item.superc?.promo || "", qty: item.superc?.qty || "", unit: item.superc?.unit || "100g" },
    });
    setEditId(item.id);
    setShowForm(true);
  };

  const handleDelete = (id) => setProducts(prev => prev.filter(p => p.id !== id));

  const handleFlippConfirm = async (updatedProducts, newMemory) => {
    setProducts(updatedProducts);
    setMatchMemory(newMemory);
    setShowFlipp(false);
    // Persist memory
    try { localStorage.setItem("prixQC-memory", JSON.stringify(newMemory)); } catch {}
    if (gistToken && gistId) {
      try { await memorySave(gistToken, gistId, newMemory); } catch {}
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#080c14", color: "#f1f5f9", fontFamily: "'Syne', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        input::placeholder { color: #4b5563; }
        input:focus, select:focus { border-color: rgba(99,102,241,0.5) !important; }
        select option { background: #1e293b; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "24px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.03em", color: "#f1f5f9" }}>
              Prix <span style={{ color: "#818cf8" }}>Costco</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 1 }}>
              <div style={{ fontSize: "11px", color: "#4b5563", fontFamily: "monospace" }}>Costco · Maxi · Super C</div>
              <SyncBadge status={syncStatus} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => { setShowSettings(v => !v); setShowForm(false); setShowExport(false); setShowFlipp(false); }}
              title="Paramètres Gist"
              style={{ background: showSettings ? "rgba(99,102,241,0.2)" : (gistToken ? "rgba(134,239,172,0.1)" : "rgba(255,255,255,0.05)"), border: `1px solid ${showSettings ? "rgba(99,102,241,0.4)" : (gistToken ? "rgba(134,239,172,0.3)" : "rgba(255,255,255,0.08)")}`, borderRadius: "10px", padding: "8px 11px", color: gistToken ? "#86efac" : "#6b7280", cursor: "pointer", fontSize: "14px" }}
            >
              ☁
            </button>
            <button
              onClick={() => { setShowFlipp(v => !v); setShowForm(false); setShowExport(false); setShowSettings(false); }}
              title="Synchroniser les promos Flipp"
              style={{ background: showFlipp ? "rgba(251,191,36,0.2)" : "rgba(255,255,255,0.05)", border: `1px solid ${showFlipp ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.08)"}`, borderRadius: "10px", padding: "8px 11px", color: showFlipp ? "#fbbf24" : "#6b7280", cursor: "pointer", fontSize: "14px" }}
            >
              🏷️
            </button>
            <button
              onClick={() => { setShowForm(!showForm); setEditId(null); setForm(emptyForm); setShowSettings(false); }}
              style={{ background: showForm ? "rgba(239,68,68,0.15)" : "rgba(99,102,241,0.2)", border: `1px solid ${showForm ? "rgba(239,68,68,0.3)" : "rgba(99,102,241,0.4)"}`, borderRadius: "10px", padding: "10px 16px", color: showForm ? "#f87171" : "#a5b4fc", cursor: "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "'Syne', sans-serif" }}
            >
              {showForm ? "✕ Annuler" : "+ Ajouter"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowExport(v => !v)}
            style={{ flex: 1, background: showExport ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "8px", color: showExport ? "#a5b4fc" : "#94a3b8", cursor: "pointer", fontSize: "12px", fontFamily: "monospace" }}
          >
            ⬇️ Exporter JSON
          </button>
          <label style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "8px", color: "#94a3b8", cursor: "pointer", fontSize: "12px", fontFamily: "monospace", textAlign: "center" }}>
            ⬆️ Importer JSON
            <input type="file" accept=".json" style={{ display: "none" }} onChange={e => {
              const file = e.target.files[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = ev => {
                try {
                  const parsed = JSON.parse(ev.target.result);
                  // Compatibilité ancien format : costco.price → costco.regular
                  const normalized = parsed.map(p => ({
                    ...p,
                    costco: p.costco ? {
                      regular: p.costco.regular ?? p.costco.price ?? null,
                      promo: p.costco.promo ?? null,
                      qty: p.costco.qty ?? null,
                      unit: p.costco.unit ?? "100g",
                    } : { regular: null, promo: null, qty: null, unit: "100g" },
                  }));
                  setProducts(normalized);
                } catch { alert("Fichier JSON invalide"); }
              };
              reader.readAsText(file);
              e.target.value = "";
            }} />
          </label>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          onSaved={handleSettingsSaved}
        />
      )}

      {/* Flipp Panel */}
      {showFlipp && (
        <FlippPanel
          products={products}
          memory={matchMemory}
          onConfirm={handleFlippConfirm}
          onClose={() => setShowFlipp(false)}
        />
      )}

      {/* Export panel */}
      {showExport && (
        <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(99,102,241,0.04)" }}>
          <div style={{ fontSize: "11px", color: "#9ca3af", fontFamily: "monospace", marginBottom: 8 }}>COPIE CE TEXTE ET SAUVEGARDE-LE :</div>
          <textarea
            readOnly
            value={JSON.stringify(products, null, 2)}
            style={{ width: "100%", height: "140px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "10px", color: "#86efac", fontSize: "11px", fontFamily: "monospace", resize: "none", outline: "none" }}
            onClick={e => e.target.select()}
          />
          <button
            onClick={() => navigator.clipboard.writeText(JSON.stringify(products, null, 2)).then(() => alert("Copié ! ✓"))}
            style={{ width: "100%", marginTop: 8, background: "rgba(134,239,172,0.15)", border: "1px solid rgba(134,239,172,0.3)", borderRadius: "8px", padding: "9px", color: "#86efac", cursor: "pointer", fontSize: "12px", fontFamily: "monospace" }}
          >
            📋 Copier dans le presse-papier
          </button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(99,102,241,0.04)" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: 12, color: "#a5b4fc", fontFamily: "monospace" }}>
            {editId ? "MODIFIER LE PRODUIT" : "NOUVEAU PRODUIT"}
          </div>
          <input
            placeholder="Nom du produit"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            style={{ ...inputStyle, width: "100%", marginBottom: 10, fontSize: "15px" }}
          />
          <select
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            style={{ ...inputStyle, width: "100%", marginBottom: 14 }}
          >
            {CATEGORIES.filter(c => c !== "Tous").map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <InputRow label="COSTCO — Prix régulier · Promo · Quantité · Unité" storeKey="costco" form={form} setForm={setForm} />
          <InputRow label="MAXI — Prix régulier · Promo · Quantité · Unité" storeKey="maxi" form={form} setForm={setForm} />
          <InputRow label="SUPER C — Prix régulier · Promo · Quantité · Unité" storeKey="superc" form={form} setForm={setForm} />
          <button
            onClick={handleSave}
            style={{ width: "100%", background: "rgba(99,102,241,0.25)", border: "1px solid rgba(99,102,241,0.5)", borderRadius: "10px", padding: "12px", color: "#a5b4fc", cursor: "pointer", fontSize: "14px", fontWeight: 700, fontFamily: "'Syne', sans-serif", marginTop: 4 }}
          >
            {editId ? "💾 Sauvegarder les modifications" : "✓ Ajouter le produit"}
          </button>
        </div>
      )}

      {/* Search & Filter */}
      <div style={{ padding: "14px 16px 8px" }}>
        <input
          placeholder="🔍  Rechercher un produit..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, width: "100%", marginBottom: 10, fontSize: "14px", padding: "10px 14px" }}
        />
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)} style={{
              background: category === c ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${category === c ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: "99px", padding: "5px 12px",
              color: category === c ? "#a5b4fc" : "#6b7280",
              cursor: "pointer", fontSize: "11px", whiteSpace: "nowrap",
              fontFamily: "monospace", fontWeight: category === c ? 700 : 400,
            }}>{c}</button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ padding: "6px 16px 12px", display: "flex", gap: 16 }}>
        {["Costco", "Maxi", "Super C"].map(store => {
          const wins = filtered.filter(p => getBestDeal(p) === store).length;
          return (
            <div key={store} style={{ fontSize: "11px", fontFamily: "monospace", color: "#4b5563" }}>
              <span style={{ color: wins > 0 ? "#86efac" : "#374151", fontWeight: 700 }}>{wins}</span>
              <span> meilleur{wins > 1 ? "s" : ""} · {store}</span>
            </div>
          );
        })}
      </div>

      {/* Products list */}
      <div style={{ padding: "0 16px 100px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#374151", fontFamily: "monospace", fontSize: "13px" }}>
            Aucun produit trouvé.<br /><span style={{ fontSize: "11px" }}>Ajoute ton premier produit ↑</span>
          </div>
        ) : (
          filtered.map(item => <ProductCard key={item.id} item={item} onEdit={handleEdit} onDelete={handleDelete} />)
        )}
      </div>
    </div>
  );
}
