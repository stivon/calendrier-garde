# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commandes

```bash
npm start          # Lance le serveur (node server.js) sur le port 3000
```

Pas de tests, pas de build step, pas de linter configuré. Pour tester manuellement les routes API en local :
```bash
curl http://localhost:3000/api/days
curl -X POST http://localhost:3000/api/days/2026-07-04 -H "Content-Type: application/json" -d '{"type":"full"}'
curl -X DELETE http://localhost:3000/api/days/2026-07-04
```

## Architecture

Application Node.js/Express qui sert un calendrier de garde partagé pour deux enfants (Philippine & Pablo, nov. 2024 – juin 2026). MongoDB Atlas est la source de vérité unique — pas de localStorage, pas de données codées en dur côté client.

```
server.js          → point d'entrée : connexion Mongo, seed initial, static + routes
models/
  CustodyDay.js    → collection custody_days  { date, source, type }
  CustodyNote.js   → collection custody_notes { date, text }
routes/api.js      → 6 routes REST (voir ci-dessous)
public/index.html  → SPA vanilla JS : fetch API, rendu calendrier, modal note+type
```

### Base de données

- **Cluster** : MongoDB Atlas `cluster0.ofhgvg0.mongodb.net`
- **Base** : `app-claude-2024-2026`
- **Utilisateur dédié** : `app-calendrier-garde` (credentials dans `.env`, jamais dans le code)
- La collection `custody_days` est seedée automatiquement au premier démarrage (148 jours de base, `source: "auto"`). Les jours ajoutés via l'UI ont `source: "manual"`.
- Une migration idempotente tourne à chaque démarrage pour backfiller le champ `type` sur les anciens documents qui n'en auraient pas.

### Modèle CustodyDay

| Champ | Type | Valeurs |
|-------|------|---------|
| `date` | String | `yyyy-mm-dd` (unique, indexé) |
| `source` | String | `"auto"` (seedé) ou `"manual"` (ajouté via UI) |
| `type` | String | `"evening"` / `"day"` / `"full"` (défaut `"day"`) |

Sémantique du type : `evening` = soir seulement (bande bleue foncée en bas de cellule), `day` = journée sans nuit (fond bleu clair), `full` = journée + nuit (fond bleu clair + bande en bas).

### Routes API

```
GET    /api/days           → [{date, source, type}]
POST   /api/days/:date     → body {type?, source?} — upsert, force source:"manual", type défaut "day"
DELETE /api/days/:date     → 204

GET    /api/notes          → [{date, text}]
POST   /api/notes/:date    → body {text} — si text vide, supprime la note (204)
DELETE /api/notes/:date    → 204
```

Toutes les routes valident le format de date (`yyyy-mm-dd`) et retournent 400 si invalide. Types invalides retournent aussi 400.

### Front-end (public/index.html)

SPA sans framework. État côté client :
- `custodyMap` : `Map<date, {source, type}>` — chargé via `GET /api/days` au démarrage
- `notes` : `{[date]: text}` — chargé via `GET /api/notes` au démarrage

Interactions dans chaque cellule du calendrier :
- **Clic sur le fond de la cellule** → `toggleCustody()` : POST si le jour n'est pas garde, DELETE sinon. Mise à jour optimiste avec rollback en cas d'erreur réseau.
- **Clic sur l'icône 📝 (top-right)** → `openModal()` : affiche la modale avec les 3 boutons de type + textarea de note. Les boutons de type appellent `setCustodyType()` directement sans fermer la modale.

Rendu visuel par type géré par les classes CSS `.type-evening`, `.type-day`, `.type-full` sur `.day-cell`. La bande bleue foncée est un pseudo-élément `::after`.

## Variables d'environnement

```
MONGODB_URI=mongodb+srv://app-calendrier-garde:<password>@cluster0.ofhgvg0.mongodb.net/app-claude-2024-2026?retryWrites=true&w=majority
PORT=3000
```

En local : fichier `.env` (gitignored). En production (Cloud Run) : variables d'environnement du service.

## Déploiement

Cloud Run via Cloud Buildpacks (pas de Dockerfile) :
```bash
gcloud run deploy calendrier-garde --source . --region europe-west1 --allow-unauthenticated \
  --set-env-vars MONGODB_URI="..."
```

Prérequis : `0.0.0.0/0` autorisé dans Network Access sur MongoDB Atlas (Cloud Run n'a pas d'IP fixe).
