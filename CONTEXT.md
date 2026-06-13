# Pintalent — Contexte Projet

## Description
Plateforme de recrutement intelligente pour GEEKFACT. Application Next.js 16 avec IA (Anthropic Claude) pour le scoring de CV, matching candidat/offre et génération de fiches de poste.

## Stack technique
- **Framework** : Next.js 16 App Router (Turbopack)
- **Language** : TypeScript
- **Style** : Tailwind CSS v4
- **DB** : SQLite via `better-sqlite3` (fichier : `data/recruitment.db`)
- **Auth** : JWT dans cookie HTTP-only (`SESSION_COOKIE`)
- **Email** : Nodemailer (SMTP privateemail.com — `app@pintalent.io`)
- **IA** : Anthropic Claude (`claude-haiku-4-5-20251001`)
- **i18n** : next-intl, locales FR/EN, routing `/fr/` et `/en/`
- **Déploiement** : PM2 sur Ubuntu (`/var/www/pintalent`), `pm2 restart pintalent`

## Architecture i18n
- Routes : `app/[locale]/hr/...` et `app/[locale]/jobs/...`
- Proxy : `proxy.ts` (middleware Next.js 16) — gère locale redirect + auth JWT
- Messages : `messages/fr.json` et `messages/en.json`
- Config : `i18n/routing.ts` et `i18n/request.ts`
- Provider : `app/[locale]/layout.tsx` → `NextIntlClientProvider locale={locale} messages={messages}`
- Switcher : `components/LanguageSwitcher.tsx` (window.location.href pour hard redirect)

## Structure des dossiers clés
```
app/
  [locale]/
    layout.tsx          ← NextIntlClientProvider
    page.tsx            ← Page publique carrières
    hr/
      layout.tsx        ← Sidebar dark (groupes nav, SVG icons, badges, LanguageSwitcher)
      dashboard/
      jobs/
      candidates/
      pipeline/
      projects/
      prospecting/
      settings/
      team/
      job-boards/
      email-settings/
      ai-agent/
      cv-templates/
      login/
    jobs/[id]/          ← Page candidature publique
  api/
    applications/       ← Candidatures (POST public déclenche notification email)
    candidates/
    jobs/
      generate/         ← Génération IA fiche de poste
    matching/
    prospecting/send/
    settings/smtp/test/
    ...
lib/
  db.ts                 ← getDb(), schéma SQLite, migrations
  email.ts              ← sendEmail(), renderTemplate()
  auth.ts               ← JWT, getSession(), SESSION_COOKIE
messages/
  fr.json               ← Toutes les traductions FR
  en.json               ← Toutes les traductions EN
```

## Fonctionnalités principales
- **Candidatures publiques** : page carrière `/fr/jobs/[id]`, upload CV, scoring IA automatique
- **Notification email** : email au créateur de l'offre quand candidature reçue (fallback → admin)
- **Matching IA** : candidat ↔ offres (multi-select + rattachement multiple)
- **Scoring CV** : Claude Haiku analyse CV vs fiche de poste → score/100 + recommandation
- **Génération fiche de poste** : bouton ✨ dans le form → génère description/missions/profil/keywords
- **Pipeline Kanban** : drag & drop entre étapes
- **Prospection email** : envoi campagnes email aux candidats
- **AI Agent** : gestion automations/webhooks
- **CV Templates** : génération DOCX/PDF
- **Équipe** : rôles (admin/rh/manager/viewer) avec permissions granulaires

## Bugs corrigés importants
- `created_by` sur table `jobs` → notification au bon recruteur
- Fix écrasement score lors du rerun matching (cherche l'app par job_id, pas app.id courant)
- LanguageSwitcher : `window.location.href` obligatoire (router.push insuffisant)
- `NextIntlClientProvider` doit recevoir `locale={locale}` ET `messages={messages}`
- `getMessages({ locale })` avec le locale explicite (pas de middleware next-intl)

## Comptes utilisateurs
- **Admin** : `i.bellamine@geekfact.ma` (ISMAIL BELLAMINE)
- Autres : Marie Dupon (rh), Marie Du (rh), Test Majda (rh), Omar X (manager)

## SMTP
- Host : `mail.privateemail.com`, port 465, secure: true
- User : `app@pintalent.io`
- From name : company_name depuis settings DB (= "Pintalent" actuellement)

## Déploiement serveur
```bash
# Depuis la machine locale
git add -A && git commit -m "..." && git push

# Sur le serveur Ubuntu
cd /var/www/pintalent
git stash          # si db-shm/db-wal modifiés
git pull
npm install
npm run build
pm2 restart pintalent
```

## Roadmap (tasks)
1. **FTS5** — Index full-text SQLite pour recherche candidats (> 5 000 candidats)
2. **SaaS multi-tenant** — isolation par client, subscriptions
3. **On-Premise** — Docker Compose, script install
4. **Super Admin** — gestion multi-clients
5. **Calendrier équipe** — planning recruteurs, synchro Google/Outlook
6. **Gestion entretiens** — planification, invitations, grille évaluation
