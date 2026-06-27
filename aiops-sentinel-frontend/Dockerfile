# ── Stage 1: Install dependencies ─────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are baked into the client bundle at build time.
# Pass these as --build-arg when running docker build, or set them in your
# CI/CD pipeline environment. They are NOT secret.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Stage 3: Runtime (standalone) ─────────────────────────────────────────────
# next.config.mjs sets output: "standalone" — Next.js produces a minimal
# server in .next/standalone that does not require node_modules at runtime.
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# Runtime-only secrets (NEXTAUTH_SECRET, NEXTAUTH_URL) are injected via
# environment variables at container start — never baked into the image.
COPY --from=builder /app/public           ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static     ./.next/static

RUN chown -R node:node /app
USER node

EXPOSE 3000
ENV PORT=3000 \
    HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
