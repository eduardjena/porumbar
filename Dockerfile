# Porumbar pe un singur serviciu: Express servește API-ul și interfața Angular (web/dist), baza de date e separată.

# 1. Interfața
FROM node:24-slim AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
# Dicționarele (i18n/) le citește și interfața la build (ro.json intră în pachet).
COPY i18n/ /app/i18n/
# Regulile inelelor și zonele de timp sunt aceleași în telefon și pe server: interfața importă src/rings.js și src/zones.js (tipurile în *.d.ts).
COPY src/rings.js src/rings.d.ts src/zones.js src/zones.d.ts /app/src/
RUN npm run build

# 2. Serverul
FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY src ./src
COPY i18n ./i18n
COPY --from=web /app/web/dist ./web/dist
# Railway dă portul în PORT; local implicit 3100.
EXPOSE 3100
USER node
CMD ["node", "src/server.js"]
