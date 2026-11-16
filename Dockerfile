FROM node:lts-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build

FROM node:lts-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
USER node
EXPOSE 8080
CMD ["node", "dist/server/entry.mjs"]

# docker build -t ghcr.io/imranr98/apps.obtainium.imranr.dev .
# docker push ghcr.io/imranr98/apps.obtainium.imranr.dev
# docker run --rm -d -p 8080:8080 --name apps.obtainium.imranr.dev ghcr.io/imranr98/apps.obtainium.imranr.dev:latest
#
# CI publishes latest and sha-<commit> tags to this GHCR image; the old
# imranrdev/apps.obtainium.imranr.dev Docker Hub image is deprecated.
