# syntax=docker/dockerfile:1

# 1) Install deps (with or without a lockfile)
FROM node:20-alpine AS deps
WORKDIR /app
# Copy any lockfile if present to favor deterministic installs
COPY package.json ./
COPY package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# 2) Build Next.js (standalone output)
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 3) Minimal runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

# Copy public assets & standalone server
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/.next/BUILD_ID ./.next/BUILD_ID

EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=20 \
  CMD wget -qO- http://localhost:3000 >/dev/null 2>&1 || exit 1

# The standalone server includes a server.js at repo root
CMD ["node", "server.js"]
