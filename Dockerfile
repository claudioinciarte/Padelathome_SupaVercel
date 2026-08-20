# ============================================================
# Padel@Home - Dockerfile (producción, multi-stage)
# Modo persistente: server.js + Socket.IO + node-cron local
# ============================================================

# ---------- Stage 1: build (compila Tailwind y prepara la app) ----------
FROM node:20-bookworm-slim AS build

WORKDIR /app

# Código fuente primero (el postinstall compila Tailwind y necesita tailwind/ y public/)
COPY . .

# Instalar dependencias SIN disparar postinstall (lo lanzamos después explícito)
RUN npm ci --ignore-scripts

# Compilar Tailwind a public/tailwind.css
RUN npm run css:build

# ---------- Stage 2: runtime (imagen mínima) ----------
FROM node:20-bookworm-slim AS runtime

# node-cron y utilidades básicas; sin crond del sistema (usa node-cron interno)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Usuario no-root
RUN useradd --create-home --shell /bin/false padel && \
    mkdir -p /app && chown -R padel:padel /app

# Dependencias de producción (sin devDependencies; el CSS ya está compilado)
COPY --from=build --chown=padel:padel /app/package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Aplicación (build stage ya tiene public/tailwind.css compilado)
COPY --from=build --chown=padel:padel /app/src ./src
COPY --from=build --chown=padel:padel /app/public ./public
COPY --from=build --chown=padel:padel /app/server.js ./server.js
COPY --from=build --chown=padel:padel /app/cronJobs.js ./cronJobs.js
COPY --from=build --chown=padel:padel /app/entrypoint.sh ./entrypoint.sh
COPY --from=build --chown=padel:padel /app/tailwind ./tailwind
COPY --from=build --chown=padel:padel /app/tailwind.config.js ./tailwind.config.js
COPY --from=build --chown=padel:padel /app/postcss.config.js ./postcss.config.js

RUN chmod +x entrypoint.sh

# Usuario de la aplicación
USER padel

EXPOSE 3000

# Healthcheck: la app expone /api/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--", "./entrypoint.sh"]
CMD ["node", "server.js"]
