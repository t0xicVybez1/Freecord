FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.0
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY packages/logger/package.json ./packages/logger/
COPY packages/types/package.json ./packages/types/
COPY apps/gateway/package.json ./apps/gateway/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @freecord/logger build
RUN pnpm --filter @freecord/types build
RUN pnpm --filter @freecord/gateway build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/apps/gateway/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 8080
CMD ["node", "dist/main.js"]
