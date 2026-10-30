# syntax=docker/dockerfile:1

# ---- Builder ----
FROM node:22-slim AS builder
WORKDIR /app

# better-sqlite3 es un módulo nativo que necesita compilarse
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY seed ./seed
RUN npm run build

# ---- Runtime ----
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/seed ./seed
COPY --from=builder /app/package.json ./package.json

EXPOSE 8080
CMD ["node", "dist/index.js"]
