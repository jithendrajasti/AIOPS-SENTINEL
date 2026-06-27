git branch -M main

Write-Host "Commit 1..."
git add .gitignore *.md
git commit -m "docs: Add deployment manuals and architecture documentation"

Write-Host "Commit 2..."
git add aiops-sentinel-backend/docker-compose*.yml aiops-sentinel-backend/.gitignore aiops-sentinel-backend/package*.json
git commit -m "build: Add backend Docker infrastructure and config"

Write-Host "Commit 3..."
git add aiops-sentinel-backend/services/log-collector
git commit -m "feat: Implement log-collector and Kafka integration"

Write-Host "Commit 4..."
git add aiops-sentinel-backend/services/log-generator
git commit -m "feat: Implement log-generator utility for testing"

Write-Host "Commit 5..."
git add aiops-sentinel-backend/services/central-brain/prisma aiops-sentinel-backend/services/central-brain/package*.json aiops-sentinel-backend/services/central-brain/tsconfig.json aiops-sentinel-backend/services/central-brain/src/config aiops-sentinel-backend/services/central-brain/src/server.ts
git commit -m "feat: Initialize central-brain core backend and Prisma schema"

Write-Host "Commit 6..."
git add aiops-sentinel-backend/services/central-brain/src/services aiops-sentinel-backend/services/central-brain/src/utils
git commit -m "feat: Implement RAG pipeline, LLM integration, and anomaly detection"

Write-Host "Commit 7..."
git add aiops-sentinel-backend/services/central-brain
git commit -m "feat: Add Socket.IO multi-tenant architecture and API routes"

Write-Host "Commit 8..."
git add aiops-sentinel-frontend/.gitignore aiops-sentinel-frontend/package*.json aiops-sentinel-frontend/tailwind.config.ts aiops-sentinel-frontend/tsconfig.json aiops-sentinel-frontend/src/components aiops-sentinel-frontend/src/lib aiops-sentinel-frontend/src/types aiops-sentinel-frontend/components.json aiops-sentinel-frontend/postcss.config.mjs aiops-sentinel-frontend/eslint.config.mjs
git commit -m "feat: Initialize Next.js frontend with Shadcn UI components"

Write-Host "Commit 9..."
git add aiops-sentinel-frontend
git commit -m "feat: Implement frontend dashboard, auth, and incident management UI"

Write-Host "Commit 10..."
git add .
git commit -m "chore: Finalize configurations and polish codebase"

Write-Host "Pushing to GitHub..."
git push -u origin main
