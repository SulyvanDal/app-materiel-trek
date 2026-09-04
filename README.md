# app-matériel-trek

Application web de gestion de matériel de randonnée / trek.

---

## 1. Pourquoi ce projet

Ce projet a **deux objectifs**, dans cet ordre :

1. **Apprendre une architecture web pro standard.** Comprendre concrètement une
   application découplée *frontend / backend / base de données*, savoir pourquoi
   chaque frontière existe, et être capable de reproduire cette structure seul
   sur un autre projet. Le code n'est pas une fin en soi : chaque choix technique
   est fait pour être compris et justifié, pas copié d'un boilerplate.
2. **Répondre à un besoin personnel réel** : préparer et comparer des sacs de
   trek sans tableur.

Le besoin fonctionnel sert de prétexte concret à l'apprentissage. Il est assez
simple pour ne pas noyer les concepts, assez riche pour rencontrer les vraies
questions (modélisation d'une relation N-N, validation des entrées, gestion
d'erreurs, conventions d'API).

---

## 2. À quoi le projet répond

Quand on prépare un trek, on veut pouvoir :

- **lister le contenu d'un sac** et connaître son **poids total** ;
- distinguer l'**obligatoire** de l'**optionnel** (qu'est-ce que je peux laisser
  si je dois alléger ?) ;
- gérer un **inventaire de matériel** possédé, indépendant des sacs (un réchaud
  existe une fois, il peut servir dans plusieurs sacs) ;
- créer et **comparer plusieurs profils de sac** : trek été, trek hiver, bivouac
  léger… chacun avec sa sélection et ses quantités.

D'où trois entités :

| Entité    | Rôle |
|-----------|------|
| `Item`    | un objet du matériel possédé (nom, poids, catégorie, quantité possédée) |
| `Bag`     | un profil de sac (un nom) |
| `BagItem` | **table de liaison** : quel item est dans quel sac, en quelle quantité, obligatoire ou non |

`BagItem` est une table de liaison et pas une simple relation parce qu'elle
**porte des données propres au couple (sac, item)** : `bagQuantity` (2 piquets
dans le sac hiver, 4 dans le sac été) et `isRequired` (le même réchaud est
obligatoire en hiver, optionnel en été). Clé primaire composite `[bagId, itemId]`
→ un item ne peut être présent qu'une fois par sac. Suppression en cascade : si
on supprime un sac ou un item, les lignes `BagItem` correspondantes disparaissent.

---

## 3. Architecture générale

**Frontend, backend et base de données séparés, délibérément.**

```
┌────────────┐      HTTP / JSON      ┌────────────┐    Prisma    ┌──────────┐
│  Frontend  │  ───────────────────▶ │  Backend   │  ──────────▶ │   BDD    │
│ React+Vite │  ◀─────────────────── │  Express   │  ◀────────── │  SQLite  │
└────────────┘     API REST          └────────────┘              └──────────┘
```

Le but est de **rendre la frontière des responsabilités explicite** :

- le frontend ne sait rien du stockage, il consomme une API ;
- le backend ne rend pas de HTML, il expose des ressources JSON ;
- la base n'est jamais touchée directement par le frontend.

Chaque couche pourrait être remplacée sans réécrire les autres (c'est le test
qu'on se fixe : *si je change X, qu'est-ce que ça oblige à toucher ailleurs ?*).

---

## 4. Stack technique

| Couche    | Choix | Raison |
|-----------|-------|--------|
| Frontend  | React + Vite, TypeScript | *(prévu, pas encore démarré)* |
| Backend   | Node.js + Express 5, TypeScript | API REST, écosystème connu, minimal |
| ORM       | Prisma | typage généré depuis le schéma, migrations versionnées |
| Base      | SQLite pour démarrer | zéro config, un fichier ; migration PostgreSQL prévue **sans réécriture du code applicatif** grâce à Prisma |

---

## 5. Choix techniques détaillés

Cette section documente les décisions prises et **pourquoi**. C'est le cœur de
l'intérêt pédagogique du projet.

### 5.1 Organisation du dépôt

`back-end/` (et `front-end/` à venir) sont des **sous-projets indépendants**,
chacun avec son `package.json`, ses dépendances, ses scripts. Toute commande npm
se lance depuis le dossier concerné. Des *workspaces* npm à la racine pourront
piloter les deux plus tard, quand le besoin s'en fera sentir.

### 5.2 Exécution TypeScript sans transpileur en dev

Le backend est lancé par `node --watch src/server.ts` : Node exécute le
TypeScript directement en **retirant les types** (« type stripping »), sans étape
de compilation en développement. Aucune dépendance type `ts-node` / `tsx`.

Conséquence assumée : **le type stripping ne vérifie rien**. Une erreur de type
ne bloque pas `npm run dev`. La vérification est une étape séparée et
obligatoire : `npm run typecheck` (`tsc --noEmit`).

`tsconfig.json` : ESM (`"type": "module"`), `module` / `moduleResolution` en
`NodeNext`, `strict: true`, `verbatimModuleSyntax: true`.

Les imports relatifs portent l'extension **`.ts`** (ce que Node exige dans ce
mode). Pour que `tsc` l'accepte et produise un build valide :
`allowImportingTsExtensions` + `rewriteRelativeImportExtensions` (le build
réécrit `.ts` → `.js` dans `dist/`). Le code source garde `.ts`, le code compilé
a `.js` : les deux mondes sont réconciliés.

### 5.3 Découpage en couches (par rôle technique)

Choix d'un découpage **par couche** plutôt que par fonctionnalité, pour rester
simple au démarrage (peu de ressources).

```
src/
  routes/        quelle méthode + quelle URL → quel handler
  controllers/   traduction HTTP ↔ métier : lit req, appelle le service,
                 choisit le code HTTP, met en forme la réponse
  services/      logique métier + accès aux données (SEULE couche qui importe Prisma)
  schema/        schémas de validation Zod
  middlewares/   transverse : gestion d'erreurs, validation
  lib/           briques techniques partagées (client Prisma, classes d'erreur)
  app.ts         assemble et configure Express, l'exporte — n'écoute PAS
  server.ts      importe l'app, ouvre le port
```

Règles :

- une couche ne connaît que celle juste en dessous ;
- **`routes/` importe `controllers/`, jamais `services/`** ;
- **un controller ne touche jamais Prisma** ;
- le **service ne connaît pas HTTP** (pas de `req` / `res`) → il est testable et
  réutilisable (script, cron…) hors d'une requête web.

**Séparation `app.ts` / `server.ts`** : `app.ts` construit l'application et
l'exporte sans appeler `.listen()` ; `server.ts` l'importe et ouvre le port.
Raison : pouvoir tester l'API (ex. `supertest`) sans occuper un port réseau, et
séparer « comment l'app est montée » de « où / comment on la démarre ».

### 5.4 Conventions d'API REST

- **Préfixe `/api`** pour toute l'API, via un routeur agrégateur
  (`routes/index.ts`). Le préfixe vit à un seul endroit.
- **Nommage des ressources** : nom au pluriel, `kebab-case`, jamais de verbe dans
  l'URL (le verbe est la méthode HTTP). Ex. `GET /api/items`,
  `POST /api/items`, `DELETE /api/items/:id`.
- **Relations imbriquées** : `GET /api/bags/:bagId/items` — l'URL raconte la
  relation.
- **Filtrer / trier / paginer** = *query params*, pas de nouvelle URL.
- **Enveloppe de réponse** :
  - succès : `{ "data": ... }` (objet ou tableau), `"meta"` uniquement sur les
    collections (pagination à venir) ;
  - erreur : `{ "error": { "code": "MACHINE_LISIBLE", "message": "..." } }`.

  L'enveloppe permet d'ajouter des métadonnées plus tard sans casser le client,
  et donne une forme identique entre succès et erreur.
- **Codes HTTP** : `200` lecture / modif, `201` création, `204` suppression,
  `400` requête invalide, `404` ressource absente.

### 5.5 Configuration par variables d'environnement

Le port vient de `process.env.PORT`, avec repli sur `3000`. Node ne charge pas
`.env` automatiquement : le script `dev` passe `--env-file-if-exists=.env`.
`.env` est ignoré par git ; `.env.example` documente les variables attendues.

Raison : ne jamais avoir de valeur d'infrastructure figée dans le code source ;
les hébergeurs imposent le port par variable d'environnement.

### 5.6 Gestion d'erreurs centralisée

Choix : **lever une erreur typée + un middleware central la traduit**, plutôt que
`res.status(...).json(...)` répété dans chaque controller.

- `lib/errors.ts` : `AppError` (base : `statusCode`, `code`, `message`) et ses
  sous-classes `NotFoundError` (404), `ValidationError` (400).
  Le nombre de paramètres d'un constructeur = le nombre d'infos qui **varient**
  d'un `throw` à l'autre ; le reste est figé dans l'appel `super(...)`.
- Les **services `throw`** ces erreurs (ils n'ont pas accès à `res`). En
  Express 5, une promesse rejetée par un handler `async` est **automatiquement
  routée** vers le middleware d'erreur — pas de `try/catch` à écrire.
- `middlewares/error-handler.ts` : middleware à **4 paramètres**
  `(err, req, res, next)` — c'est à ce nombre d'arguments qu'Express le reconnaît
  comme gestionnaire d'erreur. Monté **en dernier** dans `app.ts`.
  - `err instanceof AppError` → réponse `{ error: { code, message } }` au statut
    porté par l'erreur ;
  - sinon (vrai bug, panne Prisma…) → `500` générique côté client, erreur
    complète loggée côté serveur (on ne fuite jamais la stack au client).
- `err` est typé **`unknown`** : en JS on peut `throw` n'importe quoi, on doit
  restreindre le type (`instanceof`) avant de l'utiliser.

### 5.7 Validation des entrées : Zod

- La validation vit dans un **middleware avant le controller** : le controller
  reçoit une donnée déjà propre et typée.
- **Répartition** : Zod rejette ce qui est malformé ou hors bornes *dans
  l'absolu* (type, champ requis, longueur, `weightGrams >= 0`, `category` dans la
  liste) ; le **service** rejette ce qui est incohérent *avec l'état existant*
  (ce `Bag` existe-t-il ? cet item est-il déjà dans ce sac ?).
- Le **type TypeScript est déduit du schéma** (`z.infer<typeof schema>`) : une
  seule source de vérité, pas de dérive entre la règle runtime et le type.
- Schéma **`.strict()`** : un body avec une clé inconnue est rejeté (attrape les
  fautes de frappe, empêche un client d'injecter un champ non prévu).
- `category` : **enum figé dans le code** (schéma Zod), pas de table `Category`
  en base. Justification : sur un projet solo avec ~6 catégories stables, une
  table + son CRUD serait de la sur-ingénierie. La contrainte vit dans l'API ;
  la colonne reste `String` en base. Migration vers une table possible plus tard
  si le besoin apparaît (plusieurs utilisateurs, métadonnées par catégorie…).

### 5.8 Modèle de données (`back-end/prisma/schema.prisma`)

```
Bag      id, name, createdAt, updatedAt
Item     id, name, weightGrams (défaut 0), category, ownedQuantity (défaut 1),
         createdAt, updatedAt
BagItem  bagId, itemId, bagQuantity (défaut 1), isRequired (défaut false)
         PK composite [bagId, itemId], FK en cascade vers Bag et Item
```

---

## 6. État d'avancement

| Domaine | État |
|---------|------|
| Socle backend (Express, config TS, `/api`, `/api/health`) | ✅ |
| Client Prisma (instance unique) | ✅ |
| Gestion d'erreurs centralisée (`AppError` + middleware) | ✅ |
| `GET /api/items` (liste) et `GET /api/items/:id` (détail) | ✅ |
| Schéma de validation Zod pour la création d'item | ✅ |
| Middleware de validation générique | 🚧 en cours |
| `POST` / `PATCH` / `DELETE` items | ⬜ à faire |
| Ressources `bags` et `bag-items` | ⬜ à faire |
| Frontend | ⬜ pas démarré |
| Migration PostgreSQL | ⬜ envisagée plus tard |

---

## 7. Démarrer le backend

```bash
cd back-end
npm install
cp .env.example .env          # ajuster si besoin
npx prisma migrate dev        # créer / mettre à jour la base locale
npm run dev                   # http://localhost:3000
```

Scripts :

| Script | Effet |
|--------|-------|
| `npm run dev` | serveur en watch, charge `.env`, **ne vérifie pas les types** |
| `npm run typecheck` | `tsc --noEmit` — la vérification de types (à lancer avant chaque commit) |
| `npm run build` | compile vers `dist/` |
| `npm start` | lance le build (`dist/server.js`) |
