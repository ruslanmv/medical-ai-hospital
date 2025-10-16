# ==============================
# frontend/Dockerfile (FIXED)
# Handles missing package-lock.json by falling back to `npm install`.
# Production-leaning image with pruning, healthcheck, and non-root user.
# ==============================
# syntax=docker/dockerfile:1

# ---------------- deps ----------------
FROM node:20-alpine AS deps
WORKDIR /app
# Helpful for some native modules on Alpine
RUN apk add --no-cache libc6-compat
# Copy both package.json and (optionally) package-lock.json in one go
COPY package*.json ./
# If a lockfile exists, use deterministic `npm ci`; otherwise fall back to `npm install`
RUN set -eux; \
    if [ -f package-lock.json ]; then \
      npm ci; \
    else \
      echo "⚠️  package-lock.json not found; using 'npm install'"; \
      npm install; \
    fi

# ---------------- builder ----------------
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------------- runner ----------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

# Minimal runtime payload
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./

# Prune devDependencies from node_modules for a smaller runtime image
RUN npm prune --omit=dev

# Use non-root user for security
USER node

EXPOSE 3000
# Alpine has busybox wget by default
HEALTHCHECK --interval=10s --timeout=3s --retries=20 \
  CMD wget -qO- http://localhost:3000 >/dev/null 2>&1 || exit 1

CMD ["npm", "run", "start"]
