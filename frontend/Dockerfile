# --- Build Stage ---
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .
ENV NEXT_PUBLIC_API_URL=http://localhost/api
RUN npm run build

# --- Production Stage ---
FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /usr/src/app/.next ./.next
COPY --from=builder /usr/src/app/public ./public
COPY --from=builder /usr/src/app/src ./src

EXPOSE 3000

ENV PORT=3000
CMD ["npm", "run", "start"]
