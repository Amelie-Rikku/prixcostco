import { supabase } from "./supabaseClient";

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.href.split("#")[0] },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export function onSignOut(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") callback();
  });
  return () => subscription.unsubscribe();
}

// ── Products ──────────────────────────────────────────────────────────────────

// Convertit une ligne store_prices en l'objet { regular, promo, qty, unit, desc }
// attendu par les composants UI (App.jsx, FlippPanel.jsx, ShoppingList.jsx).
function storeRowToObj(sp) {
  if (!sp) return null;
  return {
    regular: sp.regular_price,
    promo: sp.is_promo ? sp.promo_price : null,
    qty: sp.format_qty,
    unit: sp.format_unit,
    desc: sp.description,
  };
}

export async function loadProducts(userId) {
  const { data, error } = await supabase
    .from("products")
    .select(`
      id, name, category, per_unit,
      store_prices (store_id, regular_price, is_promo, promo_price, format_qty, format_unit, description)
    `)
    .eq("user_id", userId)
    .order("id", { ascending: true });

  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    perUnit: row.per_unit,
    costco: storeRowToObj(row.store_prices?.find((p) => p.store_id === "costco")),
    maxi:   storeRowToObj(row.store_prices?.find((p) => p.store_id === "maxi")),
    superc: storeRowToObj(row.store_prices?.find((p) => p.store_id === "superc")),
  }));
}

export async function saveProducts(userId, products) {
  const currentIds = products.map((p) => Math.round(p.id));

  // Supprimer les produits qui ne sont plus dans la liste (cascade → store_prices, flipp_memory)
  if (currentIds.length > 0) {
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("user_id", userId)
      .not("id", "in", `(${currentIds.join(",")})`);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("user_id", userId);
    if (error) throw error;
    return;
  }

  // Upsert des produits (crée les nouveaux, met à jour les existants)
  const productRows = products.map((p) => ({
    id: Math.round(p.id),
    user_id: userId,
    name: p.name,
    category: p.category || "Épicerie sèche",
    per_unit: p.perUnit || "g",
  }));

  const { error: upsertError } = await supabase
    .from("products")
    .upsert(productRows, { onConflict: "id" });
  if (upsertError) throw upsertError;

  // Construire les lignes store_prices
  const STORE_KEYS = ["costco", "maxi", "superc"];
  const priceRows = [];

  for (const p of products) {
    for (const storeId of STORE_KEYS) {
      const store = p[storeId];
      if (!store || (store.regular == null && store.promo == null)) continue;
      priceRows.push({
        product_id: Math.round(p.id),
        store_id: storeId,
        user_id: userId,
        regular_price: store.regular ?? null,
        is_promo: store.promo != null,
        promo_price: store.promo ?? null,
        format_qty: store.qty ?? null,
        format_unit: store.unit ?? null,
        description: store.desc ?? null,
        source: "manual",
        updated_at: new Date().toISOString(),
      });
    }
  }

  // Remplacer tous les prix des produits concernés (gère la suppression d'un prix)
  const { error: deleteError } = await supabase
    .from("store_prices")
    .delete()
    .in("product_id", currentIds);
  if (deleteError) throw deleteError;

  if (priceRows.length > 0) {
    const { error: insertError } = await supabase
      .from("store_prices")
      .insert(priceRows);
    if (insertError) throw insertError;
  }
}

// ── Mémoire Flipp ─────────────────────────────────────────────────────────────

export async function loadMemory(userId) {
  const { data, error } = await supabase
    .from("flipp_memory")
    .select("product_id, store_key, flipp_id, flipp_name")
    .eq("user_id", userId);
  if (error) throw error;

  const memory = {};
  for (const row of data) {
    memory[`${row.product_id}_${row.store_key}`] = {
      flippId: row.flipp_id,
      flippName: row.flipp_name,
    };
  }
  return memory;
}

export async function saveMemory(userId, memory) {
  // Remplacement complet : supprimer puis réinsérer
  await supabase.from("flipp_memory").delete().eq("user_id", userId);

  const entries = Object.entries(memory);
  if (!entries.length) return;

  const rows = entries.map(([key, val]) => {
    const idx = key.indexOf("_");
    return {
      user_id: userId,
      product_id: Number(key.slice(0, idx)),
      store_key: key.slice(idx + 1),
      flipp_id: val.flippId,
      flipp_name: val.flippName,
    };
  });

  const { error } = await supabase.from("flipp_memory").insert(rows);
  if (error) throw error;
}

// ── Liste d'épicerie ──────────────────────────────────────────────────────────

export async function loadShoppingList(userId) {
  const { data, error } = await supabase
    .from("shopping_lists")
    .select("items")
    .eq("user_id", userId)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data?.items ?? [];
}

export async function saveShoppingList(userId, items) {
  const { error } = await supabase
    .from("shopping_lists")
    .upsert({ user_id: userId, items, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}

// ── Import de sauvegarde ──────────────────────────────────────────────────────

export async function importBackup(userId, backup) {
  const { products, memory } = backup;
  if (products?.length) await saveProducts(userId, products);
  if (memory && Object.keys(memory).length) await saveMemory(userId, memory);
}
