# Porumbar pe un singur serviciu: Express servește API-ul și interfața Angular (web/dist), baza de date e separată.

# 1. Interfața
FROM node:24-slim AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# 2. Serverul
FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY src ./src
COPY --from=web /app/web/dist ./web/dist
# Railway dă portul în PORT; local implicit 3100.
EXPOSE 3100
USER node
CMD ["node", "src/server.js"]
