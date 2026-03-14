FROM node:20-alpine
RUN apk add --no-cache git
WORKDIR /app
RUN npm install -g pnpm@10
ARG RAILWAY_GIT_COMMIT_SHA=unknown
RUN echo "Building commit: $RAILWAY_GIT_COMMIT_SHA"
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN BASE_PATH=/ pnpm --filter @workspace/web build
RUN pnpm --filter @workspace/api-server build
RUN chmod +x /app/start.sh
EXPOSE 3000
CMD ["/bin/sh", "/app/start.sh"]
