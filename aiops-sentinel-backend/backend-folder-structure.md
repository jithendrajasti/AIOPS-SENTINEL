# Target Directory Structure

aiops-sentinel-backend/
├── services/
│   ├── log-collector/         # Node.js standalone log agent
│   │   ├── src/
│   │   │   └── collector.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── central-brain/         # Express processing app + Socket.IO + AI
│       ├── src/
│       │   ├── config/        # Kafka, Redis, Pinecone initializers
│       │   ├── controllers/   # HTTP request logic
│       │   ├── services/      # AI/RAG logic & pipeline filters
│       │   ├── sockets/       # Socket.IO handlers
│       │   └── server.ts      # Main Entrypoint
│       ├── package.json
│       └── tsconfig.json
│
├── docker-compose.yml         # Local infrastructure setups (Kafka, Redis)
└── README.md