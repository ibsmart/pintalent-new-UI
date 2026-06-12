# Architecture Technique

## Stack

| Couche | Technologie | Version | Rôle |
|--------|-------------|---------|------|
| Framework | Next.js | 16.2.9 | App Router, SSR, API Routes |
| Language | TypeScript | 5.x | Typage statique |
| Style | Tailwind CSS | v4 | `@import "tailwindcss"` (pas v3) |
| Base de données | SQLite (better-sqlite3) | 9.x | Fichier local `data/recruitment.db` |
| IA | Claude Haiku | claude-haiku-4-5-20251001 | Scoring CV, génération fiches |
| PDF | pdf-parse | **1.1.1** (pas v2) | Extraction texte PDF texte |
| DOCX | mammoth | latest | Extraction texte Word |
| Excel | xlsx | 0.18.5 | Lecture fichiers Excel import |
| Auth | jose | latest | JWT (prévu, non utilisé en UI) |
| IDs | uuid | latest | Génération identifiants uniques |

> **Important** : `pdf-parse` doit être en version `1.1.1`. La v2 a une API différente (classe) qui casse l'extraction.

---

## Structure des fichiers

```
recruitment-app/
├── app/
│   ├── page.tsx                    # Landing page publique (offres + filtres)
│   ├── jobs/[id]/page.tsx          # Détail offre + formulaire candidature
│   ├── hr/
│   │   ├── layout.tsx              # Sidebar navigation CRM
│   │   ├── dashboard/page.tsx      # KPIs + stats
│   │   ├── pipeline/page.tsx       # Kanban drag & drop (7 étapes)
│   │   ├── candidates/page.tsx     # Liste candidats avec filtres
│   │   ├── candidates/[id]/page.tsx # Détail candidat + score + notes
│   │   └── jobs/page.tsx           # Gestion offres + import
│   └── api/
│       ├── jobs/route.ts           # GET (liste) + POST (créer)
│       ├── jobs/[id]/route.ts      # GET + PATCH + DELETE
│       ├── jobs/import/route.ts    # POST — import Excel/Word + génération IA
│       ├── applications/route.ts   # GET (liste) + POST (soumettre candidature)
│       ├── applications/[id]/route.ts # GET + PATCH (étape) + DELETE
│       ├── rescore/route.ts        # POST — rescorer les CVs existants
│       ├── cv/[id]/route.ts        # GET — télécharger CV par candidate_id
│       ├── notes/route.ts          # POST — ajouter note
│       ├── dashboard/route.ts      # GET — statistiques agrégées
│       └── auth/route.ts           # POST (login) + DELETE (logout)
├── lib/
│   ├── db.ts                       # SQLite init, migration, seed 23 postes
│   └── auth.ts                     # JWT avec jose
├── data/
│   └── recruitment.db              # Fichier SQLite (créé automatiquement)
├── uploads/                        # CVs uploadés (UUID.pdf/docx)
├── next.config.ts                  # serverExternalPackages
└── .env.local                      # ANTHROPIC_API_KEY + JWT_SECRET
```

---

## Base de données SQLite

### Configuration
```typescript
// lib/db.ts
_db.pragma('journal_mode = WAL');   // Lectures simultanées sans blocage
_db.pragma('synchronous = NORMAL'); // Performance optimale
_db.pragma('busy_timeout = 5000');  // Attend 5s avant erreur si verrouillé
_db.pragma('foreign_keys = ON');    // Intégrité référentielle
```

### Schéma

```sql
-- Offres d'emploi
jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT 'IT',
  location TEXT NOT NULL DEFAULT 'Casablanca',
  contract_type TEXT NOT NULL DEFAULT 'CDI',
  description TEXT NOT NULL,
  missions TEXT,
  profile TEXT,
  keywords TEXT,
  experience TEXT,
  education TEXT,
  status TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'inactive'
  created_at TEXT,
  updated_at TEXT
)

-- Candidats (profil unique par email)
candidates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  linkedin TEXT,
  cv_filename TEXT,    -- nom original du fichier
  cv_path TEXT,        -- chemin absolu dans uploads/
  created_at TEXT,
  updated_at TEXT
)

-- Candidatures (lien candidat ↔ poste)
applications (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  cover_letter TEXT,
  pipeline_stage TEXT DEFAULT 'Nouveau',
  score INTEGER DEFAULT 0,           -- 0-100 (Claude)
  score_summary TEXT,                -- synthèse matching
  strengths TEXT,                    -- points forts
  gaps TEXT,                         -- lacunes
  recommendation TEXT,               -- 'À retenir' | 'À évaluer' | 'À écarter'
  created_at TEXT,
  updated_at TEXT
)

-- Historique pipeline
pipeline_history (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  changed_at TEXT
)

-- Notes RH
notes (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT
)

-- Utilisateurs (auth prévu)
users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'hr'
)
```

### Pipeline (7 étapes)
```
Nouveau → Présélectionné → Entretien RH → Test Technique → Entretien Final → Offre → Embauché
                                                                              ↘ Refusé
```

---

## Scoring CV — Fonctionnement

1. Candidat soumet le formulaire avec CV (PDF ou DOCX)
2. **Extraction texte** : `pdf-parse` pour PDF, `mammoth` pour DOCX
3. **PDF scanné** (texte < 100 chars) → envoi du PDF en base64 à Claude (vision)
4. **Appel Claude Haiku** : CV + fiche de poste → JSON structuré
5. **Résultat synchrone** : score visible immédiatement après soumission

```typescript
// Réponse Claude :
{
  score: 82,                    // 0-100
  strengths: "...",             // points forts
  gaps: "...",                  // lacunes
  summary: "...",               // synthèse matching
  recommendation: "À retenir"  // À retenir | À évaluer | À écarter
}
// Barème : score ≥75 → À retenir, 45-74 → À évaluer, <45 → À écarter
```

---

## Import d'offres — Fonctionnement

### Excel
- Colonne obligatoire : `titre` (ou `title`, `poste`, `intitulé`)
- Colonnes optionnelles : `département`, `contrat`, `expérience`, `formation`, `description`, `missions`, `profil`, `mots-clés`
- Les en-têtes sont normalisés (accents, casse, caractères spéciaux tolérés)

### Word
- Extraction des titres de postes via Claude si document complexe
- Sinon heuristique sur les lignes courtes sans ponctuation de fin

### Génération IA (commun Excel + Word)
- Un seul appel Claude Haiku pour tous les postes détectés (batch)
- Génère : department, location, contract_type, experience, education, description, missions, profile, keywords
- Preview éditable avant sauvegarde — le client peut modifier chaque fiche

---

## Variables d'environnement

```env
# .env.local
ANTHROPIC_API_KEY=sk-ant-api03-...   # Obligatoire pour scoring + génération
JWT_SECRET=...                        # Pour auth future
```

---

## next.config.ts

```typescript
serverExternalPackages: ['better-sqlite3', 'pdf-parse', 'mammoth', 'xlsx']
```
Ces packages utilisent des binaires natifs Node.js et ne peuvent pas être bundlés par Webpack.
