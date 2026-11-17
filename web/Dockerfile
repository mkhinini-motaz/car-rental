# syntax=docker/dockerfile:1
# carweb as a container image. NEXT_PUBLIC_API_URL is compiled into the bundle by `next build`, so it
# is a build argument here, not runtime environment: a different API host means a different image.
# car-infra's compose.local.yml passes the local one; the build workflow passes production's.
# Needs `output: 'standalone'` in next.config.js, which is what makes the runtime stage this small.
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
