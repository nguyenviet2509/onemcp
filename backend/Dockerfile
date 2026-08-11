# syntax=docker/dockerfile:1.7
# OneMCP backend — NestJS
# Build context = repo root (see docker-compose.yml). Reads workspace lockfile.
FROM node:20-alpine AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
# Copy workspace metadata + all workspace package.json files.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY backend/package.json backend/
COPY portal/package.json portal/
COPY cli/package.json cli/
# Frozen-lockfile: reproduce local versions exactly (previous VPS build fetched
# @modelcontextprotocol/sdk >1.30 which changed server.tool() signature → 17 tsc errors).
RUN pnpm install --prod=false --frozen-lockfile

FROM node:20-alpine AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/backend/node_modules ./backend/node_modules
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY backend/ ./backend/
# 12GB heap: tsc+swc need >8GB after OAuth AS added.
RUN cd backend && NODE_OPTIONS=--max-old-space-size=12288 pnpm build

FROM node:20-alpine AS runtime
WORKDIR /app
# git binary cần cho simple-git (P2 skill sync).
RUN apk add --no-cache git \
 && corepack enable && corepack prepare pnpm@9.0.0 --activate \
 && addgroup -g 1001 -S onemcp \
 && adduser  -u 1001 -S onemcp -G onemcp \
 && mkdir -p /var/lib/onemcp/mirrors \
 && chown -R onemcp:onemcp /var/lib/onemcp
ENV NODE_ENV=production
COPY --from=build /repo/backend/dist ./dist
COPY --from=build /repo/backend/node_modules ./node_modules
COPY --from=build /repo/backend/package.json ./package.json
USER onemcp
EXPOSE 3000
CMD ["node", "dist/main.js"]
