FROM node:20-alpine AS base
RUN apk add --no-cache vips-dev
RUN npm install -g pnpm@9.15.0
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY packages/logger/package.json ./packages/logger/
COPY packages/snowflake/package.json ./packages/snowflake/
COPY apps/cdn/package.json ./apps/cdn/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @freecord/logger build
RUN pnpm --filter @freecord/snowflake build
RUN pnpm --filter @freecord/cdn build

FROM base AS runner
ENV NODE_ENV=production
RUN apk add --no-cache vips
COPY --from=builder /app/apps/cdn/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/main.js"]
