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

export async function loadProducts(userId) {
  const { data, error } = await supabase
    .from("products")
    .select(`
      id, name, category, per_unit,
      store_prices (store_id, price, regular_price, is_promo, promo_end_date, format_qty, format_unit, description)
    `)
    .eq("user_id", userId)
    .order("id", { ascending: true });
  if (error) throw error;

  return data.map((row) => {
    const byStore = {};
    for (const sp of row.store_prices || []) {
      byStore[sp.store_id] = {
        regular: sp.is_promo ? sp.regular_price : sp.price,
        promo: sp.is_promo ? sp.price : null,
        qty: sp.format_qty,
        unit: sp.format_unit,
        desc: sp.description,
        promo_end_date: sp.promo_end_date,
      };
    }
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      perUnit: row.per_unit,
      costco: byStore.costco ?? null,
      maxi: byStore.maxi ?? null,
      superc: byStore.superc ?? null,
    };
  });
}

export async function saveProducts(userId, products) {
  // Supprimer tout puis réinsérer — simple et fiable
  const { error: deleteError } = await supabase
    .from("products")
    .delete()
    .eq("user_id", userId);
  if (deleteError) throw deleteError;

  if (!products.length) return;

  // Insérer les produits
  const productRows = products.map((p) => ({
    id: Math.round(p.id),
    user_id: userId,
    name: p.name,
    category: p.category || "Épicerie sèche",
    per_unit: p.perUnit || "g",
  }));

  const { error: insertError } = await supabase
    .from("products")
    .insert(productRows);
  if (insertError) throw insertError;

  // Insérer les prix par magasin
  const storePriceRows = [];
  for (const p of products) {
    const pid = Math.round(p.id);
    for (const storeId of ["costco", "maxi", "superc"]) {
      const s = p[storeId];
      if (!s || (s.regular == null && s.promo == null)) continue;
      storePriceRows.push({
        product_id: pid,
        store_id: storeId,
        user_id: userId,
        price: s.promo ?? s.regular,
        regular_price: s.regular ?? null,
        is_promo: s.promo != null,
        promo_end_date: s.promo_end_date ?? null,
        format_qty: s.qty ? Number(s.qty) : null,
        format_unit: s.unit || null,
        description: s.desc || null,
        source: "manual",
      });
    }
  }

  if (storePriceRows.length > 0) {
    const { error: spError } = await supabase
      .from("store_prices")
      .insert(storePriceRows);
    if (spError) throw spError;
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
  // Chercher la liste courante de l'utilisateur
  const { data: lists, error: listError } = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("user_id", userId)
    .eq("is_current", true)
    .order("created_at", { ascending: false })
    .limit(1);
  if (listError) throw listError;

  if (!lists || lists.length === 0) return [];

  const listId = lists[0].id;
  const { data: items, error: itemsError } = await supabase
    .from("shopping_list_items")
    .select("id, product_id, qty, checked")
    .eq("list_id", listId)
    .order("id", { ascending: true });
  if (itemsError) throw itemsError;

  return (items || []).map((item) => ({
    id: item.id,
    productId: item.product_id,
    qty: item.qty,
    checked: item.checked,
  }));
}

export async function saveShoppingList(userId, items) {
  // Récupérer ou créer la liste courante
  const { data: lists } = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("user_id", userId)
    .eq("is_current", true)
    .order("created_at", { ascending: false })
    .limit(1);

  let listId;
  if (lists && lists.length > 0) {
    listId = lists[0].id;
  } else {
    const { data: newList, error: createError } = await supabase
      .from("shopping_lists")
      .insert({ user_id: userId, is_current: true, name: "Liste courante" })
      .select("id")
      .single();
    if (createError) throw createError;
    listId = newList.id;
  }

  // Remplacer tous les items
  await supabase.from("shopping_list_items").delete().eq("list_id", listId);

  if (!items.length) return;

  const rows = items.map((item) => ({
    list_id: listId,
    product_id: item.productId,
    qty: item.qty,
    checked: item.checked,
  }));

  const { error } = await supabase.from("shopping_list_items").insert(rows);
  if (error) throw error;
}

// ── Import de sauvegarde (migration depuis Gist) ──────────────────────────────

export async function importBackup(userId, backup) {
  const { products, memory } = backup;
  if (products?.length) await saveProducts(userId, products);
  if (memory && Object.keys(memory).length) await saveMemory(userId, memory);
}
