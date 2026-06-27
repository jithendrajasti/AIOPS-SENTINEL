# AI-Ops Sentinel: System Architecture & Context

## Project Overview
AI-Ops Sentinel is a real-time observability platform that ingests server logs, predicts system failures, and automatically generates a Root Cause Analysis (RCA) in plain English to drastically reduce Mean Time To Resolution (MTTR)[cite: 1]. 

## Technical Specifications
* **Frontend Status:** 100% Complete (Built using Next.js, Tailwind CSS, Daisy UI, and Socket.IO client).
* **Backend Stack:** Node.js, Express, TypeScript, KafkaJS, Redis, Socket.IO, OpenAI Node SDK, Pinecone DB.
* **Infrastructure:** Docker, Docker Compose, AWS EC2, GitHub Actions for CI/CD.

## System Core Component Breakdown

### 1. Log Ingestion (The Collector)
* A standalone Node.js script/agent that tails standard output logs from target applications.
* Streams new log rows directly to a Kafka topic using the KafkaJS library.

### 2. Stream Processing (The Express "Central Brain")
* An Express microservice running on TypeScript.
* Acts as a Kafka consumer, continuously pulling logs from the topic to run anomaly detection algorithms.
* Uses Redis for ultra-fast caching of real-time operational metrics to feed the live dashboard.

### 3. Contextualization & AI Layer (RAG Pipeline)
* Upon anomaly detection, uses the OpenAI Node SDK to initiate a similarity search inside Pinecone Vector DB to locate historical context.
* Passes the log snippet and historical fixes to the LLM to generate plain English RCA documentation.
* **Post-Resolution Pipeline:** Monitors user/developer input from the frontend. High-quality resolutions are filtered (via deduplication and TTL metadata) and ingested as "Golden Records" back into Pinecone to optimize space.

### 4. Real-Time Streaming Gateway
* Utilizes Socket.IO to maintain bi-directional communication, instantly pushing AI-generated reports and live performance metrics directly to the pre-built frontend.