# Guide de Déploiement

## Packages commerciaux

### Package Lite
- Jusqu'à **10 000 candidatures**
- Jusqu'à **100 candidats simultanés**
- Installation en **3 commandes**
- Base de données : SQLite
- Idéal pour : PME, cabinets RH, banques régionales

### Package Entreprise
- Candidatures **illimitées**
- Candidats simultanés **illimitées**
- Base de données : PostgreSQL
- Multi-tenant, SSO/LDAP, API REST, White-label
- Idéal pour : grands groupes, multi-sites

---

## Installation Package Lite (on-premise)

### Prérequis
- Node.js 18+
- 2 Go RAM minimum
- 10 Go disque (pour les CVs uploadés)

### Étapes

**1. Cloner et installer**
```bash
git clone <repo> geekfact-rh
cd geekfact-rh
npm install
```

**2. Configuration**
```bash
cp .env.local.example .env.local
```

Éditer `.env.local` :
```env
ANTHROPIC_API_KEY=sk-ant-api03-...   # Clé API fournie au client
JWT_SECRET=changez-ce-secret-en-production
```

**3. Build et démarrage**
```bash
npm run build
npm start
```

L'application est disponible sur `http://localhost:3000`

---

## Mise en production complète (Lite)

### Avec PM2 (process manager)

```bash
npm install -g pm2

# Démarrer
pm2 start npm --name "geekfact-rh" -- start

# Démarrage automatique au reboot
pm2 save
pm2 startup

# Commandes utiles
pm2 status                    # état
pm2 logs geekfact-rh          # logs en temps réel
pm2 restart geekfact-rh       # redémarrer
```

### Avec Nginx (reverse proxy HTTPS)

```nginx
server {
    listen 80;
    server_name rh.votre-client.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name rh.votre-client.com;

    ssl_certificate     /etc/letsencrypt/live/rh.votre-client.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rh.votre-client.com/privkey.pem;

    # Augmenter la limite pour upload de CVs
    client_max_body_size 20M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        # Timeout élevé pour le scoring IA (~5-10 secondes)
        proxy_read_timeout 60s;
    }
}
```

Certificat SSL gratuit avec Let's Encrypt :
```bash
certbot --nginx -d rh.votre-client.com
```

---

## Mise à jour

```bash
git pull
npm install
npm run build
pm2 restart geekfact-rh
```

---

## Backup

### Backup manuel
```bash
cp data/recruitment.db data/backup-$(date +%Y%m%d).db
cp -r uploads/ backup-uploads-$(date +%Y%m%d)/
```

### Backup automatique (cron)
```bash
crontab -e
```
Ajouter :
```
0 2 * * * cp /opt/geekfact-rh/data/recruitment.db /backup/recruitment-$(date +\%Y\%m\%d).db
0 2 * * * cp -r /opt/geekfact-rh/uploads/ /backup/uploads-$(date +\%Y\%m\%d)/
```

### Restauration
```bash
pm2 stop geekfact-rh
cp backup/recruitment-20240101.db data/recruitment.db
pm2 start geekfact-rh
```

---

## Variables d'environnement

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `ANTHROPIC_API_KEY` | ✅ | Clé API Anthropic pour Claude Haiku |
| `JWT_SECRET` | — | Secret JWT (auth future) |

> La clé Anthropic est à la charge du client. Tarif Claude Haiku : ~$0.00025 par scoring CV (très faible coût).

---

## Coûts opérationnels estimés (Lite)

| Poste | Coût |
|-------|------|
| Serveur VPS (2 vCPU, 4 Go RAM) | ~15-30 €/mois |
| Nom de domaine | ~10 €/an |
| Certificat SSL | Gratuit (Let's Encrypt) |
| Claude Haiku (1000 CVs/mois) | ~0.25 € |
| **Total** | **~20-35 €/mois** |

---

## Performance (Package Lite)

SQLite avec WAL mode configuré :
```typescript
_db.pragma('journal_mode = WAL');    // Lectures simultanées
_db.pragma('synchronous = NORMAL'); // Performance optimale
_db.pragma('busy_timeout = 5000');  // Absorbe les pics (attend 5s)
```

| Métrique | Valeur |
|----------|--------|
| Lectures simultanées | Illimitées |
| Écritures simultanées | ~100/minute sans erreur |
| Candidatures stockées | Jusqu'à 10 millions (SQLite) |
| Taille DB (10 000 candidatures) | ~50-100 Mo |
| Taille uploads (10 000 CVs) | ~5-20 Go |

---

## Roadmap Package Entreprise

```
Aujourd'hui     → Package Lite (SQLite, prêt)
+1 mois         → Queue async (scoring non-bloquant)
+3 mois         → PostgreSQL optionnel (DATABASE_URL dans .env)
+6 mois         → Multi-tenant + API REST complète
+9 mois         → SSO/LDAP, webhooks SIRH, white-label
```

### Migration SQLite → PostgreSQL
Quand `DATABASE_URL` est défini dans `.env`, l'app bascule automatiquement sur PostgreSQL :
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/geekfact_rh
```
Les requêtes SQL sont standard et compatibles sans modification.
