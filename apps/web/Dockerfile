# ── builder: compiles Next.js app ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --frozen-lockfile=false

COPY . .
RUN npm run build

# ── runtime: production server ──────────────────────────────────────────────
FROM node:20-alpine

ENV NODE_ENV=production

RUN addgroup --system app \
    && adduser --system --ingroup app app

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

RUN chown -R app:app /app

USER app

EXPOSE 3000

CMD ["npm", "start"]
