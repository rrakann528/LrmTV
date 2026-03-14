FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm@10
# cache-bust: 2026-03-14-v3
COPY . .
RUN echo "=== Workspace structure ===" && ls -la && echo "=== lib ===" && ls -la lib/ 2>/dev/null || echo "NO lib dir" && echo "=== artifacts ===" && ls -la artifacts/
RUN pnpm install --no-frozen-lockfile
RUN BASE_PATH=/ pnpm --filter @workspace/web build
RUN pnpm --filter @workspace/api-server build
EXPOSE 3000
CMD ["node", "artifacts/api-server/dist/index.cjs"]
