FROM node:20-alpine
RUN apk add --no-cache git
WORKDIR /app
RUN npm install -g pnpm@10
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN BASE_PATH=/ pnpm --filter @workspace/web build
RUN pnpm --filter @workspace/api-server build
EXPOSE 3000
CMD ["node", "artifacts/api-server/dist/index.cjs"]
