FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin_web/package.json apps/admin_web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --prefer-offline --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

COPY . .
ENV ADMIN_API_BASE_URL=http://api:3000/api
RUN npm run build --workspace @massage-vn/admin-web

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --chown=node:node --from=build /app/package*.json ./
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/apps/admin_web ./apps/admin_web
COPY --chown=node:node --from=build /app/packages ./packages

EXPOSE 3000
USER node
CMD ["npm", "run", "start", "--workspace", "@massage-vn/admin-web"]
