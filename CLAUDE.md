# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commandes

```bash
npm start          # Lance le serveur (node server.js) sur le port 3000
node backup.js     # Exporte la BDD en JSON dans backup/ (jours + notes)
```

Pas de tests, pas de build step, pas de linter configuré. Pour tester manuellement les routes API en local :
```bash
curl http://localhost:3000/api/days
curl -X POST http://localhost:3000/api/days/2026-07-04 -H "Content-Type: application/json" -d '{"type":"full"}'
curl -X DELETE http://localhost:3000/api/days/2026-07-04
```

## Git

Branche principale : `main`. Les features se font sur des branches `feature/xxx`.

Process idéal (solo dev, branches locales) :

```bash
# 1. Créer la branche feature à jour
git checkout main
git pull origin main
git checkout -b feature/nom-feature

# 2. Travailler et commiter (autant de fois que nécessaire, 100% local)
git add <fichiers>
git commit -m "message"

# 3. (Optionnel) Pousser la branche feature sur GitHub — sauvegarde/visibilité,
#    pas obligatoire avant de merger
git push origin feature/nom-feature

# 4. Une fois la feature terminée : merger dans main en local
git checkout main
git pull origin main               # re-vérifier que main n'a pas bougé
git merge feature/nom-feature

# 5. Pousser main sur GitHub
git push origin main

# 6. Nettoyage (optionnel)
git branch -d feature/nom-feature
git push origin --delete feature/nom-feature   # si la branche avait été poussée
```

Point clé : le merge se fait toujours en local d'abord ; c'est seulement le résultat (sur `main`) qu'on pousse ensuite sur GitHub.

## Architecture

Application Node.js/Express qui sert un calendrier de garde partagé pour deux enfants (Philippine & Pablo). Plage navigable : novembre 2024 → aujourd'hui + 2 ans (dynamique). MongoDB Atlas est la source de vérité unique — pas de localStorage, pas de données codées en dur côté client.

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
- **Clic sur cellule vide** → `openCustodyModal()` : modale de choix du type de garde
- **Clic sur cellule avec garde** → rien (protection contre suppression accidentelle)
- **Bouton ✏️ (top-right, à gauche de 📝)** → `openCustodyModal()` : modifier ou supprimer la garde (désélectionner le type + Enregistrer = supprime)
- **Bouton 📝 (top-right)** → `openNoteModal()` : ajouter/modifier/supprimer la note uniquement

Les notes et les jours de garde sont **indépendants** : on peut avoir l'un sans l'autre.

Rendu visuel par type géré par les classes CSS `.type-evening`, `.type-day`, `.type-full` sur `.day-cell`. La bande bleue foncée (20% hauteur) est un pseudo-élément `::after`.

La légende et les boutons de la modale utilisent des mini-blocs CSS (`.legend-swatch`) qui reproduisent visuellement l'apparence des cellules.

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
