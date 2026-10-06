# Florentina Inn — Production Deployment (Docker + Ubuntu VPS)

## Architecture

```
Browser ──HTTPS──▶ nginx (host, :80/:443, Let's Encrypt)
                     ├── /            ─▶ 127.0.0.1:3000 ─▶ frontend container (Next.js standalone, incl. /api/paymongo, /api/stripe)
                     └── /backend/*   ─▶ 127.0.0.1:5001 ─▶ backend container (Express, prefix /backend stripped)
frontend container ──http://backend:5001 (Docker network)──▶ backend container
backend container  ──mongodb+srv──▶ MongoDB Atlas (external, unchanged)
```

- The backend is served under `/backend/` and **not** `/api/`, because Next.js already owns `/api/paymongo` and `/api/stripe`.
- Frontend and API share one origin (`https://florentinainn.site`), so there is one certificate and no cross-site CORS.
- Containers publish ports **only on 127.0.0.1**, so they are reachable from nginx but not from the Internet.
- MongoDB stays on Atlas. There is no database container, no database volume, and nothing in Docker that can delete data.
- Realtime notifications use Server-Sent Events at `/backend/system/notifications/stream`. They are not WebSockets. nginx streams them unbuffered and leaves query strings out of the logs, so JWTs are never written there.

## Files

| File | Purpose |
|---|---|
| `docker-compose.prod.yml` | Production stack (backend + frontend) |
| `.env.production.example` | Template for `.env.production` (never commit the real one) |
| `hotel-rental-backend-main/Dockerfile`, `.dockerignore` | Multi-stage TypeScript build that runs as a non-root user |
| `hotel-rental-frontend-main/Dockerfile`, `.dockerignore` | Multi-stage Next.js standalone build that runs as a non-root user |
| `deploy/nginx/florentina-inn.bootstrap.conf` | HTTP-only config used until the first certificate exists |
| `deploy/nginx/florentina-inn.conf` | Final HTTPS config |
| `deploy/scripts/deploy.sh` | Backup → pull → build → recreate → health check |
| `deploy/scripts/rollback.sh` | Switch back to the previous images |
| `deploy/scripts/backup-mongo.sh` | `mongodump` of Atlas into `./backups` |
| `deploy/scripts/restore-mongo.sh` | Restore into a **new** database by default |

## Environment variables (`/var/www/florentinainn/.env.production`)

| Variable | Used by | Public? | Notes |
|---|---|---|---|
| `PUBLIC_URL` | frontend build + backend | Public | `https://florentinainn.site`, no trailing slash. Becomes `NEXT_PUBLIC_BASE_URL_LIVE`, `NEXT_PUBLIC_BACKEND_URL_LIVE` (`PUBLIC_URL/backend`), backend `FRONTEND_URL` and the CORS origin |
| `HOTEL_TIMEZONE` | both | Public | Also baked in as `NEXT_PUBLIC_HOTEL_TIMEZONE` |
| `CORS_ORIGINS` | backend | Public | Optional extra comma-separated origins |
| `FRONTEND_HOST_PORT`, `BACKEND_HOST_PORT` | compose | n/a | Loopback ports nginx proxies to (defaults 3000 / 5001) |
| `MONGODB_URI` | backend, backup scripts | **Secret** | Atlas connection string |
| `MONGODB_DATABASE` | backup/restore scripts | n/a | `florentinaInn` |
| `JWT_SECRET` | backend | **Secret** | At least 32 chars: `openssl rand -hex 48` |
| `PAYMONGO_SECRET_KEY` | backend + frontend server | **Secret** | Used by the Next.js server route `/api/paymongo` and backend verification. Never in the browser bundle |
| `STRIPE_SECRET_KEY` | backend + frontend server | **Secret** | Same as above for Stripe |
| `BREVO_API_KEY` | backend | **Secret** | Email |
| `EMAIL_SENDER_NAME`, `EMAIL_SENDER_ADDRESS`, `EMAIL_SANDBOX`, `HOTEL_ADMIN_EMAIL` | backend | Private | Sender must be verified in Brevo |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | backend | **Secret** | Image uploads |
| `GEMINI_API_KEY` | backend | **Secret** | Chatbot / forecasts |

Only `NEXT_PUBLIC_*` values are embedded in the browser bundle: the base URL, the backend URL and the timezone. All three are safe to expose. They are fixed at **build time**, so after changing `PUBLIC_URL` or `HOTEL_TIMEZONE` you must rebuild the frontend.

Do not create a `NEXT_PUBLIC_PAYMONGO` variable. A secret key under a `NEXT_PUBLIC_` name gets shipped to every visitor's browser.

---

## First deployment (fresh Ubuntu VPS, Docker already installed)

### 1. SSH into the VPS
```bash
ssh YOUR_USER@YOUR_VPS_IP
docker --version && docker compose version
```
If `docker ps` needs `sudo`, either prefix Docker commands with `sudo` or run `sudo usermod -aG docker $USER`, then log out and back in.

### 2. Clone the repository
Frontend and backend are both in one repository.
```bash
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www
cd /var/www
git clone -b main https://github.com/Z3phyy/florentinainn-V2.git florentinainn
cd /var/www/florentinainn
```
If the repository is private, use a GitHub deploy key (SSH URL) or a fine-grained personal access token.

### 3. Allow the VPS in MongoDB Atlas
Atlas → **Network Access** → **Add IP Address** → enter the VPS public IP (`curl -4 ifconfig.me`).

### 4. Create the production env file
```bash
cd /var/www/florentinainn
cp .env.production.example .env.production
openssl rand -hex 48
nano .env.production
chmod 600 .env.production
```
Fill in every value. Paste the `openssl` output as `JWT_SECRET`. Use a **new** secret, not the one previously committed as `.jwt-secret`.

### 5. Build the images
```bash
cd /var/www/florentinainn
docker compose --env-file .env.production -f docker-compose.prod.yml build
```

### 6. Start the application
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

Optional shortcut for the rest of this guide:
```bash
echo "alias dc='docker compose --env-file /var/www/florentinainn/.env.production -f /var/www/florentinainn/docker-compose.prod.yml'" >> ~/.bashrc
source ~/.bashrc
```

### 7. Verify the containers
```bash
dc ps
dc logs --tail=100 backend
dc logs --tail=100 frontend
```
What to look for:
- Both services show `Up ... (healthy)`. Allow about 30–60 seconds.
- Backend log contains `Connected to MongoDB`.
- If the backend keeps restarting with `MongoDB connection failed`, the Atlas IP allowlist or `MONGODB_URI` is wrong.
- `PORTS` show `127.0.0.1:3000->3000` and `127.0.0.1:5001->5001`, not `0.0.0.0`.

### 8. Test frontend and backend locally on the VPS
```bash
curl -I http://127.0.0.1:3000/
curl http://127.0.0.1:5001/health
```
Expected: `HTTP/1.1 200 OK` and `{"status":"ok","database":"connected"}`.

### 9. Install and configure nginx (HTTP first)
```bash
sudo apt update
sudo apt install -y nginx certbot
sudo mkdir -p /var/www/certbot
sudo cp /var/www/florentinainn/deploy/nginx/florentina-inn.bootstrap.conf /etc/nginx/sites-available/florentina-inn
sudo ln -sf /etc/nginx/sites-available/florentina-inn /etc/nginx/sites-enabled/florentina-inn
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```
The configs already use `florentinainn.site`. If you changed `FRONTEND_HOST_PORT`/`BACKEND_HOST_PORT`, update the two `upstream` blocks to match.

### 10. Firewall
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```
Only 22, 80 and 443 should be open. The containers bind to 127.0.0.1, so Docker's iptables rules don't open them to the Internet.

### 11. DNS
At your DNS provider:
- `A` record: name `@` → VPS IPv4.
- `AAAA` record → VPS IPv6, **only** if the VPS has working IPv6.
- Only `florentinainn.site` is configured. To also serve `www.florentinainn.site`, add a `www` record, add it to both `server_name` lines and add `-d www.florentinainn.site` to certbot.

Check propagation and HTTP access:
```bash
dig +short florentinainn.site
curl -I http://florentinainn.site/
```

### 12. HTTPS with Let's Encrypt
```bash
sudo certbot certonly --webroot -w /var/www/certbot -d florentinainn.site --email YOUR_EMAIL --agree-tos --no-eff-email --deploy-hook "systemctl reload nginx"
sudo cp /var/www/florentinainn/deploy/nginx/florentina-inn.conf /etc/nginx/sites-available/florentina-inn
sudo nginx -t
sudo systemctl reload nginx
sudo certbot renew --dry-run
```
Renewal runs automatically through the `certbot.timer` systemd timer and reloads nginx after each renewal.

### 13. Final verification
```bash
curl -I http://florentinainn.site/
curl -I https://florentinainn.site/
curl https://florentinainn.site/backend/health
```
Expected: a 301 redirect to https, then 200, then `{"status":"ok","database":"connected"}`.

In the browser (DevTools → Network/Console open):
- [ ] Home page and room pages load over HTTPS without mixed-content warnings.
- [ ] API calls go to `https://florentinainn.site/backend/...` with no CORS errors.
- [ ] Admin/staff login (password + access code) works; refresh keeps you logged in.
- [ ] Admin dashboard data loads (proves MongoDB works).
- [ ] Notifications: one request to `/backend/system/notifications/stream` stays open (EventSource). Create a booking in another browser and the bell updates.
- [ ] Guest reservation → PayMongo checkout opens → after paying (test card / GCash test), you return to `https://florentinainn.site/guest/clientPayment?...` and the booking becomes confirmed.
- [ ] Confirmation / voucher email arrives (Admin → Settings → Email diagnostics), and its link points to `https://florentinainn.site/...`.
- [ ] Room image upload works (Cloudinary).
- [ ] Admin → Settings → Backup: create a backup; download/restore works. Upload limit is 512 MB.
- [ ] Chatbot answers (Gemini).
- [ ] `curl -s -H "Origin: https://evil.example" https://florentinainn.site/backend/room` returns `{"error":"Not allowed by CORS"}`.

PayMongo and Stripe need **no webhook URL**. The app verifies payment by calling the PayMongo/Stripe API when the guest returns to `/guest/clientPayment`. When you switch to live keys, only the env values change.

---

## Future deployments

After pushing to the branch the VPS tracks:
```bash
cd /var/www/florentinainn
./deploy/scripts/deploy.sh
```
The script:
1. Validates `docker-compose.prod.yml` + `.env.production`.
2. Backs up MongoDB to `./backups/`. Skip this with `SKIP_BACKUP=1`.
3. Runs `git pull --ff-only`. It refuses to merge or overwrite local edits.
4. Tags the currently running images as `:previous`.
5. Builds new images while the old containers keep serving traffic.
6. Runs `up -d`, which recreates only the containers whose image or config changed. Expect a few seconds of downtime per container.
7. Waits until both containers are healthy; if not, prints logs and the rollback command.

Manual equivalent:
```bash
cd /var/www/florentinainn
./deploy/scripts/backup-mongo.sh
git pull --ff-only
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f --tail=100
```

`build` then `up -d` versus `up -d --build`: both build before any container is stopped, so downtime is the same. Separate steps let you stop after a failed build, or inspect images, before touching the running containers. `up -d` alone (no build) would **not** pick up new code, because the images would be stale.

Env-only change (e.g. rotating an API key):
```bash
nano .env.production
dc up -d
```
If you changed `PUBLIC_URL` or `HOTEL_TIMEZONE`, run `dc build frontend && dc up -d` because those are baked into the frontend bundle.

### Rollback
Images (fastest; returns to the images from before the last `deploy.sh`):
```bash
./deploy/scripts/rollback.sh
```
Code (any earlier commit):
```bash
git log --oneline -10
git checkout <GOOD_COMMIT_SHA>
SKIP_PULL=1 ./deploy/scripts/deploy.sh
```
Once the fix is pushed, run `git checkout main` and deploy normally.

Schema changes: the backend runs small idempotent migrations at startup, such as field renames. Rolling back code does not undo them. If a release changes data in an incompatible way, restore from the pre-deploy backup that `deploy.sh` took.

---

## MongoDB safety

- The database is on **MongoDB Atlas**. The Compose stack has no Mongo container and no volumes, so `docker compose down`, rebuilds, `docker system prune`, container recreation and VPS reboots cannot touch data.
- Do not run `docker compose down -v` or `docker volume prune` as a habit anyway. They aren't needed here.
- Do not point a test or staging stack at the production `MONGODB_URI`.
- On the free M0 Atlas tier, Atlas has **no automated backups**, so the script below is your backup. M10+ clusters can enable Atlas Cloud Backup as well.
- The admin panel's built-in backup stores its files in GridFS inside the same database, so it does not replace an external backup.

## Backup and restore

Backup now (writes `backups/florentina-<UTC timestamp>.archive.gz`, checks the gzip integrity, keeps the newest 30 files; change the count with `BACKUP_KEEP=60`):
```bash
cd /var/www/florentinainn
./deploy/scripts/backup-mongo.sh
ls -lh backups/
gzip -t backups/florentina-*.archive.gz && echo OK
```

Daily automatic backup at 03:00 server time:
```bash
crontab -e
```
```
0 3 * * * /var/www/florentinainn/deploy/scripts/backup-mongo.sh >> /var/www/florentinainn/backups/backup.log 2>&1
```
Copy backups off the server too, for example:
```bash
scp YOUR_USER@YOUR_VPS_IP:/var/www/florentinainn/backups/florentina-*.archive.gz ./
```

Restore into a **separate** database (default; the live data is not touched):
```bash
./deploy/scripts/restore-mongo.sh backups/florentina-20261006T030000Z.archive.gz
```
This creates `florentinaInn_restore_<timestamp>`, which you can inspect in Atlas or Compass. The Atlas user needs permission to create that database (e.g. "Read and write to any database").

Replace the **live** database (disaster recovery only). You must type the database name to confirm. The script then takes a fresh safety backup, stops the app, drops and restores each collection from the archive, and starts the app again:
```bash
./deploy/scripts/restore-mongo.sh backups/florentina-20261006T030000Z.archive.gz --replace-live
```

---

## Troubleshooting

```bash
dc ps
dc logs -f --tail=200 backend
dc logs -f --tail=200 frontend
dc restart backend
dc restart frontend
dc up -d --force-recreate backend
docker inspect --format '{{json .State.Health}}' florentina-inn-backend-1
docker inspect --format '{{json .State.Health}}' florentina-inn-frontend-1
curl -s http://127.0.0.1:5001/health
curl -sI http://127.0.0.1:3000/
sudo ss -tulpn | grep -E ':80|:443|:3000|:5001|:22'
sudo nginx -t
sudo systemctl status nginx
sudo tail -f /var/log/nginx/florentina-inn.error.log
sudo tail -f /var/log/nginx/florentina-inn.access.log
docker network ls
docker network inspect florentina-inn_internal
dc exec frontend node -e "fetch('http://backend:5001/health').then(r=>r.text()).then(console.log)"
docker run --rm -e MONGODB_URI="$(grep ^MONGODB_URI= .env.production | cut -d= -f2-)" mongo:8 sh -c 'mongosh "$MONGODB_URI" --quiet --eval "db.runCommand({ping:1})"'
df -h
docker system df
docker image prune -f
sudo certbot certificates
```

| Symptom | Likely cause |
|---|---|
| Backend restarting, `MongoDB connection failed` | VPS IP not in Atlas Network Access, or wrong `MONGODB_URI` |
| Browser `Not allowed by CORS` | `PUBLIC_URL` doesn't exactly match the browser origin (scheme/host/www) |
| Frontend calls the wrong API host | `PUBLIC_URL` changed without rebuilding the frontend |
| 413 on upload | Larger than the nginx limits (20 MB on the site, 520 MB under `/backend/`) |
| 502 from nginx | Container down or unhealthy, or upstream ports don't match `*_HOST_PORT` |
| Everyone logged out after deploy | `JWT_SECRET` changed or is shorter than 32 characters |

## Security notes

- Public ports: 22, 80, 443 only. Containers bind to 127.0.0.1; there is no database port at all.
- Containers run as the non-root `node` user, with all Linux capabilities dropped, `no-new-privileges`, and log rotation (5×10 MB).
- `.env`, `.env.production`, `.jwt-secret` and `backups/` are gitignored and excluded from images. Only dev dependencies needed for the build are in build stages; runtime images contain production files only. Browser source maps are not generated.
- `JWT_SECRET` is mandatory in production; Compose refuses to start without it.
- Existing rate limits (login, OTP, payments, AI, reviews, tracking) see the real client IP: Express `trust proxy` = 1 behind nginx, and the Next.js payment routes forward the client IP to the backend.
- `POST /backend/system/admin` allows creating the first super admin while none exists. On a brand-new empty database, create the super admin immediately after the first deploy.
