# Build dashboard
FROM node:24.22.2-bookworm@sha256:e7add2a490bb17d97b485b8641bd88455fff7839ade0f5eba493c3508124d413 AS web-build
ARG LATER_PUBLIC_BASE_PATH=./
ENV VITE_PUBLIC_BASE_PATH=${LATER_PUBLIC_BASE_PATH}
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Build server and worker
FROM node:24.22.2-bookworm@sha256:e7add2a490bb17d97b485b8641bd88455fff7839ade0f5eba493c3508124d413 AS server-build
WORKDIR /app
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# Production dependencies
FROM node:24.22.2-bookworm@sha256:e7add2a490bb17d97b485b8641bd88455fff7839ade0f5eba493c3508124d413 AS server-production
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev

FROM node:24.22.2-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c
WORKDIR /app
ENV NODE_ENV=production
COPY --from=server-build /app/dist ./dist
COPY --from=server-production /app/node_modules ./node_modules
COPY --from=server-production /app/package.json ./package.json
COPY --from=web-build /app/web/dist ./public
EXPOSE 3000
CMD ["node", "dist/index.js"]
