# syntax=docker/dockerfile:1

# ── 1) Deps (compila better-sqlite3 nativo) ───────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── 2) Imagen final (sin herramientas de build) ───────────────
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src/ ./src/
COPY public/ ./public/
EXPOSE 3000
CMD ["node", "src/server.js"]
