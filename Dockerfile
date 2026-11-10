FROM node:lts-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build

FROM node:lts-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS runtime
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
