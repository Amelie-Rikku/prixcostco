-- ─────────────────────────────────────────────────────────────────────────────
-- PrixCostco — Schéma Supabase
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Table : products ──────────────────────────────────────────────────────────
-- Chaque produit appartient à un utilisateur.
-- Les données par magasin sont stockées en JSONB pour correspondre
-- exactement à la structure existante de l'application.

create table if not exists products (
  id          bigint        primary key,
  user_id     uuid          not null references auth.users(id) on delete cascade,
  name        text          not null,
  category    text          not null default 'Épicerie sèche',
  per_unit    text          not null default 'g',
  costco      jsonb,
  maxi        jsonb,
  superc      jsonb,
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

-- Mise à jour automatique de updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger products_updated_at
  before update on products
  for each row execute function update_updated_at();

-- Sécurité niveau ligne (RLS) : chaque utilisateur ne voit que ses produits
alter table products enable row level security;

create policy "Utilisateur voit ses propres produits"
  on products for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── Table : flipp_memory ──────────────────────────────────────────────────────
-- Mémorise quelle entrée Flipp correspond à chaque produit/magasin.
-- Supprimé automatiquement si le produit est supprimé (CASCADE).

create table if not exists flipp_memory (
  product_id  bigint   not null references products(id) on delete cascade,
  store_key   text     not null,   -- 'costco' | 'maxi' | 'superc'
  user_id     uuid     not null references auth.users(id) on delete cascade,
  flipp_id    text,
  flipp_name  text,
  primary key (product_id, store_key)
);

-- RLS
alter table flipp_memory enable row level security;

create policy "Utilisateur voit sa propre mémoire"
  on flipp_memory for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
