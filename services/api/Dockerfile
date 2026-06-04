# ── Stage 1: Build ────────────────────────────────────────────────────────────
# Railway sends the full repo as build context (from repo root).
# We isolate to services/api/ so only the API gets built.
FROM node:22-alpine AS builder
WORKDIR /app

# Copy only the API service files
COPY services/api/package*.json ./
COPY services/api/nest-cli.json ./
COPY services/api/tsconfig.json ./
COPY services/api/src/ ./src/

# Install all dependencies (dev included — needed for nest build)
RUN npm ci --legacy-peer-deps

# Build the NestJS app into dist/
RUN npm run build

# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

# Security: run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

# Copy only what's needed to run the app
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./

ENV NODE_ENV=production

# Switch to non-root user
USER nestjs

EXPOSE 3000
CMD ["node", "dist/main"]
