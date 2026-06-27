# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json .
COPY src ./src
RUN npm run build

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Drop to non-root for security
RUN chown -R node:node /app
USER node

ENV PORT=4000 \
    NODE_ENV=production \
    KAFKA_BROKERS=kafka:29092 \
    REDIS_URL=redis://redis:6379

EXPOSE 4000
CMD ["node", "dist/server.js"]
