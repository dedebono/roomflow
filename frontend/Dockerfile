# Build stage
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BASE_URL=
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL

# Install dependencies (needed for build)
COPY package*.json ./
RUN pnpm install

# Copy source and build
COPY . .
RUN pnpm run build

# Production stage
FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

# Copy standalone server from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
