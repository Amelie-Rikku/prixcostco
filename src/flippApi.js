const PROXY = "https://corsproxy.io/?";

const STORE_KEYWORDS = {
  costco: ["costco"],
  maxi:   ["maxi"],
  superc: ["super c", "super-c"],
};

export async function fetchStoreItems(postalCode, storeKey) {
  const flyersUrl = `https://flipp.com/flyers.json?locale=fr-CA&postal_code=${postalCode}`;

  let flyersRes;
  try {
    flyersRes = await fetch(PROXY + encodeURIComponent(flyersUrl));
  } catch {
    throw new Error("Impossible de contacter le proxy CORS — vérifiez votre connexion.");
  }
  if (!flyersRes.ok) throw new Error(`Flipp a répondu avec une erreur (${flyersRes.status})`);

  const flyersData = await flyersRes.json();
  const keywords = STORE_KEYWORDS[storeKey] ?? [];
  const storeFlyers = (flyersData.flyers ?? []).filter(f =>
    keywords.some(k => (f.merchant ?? "").toLowerCase().includes(k))
  );

  if (!storeFlyers.length) throw new Error(`Aucune circulaire trouvée pour ${storeKey}`);

  const flyerId = storeFlyers[0].id;
  const itemsUrl = `https://flipp.com/flyers/${flyerId}/flyer_items.json`;

  let itemsRes;
  try {
    itemsRes = await fetch(PROXY + encodeURIComponent(itemsUrl));
  } catch {
    throw new Error("Impossible de charger les items de la circulaire.");
  }
  if (!itemsRes.ok) throw new Error(`Erreur chargement items (${itemsRes.status})`);

  const itemsData = await itemsRes.json();
  return (itemsData.flyer_items ?? []).filter(
    item => (item.current_price ?? item.price) != null
  );
}
