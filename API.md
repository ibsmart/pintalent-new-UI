# Référence API

Base URL : `http://localhost:3000/api`

---

## Offres d'emploi

### `GET /api/jobs`
Liste des offres avec compteurs de candidatures.

**Paramètres query :**
| Param | Type | Description |
|-------|------|-------------|
| `status` | `active` \| `inactive` \| `all` | Défaut: `active` |
| `department` | string | Filtrer par département |
| `contract` | string | Filtrer par type contrat |
| `q` | string | Recherche texte (titre, description, département) |

**Réponse :**
```json
[{
  "id": "uuid",
  "title": "Chef de Projet Data",
  "department": "Data & BI",
  "location": "Casablanca",
  "contract_type": "CDI",
  "experience": "5-8 ans",
  "education": "Bac+5",
  "description": "...",
  "missions": "...",
  "profile": "...",
  "keywords": "Python, SQL, ...",
  "status": "active",
  "application_count": 12,
  "avg_score": 74,
  "created_at": "2024-01-01T00:00:00.000Z"
}]
```

---

### `POST /api/jobs`
Créer une nouvelle offre. Seul `title` est obligatoire.

**Body JSON :**
```json
{
  "title": "Développeur Full Stack",
  "department": "Digital",
  "location": "Casablanca",
  "contract_type": "CDI",
  "experience": "3-5 ans",
  "education": "Bac+5",
  "description": "...",
  "missions": "...",
  "profile": "...",
  "keywords": "React, Node.js",
  "status": "active"
}
```

---

### `GET /api/jobs/[id]`
Détail complet d'une offre.

---

### `PATCH /api/jobs/[id]`
Modifier un ou plusieurs champs d'une offre.

---

### `DELETE /api/jobs/[id]`
Supprimer une offre.

---

### `POST /api/jobs/import`
Import et génération IA d'offres depuis un fichier.

**Mode parsing (défaut) :**
```
Content-Type: multipart/form-data
Body: file=<fichier .xlsx/.xls/.docx/.doc>
```
Réponse :
```json
{
  "jobs": [...],    // fiches générées
  "count": 5,
  "capped": false   // true si > 30 postes (limité aux 30 premiers)
}
```

**Mode sauvegarde :**
```
POST /api/jobs/import?mode=save
Content-Type: application/json
Body: { "jobs": [...] }
```
Réponse :
```json
{ "inserted": 5 }
```

---

## Candidatures

### `GET /api/applications`
Liste des candidatures avec infos candidat et poste.

**Paramètres query :**
| Param | Type | Description |
|-------|------|-------------|
| `job_id` | uuid | Filtrer par offre |
| `stage` | string | Filtrer par étape pipeline |
| `min_score` | number | Score minimum |
| `sort` | `score` \| `created_at` \| `updated_at` | Tri |
| `order` | `ASC` \| `DESC` | Ordre |

---

### `POST /api/applications`
Soumettre une candidature avec CV.

**Body : `multipart/form-data`**
| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `name` | ✅ | Nom complet |
| `email` | ✅ | Email |
| `job_id` | ✅ | UUID de l'offre |
| `phone` | — | Téléphone |
| `linkedin` | — | URL LinkedIn |
| `cv` | — | Fichier PDF ou DOCX |
| `cover_letter` | — | Lettre de motivation |

**Réponse (201) :**
```json
{
  "id": "uuid",
  "success": true,
  "score": 82,
  "recommendation": "À retenir",
  "summary": "Candidat très qualifié pour ce poste..."
}
```
> Le scoring est **synchrone** — la réponse contient le score final.

---

### `GET /api/applications/[id]`
Détail d'une candidature avec historique pipeline et notes.

---

### `PATCH /api/applications/[id]`
Modifier l'étape pipeline (enregistre dans l'historique).

```json
{ "pipeline_stage": "Entretien RH" }
```

---

### `DELETE /api/applications/[id]`
Supprimer une candidature.

---

## Rescoring

### `POST /api/rescore`
Rescorer les candidatures avec score = 0 ou sans analyse.

**Body JSON (optionnel) :**
```json
{ "app_id": "uuid" }   // omis = toutes les candidatures non scorées
```

**Réponse :**
```json
{
  "scored": 2,
  "total": 2,
  "errors": []
}
```

---

## CV

### `GET /api/cv/[candidate_id]`
Télécharger le CV d'un candidat (retourne le fichier).

---

## Notes

### `POST /api/notes`
Ajouter une note RH sur une candidature.

```json
{
  "application_id": "uuid",
  "content": "Très bon profil technique, à convoquer rapidement."
}
```

---

## Dashboard

### `GET /api/dashboard`
Statistiques agrégées pour le dashboard.

**Réponse :**
```json
{
  "totalJobs": 23,
  "totalApplications": 145,
  "avgScore": 68,
  "byStage": [
    { "pipeline_stage": "Nouveau", "count": 45 },
    { "pipeline_stage": "Présélectionné", "count": 32 }
  ],
  "byJob": [
    { "id": "uuid", "title": "Chef de Projet Data", "count": 12, "avg_score": 74 }
  ]
}
```

---

## Auth (prévu)

### `POST /api/auth`
Login — retourne un cookie httpOnly JWT.

```json
{ "email": "hr@geekfact.com", "password": "..." }
```

### `DELETE /api/auth`
Logout — supprime le cookie.

---

## Étapes pipeline valides

```
Nouveau
Présélectionné
Entretien RH
Test Technique
Entretien Final
Offre
Embauché
Refusé
```
