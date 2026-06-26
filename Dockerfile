# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1 — build the frontend (vite) and compile the server (tsc)
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Install ALL dependencies (including dev) needed for the build
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source and build
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2 — slim runtime image
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Compiled output (frontend in dist/, server in dist/server/)
COPY --from=builder /app/dist ./dist

# Runtime data read from process.cwd() by the server
COPY knowledge ./knowledge
COPY faq-cache ./faq-cache

# Railway provides PORT at runtime; the server falls back to 5782 locally.
EXPOSE 5782

CMD ["node", "dist/server/index.js"]
