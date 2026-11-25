# syntax=docker/dockerfile:1
# API + worker image (same image, different command). Build context: repository root.
#   docker build -f apps/api/Dockerfile .

FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- all deps (for building) ----
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace apps/api --include-workspace-root=false --no-audit --no-fund

# ---- build: prisma generate + tsc ----
FROM deps AS build
COPY apps/api apps/api
WORKDIR /app/apps/api
RUN npx prisma generate && npx tsc -p tsconfig.build.json

# ---- production deps only ----
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace apps/api --include-workspace-root=false --omit=dev --no-audit --no-fund && npm cache clean --force

# ---- runtime ----
FROM base AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PATH=/app/node_modules/.bin:$PATH NPM_CONFIG_UPDATE_NOTIFIER=false
COPY --from=prod-deps --chown=node:node /app/node_modules /app/node_modules
COPY --from=build --chown=node:node /app/apps/api/dist /app/apps/api/dist
COPY --chown=node:node apps/api/package.json apps/api/prisma.config.ts /app/apps/api/
COPY --chown=node:node apps/api/prisma /app/apps/api/prisma
COPY --chown=node:node apps/api/assets /app/apps/api/assets
WORKDIR /app/apps/api
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
