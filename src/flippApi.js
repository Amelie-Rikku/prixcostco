const BASE = "https://flyers-ng.flippback.com/api/flipp";

const STORE_KEYWORDS = {
  costco: ["costco"],
  maxi:   ["maxi"],
  superc: ["super c", "super-c"],
};

function makeSid() {
  return Math.floor(Math.random() * 9e15 + 1e15).toString();
}

export async function fetchStoreItems(postalCode, storeKey) {
  const sid = makeSid();
  const flyersUrl = `${BASE}/data?locale=fr&postal_code=${postalCode}&sid=${sid}`;
  const flyersRes = await fetch(flyersUrl);
  if (!flyersRes.ok) throw new Error(`Flipp flyers: ${flyersRes.status}`);
  const flyersData = await flyersRes.json();

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

  const itemsUrl = `${BASE}/flyers/${flyerId}/flyer_items?locale=fr&sid=${sid}`;
  const itemsRes = await fetch(itemsUrl);
  if (!itemsRes.ok) throw new Error(`Flipp items: ${itemsRes.status}`);
  const itemsData = await itemsRes.json();

  const items = (itemsData.flyer_items ?? itemsData ?? []).filter(
    item => (item.current_price ?? item.price) != null
  );
  console.log(`[Flipp] ${storeKey}: ${items.length} items chargés`);
  return items;
}
