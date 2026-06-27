# 🚀 AI-Ops Sentinel — Deployment & Testing Guide

---

## 🏗️ Architecture at a Glance

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         PRODUCTION STACK                            │
│                                                                     │
│  ┌──────────────────┐        ┌──────────────────────────────────┐   │
│  │  Next.js 15      │ HTTPS  │  Express / Central Brain         │   │
│  │  (Vercel or      │──────▶│  (EC2 / Docker, port 4000)        │   │
│  │   Docker :3000)  │  JWT   │                                  │   │
│  │                  │◀──────│  ├── PostgreSQL (pg)              │   │
│  │  NextAuth v5     │ WS/IO  │  ├── Redis (metrics/cache)       │   │
│  │  httpOnly cookie │        │  ├── Kafka consumer              │   │
│  └──────────────────┘        │  ├── Gemini AI + Pinecone (RAG)  │   │
│                              │  └── Socket.IO gateway           │   │
│  ┌──────────────────┐        └──────────────┬───────────────────┘   │
│  │  Log Collector   │──── raw-logs ────────▶│  Kafka topic          │   │
│  │  (file tailer)   │        topic          └───────────────────────┘   │
│  └──────────────────┘                                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 💻 Part 1 — Local Development (Start Here)

> [!TIP]
> Run the full stack locally before deploying to the cloud. This confirms every layer works end-to-end.

### 🛠️ Step 1 — Prerequisites

| Tool | Minimum Version | How to check |
| :--- | :--- | :--- |
| **Node.js** | `v20` | `node -v` |
| **Docker Desktop** | `any` | `docker -v` |
| **npm** | `v10` | `npm -v` |

> [!IMPORTANT]
> **External Accounts Needed** (free tiers are sufficient):
> - **Google AI Studio** → [aistudio.google.com](https://aistudio.google.com) — get a `GEMINI_API_KEY`
> - **Pinecone** → [app.pinecone.io](https://app.pinecone.io) — create an index named `aiops-incidents` (1024 dimensions, cosine metric), get a `PINECONE_API_KEY`

### 🐳 Step 2 — Start Infrastructure

This starts **Kafka**, **Redis**, and **PostgreSQL**.

```bash
cd aiops-sentinel-backend
docker compose up -d
```

> [!NOTE]
> Wait ~30 seconds for Kafka to initialise. Verify all four containers are healthy:
> ```bash
> docker compose ps
> # zookeeper   → healthy
> # kafka       → healthy
> # redis       → healthy
> # postgres    → healthy
> ```

### ⚙️ Step 3 — Configure Central Brain

```bash
cd services/central-brain
cp .env.example .env
```

Open `.env` and fill in:

```env
GEMINI_API_KEY=your-key-from-google-ai-studio
PINECONE_API_KEY=your-pinecone-api-key

# Leave these as-is for local dev
DATABASE_URL=postgresql://aiops:aiops_secret@localhost:5432/aiops_sentinel
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=localhost:9092
USE_KAFKA=true
MOCK_AI=false          # set true if you don't have API keys yet

# Already set — do not change
JWT_SECRET=jJa2d5pARRTTkscYZSk+AXN+1B6HBe8TGVRuEsZ5ezzvX0DBLmbHP5htK24wA5bM
CORS_ORIGIN=http://localhost:3000
```

### 🌱 Step 4 — Run Database Migrations and Seed

```bash
# Still in services/central-brain
npm install
npm run seed
```

This creates all tables and inserts test data:

| Email | Password | Role |
| :--- | :--- | :--- |
| `arjun.dev@aiops-sentinel.io` | `SentinelSRE@2026` | SRE Lead |
| `priya.ops@aiops-sentinel.io` | `SentinelSRE@2026` | DevOps Engineer |
| `rahul.plat@aiops-sentinel.io` | `SentinelSRE@2026` | Platform Engineer |

### 🧠 Step 5 — Start Central Brain

```bash
npm run dev
```

Look for these lines to confirm a clean start:

```text
[Server] AI-Ops Sentinel Central Brain → http://localhost:4000
[KafkaAdmin] Topic "raw-logs" already exists
[KafkaConsumer] Subscribed to topic "raw-logs"
[Database] PostgreSQL connected via pg
```

### 🖥️ Step 6 — Configure and Start the Frontend

```bash
cd aiops-sentinel-frontend
# .env.local is already pre-configured from our setup — no changes needed
npm install
npm run dev
```

Open `http://localhost:3000` — the login page should appear immediately.

### 🎢 Step 7 — Drive the Full Log → Anomaly → UI Pipeline

> [!TIP]
> **Option A — File-based pipeline** (tests the real file-tail path end-to-end):
> ```bash
> # Terminal 1: write realistic log lines to sample.log
> cd services/log-collector
> npm run write:logs
> 
> # Terminal 2: tail sample.log and send each line to Kafka
> npm run dev
> ```

> [!TIP]
> **Option B — Direct Kafka pipeline** (faster, skips the file step):
> ```bash
> cd services/log-generator
> npm run dev
> ```

Within 30 seconds, incidents should appear live on the Dashboard.

---

## ☁️ Part 2 — Production Deployment

### 🌟 Option A: Vercel (Frontend) + EC2 (Backend) — Recommended

Vercel handles the Next.js frontend globally. EC2 runs the stateful backend services in Docker.

#### 🌐 2A.1 — Deploy Frontend to Vercel

1. **Push your code to GitHub.**
2. **Import the project at [vercel.com/new](https://vercel.com/new)**
   - Root directory: `aiops-sentinel-frontend`
   - Framework preset: Next.js (auto-detected)
3. **Add these environment variables in Vercel → Settings → Environment Variables:**

| Variable | Value |
| :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://your-ec2-domain.com` |
| `NEXT_PUBLIC_SOCKET_URL` | `https://your-ec2-domain.com` |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` |
| `NEXTAUTH_SECRET` | Output of: `openssl rand -base64 32` |

4. **Deploy.** Vercel rebuilds on every push to `main` automatically.

#### 🖥️ 2A.2 — Deploy Backend to EC2

**Step 1 — Provision EC2**

- Instance type: `t3.medium` (2 vCPU, 4 GB RAM)
- OS: Amazon Linux 2023 or Ubuntu 22.04
- Security group inbound rules:

| Port | Protocol | Source | Purpose |
| :--- | :--- | :--- | :--- |
| `22` | TCP | Your IP only | SSH Access |
| `80` | TCP | 0.0.0.0/0 | HTTP Traffic |
| `443` | TCP | 0.0.0.0/0 | HTTPS Traffic |
| `4000` | TCP | 0.0.0.0/0 | API / Socket.IO |

**Step 2 — Install Docker**

```bash
# Amazon Linux 2023
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
newgrp docker

# Ubuntu 22.04
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

**Step 3 — Install Docker Compose**

```bash
sudo curl -L \
  "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker-compose --version
```

**Step 4 — Copy the backend to EC2**

```bash
# From your local machine
scp -r aiops-sentinel-backend/ ec2-user@YOUR_EC2_IP:~/aiops-sentinel-backend
# Or clone from GitHub on the server directly
```

**Step 5 — Create the production `.env` on EC2**

```bash
cd ~/aiops-sentinel-backend
cp .env.example .env
nano .env
```

Fill in every value (no placeholders):

```env
GEMINI_API_KEY=your-real-gemini-key
GEMINI_MODEL=gemini-2.5-flash

PINECONE_API_KEY=your-real-pinecone-key
PINECONE_INDEX_NAME=aiops-incidents

JWT_SECRET=<run: openssl rand -base64 48>

POSTGRES_PASSWORD=<strong-random-password — never use the default>
POSTGRES_USER=aiops
POSTGRES_DB=aiops_sentinel

CORS_ORIGIN=https://your-app.vercel.app

LOG_VOLUME_PATH=/var/log/aiops
```

**Step 6 — Build and launch all services**

```bash
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

This starts: Zookeeper, Kafka, Redis, PostgreSQL, Log Collector, and Central Brain.

**Step 7 — Run database seed inside the container**

```bash
docker exec -it aiops-central-brain npm run seed
```

**Step 8 — Set up NGINX + SSL (recommended)**

```bash
sudo apt install -y nginx certbot python3-certbot-nginx   # Ubuntu
# or
sudo dnf install -y nginx certbot python3-certbot-nginx   # Amazon Linux
```

Create `/etc/nginx/sites-available/aiops`:

```nginx
server {
    listen 80;
    server_name your-ec2-domain.com;

    location / {
        proxy_pass         http://localhost:4000;
        proxy_http_version 1.1;

        # Required for Socket.IO WebSocket upgrade
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host            $host;
        proxy_set_header X-Real-IP       $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/aiops /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your-ec2-domain.com   # free SSL certificate
```

---

### 📦 Option B: Full Docker Self-Hosted (Frontend + Backend Together)

Use this when you want everything on one server (e.g., a single VPS).

**Step 1 — Add the frontend service to `docker-compose.prod.yml`**

Insert this before the `volumes:` section at the bottom of the file:

```yaml
  frontend:
    build:
      context: ../aiops-sentinel-frontend
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ${CORS_ORIGIN}
        NEXT_PUBLIC_SOCKET_URL: ${CORS_ORIGIN}
    image: aiops/frontend:latest
    container_name: aiops-frontend
    restart: unless-stopped
    depends_on:
      - central-brain
    ports:
      - "3000:3000"
    environment:
      NEXTAUTH_URL: ${NEXTAUTH_URL:?set NEXTAUTH_URL}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:?set NEXTAUTH_SECRET}
```

**Step 2 — Add the extra vars to your root `.env`**

```env
NEXTAUTH_URL=https://your-server-ip-or-domain:3000
NEXTAUTH_SECRET=<output of: openssl rand -base64 32>
```

**Step 3 — Build and launch**

```bash
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
docker exec -it aiops-central-brain npm run seed
```

---

## 🧪 Part 3 — Testing the Deployment

Run each check in order. Each one validates a deeper layer of the stack.

### 🩺 Check 1 — Backend Health

```bash
curl https://your-ec2-domain.com/health
```

**Expected:**
```json
{"status":"ok","timestamp":"2026-06-27T10:00:00.000Z"}
```

> [!WARNING]
> **If it fails:** The container isn't running or NGINX isn't proxying.
> ```bash
> docker logs aiops-central-brain --tail 50
> ```

### 🗄️ Check 2 — Database

```bash
curl https://your-ec2-domain.com/api/incidents
```

**Expected:** A JSON array (empty `[]` is fine; a `500` means the DB connection failed).

> [!WARNING]
> **If it fails:**
> ```bash
> docker exec -it aiops-central-brain sh -c \
>   "node -e \"require('./dist/config/database').connectDatabase().then(() => console.log('DB OK'))\""
> ```

### 🔐 Check 3 — Authentication Flow

1. Open `https://your-app.vercel.app/login`
2. Sign in with `arjun.dev@aiops-sentinel.io` / `SentinelSRE@2026`
3. You should land on `/dashboard`

> [!NOTE]
> **What to verify in the browser (DevTools → Application → Cookies):**
> - `next-auth.session-token` exists
> - Its **HttpOnly** column is checked ✓ — this means JavaScript cannot read the token (XSS protection confirmed)
> - `aiops_token` does **not** exist — the old localStorage token is gone

**Common Failures:**

| Symptom | Fix |
| :--- | :--- |
| **Redirect loop back to `/login`** | `NEXTAUTH_URL` doesn't match the actual URL exactly (including `https://`) |
| **"Invalid credentials"** | Backend is unreachable, or DB seed hasn't been run |
| **Network error on submit** | `NEXT_PUBLIC_API_URL` points to a wrong or HTTP address |

### 🚀 Check 4 — Kafka Live Pipeline

```bash
# Confirm the log-collector is tailing and the producer is connected
docker logs aiops-log-collector --tail 30
# Expected:
# [FileTailer] Watching "app.log" from byte 0 — poll every 500ms
# [Kafka] Producer connected → kafka:29092

# Confirm the consumer is subscribed
docker logs aiops-central-brain --tail 30
# Expected:
# [KafkaAdmin] Topic "raw-logs" already exists
# [KafkaConsumer] Subscribed to topic "raw-logs"
```

**Trigger a test anomaly** by writing a burst of errors directly to the watched file:

```bash
# On the EC2 host
for i in $(seq 1 20); do
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [FATAL] Connection pool exhausted in api-gateway: ECONNREFUSED localhost:5432" \
    >> /var/log/aiops/app.log
done
```

Within ~60 seconds you should see a new incident card on the Dashboard.

### 🔌 Check 5 — Socket.IO Live Stream

1. Open the Dashboard — the **Live** badge in the top-right should be **green**
2. If it is grey/red:
   - Check `NEXT_PUBLIC_SOCKET_URL` is correct
   - Confirm NGINX forwards the `Upgrade` and `Connection` headers (the WebSocket config from Step 8 above)
   - Open the browser console — look for `connect_error` messages

> [!TIP]
> **Quick test without NGINX:**
> ```javascript
> // Temporarily test the raw WebSocket connection from your browser console:
> const s = new WebSocket("wss://your-ec2-domain.com/socket.io/?EIO=4&transport=websocket");
> s.onopen = () => console.log("WebSocket OK");
> s.onerror = (e) => console.error("WebSocket failed", e);
> ```

### 🤖 Check 6 — AI Assistant (Gemini + RAG)

1. Go to `/assistant`
2. Ask: _"What are the most common incidents in our system?"_
3. You should get a structured Markdown response with code blocks and bullet points

> [!WARNING]
> **If you see `[MOCK] Set MOCK_AI=false`:**
> - `MOCK_AI=true` in your `.env` → change to `false` and restart: `docker-compose -f docker-compose.prod.yml restart central-brain`
> - Or `GEMINI_API_KEY` is missing/invalid — check the API key in Google AI Studio

### ⚙️ Check 7 — Settings Toggles (Functional Test)

1. Go to `/settings`
2. **Reduce motion** → toggle ON: all page-transition animations stop immediately site-wide
3. **Live log stream** → toggle OFF: the Live badge turns grey within 2 seconds; toggle ON: it reconnects automatically
4. Refresh the page: the toggles remember their state (persisted in `localStorage`)

---

## 📡 Part 4 — Pointing to Real Application Logs

The log-collector can tail any file on the host. Here's how to connect it to your real application.

### 📁 Option A — Application on the same EC2 host

Make your app write logs to `/var/log/aiops/app.log`. The Docker volume mount in `docker-compose.prod.yml` already handles the rest.

For NGINX access/error logs:

```bash
# Symlink nginx error log into the watched directory
sudo ln -s /var/log/nginx/error.log /var/log/aiops/nginx-error.log

# Update LOG_FILE_PATH in the log-collector's env in docker-compose.prod.yml:
# LOG_FILE_PATH: /var/log/aiops/nginx-error.log
docker-compose -f docker-compose.prod.yml restart log-collector
```

### 🛰️ Option B — Application on a different server (Filebeat)

Install Filebeat on the application server and ship logs directly to your Kafka topic:

```yaml
# /etc/filebeat/filebeat.yml
filebeat.inputs:
  - type: log
    paths:
      - /var/log/your-app/*.log

output.kafka:
  hosts: ["your-kafka-broker:9092"]
  topic: "raw-logs"
  codec.format:
    string: >
      {"timestamp":"%{[@timestamp]}","source":"your-app",
       "raw":"%{[message]}","lineNumber":%{[log.offset]}}
```

### ☁️ Option C — Cloud Kafka (Confluent Cloud)

1. Create a cluster at [confluent.cloud](https://confluent.cloud) (free tier available)
2. Create a topic named `raw-logs` with 3 partitions
3. Get your bootstrap server, API key, and secret
4. Update both services' `.env`:

```env
KAFKA_BROKERS=pkc-xxxxx.us-east-1.aws.confluent.cloud:9092
KAFKA_SASL_MECHANISM=plain
KAFKA_SASL_USERNAME=your-confluent-api-key
KAFKA_SASL_PASSWORD=your-confluent-api-secret
```

5. Remove the `zookeeper` and `kafka` services from `docker-compose.prod.yml` — you no longer need them

---

## 📖 Part 5 — Useful Commands Reference

```bash
# ── Local Development ──────────────────────────────────────────────────────────
docker compose up -d                            # start Kafka, Redis, Postgres
docker compose down                             # stop all infra containers
docker compose down -v                          # stop + wipe all data volumes

npm run seed        # (central-brain) create schema + insert test data
npm run dev         # (central-brain) start API server with hot-reload
npm run dev         # (frontend)      start Next.js dev server
npm run write:logs  # (log-collector) write test logs to sample.log
npm run dev         # (log-collector) tail sample.log → Kafka
npm run dev         # (log-generator) send synthetic logs directly to Kafka

# ── Production ─────────────────────────────────────────────────────────────────
docker-compose -f docker-compose.prod.yml up -d        # start prod stack
docker-compose -f docker-compose.prod.yml down         # stop prod stack
docker-compose -f docker-compose.prod.yml logs -f      # stream all container logs
docker-compose -f docker-compose.prod.yml restart central-brain  # restart one service

docker exec -it aiops-central-brain npm run seed       # seed prod database
docker exec -it aiops-central-brain sh                 # open shell in container

# ── Health and Diagnostics ─────────────────────────────────────────────────────
curl http://localhost:4000/health                       # backend health endpoint
curl http://localhost:4000/api/incidents                # incidents API
docker logs aiops-central-brain --tail 100 -f          # watch backend logs live
docker logs aiops-kafka --tail 50                      # check Kafka broker logs

# ── Secret Generation ──────────────────────────────────────────────────────────
openssl rand -base64 32    # generate NEXTAUTH_SECRET (required: 32+ bytes)
openssl rand -base64 48    # generate JWT_SECRET      (required: 32+ bytes)
```

---

## 🛠️ Part 6 — Common Issues & Fixes

| Symptom | Likely Cause | Fix |
| :--- | :--- | :--- |
| **Login loops back to `/login`** | `NEXTAUTH_URL` doesn't match deployed URL | Set `NEXTAUTH_URL` exactly to your frontend URL including `https://` |
| **401 on all API calls after login** | `JWT_SECRET` mismatch | Both services must use the same `JWT_SECRET` value |
| **Socket.IO badge stays grey** | WebSocket not proxied by NGINX | Add `Upgrade` + `Connection` headers to NGINX config |
| **No incidents appear after log burst** | `USE_KAFKA=false` or Kafka unhealthy | Check `docker compose ps`, confirm `USE_KAFKA=true` in `.env` |
| **AI returns `[MOCK]` responses** | `MOCK_AI=true` or invalid API key | Set `MOCK_AI=false` and verify `GEMINI_API_KEY` is valid |
| **DB seed fails** | Postgres not ready | Wait 10 s and retry: `docker exec -it aiops-central-brain npm run seed` |
| **Server crashes on startup with `validateEnv`** | Missing required env var | The error message names the exact variable — add it to `.env` |
| **Kafka consumer `ECONNREFUSED`** | Wrong broker address | Local = `localhost:9092`. Docker-internal = `kafka:29092` |
| **`NEXTAUTH_SECRET` error on Vercel** | Secret not set in Vercel dashboard | Add it under Project Settings → Environment Variables |

---

## ✅ Part 7 — Production Secrets Checklist

Before going live, confirm every item:

- [ ] `JWT_SECRET` — 48+ bytes, cryptographically random: `openssl rand -base64 48`
- [ ] `NEXTAUTH_SECRET` — 32+ bytes: `openssl rand -base64 32`
- [ ] `GEMINI_API_KEY` — from [Google AI Studio](https://aistudio.google.com)
- [ ] `PINECONE_API_KEY` — from [Pinecone console](https://app.pinecone.io)
- [ ] `POSTGRES_PASSWORD` — strong random password, not the default `aiops_secret`
- [ ] `CORS_ORIGIN` — exact frontend URL (e.g., `https://aiops.vercel.app`), never `*`
- [ ] `NEXTAUTH_URL` — exact frontend URL with `https://`
- [ ] `NEXT_PUBLIC_API_URL` — EC2 backend URL with `https://`
- [ ] No `.env` files committed to git (check: `git status` shows no `.env` files)
- [ ] Session cookie is `HttpOnly` (verify in DevTools → Application → Cookies)
- [ ] `MOCK_AI=false` — real Gemini AI is active, not the DB mock

