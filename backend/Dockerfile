FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
WORKDIR /app
COPY package*.json ./
RUN pnpm install
COPY . .
RUN pnpm prisma generate && pnpm run build

FROM node:20-alpine
WORKDIR /app
ENV TZ=Asia/Jakarta
RUN apk add --no-cache tzdata
COPY package*.json ./
# Skip install, copy fully built node_modules directly
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
RUN mkdir -p /app/uploads
ENV NODE_ENV=development
ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
