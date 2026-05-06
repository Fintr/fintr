FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
ARG NEXT_PUBLIC_APP_BASE_URL
ARG NEXT_PUBLIC_BE_URL
ARG NEXT_PUBLIC_AUTH0_DOMAIN
ARG NEXT_PUBLIC_AUTH0_CLIENT_ID
ARG NEXT_PUBLIC_AUTH0_AUDIENCE
ARG NEXT_PUBLIC_ENVIRONMENT
ARG SENTRY_AUTH_TOKEN
ENV NEXT_PUBLIC_APP_BASE_URL=${NEXT_PUBLIC_APP_BASE_URL}
ENV NEXT_PUBLIC_BE_URL=${NEXT_PUBLIC_BE_URL}
ENV NEXT_PUBLIC_AUTH0_DOMAIN=${NEXT_PUBLIC_AUTH0_DOMAIN}
ENV NEXT_PUBLIC_AUTH0_CLIENT_ID=${NEXT_PUBLIC_AUTH0_CLIENT_ID}
ENV NEXT_PUBLIC_AUTH0_AUDIENCE=${NEXT_PUBLIC_AUTH0_AUDIENCE}
ENV NEXT_PUBLIC_ENVIRONMENT=${NEXT_PUBLIC_ENVIRONMENT}
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}
RUN npm install -g pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 nextjs && adduser -u 1001 -G nextjs -s /bin/sh -D nextjs
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]