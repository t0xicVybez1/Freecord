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
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG VITE_API_URL
ARG VITE_GATEWAY_URL
ARG VITE_CDN_URL
ARG VITE_VOICE_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GATEWAY_URL=$VITE_GATEWAY_URL
ENV VITE_CDN_URL=$VITE_CDN_URL
ENV VITE_VOICE_URL=$VITE_VOICE_URL
RUN pnpm --filter @freecord/types build
RUN pnpm --filter @freecord/permissions build
RUN pnpm --filter @freecord/snowflake build
RUN pnpm --filter @freecord/markdown build
RUN pnpm --filter @freecord/web build

FROM nginx:alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY infra/nginx/spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
