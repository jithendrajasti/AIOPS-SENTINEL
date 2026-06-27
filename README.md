<div align="center">
  <img src="https://raw.githubusercontent.com/jithendrajasti/AIOPS-SENTINEL/main/aiops-sentinel-frontend/public/logo-full.png" alt="AI-Ops Sentinel Logo" width="300"/>
  <h1>AI-Ops Sentinel</h1>
  <p><strong>Intelligent, Multi-Tenant Root Cause Analysis & Real-Time Log Monitoring</strong></p>
  
  <p>
    <img src="https://img.shields.io/badge/Next.js-15-black?style=flat&logo=next.js" alt="Next.js" />
    <img src="https://img.shields.io/badge/Node.js-Express-green?style=flat&logo=node.js" alt="Node.js" />
    <img src="https://img.shields.io/badge/Kafka-Streaming-red?style=flat&logo=apachekafka" alt="Kafka" />
    <img src="https://img.shields.io/badge/Redis-Caching-red?style=flat&logo=redis" alt="Redis" />
    <img src="https://img.shields.io/badge/PostgreSQL-Database-blue?style=flat&logo=postgresql" alt="PostgreSQL" />
    <img src="https://img.shields.io/badge/AI-Gemini_Flash-orange?style=flat&logo=google" alt="Google Gemini" />
    <img src="https://img.shields.io/badge/RAG-Pinecone-blueviolet?style=flat" alt="Pinecone" />
  </p>
</div>

---

**AI-Ops Sentinel** is a powerful platform built for Site Reliability Engineers (SREs) and DevOps teams. It automatically ingests server logs via Apache Kafka, uses Google Gemini AI coupled with a Pinecone Vector Database (RAG) to instantly identify the root cause of crashes, and streams the analysis live to an isolated, multi-tenant Next.js dashboard using WebSockets.

## ✨ Core Features

* 🚀 **Real-Time Log Ingestion**: Uses Apache Kafka to handle massive throughput of server logs securely.
* 🤖 **AI Root Cause Analysis**: Leverages Google Gemini 2.5 Flash to automatically detect anomalies and generate human-readable solutions.
* 📚 **RAG (Retrieval-Augmented Generation)**: Queries Pinecone Vector DB to find "Golden Records" (historical fixes) to solve new problems based on past company knowledge.
* 🔒 **Multi-Tenant Architecture**: Robust tenant isolation using JWT-authenticated WebSockets and Redis key-spacing. Customer A can never see Customer B's logs.
* ⚡ **Live WebSocket Dashboard**: React Context-driven Socket.IO integration for instant incident alerts and live KPI graphs without page refreshes.

---

## 🏗️ Architecture

```mermaid
graph TD
    subgraph Client Infrastructure
        LC[Log Collector CLI]
        APP[App Logs]
        APP --> LC
    end

    subgraph Message Broker
        KAFKA[(Apache Kafka)]
        LC -- "Streams (includes Platform ID)" --> KAFKA
    end

    subgraph Central Brain Backend
        CONSUMER[Kafka Consumer]
        API[Express API / Services]
        SOCKETS[Socket.IO Gateway]
        AI[Gemini RCA Engine]
        
        KAFKA --> CONSUMER
        CONSUMER -- "1. Detect Anomaly" --> API
        API -- "2. Live Alert" --> SOCKETS
        API -- "3. Trigger RCA" --> AI
        AI -- "4. RCA Results" --> SOCKETS
    end

    subgraph Data Layer
        PG[(PostgreSQL)]
        REDIS[(Redis Metrics)]
        PINECONE[(Pinecone Vector DB)]
        
        CONSUMER -- "Update KPIs" --> REDIS
        API -- "Save Incident" --> PG
        AI -- "Query Past Fixes" --> PINECONE
        API -- "User marks Golden Record" --> PINECONE
    end

    subgraph Next.js Frontend
        UI[Web Dashboard]
        API -- "REST (NextAuth v5)" --> UI
        SOCKETS -- "JWT Auth & Room Scoping" --> UI
    end
```

---

## 🚀 Quick Start (Local Development)

To run the entire platform locally, you will need **Docker Desktop**, **Node.js v20+**, and free API keys for **Google AI Studio** and **Pinecone**.

### 1. Start Infrastructure
We use Docker Compose to spin up Zookeeper, Kafka, Redis, and PostgreSQL.
```bash
cd aiops-sentinel-backend
docker compose up -d
```
*Wait ~30 seconds for Kafka to become fully healthy.*

### 2. Configure & Start Backend (`central-brain`)
The backend orchestrates the AI, WebSockets, and database.
```bash
cd services/central-brain
cp .env.example .env
npm install
```
Edit `.env` and add your `GEMINI_API_KEY` and `PINECONE_API_KEY`. (If you don't have keys yet, set `MOCK_AI=true`).

Then, initialize the database and start the server:
```bash
npx prisma migrate deploy
npm run seed
npm run dev
```

### 3. Start Frontend (`aiops-sentinel-frontend`)
```bash
cd ../../../aiops-sentinel-frontend
npm install
npm run dev
```
Open `http://localhost:3000` in your browser. Create an account, or log in with the seeded credentials (`arjun.dev@aiops-sentinel.io` / `SentinelSRE@2026`).

### 4. Stream Test Logs (`log-collector`)
In a new terminal window, simulate an application crash to see the system in action:
```bash
cd aiops-sentinel-backend/services/log-collector
npm install
npm run write:logs  # Writes fake crash logs to sample.log
npm run dev         # Tails the log file and streams to Kafka
```
Watch your frontend dashboard — the AI will instantly pick up the anomaly, analyze it, and pop up a new Incident Card in real-time!

---

## 🔐 Multi-Tenant Architecture

Security and data isolation are critical. AI-Ops Sentinel implements multi-tenancy at every layer:
1. **Frontend / Auth:** Users sign up and belong to a specific `platformId`.
2. **Log Collection:** The `log-collector` `.env` requires a `PLATFORM_ID`. All ingested logs are tagged with this ID.
3. **WebSockets:** When the frontend connects, it passes a JWT token. The backend verifies the token and connects the socket to a private `io.to(platformId)` room. Incidents are ONLY broadcasted to the room matching the log's platform ID.
4. **Metrics:** Redis keys are namespaced (e.g., `aiops:metrics:tenant_X:total_logs`).

---

## 📚 Documentation

For complete, detailed instructions on how to deploy this stack to production (Vercel + AWS EC2) and secure the environment, please see the Deployment Manuals:

- 📖 [Deployment Manual](deployment_manual.md) - Master guide to architecture, building, and deploying.
- 📖 [Post-Deployment Testing Guide](post_deployment_guide.md) - How to test Kafka, Sockets, and NGINX in production.

---

## 📄 License

This project is licensed under the MIT License.
