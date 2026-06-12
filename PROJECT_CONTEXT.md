# Pintalent — Project Context
> Généré le 2026-06-12 · Session de travail Claude

---

## 🏗️ Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Langage | TypeScript |
| Style | Tailwind CSS v4 |
| Base de données | SQLite via `better-sqlite3` |
| Auth | JWT (cookie `hr_token`) |
| Email | Nodemailer + SMTP privateemail.com |
| Export CV | PDFKit (PDF), `docx` lib (DOCX) |
| IA/Scoring | Claude API (Anthropic) |
| Déploiement | Serveur Linux (à configurer) |

---

## 📁 Structure projet

```
recruitment-app/
├── app/
│   ├── api/                    # API Routes Next.js
│   │   ├── auth/               # login, logout, me
│   │   ├── candidates/         # CRUD candidats + extract
│   │   ├── applications/       # CRUD candidatures
│   │   ├── jobs/               # CRUD offres
│   │   ├── cv-templates/       # Templates CV + generate (PDF/DOCX)
│   │   ├── settings/smtp/      # Config SMTP + test
│   │   ├── prospecting/        # send, preview, applications
│   │   ├── matching/           # Scoring IA candidat↔offres
│   │   └── ...
│   ├── hr/                     # Interface RH (protégée JWT)
│   │   ├── dashboard/
│   │   ├── candidates/         # Liste + fiche candidat
│   │   ├── jobs/
│   │   ├── pipeline/
│   │   ├── projects/           # Campagnes
│   │   ├── cv-templates/       # Création/édition templates CV
│   │   ├── prospecting/        # ✨ NOUVEAU — envoi emails ciblés
│   │   ├── email-settings/     # Config SMTP
│   │   ├── settings/
│   │   └── team/
│   ├── jobs/[id]/              # Page publique offre d'emploi
│   └── login/
├── lib/
│   ├── db.ts                   # SQLite init + migrations
│   ├── email.ts                # sendEmail() via nodemailer
│   ├── auth.ts                 # JWT helpers
│   └── permissions-context.tsx
├── proxy.ts                    # Next.js 16 middleware (ancien: middleware.ts)
├── data/recruitment.db         # Base SQLite
├── uploads/                    # CVs uploadés
├── DESIGN_SYSTEM.md            # ✨ Design system complet
└── PROJECT_CONTEXT.md          # Ce fichier
```

---

## 🎨 Design System (résumé)

- **Couleur brand** : Vert Pintalent `#10b981` (emerald-500) — remplace l'ancien rouge
- **CTA/boutons** : `emerald-600` (#059669) / hover `emerald-700`
- **Coins** : `rounded-xl` boutons/inputs, `rounded-2xl` cards
- **Nom produit** : **Pintalent** (jamais "Claude" dans l'UI)
- Voir `DESIGN_SYSTEM.md` pour les composants complets

---

## ✅ Chantiers réalisés

### 1. Export CV — DOCX uniquement
- PDF retiré de la popup export (trop de bugs PDFKit avec les pages blanches)
- DOCX fonctionne avec logo (ImageRun, aligné à droite sur la ligne du nom)
- Logo configurable : `logo_width` (défaut 130px) et `logo_height` (défaut 46px) dans le template
- Colonnes `logo_width`, `logo_height` ajoutées à la table `cv_templates`

### 2. Next.js 16 — Middleware → Proxy
- `middleware.ts` renommé `proxy.ts`
- Export renommé de `middleware` à `proxy`
- Corrige le warning de dépréciation Next.js 16

### 3. Template CV — Formulaire redesigné (`app/hr/cv-templates/_form.tsx`)
- 6 palettes couleurs prédéfinies (Océan, Émeraude, Ardoise, Bordeaux, Violet, Charbon)
- Preview SVG mini des layouts avec les couleurs en temps réel
- Upload logo avec zone drag-and-drop, preview, dimensions configurables
- Sections comme pill/chips toggleables
- Anonymisation comme boutons pleine largeur
- ColorPicker : swatch + label + hex input dans une card

### 4. Red → Emerald (17 fichiers UI)
- Tous les `red-N` remplacés par `emerald-N` dans l'interface RH
- Fichiers concernés : candidates, jobs, pipeline, projects, cv-templates, dashboard, layout, login, email-settings, job-boards, settings, team, jobs publics

### 5. Claude → Pintalent (3 fichiers)
- `candidates/page.tsx` : 3 occurrences
- `candidates/[id]/page.tsx` : 1 occurrence
- `jobs/page.tsx` : 2 occurrences

### 6. SMTP Email — Fix délivrabilité Gmail
- **Problème** : SPF `pintalent.io` n'incluait pas `spf.privateemail.com`
- **Fix DNS** : ajout `include:spf.privateemail.com` dans le TXT SPF
- Config SMTP : `mail.privateemail.com`, port 465, SSL, `app@pintalent.io`
- Emails maintenant livrés correctement dans Gmail

### 7. Prospection (`/hr/prospecting`) — ✨ NOUVEAU
**Page complète de prospection email** :
- Liste candidats avec recherche, checkboxes, filtre par statut pipeline
- 4 filtres : Tous / Sans contact / En cours / Rejetés
- Toggle "Exclure automatiquement" les candidats déjà en pipeline actif
- Sélection des offres actives à inclure dans l'email (avec nb de candidats en pipeline)
- Expérience candidat (`years_experience`) et expérience requise offre (`experience`) affichées
- Compositeur d'email : objet personnalisable (`{{candidat.nom}}`), intro libre
- Récapitulatif avant envoi (nb destinataires / offres / déjà en pipeline)
- Aperçu HTML dans iframe avant envoi
- **Email HTML pro** : header dégradé vert, cartes offres avec badges CDI/CDD, boutons "Postuler →", footer
- Envoi personnalisé par candidat via SMTP
- Nouveau dans la sidebar : ✉️ Prospection
- APIs : `POST /api/prospecting/send`, `POST /api/prospecting/preview`, `GET /api/prospecting/applications`

### 8. UI — Remplacement des alert() natifs
- `app/hr/candidates/page.tsx` : tous les `alert()` et `confirm()` remplacés
- **Toast** : notification bas d'écran centrée, 3 styles (❌ erreur, ⚠️ warning, ✅ succès), auto-dismiss 5s
- **Modal de confirmation** : modal propre avec fond flouté pour les suppressions
- Animation `slideUp` ajoutée dans `globals.css`

---

## 🗄️ Schéma DB (tables principales)

| Table | Colonnes notables |
|-------|-------------------|
| `candidates` | id, name, email, phone, linkedin, cv_path, current_title, years_experience, contract_preference, current_salary, desired_salary, tjm |
| `jobs` | id, title, department, location, contract_type, description, missions, profile, keywords, experience, status, campaign_id |
| `applications` | id, candidate_id, job_id, pipeline_stage, score, score_summary, recommendation |
| `cv_templates` | id, name, primary_color, secondary_color, accent_color, font_style, logo_base64, **logo_width**, **logo_height**, sections, anonymize_name, anonymize_contact |
| `settings` | key/value — smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_name, smtp_from_email, smtp_secure |
| `email_templates` | id, name, subject, body, variables (JSON) |
| `automations` | trigger sur pipeline_stage → envoi email |

---

## 📧 SMTP — Config actuelle

```
Host     : mail.privateemail.com
Port     : 465 (SSL)
User     : app@pintalent.io
Secure   : true
SPF DNS  : v=spf1 include:sendgrid.net include:spf.mtasv.net include:spf.privateemail.com -all
DMARC    : p=reject (strict)
DKIM     : configuré ✅
```

---

## 🚧 Chantiers à venir

### Phase 1 — Déploiement serveur
- [ ] Setup serveur Linux (PM2 / Docker)
- [ ] Variables d'environnement (JWT_SECRET, ANTHROPIC_API_KEY, etc.)
- [ ] Persistance SQLite sur volume
- [ ] Reverse proxy Nginx
- [ ] HTTPS / certificat SSL

### Phase 2 — SaaS vs On-premise
**Deux packages envisagés :**

**On-premise** (solution actuelle) :
- Déployée sur le serveur du client
- Accès complet au code
- Pas de frais récurrents d'hébergement
- Mises à jour manuelles

**SaaS** :
- Multi-tenant : chaque client = schéma DB isolé (ou DB séparée)
- Authentification par organisation (`org_id` sur toutes les tables)
- Facturation récurrente (Stripe)
- Dashboard admin global
- Mises à jour automatiques

**Architecture SaaS envisagée :**
- Table `organizations` (id, name, plan, created_at)
- Middleware qui lit `org_id` depuis le JWT et scope toutes les requêtes DB
- Isolation : soit un SQLite par org (simple), soit PostgreSQL multi-tenant

### Phase 3 — Fonctionnalités futures
- [ ] PDF export — résoudre définitivement les bugs PDFKit (ou migrer vers Puppeteer)
- [ ] Templates email visuels (éditeur drag-and-drop)
- [ ] Tableau de bord prospection (suivi des emails envoyés, taux d'ouverture)
- [ ] Intégration LinkedIn Scraping
- [ ] API publique pour intégrations tierces

---

## 🔑 Variables d'environnement requises

```env
JWT_SECRET=<secret_fort>
ANTHROPIC_API_KEY=<clé_claude>
NEXT_PUBLIC_SITE_URL=https://app.pintalent.io   # pour les liens offres dans les emails
```

---

## 📌 Points d'attention

1. **DB SQLite** : chemin `./data/recruitment.db` — doit être sur un volume persistant en prod
2. **Uploads** : dossier `./uploads/` — idem, volume persistant
3. **proxy.ts** : doit exporter une fonction nommée `proxy` (pas `middleware`) — Next.js 16
4. **NEXT_PUBLIC_SITE_URL** : non encore configuré — les liens dans les emails prospection utilisent `req.headers.origin` en fallback (OK en dev, à configurer en prod)
5. **Logo DOCX** : stocké en base64 dans `cv_templates.logo_base64` — attention taille DB si gros logos
