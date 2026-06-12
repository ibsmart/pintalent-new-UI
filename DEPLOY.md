# Guide de déploiement — Pintalent

> Stack : Next.js 16 · Node.js 20 · SQLite · PM2 · Nginx · Let's Encrypt

---

## Prérequis

- Serveur Ubuntu 22.04 / 24.04 (recommandé)
- Accès SSH root ou sudo
- Un nom de domaine pointant vers l'IP du serveur
- Clé API Anthropic (`sk-ant-...`)

---

## Étape 1 — Mise à jour du serveur

```bash
sudo apt update && sudo apt upgrade -y
```

---

## Étape 2 — Installer Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # doit afficher v20.x
npm -v
```

---

## Étape 3 — Installer PM2

```bash
sudo npm install -g pm2
```

---

## Étape 4 — Cloner le repo

```bash
cd /var/www
sudo git clone https://github.com/ibsmart/pintalent-new-UI.git pintalent
sudo chown -R $USER:$USER /var/www/pintalent
cd /var/www/pintalent
```

---

## Étape 5 — Variables d'environnement

```bash
nano /var/www/pintalent/.env.local
```

Colle et adapte :

```env
JWT_SECRET=un_secret_long_et_aleatoire_min_32_chars
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_SITE_URL=https://ton-sous-domaine.pintalent.io
```

`Ctrl+X` → `Y` → `Entrée` pour sauvegarder.

---

## Étape 6 — Créer les dossiers persistants

```bash
mkdir -p /var/www/pintalent/data
mkdir -p /var/www/pintalent/uploads
```

---

## Étape 7 — (Optionnel) Copier les données depuis un autre serveur

### Depuis un PC Windows :
```bash
scp "C:\chemin\vers\data\recruitment.db" user@IP:/var/www/pintalent/data/
scp -r "C:\chemin\vers\uploads" user@IP:/var/www/pintalent/
```

### Depuis un autre serveur Linux :
```bash
scp user@ANCIEN_IP:/var/www/pintalent/data/recruitment.db /var/www/pintalent/data/
scp -r user@ANCIEN_IP:/var/www/pintalent/uploads /var/www/pintalent/
```

> Si tu ne copies pas de DB, l'app crée automatiquement une base vide au 1er démarrage.

---

## Étape 8 — Installer les dépendances & builder

```bash
cd /var/www/pintalent
npm install
npm run build
```

> ⚠️ Si le build échoue, vérifier les logs d'erreur et consulter la section **Dépannage** en bas.

---

## Étape 9 — Lancer avec PM2

```bash
pm2 start npm --name "pintalent" -- start
pm2 save
pm2 startup
```

> Copie-colle la commande affichée par `pm2 startup` (du type `sudo env PATH=...`) et exécute-la pour que l'app redémarre automatiquement après un reboot.

### Vérifier que ça tourne :
```bash
pm2 status
pm2 logs pintalent --lines 30
```

L'app est accessible sur `http://IP_SERVEUR:3000`

---

## Étape 10 — Nginx (reverse proxy)

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/pintalent
```

Colle (remplace `ton-domaine.com`) :

```nginx
server {
    listen 80;
    server_name ton-domaine.com;

    # Increase upload size for CVs
    client_max_body_size 20M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/pintalent /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Étape 11 — HTTPS avec Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ton-domaine.com
```

Certbot configure le HTTPS automatiquement et renouvelle le certificat tous les 90 jours.

---

## Étape 12 — DNS

Dans ton registrar (Namecheap, Cloudflare, etc.), ajoute un enregistrement **A** :

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A | `sous-domaine` | `IP_SERVEUR` | Automatic |

Exemple pour `geekfact.pintalent.io` : Host = `geekfact`, Value = `141.94.x.x`

---

## Récapitulatif commandes rapides

```bash
# Démarrer
pm2 start npm --name "pintalent" -- start

# Arrêter
pm2 stop pintalent

# Redémarrer
pm2 restart pintalent

# Voir les logs
pm2 logs pintalent --lines 50

# Mise à jour depuis GitHub
cd /var/www/pintalent && git pull && npm install && npm run build && pm2 restart pintalent
```

---

## Mise à jour du code

À chaque nouvelle version :

```bash
cd /var/www/pintalent
git pull
npm install        # si package.json a changé
npm run build
pm2 restart pintalent
```

---

## Configuration SMTP (après déploiement)

Se connecter à l'interface RH → **Paramètres** → **Email** et renseigner :

| Champ | Valeur |
|-------|--------|
| Hôte SMTP | `mail.privateemail.com` |
| Port | `465` |
| SSL | `Activé` |
| Utilisateur | `app@pintalent.io` |
| Mot de passe | *(voir gestionnaire de mots de passe)* |
| Nom expéditeur | `Pintalent` |
| Email expéditeur | `app@pintalent.io` |

> ⚠️ Le SPF DNS de `pintalent.io` doit inclure `include:spf.privateemail.com`

---

## Dépannage

### Build échoue — erreur TypeScript
```bash
npx tsc --noEmit   # voir toutes les erreurs d'un coup
```

### L'app ne démarre pas
```bash
pm2 logs pintalent --lines 100
```

### Erreur ENOENT prerender-manifest.json
```bash
pm2 stop pintalent && pm2 delete pintalent
npm run build
pm2 start npm --name "pintalent" -- start
```

### Login ne redirige pas
- Vérifier que HTTPS est actif (le cookie `hr_session` requiert HTTPS en prod)
- Vérifier `JWT_SECRET` dans `.env.local`

### Uploads de CV échouent
```bash
ls -la /var/www/pintalent/uploads/
sudo chown -R $USER:$USER /var/www/pintalent/uploads/
```

### Nginx — taille des fichiers uploadés
Ajouter dans le bloc `server {}` de la config Nginx :
```nginx
client_max_body_size 20M;
```
Puis : `sudo systemctl reload nginx`

---

## Infos importantes

| Élément | Emplacement |
|---------|-------------|
| Base de données | `/var/www/pintalent/data/recruitment.db` |
| CVs uploadés | `/var/www/pintalent/uploads/` |
| Variables d'env | `/var/www/pintalent/.env.local` |
| Logs PM2 | `~/.pm2/logs/` |
| Config Nginx | `/etc/nginx/sites-available/pintalent` |

> 💡 **Sauvegardes** : pense à sauvegarder régulièrement `data/recruitment.db` et `uploads/` — c'est toute la donnée de l'application.
