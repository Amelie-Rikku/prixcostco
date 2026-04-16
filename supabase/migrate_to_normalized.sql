-- ─────────────────────────────────────────────────────────────────────────────
-- PrixCostco — Migration vers le schéma normalisé
-- À exécuter UNE SEULE FOIS dans : Supabase Dashboard → SQL Editor → New query
--
-- Ce script :
--   1. Crée la table `stores` (référentiel statique)
--   2. Crée la table `store_prices` (prix normalisés par magasin)
--   3. Migre les données depuis les colonnes JSONB de `products`
--   4. Supprime les colonnes JSONB devenues inutiles (costco, maxi, superc)
--
-- Aucune donnée n'est perdue — tout est copié avant suppression.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Étape 1 : Table stores ────────────────────────────────────────────────────

create table if not exists stores (
  id    text primary key,   -- 'costco' | 'maxi' | 'superc'
  name  text not null
);

insert into stores (id, name) values
  ('costco', 'Costco'),
  ('maxi',   'Maxi'),
  ('superc', 'Super C')
on conflict (id) do nothing;

-- Les stores sont lisibles par tous les utilisateurs authentifiés
alter table stores enable row level security;

create policy "Lecture publique des magasins"
  on stores for select
  using (auth.role() = 'authenticated');


-- ── Étape 2 : Table store_prices ──────────────────────────────────────────────

create table if not exists store_prices (
  id              bigserial     primary key,
  product_id      bigint        not null references products(id) on delete cascade,
  store_id        text          not null references stores(id),
  user_id         uuid          not null references auth.users(id) on delete cascade,
  regular_price   numeric(10,2),
  is_promo        boolean       not null default false,
  promo_price     numeric(10,2),
  promo_end_date  date,
  format_qty      numeric(10,3),
  format_unit     text,
  description     text,
  source          text          not null default 'manual', -- 'manual' | 'flipp' | 'ocr' | 'barcode'
  updated_at      timestamptz   not null default now(),
  unique (product_id, store_id)
);

-- Mise à jour automatique de updated_at
create trigger store_prices_updated_at
  before update on store_prices
  for each row execute function update_updated_at();

-- RLS : chaque utilisateur ne voit que ses propres prix
alter table store_prices enable row level security;

create policy "Utilisateur voit ses propres prix"
  on store_prices for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── Étape 3 : Migration des données JSONB → store_prices ──────────────────────
-- Les colonnes costco / maxi / superc de products contiennent des objets JSON
-- de la forme : { "regular": 14.99, "promo": null, "qty": 1000, "unit": "g", "desc": "..." }
-- La valeur JSON null devient SQL NULL via l'opérateur ->>'field'.

-- Costco
insert into store_prices
  (product_id, store_id, user_id,
   regular_price, is_promo, promo_price,
   format_qty, format_unit, description, source)
select
  p.id,
  'costco',
  p.user_id,
  (p.costco->>'regular')::numeric,
  (p.costco->>'promo') is not null,                              -- null JSON → SQL NULL → false
  (p.costco->>'promo')::numeric,                                 -- null si pas de promo
  (p.costco->>'qty')::numeric,
  p.costco->>'unit',
  p.costco->>'desc',
  'manual'
from products p
where p.costco is not null
  and (p.costco->>'regular' is not null or p.costco->>'promo' is not null)
on conflict (product_id, store_id) do nothing;

-- Maxi
insert into store_prices
  (product_id, store_id, user_id,
   regular_price, is_promo, promo_price,
   format_qty, format_unit, description, source)
select
  p.id,
  'maxi',
  p.user_id,
  (p.maxi->>'regular')::numeric,
  (p.maxi->>'promo') is not null,
  (p.maxi->>'promo')::numeric,
  (p.maxi->>'qty')::numeric,
  p.maxi->>'unit',
  p.maxi->>'desc',
  'manual'
from products p
where p.maxi is not null
  and (p.maxi->>'regular' is not null or p.maxi->>'promo' is not null)
on conflict (product_id, store_id) do nothing;

-- Super C
insert into store_prices
  (product_id, store_id, user_id,
   regular_price, is_promo, promo_price,
   format_qty, format_unit, description, source)
select
  p.id,
  'superc',
  p.user_id,
  (p.superc->>'regular')::numeric,
  (p.superc->>'promo') is not null,
  (p.superc->>'promo')::numeric,
  (p.superc->>'qty')::numeric,
  p.superc->>'unit',
  p.superc->>'desc',
  'manual'
from products p
where p.superc is not null
  and (p.superc->>'regular' is not null or p.superc->>'promo' is not null)
on conflict (product_id, store_id) do nothing;


-- ── Vérification avant suppression ────────────────────────────────────────────
-- Optionnel : exécute ces requêtes pour vérifier que la migration est correcte
-- avant de supprimer les colonnes JSONB.
--
-- select count(*) from store_prices;
-- select p.name, sp.store_id, sp.regular_price, sp.is_promo, sp.promo_price
--   from store_prices sp
--   join products p on p.id = sp.product_id
--   order by p.name, sp.store_id;


-- ── Étape 4 : Suppression des colonnes JSONB ──────────────────────────────────
-- À exécuter seulement après avoir vérifié que les données sont bien dans store_prices.

alter table products drop column if exists costco;
alter table products drop column if exists maxi;
alter table products drop column if exists superc;
