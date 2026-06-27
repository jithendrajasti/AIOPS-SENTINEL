# AI-Ops Sentinel Architecture & UI Integration Guide

## 1. Overview
**AI-Ops Sentinel** is a real-time observability platform designed to ingest server logs, predict system failures, and automatically generate a Root Cause Analysis (RCA) in plain English to reduce Mean Time To Resolution (MTTR).

The codebase is split into two primary repositories:
- `aiops-sentinel-backend`: The backend infrastructure consisting of a log collector agent and a central Express/Node.js service.
- `aiops-sentinel-frontend`: A modern Next.js React frontend application.

---

## 2. Backend Architecture
The backend is composed of several microservices and integrations that act as the "Central Brain":

* **Log Ingestion (The Collector):** A standalone Node.js script that tails application logs and streams them to an Apache Kafka topic.
* **Stream Processing:** An Express microservice that acts as a Kafka consumer. It pulls logs in real-time, runs anomaly detection, and caches operational metrics in Redis for live dashboard updates.
* **Contextualization & AI Layer (RAG Pipeline):** When an anomaly is detected, the backend queries Pinecone (a Vector Database) for similar historical incidents ("Golden Records"). It then uses the OpenAI API to generate a plain-English Root Cause Analysis (RCA).
* **Real-Time Streaming:** The backend uses `Socket.IO` to maintain a persistent bi-directional WebSocket connection with the frontend, pushing live incidents, logs, and system metrics instantly without requiring the frontend to poll.
* **Database / API Layer:** Exposes standard RESTful APIs (built with Express and Prisma/PostgreSQL) for fetching historical data, analytics, user profiles, and managing the Golden Records.

---

## 3. Frontend Architecture
The frontend is built for performance and a premium SaaS aesthetic:
* **Framework:** Next.js 15 (App Router) with TypeScript.
* **Styling:** Tailwind CSS with a strict dark-mode glassmorphism design system.
* **Components:** shadcn/ui and Lucide Icons for rapid, consistent UI development.
* **Data Fetching & State:** Uses standard React Hooks (`useEffect`, `useState`) paired with a custom `apiFetch` wrapper for standard HTTP REST calls, and `socket.io-client` for real-time live data streams.

---

## 4. Frontend-Backend Integration Points
The frontend and backend communicate via two distinct channels:

1. **RESTful HTTP API (`apiFetch`):** Used for standard CRUD operations and fetching initial page loads (e.g., getting the list of incidents, fetching analytics history, or creating a new Golden Record).
2. **WebSocket (Socket.IO):** Used for real-time reactivity. The frontend subscribes to events (like `new_incident`, `metric_update`, `log_stream`) and the backend pushes data instantly. This drives the live dashboard KPI cards and live incident feeds.

---

## 5. Page-by-Page UI & API Mapping

Below is a detailed breakdown of every page, the buttons it contains, and exactly how those actions map back to the backend.

### **Dashboard (`/dashboard`)**
* **Purpose:** The main landing page showing live KPI cards, incident feed, and service health.
* **Backend Connections (Initial Load):**
  * `GET /api/incidents` (Fetches recent incident feed)
  * `GET /api/services` (Fetches service health status)
  * `GET /api/analytics/kpis` (Fetches metrics for KPI cards)
* **Real-time Connections (Socket.IO):** Listens for live updates to seamlessly update the UI.
* **Buttons / Interactions:**
  * **Navigation Links:** Clicking an incident routes to `/incidents/[id]`. Clicking a service routes to `/services/[id]`. No direct API mutations occur from button clicks on this page.

### **Incident Details (`/incidents/[id]`)**
* **Purpose:** Deep dive into a specific incident, showing AI Root Cause Analysis, related logs, and similar historical incidents.
* **Backend Connections (Initial Load):**
  * `GET /api/incidents/:id` (Fetches specific incident data, AI analysis, and logs)
  * `GET /api/incidents` (Fetches list to find "Similar Incidents" to recommend)
* **Buttons / Interactions:**
  * **"Mark as Golden Record" Button:** Opens a modal to save the incident's fix to the knowledge base.
    * **Modal "Save Golden Record" Button:** Sends `POST /api/golden-records` with the issue, remediation, service, and tags. This updates the Pinecone Vector DB to help the AI solve future similar issues.
  * **"Dismiss" Button:** Ignores the incident.
    * Sends `PATCH /api/incidents/:id/status` with payload `{ status: "dismissed" }`.
  * **"Resolve Incident" Button:** Marks the incident as fixed.
    * Sends `PATCH /api/incidents/:id/status` with payload `{ status: "resolved" }`.

### **Incidents List (`/incidents`)**
* **Purpose:** A master table/list of all past and present incidents.
* **Backend Connections:** `GET /api/incidents`
* **Buttons / Interactions:**
  * Contains standard filtering and pagination (handled client-side or via query params).
  * **View Details:** Navigates to the Incident Details page.

### **Services List (`/services`)**
* **Purpose:** Shows the health, latency, and error rate of all monitored microservices.
* **Backend Connections:** `GET /api/services`
* **Buttons / Interactions:**
  * **Service Row Click:** Navigates to `/services/[id]`.

### **Service Details (`/services/[id]`)**
* **Purpose:** Shows detailed health trends, dependencies, and recent incidents for a specific microservice.
* **Backend Connections:** 
  * `GET /api/services/:id` (Fetches specific service details and recent incidents)
  * `GET /api/services` (Fetches all services to build dependency/relationship graphs)

### **Golden Records (`/golden-records`)**
* **Purpose:** The curated knowledge base of known issues and their verified fixes (used by the RAG pipeline).
* **Backend Connections (Initial Load):** `GET /api/golden-records`
* **Buttons / Interactions:**
  * **"Add Record Manually" Button:** Opens a modal to create a new knowledge base entry from scratch.
    * **Modal "Save" Button:** Sends `POST /api/golden-records`.
  * **"Delete" (Trash Icon) Button on a Record:** Removes a record from the knowledge base.
    * Sends `DELETE /api/golden-records/:id`.

### **AI Assistant (`/assistant`)**
* **Purpose:** A chat interface where engineers can ask the AI questions about stack traces, specific incidents, or system health.
* **Buttons / Interactions:**
  * **"Send" Button / Enter Key:** Submits the user's prompt to the AI.
    * Sends `POST /api/assistant` with the chat history/prompt. The backend queries OpenAI (and potentially Pinecone context) and returns the AI's response to display in the chat window.

### **Analytics (`/analytics`)**
* **Purpose:** Shows long-term trends, Mean Time To Resolution (MTTR) improvements, and incident charts.
* **Backend Connections:** `GET /api/analytics` (Fetches chart data payloads for Recharts).

### **Settings (`/settings`)**
* **Purpose:** User profile and application preferences.
* **Backend Connections:** `GET /api/auth/profile` (Fetches the current user's profile details).
* **Buttons / Interactions:**
  * **Profile Update / Toggles:** Changes to live log streaming preferences are handled locally (affecting the Socket.IO connection behavior) or synced via respective PUT/PATCH endpoints to the user's profile.
