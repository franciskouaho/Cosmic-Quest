FROM node:20-alpine as base

# Configurer l'environnement pour limiter la mémoire
ENV NODE_OPTIONS="--max-old-space-size=256"

# Configuration pour Yarn 4
RUN corepack enable && corepack prepare yarn@stable --activate

# Stage de build unique
FROM base as build
WORKDIR /app

# Copier uniquement les fichiers nécessaires pour installer les dépendances
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn

# Installer les dépendances avec les options de Yarn 4
# --immutable est correct pour Yarn 4, mais network-concurrency n'existe pas
RUN yarn install --immutable --network-timeout 100000

# Copier le reste des fichiers
COPY . .

# Build de l'application
RUN node ace build

# Stage de production
FROM base as production
ENV NODE_ENV=production
WORKDIR /app

# Installation de ffmpeg dans une étape séparée avec plus de mémoire disponible
RUN apk update && apk add --no-cache ffmpeg

COPY --from=build /app/build .
COPY --from=build /app/node_modules ./node_modules

# Si vous utilisez Yarn Zero-Installs, vous pourriez aussi avoir besoin de ceci:
COPY --from=build /app/.yarn ./.yarn
COPY --from=build /app/.yarnrc.yml ./

EXPOSE 3333
CMD ["node", "./bin/server.js"]
