FROM node:lts-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build

FROM node:lts-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 8080
CMD ["node", "dist/server/entry.mjs"]

# docker build -t imranrdev/apps.obtainium.imranr.dev .
# docker push docker imranrdev/apps.obtainium.imranr.dev
# docker run --rm -d -p 8080:8080 --name apps.obtainium.imranr.dev imranrdev/apps.obtainium.imranr.dev