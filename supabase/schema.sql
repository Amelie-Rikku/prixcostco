-- ─────────────────────────────────────────────────────────────────────────────
-- PrixCostco — Schéma Supabase
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Table : stores ────────────────────────────────────────────────────────────
-- Référentiel statique des 3 magasins supportés.

create table if not exists stores (
  id    text primary key,   -- 'costco' | 'maxi' | 'superc'
  name  text not null
);

insert into stores (id, name) values
  ('costco', 'Costco'),
  ('maxi',   'Maxi'),
  ('superc', 'Super C')
on conflict do nothing;

alter table stores enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'stores' and policyname = 'public-read-stores') then
    create policy "public-read-stores" on stores for select using (true);
  end if;
end $$;


-- ── Table : products ──────────────────────────────────────────────────────────
-- Catalogue de produits générique par utilisateur.

create table if not exists products (
  id          bigint        primary key,
  user_id     uuid          not null references auth.users(id) on delete cascade,
  name        text          not null,
  category    text          not null default 'Épicerie sèche',
  per_unit    text          not null default 'g',   -- unité de comparaison : 100g, g, kg, 100ml, litre, unité…
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'products_updated_at') then
    create trigger products_updated_at
      before update on products
      for each row execute function update_updated_at();
  end if;
end $$;

alter table products enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'products' and policyname = 'user-products') then
    create policy "user-products" on products for all
      using  (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;


-- ── Table : store_prices ──────────────────────────────────────────────────────
-- Prix d'un produit dans un magasin donné.
-- Une seule ligne par (product_id, store_id).
-- is_promo=true : price = prix promo, regular_price = prix normal.
-- is_promo=false : price = prix régulier, regular_price = idem.

create table if not exists store_prices (
  id             bigserial     primary key,
  product_id     bigint        not null references products(id) on delete cascade,
  store_id       text          not null references stores(id),
  user_id        uuid          not null references auth.users(id) on delete cascade,
  price          numeric(10,2),                          -- prix actif (promo si dispo, sinon régulier)
  regular_price  numeric(10,2),                          -- prix régulier (même si promo active)
  is_promo       boolean       not null default false,
  promo_end_date date,                                   -- date de fin de la promo (Phase 2)
  format_qty     numeric(10,3),                          -- quantité du format (ex: 1000)
  format_unit    text,                                   -- unité du format   (ex: 'g', 'ml', 'kg')
  description    text,                                   -- description Flipp / étiquette
  source         text          not null default 'manual', -- 'manual' | 'flipp' | 'ocr' | 'barcode'
  updated_at     timestamptz   not null default now(),
  unique(product_id, store_id)
);

alter table store_prices enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'store_prices' and policyname = 'user-store-prices') then
    create policy "user-store-prices" on store_prices for all
      using  (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;


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

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'flipp_memory' and policyname = 'user-flipp-memory') then
    create policy "user-flipp-memory" on flipp_memory for all
      using  (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;


-- ── Table : shopping_lists ────────────────────────────────────────────────────
-- Listes d'épicerie de l'utilisateur (courante + historique futur).
-- is_current=true : liste active en cours de construction.

create table if not exists shopping_lists (
  id          bigserial     primary key,
  user_id     uuid          not null references auth.users(id) on delete cascade,
  name        text,
  is_current  boolean       not null default false,
  created_at  timestamptz   not null default now()
);

alter table shopping_lists enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'shopping_lists' and policyname = 'user-shopping-lists') then
    create policy "user-shopping-lists" on shopping_lists for all
      using  (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;


-- ── Table : shopping_list_items ───────────────────────────────────────────────
-- Articles d'une liste d'épicerie.
-- Les colonnes price_snapshot_* capturent les prix au moment de la comparaison
-- (utilisées pour l'historique — Phase 2).

create table if not exists shopping_list_items (
  id                         bigserial  primary key,
  list_id                    bigint     not null references shopping_lists(id) on delete cascade,
  product_id                 bigint     references products(id) on delete set null,
  qty                        int        not null default 1,
  checked                    boolean    not null default false,
  price_snapshot_costco      numeric(10,2),
  price_snapshot_maxi        numeric(10,2),
  price_snapshot_superc      numeric(10,2),
  unit_price_snapshot_costco numeric(10,4),
  unit_price_snapshot_maxi   numeric(10,4),
  unit_price_snapshot_superc numeric(10,4)
);

alter table shopping_list_items enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'shopping_list_items' and policyname = 'user-shopping-list-items') then
    create policy "user-shopping-list-items" on shopping_list_items for all
      using  (exists (select 1 from shopping_lists sl where sl.id = list_id and sl.user_id = auth.uid()))
      with check (exists (select 1 from shopping_lists sl where sl.id = list_id and sl.user_id = auth.uid()));
  end if;
end $$;
