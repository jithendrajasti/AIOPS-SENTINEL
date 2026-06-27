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

# Create the default log directory for volume mounting
RUN mkdir -p /var/log/aiops

# Drop to non-root for security
RUN chown -R node:node /app /var/log/aiops
USER node

ENV LOG_FILE_PATH=/var/log/aiops/app.log \
    KAFKA_BROKERS=kafka:29092 \
    KAFKA_TOPIC=raw-logs \
    USE_KAFKA=true \
    POLL_INTERVAL_MS=500

CMD ["node", "dist/collector.js"]
