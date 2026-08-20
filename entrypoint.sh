#!/bin/sh

# Punto de entrada del contenedor (modo persistente).
# Los cron jobs los gestiona node-cron dentro del proceso Node (cronJobs.js),
# así que aquí solo lanzamos la aplicación principal.
echo "Iniciando la aplicación principal (Node.js server)..."
exec "$@"
