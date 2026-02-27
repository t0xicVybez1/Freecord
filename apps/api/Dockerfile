FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.0
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/permissions/package.json ./packages/permissions/
COPY packages/snowflake/package.json ./packages/snowflake/
COPY packages/logger/package.json ./packages/logger/
COPY packages/markdown/package.json ./packages/markdown/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @freecord/types build
RUN pnpm --filter @freecord/permissions build
RUN pnpm --filter @freecord/snowflake build
RUN pnpm --filter @freecord/logger build
RUN pnpm --filter @freecord/api run db:generate
RUN pnpm --filter @freecord/api build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/main.js"]
