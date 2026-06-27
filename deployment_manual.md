# 🚀 AI-Ops Sentinel — Architecture & Deployment Guide

Welcome to the **AI-Ops Sentinel** manual. This guide details exactly how the application is coded, how the multi-tenant architecture works under the hood, and how to successfully deploy it to production.

---

## 🏗️ Architecture & Codebase Overview

AI-Ops Sentinel is a full-stack, multi-tenant incident management platform. It ingests raw logs, uses AI to perform Root Cause Analysis (RAG), and streams results to an isolated web dashboard in real-time.

```text
┌─────────────────────────────────────────────────────────────────────┐
│                       MULTI-TENANT ARCHITECTURE                     │
│                                                                     │
│  ┌──────────────────┐        ┌──────────────────────────────────┐   │
│  │  Next.js 15 UI   │ HTTPS  │  Central Brain (Express.js)      │   │
│  │  <SocketProvider>│──────▶│  ├── API Controllers              │   │
│  │  (NextAuth v5)   │  JWT   │  ├── Socket.IO Gateway           │   │
│  │                  │◀──────│  │    └─ io.to(platformId).emit   │   │
│  └────────┬─────────┘ WS/IO  │  ├── Prisma (PostgreSQL)         │   │
│           │                  │  ├── Redis (Metrics per tenant)  │   │
│           │                  │  ├── Kafka Consumer              │   │
│           │                  │  └── Gemini AI + Pinecone (RAG)  │   │
│           │                  └──────────────┬───────────────────┘   │
│  ┌────────▼─────────┐                       │                       │
│  │  Log Collector   │──── raw-logs ────────▶│  Kafka Topic          │   │
│  │  (Node.js CLI)   │     (Includes         └───────────────────────┘   │
│  │  PLATFORM_ID     │      platformId)                              │   │
│  └──────────────────┘                                               │
└─────────────────────────────────────────────────────────────────────┘
```

### 🧩 How It Was Coded (The Tech Stack)

#### 1. The Frontend (`aiops-sentinel-frontend`)
- **Framework:** Next.js 15 (App Router).
- **Styling:** TailwindCSS + Shadcn UI components.
- **Authentication:** NextAuth.js v5 (auth.js) using JWT strategies and HttpOnly cookies.
- **Real-Time State:** We use a singleton **React Context (`SocketProvider`)** at the root of the layout. This ensures only *one* WebSocket connection is made per client. The provider listens to events (`incident:new`, `kpi:update`) and distributes the state to the Dashboard, Sidebar, and Incident pages without duplicating network requests.

#### 2. The Backend (`services/central-brain`)
- **Framework:** Node.js with Express and TypeScript.
- **Database:** PostgreSQL managed by Prisma ORM.
- **AI Engine:** Google Gemini API for log summarisation + Pinecone Vector Database for Retrieval-Augmented Generation (finding historical "Golden Records" to fix similar bugs).
- **Multi-Tenant WebSockets:** The Socket.IO server uses a JWT authentication middleware. When a frontend connects, the backend decodes the token, extracts the `platformId`, and calls `socket.join(platformId)`. This completely isolates WebSocket broadcasts.
- **Multi-Tenant Metrics:** Redis is used for high-throughput metric aggregation. Keys are strictly namespaced by tenant (e.g., `aiops:metrics:${platformId}:total_logs`), ensuring no cross-tenant data leakage.

#### 3. The Log Collector (`services/log-collector`)
- **Framework:** Lightweight Node.js CLI.
- **Function:** It tails local log files on the target server, batches them, and ships them to Apache Kafka. It includes a preset `PLATFORM_ID` in its `.env` file so the backend knows which tenant account the logs belong to.

---

## 💻 Part 1 — Local Development

> [!TIP]
> Always run the full stack locally before deploying to the cloud. This confirms every layer works end-to-end.

### 🛠️ Prerequisites

| Tool | Minimum Version | How to check |
| :--- | :--- | :--- |
| **Node.js** | `v20` | `node -v` |
| **Docker Desktop**| `any` | `docker -v` |
| **npm** | `v10` | `npm -v` |

> [!IMPORTANT]
> **External Accounts Needed** (free tiers are sufficient):
> - **Google AI Studio** → [aistudio.google.com](https://aistudio.google.com) — get a `GEMINI_API_KEY`
> - **Pinecone** → [app.pinecone.io](https://app.pinecone.io) — create an index named `aiops-incidents` (1024 dimensions, cosine metric), get a `PINECONE_API_KEY`

### 🐳 Step 1 — Start Infrastructure

This spins up **Kafka**, **Redis**, and **PostgreSQL**.

```bash
cd aiops-sentinel-backend
docker compose up -d
```
*Wait ~30 seconds and run `docker compose ps` to ensure Zookeeper, Kafka, Redis, and Postgres are `healthy`.*

### ⚙️ Step 2 — Configure & Seed Central Brain

```bash
cd services/central-brain
cp .env.example .env
npm install
```

Update your `.env` with your API keys:
```env
GEMINI_API_KEY=your-key-from-google-ai-studio
PINECONE_API_KEY=your-pinecone-api-key
DATABASE_URL=postgresql://aiops:aiops_secret@localhost:5432/aiops_sentinel
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=localhost:9092
```

Run migrations and seed test users:
```bash
npx prisma migrate deploy
npm run seed
```

### 🧠 Step 3 — Start the Servers

**Terminal 1 (Backend):**
```bash
cd services/central-brain
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd aiops-sentinel-frontend
npm install
npm run dev
```
Open `http://localhost:3000` and sign up for a new account.

---

## ☁️ Part 2 — Production Deployment

### 🌟 Option A: Vercel (Frontend) + EC2 (Backend) — Recommended

#### 🌐 2A.1 — Deploy Frontend to Vercel

1. **Push your code to GitHub.**
2. **Import the project at [vercel.com/new](https://vercel.com/new)**
3. **Add these Environment Variables:**

| Variable | Value |
| :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://your-ec2-domain.com` |
| `NEXT_PUBLIC_SOCKET_URL`| `https://your-ec2-domain.com` |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` |
| `NEXTAUTH_SECRET` | Output of: `openssl rand -base64 32` |

4. **Deploy.**

#### 🖥️ 2A.2 — Deploy Backend to EC2 (Ubuntu 22.04)

1. **Provision EC2:** `t3.medium` (2 vCPU, 4 GB RAM). Open ports `22` (SSH), `80` (HTTP), `443` (HTTPS), and `4000` (API).
2. **Install Docker & Docker Compose:**
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```
3. **Copy Code & Configure `.env`:**
   Clone your repo to the EC2 instance, copy `.env.example` to `.env`, and fill in **all** production secrets (including a strong `POSTGRES_PASSWORD` and `JWT_SECRET` via `openssl rand -base64 48`).
4. **Build and Launch:**
   ```bash
   cd aiops-sentinel-backend
   docker-compose -f docker-compose.prod.yml build
   docker-compose -f docker-compose.prod.yml up -d
   ```
5. **NGINX + SSL:** Install NGINX and use Certbot for free SSL. 
   > [!CAUTION]
   > You MUST configure NGINX to upgrade WebSockets, or the React `SocketProvider` will fail to connect.
   ```nginx
   location / {
       proxy_pass http://localhost:4000;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
   }
   ```

---

## 📡 Part 3 — Deploying the Log Collector

The Log Collector must be installed on the servers you wish to monitor.

1. **Get your Platform ID:** Log into your deployed Vercel frontend, go to **Settings**, and copy your `Platform ID`.
2. **Configure the Collector:** On your target server, clone the repo and navigate to `services/log-collector`.
3. **Set the `.env`:**
   ```env
   KAFKA_BROKERS=your-ec2-domain.com:9092
   KAFKA_TOPIC=raw-logs
   PLATFORM_ID=your_copied_platform_id
   LOG_FILE_PATH=/var/log/syslog
   ```
4. **Run:**
   ```bash
   npm install && npm start
   ```

---

## 🧪 Part 4 — Testing the Deployment

Run these checks to validate the multi-tenant architecture:

### 🩺 Check 1 — Backend Health & DB
```bash
curl https://your-ec2-domain.com/health
# Expected: {"status":"ok"}
```

### 🔐 Check 2 — WebSocket Authentication
1. Log into your Vercel frontend.
2. Open **Chrome DevTools → Network → WS (WebSockets)**.
3. Refresh the page. You should see a successful `101 Switching Protocols` connection. 
4. Check the "Payload" or "Messages" tab of the WebSocket. You should see the backend emitting `kpi:update` specifically for your platform's data.

### 🚀 Check 3 — Multi-Tenant Kafka Pipeline
On your monitored server, append a fake error to the log file:
```bash
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [FATAL] Database connection pool exhausted" >> /var/log/syslog
```
Within ~15 seconds, the Vercel dashboard should flash a new AI-analyzed Incident. If you log in with a *different* user account (with a different Platform ID) in an Incognito window, they should **not** see this incident, confirming tenant isolation is working perfectly.

---

## ✅ Part 5 — Production Secrets Checklist

Before going fully live, confirm:
- [ ] `JWT_SECRET` — 48+ bytes, cryptographically random.
- [ ] `NEXTAUTH_SECRET` — 32+ bytes.
- [ ] `POSTGRES_PASSWORD` — Strong, non-default password.
- [ ] `CORS_ORIGIN` — Exact Vercel frontend URL, never `*`.
- [ ] Session cookie is `HttpOnly` (verify in DevTools → Application → Cookies).
- [ ] `MOCK_AI=false` — Real Gemini AI is processing incidents.
