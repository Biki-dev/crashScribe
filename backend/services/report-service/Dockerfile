# Multi-stage Dockerfile for Report Ingestion & Sync Service
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY migrations ./migrations

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 5002
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget --no-verbose --tries=1 --spider http://localhost:5002/health || exit 1

CMD ["node", "dist/index.js"]
