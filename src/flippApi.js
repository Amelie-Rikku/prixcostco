const PROXIES = [
  "https://corsproxy.io/?",
  "https://api.allorigins.win/raw?url=",
];

const STORE_KEYWORDS = {
  costco: ["costco"],
  maxi:   ["maxi"],
  superc: ["super c", "super-c"],
};

async function fetchWithProxy(url) {
  for (const proxy of PROXIES) {
    try {
      const res = await fetch(proxy + encodeURIComponent(url));
      if (res.ok) return res;
    } catch { /* try next proxy */ }
  }
  throw new Error("Tous les proxies ont échoué — vérifiez votre connexion.");
}

export async function fetchStoreItems(postalCode, storeKey) {
  const flyersUrl = `https://flipp.com/flyers.json?locale=fr-CA&postal_code=${postalCode}`;
  const flyersRes = await fetchWithProxy(flyersUrl);
  const flyersData = await flyersRes.json();

  // Debug: log available merchants
  const merchants = [...new Set((flyersData.flyers ?? []).map(f => f.merchant))];
  console.log(`[Flipp] Marchands disponibles (${postalCode}):`, merchants);

  const keywords = STORE_KEYWORDS[storeKey] ?? [];
  const storeFlyers = (flyersData.flyers ?? []).filter(f =>
    keywords.some(k => (f.merchant ?? "").toLowerCase().includes(k))
  );

  if (!storeFlyers.length) {
    throw new Error(`${storeKey}: aucune circulaire (marchands: ${merchants.join(", ")})`);
  }

  const flyerId = storeFlyers[0].id;
  console.log(`[Flipp] ${storeKey} → circulaire #${flyerId} (${storeFlyers[0].merchant})`);

  const itemsUrl = `https://flipp.com/flyers/${flyerId}/flyer_items.json`;
  const itemsRes = await fetchWithProxy(itemsUrl);
  const itemsData = await itemsRes.json();

  const items = (itemsData.flyer_items ?? []).filter(
    item => (item.current_price ?? item.price) != null
  );
  console.log(`[Flipp] ${storeKey}: ${items.length} items chargés`);
  return items;
}
