# Florentina Inn

Hotel reservation system for `https://florentinainn.site`.

- `client/` — Next.js frontend (standalone build)
- `server/` — Express + TypeScript backend
- `docker-compose.prod.yml` — `backend` + `frontend` services (compose project `florentina-inn`)
- `docker-compose.edge.yml` — joins `backend`/`frontend` to the shared proxy network `inkofbaphomet_edge` as `florentina-backend` / `florentina-frontend`
- `docker-compose.mongo.yml` — dedicated Florentina MongoDB (`florentina-mongo`, internal network only)
- `deploy/mongo/init/` — creates the app DB user; runs only when the Mongo volume is empty
- `deploy/nginx/florentina-inn.conf` — reference copy of the live proxy config (see below)

## Production architecture

```
Internet ─▶ Cloudflare/DNS ─▶ inkofbaphomet-nginx-1 (:80/:443, owned by /root/finalproject)
                                   │  snippets/florentina-inn.conf (florentinainn.site, TLS)
                                   ├── /backend/*  ─▶ florentina-backend:5001  (prefix stripped)
                                   └── /*          ─▶ florentina-frontend:3000
                                        (network: inkofbaphomet_edge)

florentina-inn-backend-1 ─▶ florentina-mongo:27017/florentinaInn  (network: florentina-inn_internal)
                                   volume: florentina-inn_mongo-data
```

Florentina Inn does **not** run its own reverse proxy and never binds ports 80/443. The shared nginx container,
its certificates (`/root/finalproject/certbot`) and its config (`/root/finalproject/nginx/`) belong to the
Ink of Baphomet project and also serve the BIMS site. Do not start, stop, or recreate them when deploying
Florentina. The live Florentina server blocks are in
`/root/finalproject/nginx/snippets/florentina-inn.conf`; `deploy/nginx/florentina-inn.conf` is a copy kept for reference.

Secrets live in `.env.production` (not committed; see `.env.production.example`).

## Redeploying

Run everything from the project directory. Define the compose shortcut once per shell:

```bash
cd /root/florentinainn-V2
DC="docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.edge.yml -f docker-compose.mongo.yml"
```

Always pass all three files, and always name the services (`backend frontend`) with `--no-deps` when
starting them. That keeps MongoDB running untouched during app deploys.

### 1. Back up the database (before every deploy)

```bash
mkdir -p backups && chmod 700 backups
F=backups/florentina-$(date -u +%Y%m%dT%H%M%SZ).archive.gz
docker exec florentina-inn-mongo-1 sh -c 'mongodump --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db florentinaInn --gzip --archive' > "$F" \
  && chmod 600 "$F" && gzip -t "$F" && ls -lh "$F"
```

### 2. Deploy code changes

```bash
git pull --ff-only
$DC config --quiet
docker tag florentina-backend:latest florentina-backend:previous
docker tag florentina-frontend:latest florentina-frontend:previous
$DC build backend frontend
$DC up -d --no-deps backend frontend
$DC ps
```

Both containers should show `(healthy)` within about a minute.

### 3. Full rebuild (Dockerfile, dependency, or frontend build-time variable changes)

`NEXT_PUBLIC_*` values are baked into the frontend bundle at build time (from `PUBLIC_URL` and `HOTEL_TIMEZONE`
in `.env.production`). After changing those, a `Dockerfile`, or `package*.json`, rebuild without cache:

```bash
$DC build --pull --no-cache backend frontend
$DC up -d --no-deps backend frontend
```

Runtime-only `.env.production` changes (API keys, `JWT_SECRET`, email settings) need no rebuild:

```bash
$DC up -d --no-deps backend frontend
```

### 4. Verify

```bash
$DC ps
$DC logs --tail=20 backend                       # expect "Connected to MongoDB"
curl -sS -o /dev/null -w '%{http_code}\n' https://florentinainn.site/                # 200
curl -sS -o /dev/null -w '%{http_code}\n' https://florentinainn.site/backend/health  # 200
docker ps --format 'table {{.Names}}\t{{.Status}}'  # other apps still healthy
```

### Rollback

```bash
docker tag florentina-backend:previous florentina-backend:latest
docker tag florentina-frontend:previous florentina-frontend:latest
$DC up -d --no-deps backend frontend
```

## Logs

```bash
$DC logs -f --tail=100 backend frontend
$DC logs --tail=100 mongo
docker logs --tail=100 inkofbaphomet-nginx-1 2>&1 | grep florentinainn   # proxy side (read-only)
```

## Stop / start / restart

```bash
$DC restart backend frontend           # restart the app
$DC stop backend frontend              # stop the app (site shows 502 from the shared proxy; DB keeps running)
$DC up -d --no-deps backend frontend   # start it again
$DC restart mongo                      # restart only the Florentina database (brief app DB outage)
```

## Never do this

- `$DC down -v`, `docker volume rm florentina-inn_*`, `docker volume prune`, or `docker system prune --volumes`. These delete the database.
- `docker compose down` / `up` / `restart` in `/root/finalproject` or the BIMS project to "fix" Florentina.
- Running a plain `$DC up -d` without service names. It may recreate the Mongo container; the data volume survives, but it causes a needless database restart.
- Adding an nginx/certbot service or host ports 80/443 to these compose files.

## Restore a backup

Restore into a throwaway container first to inspect it:

```bash
docker run -d --rm --name florentina-restore-test --network none mongo:7
docker exec -i florentina-restore-test mongorestore --gzip --archive < backups/<file>.archive.gz
docker exec florentina-restore-test mongosh --quiet florentinaInn --eval 'db.getCollectionNames().forEach(c=>print(c, db[c].countDocuments()))'
docker stop florentina-restore-test
```

To replace live data (destructive, so take a fresh backup first):

```bash
docker exec -i florentina-inn-mongo-1 sh -c 'mongorestore -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --gzip --archive --drop --nsInclude "florentinaInn.*"' < backups/<file>.archive.gz
```
