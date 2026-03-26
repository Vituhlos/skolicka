# Stage 1: Build frontend (API calls go to same origin — empty VITE_API_URL)
FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN VITE_API_URL="" npm run build

# Stage 2: Install backend dependencies (compile native better-sqlite3)
FROM node:22-alpine AS backend-deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY backend/package*.json ./
RUN npm install --omit=dev

# Stage 3: Final image
FROM node:22-alpine
WORKDIR /app

COPY --from=backend-deps /app/node_modules ./node_modules
COPY backend/src ./src
COPY --from=frontend-build /app/dist ./public

RUN mkdir -p /data uploads/avatars

LABEL org.opencontainers.image.source="https://github.com/Vituhlos/skolicka"
LABEL org.opencontainers.image.description="Školička — vzdělávací platforma pro děti"

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production
ENV DB_PATH=/data/skolicka.db

VOLUME ["/data", "/app/uploads"]

CMD ["node", "src/index.js"]
