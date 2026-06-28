FROM node:18-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Generate Prisma Client and build the TypeScript code
RUN npx prisma generate
RUN npm run build

# Production image
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
# Install only production dependencies
RUN npm ci --omit=dev

# Copy compiled files and generated prisma client
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

EXPOSE 4000
CMD ["npm", "run", "start"]
