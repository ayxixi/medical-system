FROM node:20-alpine AS web-dependencies
WORKDIR /web
COPY apps/web/package*.json ./
RUN npm ci --include=dev --no-audit --no-fund --fetch-retries=5 --fetch-timeout=120000

FROM web-dependencies AS web-build
COPY apps/web ./
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM node:20-alpine AS server-dependencies
WORKDIR /app
COPY apps/server/package*.json ./
RUN npm ci --include=dev --no-audit --no-fund --fetch-retries=5 --fetch-timeout=120000

FROM server-dependencies AS server-build
COPY apps/server ./
RUN npx prisma generate && npm run build && npm prune --omit=dev

FROM nginx:1.27-alpine AS runtime
COPY --from=web-build /web/dist /usr/share/nginx/html
COPY --from=server-build /app/node_modules /app/node_modules
COPY --from=server-build /app/dist /app/dist
COPY --from=server-build /app/prisma /app/prisma
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY docker/container-entrypoint.sh /usr/local/bin/medical-entrypoint
RUN chmod 755 /usr/local/bin/medical-entrypoint && mkdir -p /data/uploads && chown -R nginx:nginx /data
ENV NODE_ENV=production PORT=3000 BIND_HOST=127.0.0.1 DATABASE_URL=file:/data/medical.db UPLOAD_PATH=/data/uploads
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=45s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
ENTRYPOINT ["medical-entrypoint"]
CMD ["nginx", "-g", "daemon off;"]
