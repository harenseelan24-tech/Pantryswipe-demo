# ── Stage 1: build ─────────────────────────────────────────────────────────────
# Use a full Node image so pnpm + native build tools are available.
FROM node:22-alpine AS builder
WORKDIR /workspace

# Enable corepack so the pnpm version in packageManager field is respected.
RUN corepack enable

# Copy manifests first — these layers are cached unless deps change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json ./

# Workspace packages the api-server depends on at build time.
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/

# Frozen lockfile = reproducible installs; fails fast if lockfile is stale.
RUN pnpm install --frozen-lockfile

# esbuild bundles all dependencies into a single ESM file — no node_modules
# are needed in the production image.
RUN pnpm --filter @workspace/api-server run build

# ── Stage 2: production runtime ────────────────────────────────────────────────
# Minimal Alpine image; no build tools, no source, no node_modules.
FROM node:22-alpine AS runner
WORKDIR /app

# Non-root user — principle of least privilege.
# If the process is ever compromised it cannot write outside /app.
RUN addgroup --system --gid 1001 appgroup \
 && adduser  --system --uid 1001 --ingroup appgroup appuser

# Copy only the self-contained esbuild bundle from the builder stage.
# The pino plugin emits worker files alongside index.mjs — copy the whole dist/.
COPY --from=builder --chown=appuser:appgroup \
     /workspace/artifacts/api-server/dist ./dist

USER appuser

EXPOSE 8080

ENV NODE_ENV=production \
    PORT=8080

# Docker-native health check — used by ECS, Kubernetes liveness probes, etc.
# Targets the lightweight liveness endpoint (no DB round-trip).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/healthz/live || exit 1

CMD ["node", "--enable-source-maps", "dist/index.mjs"]
