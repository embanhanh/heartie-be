# syntax=docker/dockerfile:1

# Stage 1: install base dependencies (with dev deps for building)
FROM node:20-slim AS deps

ENV NODE_ENV=development
WORKDIR /app

COPY package*.json ./
RUN npm install --ignore-scripts

# Stage 2: build the application
FROM node:20-slim AS builder

ENV NODE_ENV=development
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# Stage 3: prune to production dependencies only
FROM node:20-slim AS prod-deps

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts

# Stage 4: final runtime image
FROM node:20-slim

ENV NODE_ENV=production
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY package*.json ./
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/src/main"]