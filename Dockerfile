FROM node:lts-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY . .
RUN npm run build

FROM node:lts-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 8080
CMD ["node", "dist/server/entry.mjs"]

# docker build -t imranrdev/apps.obtainium.page .
# docker push imranrdev/apps.obtainium.page
# docker run --rm -d -p 8080:8080 --name apps.obtainium.page imranrdev/apps.obtainium.page
