FROM node:20-alpine AS base
RUN apk add --no-cache python3 make g++ linux-headers
RUN npm install -g pnpm@9.15.0
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY packages/logger/package.json ./packages/logger/
COPY apps/voice/package.json ./apps/voice/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @freecord/logger build
RUN pnpm --filter @freecord/voice build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/apps/voice/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 8081
EXPOSE 40000-49999/udp
CMD ["node", "dist/main.js"]
