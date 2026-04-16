-- ─────────────────────────────────────────────────────────────────────────────
-- PrixCostco — Schéma Supabase (schéma normalisé final)
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query
--
-- Pour migrer depuis l'ancien schéma JSONB, exécuter d'abord :
--   supabase/migrate_to_normalized.sql
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Fonction utilitaire : updated_at automatique ──────────────────────────────

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;


-- ── Table : stores ────────────────────────────────────────────────────────────
-- Référentiel statique des magasins supportés.

create table if not exists stores (
  id    text primary key,   -- 'costco' | 'maxi' | 'superc'
  name  text not null
);

insert into stores (id, name) values
  ('costco', 'Costco'),
  ('maxi',   'Maxi'),
  ('superc', 'Super C')
on conflict (id) do nothing;

alter table stores enable row level security;

create policy "Lecture publique des magasins"
  on stores for select
  using (auth.role() = 'authenticated');


-- ── Table : products ──────────────────────────────────────────────────────────
-- Catalogue générique des produits (sans données de prix — voir store_prices).

create table if not exists products (
  id          bigint        primary key,
  user_id     uuid          not null references auth.users(id) on delete cascade,
  name        text          not null,
  category    text          not null default 'Épicerie sèche',
  per_unit    text          not null default 'g',
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

create trigger products_updated_at
  before update on products
  for each row execute function update_updated_at();

alter table products enable row level security;

create policy "Utilisateur voit ses propres produits"
  on products for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── Table : store_prices ──────────────────────────────────────────────────────
-- Prix par produit et par magasin.
-- Une seule ligne par (product_id, store_id) — contrainte UNIQUE.

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

create trigger store_prices_updated_at
  before update on store_prices
  for each row execute function update_updated_at();

alter table store_prices enable row level security;

create policy "Utilisateur voit ses propres prix"
  on store_prices for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── Table : flipp_memory ──────────────────────────────────────────────────────
-- Mémorise quelle entrée Flipp correspond à chaque produit/magasin.

create table if not exists flipp_memory (
  product_id  bigint   not null references products(id) on delete cascade,
  store_key   text     not null,   -- 'costco' | 'maxi' | 'superc'
  user_id     uuid     not null references auth.users(id) on delete cascade,
  flipp_id    text,
  flipp_name  text,
  primary key (product_id, store_key)
);

alter table flipp_memory enable row level security;

create policy "Utilisateur voit sa propre mémoire"
  on flipp_memory for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── Table : shopping_lists ────────────────────────────────────────────────────
-- Liste d'épicerie active par utilisateur.
-- items: [{ id, productId, qty, checked }]

create table if not exists shopping_lists (
  user_id     uuid    primary key references auth.users(id) on delete cascade,
  items       jsonb   not null default '[]',
  updated_at  timestamptz not null default now()
);

alter table shopping_lists enable row level security;

create policy "Utilisateur voit sa propre liste"
  on shopping_lists for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
