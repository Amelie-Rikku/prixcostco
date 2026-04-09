# PRD — Application de comparaison de prix d'épicerie
**PrixCostco** (nom de travail)
Version 1.1 — Avril 2026

---

## 1. Vision

Une application web personnelle permettant de comparer le prix unitaire des produits d'épicerie entre Costco, Maxi et Super C, afin de répondre à la question fondamentale : **"Suis-je devant le meilleur prix en ce moment ?"**

L'application est conçue pour un usage solo, sans publicité, sans abonnement. Les données se construisent progressivement au fil des visites en magasin et des circulaires.

---

## 2. Utilisateur cible

Un seul utilisateur (usage personnel). L'interface doit être fluide sur téléphone (contexte principal : en magasin, debout dans une allée) et confortable sur PC (contexte secondaire : planification de la liste de la semaine).

---

## 3. Cas d'utilisation principaux

### CU-1 : Vérification rapide en magasin
> "Je suis devant le beurre d'arachide. Est-ce moins cher ici qu'ailleurs ?"

1. L'utilisateur cherche un produit (par nom, scan de code-barres ou photo d'étiquette)
2. L'app affiche, pour chaque magasin, le prix réel avec son format (ex. 500g / 1kg / 2-pack) et le prix unitaire calculé (ex. 0,89 $/100g)
3. L'utilisateur voit immédiatement où c'est le moins cher au prix unitaire

### CU-2 : Planification de la liste de courses
> "Avant d'aller faire l'épicerie, où est-ce que je devrais aller cette semaine ?"

1. L'utilisateur saisit sa liste de la semaine (texte libre)
2. L'app compare produit par produit et indique le magasin le moins cher pour chacun
3. Les produits introuvables dans la base sont listés avec un contrôle d'ajout rapide
4. La liste et les prix au moment de la comparaison sont sauvegardés automatiquement

### CU-3 : Consultation des promotions courantes
> "Qu'est-ce qui est en promo cette semaine ?"

1. L'utilisateur rafraîchit les promos via un bouton
2. L'app interroge Flipp et met à jour les promotions actives
3. Les promos expirées disparaissent automatiquement au prochain rafraîchissement

---

## 4. Fonctionnalités MVP

### 4.1 Gestion des produits

- **Catalogue générique** : les produits sont définis par catégorie/type sans importance de la marque (ex. "Lait 2%", "Beurre d'arachide crémeux")
- **Matching souple** : la comparaison se fait sur le type de produit, pas sur la marque exacte
- **Prix par magasin** : chaque produit peut avoir un prix différent selon le magasin, avec son format associé (poids, volume, quantité)
- **Prix unitaire calculé** : affiché automatiquement à partir du prix et du format selon la convention suivante :
  - Solides → **$/100g**
  - Liquides → **$/L**
  - Articles vendus à l'unité → **$/unité**
- **Ajout manuel** : l'utilisateur peut créer un produit, saisir un prix et un format manuellement pour n'importe quel magasin
- **Écrasement du prix** : l'utilisateur peut toujours corriger le prix récupéré automatiquement

### 4.2 Récupération des données

- **Flipp API** : source principale pour les circulaires de Costco, Maxi et Super C
- **Proxy serverless** : l'appel à Flipp passe par une Vercel Function (serveur relais) pour éviter les restrictions CORS des navigateurs — transparent pour l'utilisateur
- **Extraction des prix réguliers** : quand un circulaire affiche le prix régulier en plus du prix promo, les deux sont capturés et stockés
- **Rafraîchissement à la demande** : un bouton "Mettre à jour les promos" déclenche l'appel
- **Détection d'expiration** : au rafraîchissement, les promos dont la date de fin est dépassée sont automatiquement retirées
- **Résilience** : si Flipp est indisponible, l'app fonctionne avec les données existantes — seule la mise à jour est bloquée

### 4.3 Ajout de produits via mobile

- **Scan de code-barres** : via la caméra du téléphone, identifie le produit via Open Food Facts pour pré-remplir le nom et le format
- **Photo d'étiquette (OCR)** : via Google Cloud Vision, capture le nom du produit, le prix et le poids/format depuis l'étiquette en rayon
- **Produit inexistant** : formulaire d'ajout pré-rempli avec les données captées
- **Produit déjà existant** : affichage de la fiche existante avec proposition de modification du prix et du format

### 4.4 Comparaison de liste de courses

- **Saisie texte libre** : l'utilisateur tape sa liste (un produit par ligne)
- **Matching souple** : chaque ligne est associée à un produit de la base via recherche floue
- **Vue résultat** : pour chaque produit, affichage du prix dans chaque magasin (avec format et prix unitaire) et indicateur visuel du moins cher
- **Produit absent d'un magasin** : affiché comme "Prix inconnu" dans la colonne correspondante
- **Produits introuvables dans la base** : listés clairement avec contrôle d'ajout direct depuis la vue résultat
- **Sauvegarde automatique** : chaque liste comparée est conservée avec un instantané des prix au moment de la comparaison, consultable dans l'historique

### 4.5 Historique des listes

- L'utilisateur peut consulter ses listes passées avec les prix qui étaient en vigueur à ce moment-là
- Utile pour voir l'évolution des prix semaine après semaine

### 4.6 Promotions

- Les promos sont distinguées visuellement des prix réguliers
- Chaque promo affiche sa **date de fin de validité**
- Les promos disparaissent automatiquement à expiration (détectée au prochain rafraîchissement)
- Un prix régulier capturé via une promo est conservé dans la base même après la fin de la promo

### 4.7 Interface

- **Langue** : français par défaut, architecture i18n (internationalisation) en place pour faciliter l'ajout de langues futures
- **Responsive** : optimisé mobile en priorité (grands boutons, lecture rapide debout en magasin), confortable sur PC
- **PWA (Progressive Web App)** : installable sur téléphone depuis le navigateur, sans passer par l'App Store
- **Authentification** : connexion via Google (OAuth), accès restreint à l'utilisateur autorisé

---

## 5. Fonctionnalités hors scope (V2)

- Alertes et notifications lors d'une mise en promo d'un produit
- Historique des prix par produit et analyse de tendances
- Programmes de fidélité (PC Optimum, etc.)
- Prise en compte du coût d'abonnement Costco
- Partage de liste avec d'autres utilisateurs
- Mode hors-ligne (cache local sur l'appareil)
- Application native iOS/Android

---

## 6. Architecture technique

### Stack

| Couche | Technologie | Raison |
|---|---|---|
| Frontend | React + Vite (PWA) | Léger, mobile-friendly, VS Code compatible |
| Backend / DB | Supabase | Auth Google, PostgreSQL, API auto-générée, gratuit |
| Hébergement + API proxy | Vercel | Déploiement automatique, Vercel Functions pour proxy Flipp, gratuit |
| Données circulaires | Flipp (API non-officielle) | Agrège Costco, Maxi, Super C |
| Lookup produit | Open Food Facts API | Gratuit, open-source, données canadiennes |
| OCR étiquette | Google Cloud Vision | Précision optimale, ~1000 req/mois gratuitement (amplement suffisant) |

### Modèle de données (simplifié)

```
products
  id, name, category, unit_of_measure (g / ml / unit)

store_prices
  id, product_id, store_id, price, format_qty, format_unit, unit_price (calculé),
  is_promo, promo_end_date, source (manual / flipp / ocr / barcode), updated_at

stores
  id, name (Costco / Maxi / Super C)

shopping_lists
  id, created_at, name (optionnel)

shopping_list_items
  id, list_id, raw_text, product_id (résolu, nullable),
  price_snapshot_costco, price_snapshot_maxi, price_snapshot_superc,
  unit_price_snapshot_costco, unit_price_snapshot_maxi, unit_price_snapshot_superc
```

### Flux de données

```
Flipp API ──→ Vercel Function (proxy) ──→ Supabase (store_prices)
                                                ↑
Open Food Facts ────────────────────────────────┤ (via scan code-barres)
                                                │
Google Cloud Vision (OCR) ──────────────────────┤ (via photo étiquette)
                                                │
Saisie manuelle ────────────────────────────────┘

Supabase ←→ React (PWA) ←→ Utilisateur
```

---

## 7. Expérience utilisateur clé

### Écran principal (mobile)
- Barre de recherche en haut (texte ou icônes scan/photo)
- Résultats immédiats : liste des magasins avec prix, format et prix unitaire
- Badge visuel sur le moins cher
- Indication visuelle si le prix affiché est une promo (+ date de fin)

### Écran liste de courses
- Zone de texte libre pour saisir la liste
- Bouton "Comparer"
- Tableau résultat : produit | Costco | Maxi | Super C | Moins cher ✓
- "Prix inconnu" pour les magasins sans donnée
- Accès à l'historique des listes précédentes

### Écran promos
- Liste des promos actives par magasin
- Date de fin de validité visible sur chaque promo
- Bouton "Rafraîchir" en haut

---

## 8. Contraintes et hypothèses

- **Gratuit** : toutes les technologies choisies sont sur leur tier gratuit
- **Usage solo** : pas de gestion multi-utilisateurs en V1
- **Données évolutives** : la base de prix se construit dans le temps, elle sera incomplète au départ — c'est attendu et acceptable
- **Flipp non-officiel** : l'API Flipp n'est pas documentée publiquement ; si elle change, la récupération automatique sera à ajuster
- **Promos expirées** : les promos expirées restent visibles jusqu'au prochain rafraîchissement manuel — la date de fin affichée permet à l'utilisateur de juger
- **Costco en ligne limité** : les prix Costco en ligne peuvent différer du magasin physique ; on documente les prix du magasin physique
- **Supabase pause** : sur le tier gratuit, le projet se met en pause après 7 jours d'inactivité — les données sont conservées, le réveil est automatique à la prochaine visite
- **Google Cloud Vision** : ~1000 requêtes OCR gratuites par mois, largement suffisant pour un usage personnel

---

## 9. Critères de succès

- Je peux, en moins de 10 secondes en magasin, savoir si un produit est moins cher ailleurs
- Ma liste de courses peut être comparée avant de partir faire l'épicerie
- Je peux consulter mes listes passées avec les prix qui étaient en vigueur à ce moment-là
- Les promotions affichent leur date de fin et disparaissent au prochain rafraîchissement
- L'app fonctionne sur mon téléphone sans installation via l'App Store
