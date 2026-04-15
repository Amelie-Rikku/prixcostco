import { supabase } from "./supabaseClient";

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthChange(callback) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => subscription.unsubscribe();
}

export async function getUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// ── Products ──────────────────────────────────────────────────────────────────

export async function loadProducts(userId) {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, category, per_unit, costco, maxi, superc")
    .eq("user_id", userId)
    .order("id", { ascending: true });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    perUnit: row.per_unit,
    costco: row.costco,
    maxi: row.maxi,
    superc: row.superc,
  }));
}

export async function saveProducts(userId, products) {
  // Stratégie : supprimer tout puis réinsérer — simple et fiable
  const { error: deleteError } = await supabase
    .from("products")
    .delete()
    .eq("user_id", userId);
  if (deleteError) throw deleteError;

  if (!products.length) return;

  const rows = products.map((p) => ({
    id: Math.round(p.id),
    user_id: userId,
    name: p.name,
    category: p.category || "Épicerie sèche",
    per_unit: p.perUnit || "g",
    costco: p.costco ?? null,
    maxi: p.maxi ?? null,
    superc: p.superc ?? null,
  }));

  const { error: insertError } = await supabase
    .from("products")
    .insert(rows);
  if (insertError) throw insertError;
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

// ── Import de sauvegarde (migration depuis Gist) ──────────────────────────────

export async function importBackup(userId, backup) {
  const { products, memory } = backup;
  if (products?.length) await saveProducts(userId, products);
  if (memory && Object.keys(memory).length) await saveMemory(userId, memory);
}
