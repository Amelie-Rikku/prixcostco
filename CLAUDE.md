# PrixCostco — Contexte de session Claude

## Vue d'ensemble
Application React PWA de comparaison de prix d'épicerie (Costco, Maxi, Super C).
Usage personnel, gratuit, mobile-first.

**URL de production** : https://amelie-rikku.github.io/prixcostco/
**Repo GitHub** : amelie-rikku/prixcostco
**Branche de dev** : `claude/grocery-price-comparison-prd-VWDxk`
**Branche principale** : `main` (déployée sur GitHub Pages via `npm run deploy`)

---

## Stack technique
- **Frontend** : React + Vite (pas de TypeScript)
- **Auth + DB** : Supabase (Google OAuth, PostgreSQL, RLS)
- **Hosting** : GitHub Pages (`gh-pages` package)
- **Circulaires** : Flipp API (non-officielle, fonctionne depuis le navigateur)
- **Style** : CSS-in-JS inline, polices Syne + DM Mono (Google Fonts)

---

## Fichiers clés

```
src/
  App.jsx          — Composant principal, toute la logique UI
  Auth.jsx         — Écran de connexion Google (affiché si non connecté)
  FlippPanel.jsx   — Panel de synchro des promos Flipp
  ShoppingList.jsx — Liste d'épicerie avec comparaison par magasin
  db.js            — Couche données Supabase (auth + CRUD)
  supabaseClient.js — Instance Supabase (lit les variables d'env VITE_)

supabase/
  schema.sql       — Schéma complet à exécuter dans le SQL Editor Supabase

.mcp.json          — Config MCP Supabase (actif en session locale Windows)
.env.local         — Variables d'env (NON commité, présent sur ce serveur)
.env.local.example — Template des variables d'env
```

---

## Variables d'environnement (.env.local)
```
VITE_SUPABASE_URL=https://sryrjsjqgvxogcimfkez.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_bdRmzu8X_8NalOfilNiSQw_XJtRPVIM
```
Le fichier `.env.local` est déjà présent sur ce serveur. Il ne faut pas le commiter.

---

## Base de données Supabase

### Tables existantes (déjà créées ✓)
- **`products`** — Produits avec prix par magasin (JSONB: costco, maxi, superc)
- **`flipp_memory`** — Mémorisation des correspondances produit/Flipp

### Table à créer ⚠️
- **`shopping_lists`** — Liste d'épicerie par utilisateur

SQL à exécuter dans **Supabase Dashboard → SQL Editor** :
```sql
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
```
**Cette table n'existe pas encore** — le bouton 🛒 lèvera une erreur tant qu'elle n'est pas créée.

---

## Déploiement
```bash
npm run deploy   # build Vite + pousse sur gh-pages
git push origin main  # pousse le code source
```
Le `.env.local` doit être présent sur le serveur qui build (il l'est).

---

## MCP Supabase
Configuré dans `.mcp.json` (à la racine du projet).
- Fonctionne uniquement en session **Claude Code locale** (Windows)
- Clé secrète : dans `.mcp.json` à la racine (non commité — récupérer dans Supabase Dashboard → Settings → API → Secret key)
- Ref projet : `sryrjsjqgvxogcimfkez`
- **Dans la session web (claude.ai/code)** : le réseau bloque Supabase, MCP non disponible

---

## Fonctionnalités implémentées ✓

### Phase 1 — Migration Supabase
- [x] Auth Google via Supabase (`src/Auth.jsx`)
- [x] Chargement/sauvegarde produits en base (`products` table)
- [x] Mémorisation Flipp en base (`flipp_memory` table)
- [x] Auto-save debounced (1.5s après modification)
- [x] Bouton "💾 Backup complet" (export JSON local)
- [x] Import JSON (avec conversion float→int pour les IDs)
- [x] Fix OAuth redirect GitHub Pages

### Phase 1.5 — Liste d'épicerie
- [x] `ShoppingList.jsx` — recherche depuis le catalogue, quantités, cases à cocher
- [x] Totaux par magasin avec badge MEILLEUR
- [x] Sauvegarde dans Supabase (`shopping_lists` table — **à créer**)
- [x] Bouton 🛒 dans le header avec compteur d'articles actifs

---

## Fonctionnalités à faire (PRD)

### Phase 2
- [ ] Dates d'expiration des promos (champ `promo_end` + avertissement auto)
- [ ] Historique des prix avec snapshots
- [ ] Alertes de baisse de prix

### Phase 3
- [ ] PWA manifest + service worker
- [ ] Barcode scan (Open Food Facts)
- [ ] OCR reçus (Google Cloud Vision)

### Phase 4
- [ ] i18n (français + anglais)
- [ ] Proxy Vercel pour l'API Flipp (si CORS devient un problème)
- [ ] Migration hosting : GitHub Pages → Vercel

---

## Commandes utiles
```bash
npm run dev      # serveur de dev local (port 5173)
npm run build    # build production dans dist/
npm run deploy   # build + déploiement GitHub Pages
git push origin main
git push origin claude/grocery-price-comparison-prd-VWDxk
```

---

## Notes techniques importantes

### IDs produits
Les anciens IDs (Gist) étaient des floats (`Date.now() + Math.random()`).
Supabase exige des `bigint`. La conversion se fait dans l'import JSON :
`Math.trunc(id)` + boucle while pour garantir l'unicité.

### Auth OAuth GitHub Pages
- `signInWithGoogle` utilise `redirectTo: window.location.href.split("#")[0]`
- `getSession()` lit le fragment `#access_token=...` au retour OAuth
- `onSignOut()` écoute uniquement `SIGNED_OUT` (pas `INITIAL_SESSION`)
- Site URL Supabase configuré à : `https://amelie-rikku.github.io/prixcostco/`

### Calcul de prix unitaires
`calcPerPrice(price, qty, unit, perUnit)` — convertit tout en base (g ou ml)
puis calcule le prix par unité cible (ex: $/100g).
