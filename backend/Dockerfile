# syntax=docker/dockerfile:1.7
# OneMCP backend — NestJS
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY package.json ./
RUN pnpm install --prod=false --frozen-lockfile=false

FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

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
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
USER onemcp
EXPOSE 3000
CMD ["node", "dist/main.js"]
