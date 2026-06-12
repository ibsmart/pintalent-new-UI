# Fonctionnalités

## Landing Page (public)

### Page d'accueil `GET /`
- Hero section avec branding GEEKFACT
- Grille des offres actives
- Filtres : département, type de contrat, recherche texte libre
- Compteur d'offres en temps réel

### Page détail offre `GET /jobs/[id]`
- Description complète du poste (contexte, missions, profil, compétences)
- Formulaire de candidature inline (sidebar collapsible)
- Champs : nom, email, téléphone, LinkedIn, CV (PDF/DOCX), lettre de motivation
- Validation côté client avant envoi
- **Score visible immédiatement** après soumission :
  - Score 0-100 avec barre de progression colorée
  - Recommandation : À retenir / À évaluer / À écarter
  - Synthèse du matching
- Bouton "⏳ Analyse de votre CV en cours..." pendant le traitement

---

## CRM RH (back-office `/hr/*`)

> Accès anonyme — pas d'authentification requise

### Dashboard `GET /hr/dashboard`
- KPIs : postes actifs, total candidatures, score moyen, embauché(e)s
- Vue pipeline (répartition par étape)
- Stats par poste (candidatures + score moyen)
- Dernières candidatures reçues

### Pipeline Kanban `GET /hr/pipeline`
- 7 colonnes : Nouveau, Présélectionné, Entretien RH, Test Technique, Entretien Final, Offre, Embauché
- Cartes candidats avec score, poste, date
- **Drag & drop natif** (HTML5 dataTransfer, pas de bibliothèque externe)
- Boutons de déplacement rapide sur chaque carte
- Historique automatique à chaque changement d'étape

### Liste candidats `GET /hr/candidates`
- Tableau avec filtres : poste, étape pipeline, score minimum
- Tri : par score ou par date
- Recherche : nom ou email
- Score coloré (vert/jaune/rouge)

### Détail candidat `GET /hr/candidates/[id]`
- Informations de contact complètes
- Téléchargement du CV
- **Scoring IA** :
  - Barre de score visuelle 0-100
  - Points forts (strengths)
  - Lacunes (gaps)
  - Recommandation colorée
- Sélecteur d'étape pipeline
- Historique des changements d'étape avec dates
- Zone notes RH (ajout + liste chronologique)

### Gestion des offres `GET /hr/jobs`
- Tableau de toutes les offres (actives + inactives)
- Recherche par titre ou département
- Toggle actif/inactif par offre
- Création / modification via formulaire modal
  - Seul le titre est obligatoire
  - Tous les autres champs sont optionnels
- Suppression avec confirmation
- **Import fichier** (Excel ou Word) :
  - Drag & drop ou sélection fichier
  - L'IA génère automatiquement toutes les fiches depuis les titres
  - Preview éditable avant import (bouton ✏️ par ligne)
  - Import en un clic

---

## Scoring CV — Détail

### Extraction texte
| Format | Méthode |
|--------|---------|
| PDF texte | `pdf-parse v1.1.1` |
| PDF scanné (image) | Claude Vision (base64) |
| DOCX / DOC | `mammoth` |

### Appel IA
- Modèle : `claude-haiku-4-5-20251001`
- Input : texte CV (4000 chars max) + fiche de poste complète
- Output JSON : score, strengths, gaps, summary, recommendation
- Barème : techniques 35%, expérience 30%, formation 20%, sectoriel 15%
- Traitement **synchrone** — le candidat voit son score immédiatement

### Rescoring
- Endpoint `POST /api/rescore` pour rescorer les candidatures existantes
- Paramètre optionnel `app_id` pour rescorer une seule candidature
- Traite automatiquement toutes les candidatures avec score = 0

---

## Import d'offres — Détail

### Flux complet
1. Upload fichier Excel ou Word
2. Extraction des titres (+ données existantes si dispo)
3. Génération batch par Claude Haiku (1 seul appel pour tous les postes)
4. Preview éditable : tableau avec bouton modifier par ligne
5. Confirmation → insertion en base

### Excel — colonnes reconnues
| Champ | Noms acceptés |
|-------|--------------|
| Titre | titre, title, intitulé, poste |
| Département | département, department, service, direction, pôle |
| Localisation | localisation, location, lieu, ville |
| Contrat | contrat, contract_type, type_contrat |
| Expérience | expérience, experience, exp |
| Formation | formation, education, diplôme |
| Description | description, contexte, présentation |
| Missions | missions, responsabilités, activités |
| Profil | profil, profile, compétences |
| Mots-clés | mots-clés, keywords, skills, tags |

> Les en-têtes sont normalisés (accents ignorés, casse ignorée, tirets/espaces → underscore)

### Limites
- Maximum 30 postes par import (évite les timeouts Claude)
- Fichiers acceptés : `.xlsx`, `.xls`, `.docx`, `.doc`

---

## Données seedées au démarrage

23 postes GEEKFACT pré-chargés couvrant les départements :
Data & BI, Digital, Innovation, Opérations Bancaires, Monétique, Crédits, Risques & Conformité, Produits Bancaires, Marchés Financiers, Finance, Commercial, Paiements, Ressources Humaines, IT & Support
