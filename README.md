# GEEKFACT — Plateforme de Recrutement

Application complète de recrutement : landing page publique + CRM RH back-office.

## Démarrage rapide

```bash
npm install
cp .env.local.example .env.local   # puis renseigner ANTHROPIC_API_KEY
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000) — landing page candidats  
Ouvrir [http://localhost:3000/hr/dashboard](http://localhost:3000/hr/dashboard) — CRM RH

## Documentation

| Fichier | Contenu |
|---------|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Stack technique, structure des fichiers, base de données |
| [FEATURES.md](./FEATURES.md) | Toutes les fonctionnalités détaillées |
| [API.md](./API.md) | Référence de toutes les routes API |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Installation en production, packages Lite vs Entreprise |

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS v4)
- **SQLite** via `better-sqlite3` — fichier `data/recruitment.db`
- **Claude Haiku** (`claude-haiku-4-5-20251001`) — scoring CV + génération de fiches
- **pdf-parse v1** + **mammoth** — extraction texte PDF/DOCX
