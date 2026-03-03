# -------- BUILD STAGE --------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci

COPY . .
RUN npm run build


# -------- PRODUCTION STAGE --------
FROM node:20-alpine

RUN apk add --no-cache dumb-init openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

RUN addgroup -S nodejs && adduser -S nodejs -G nodejs
USER nodejs

EXPOSE 5000

CMD ["dumb-init", "node", "dist/index.cjs"]
