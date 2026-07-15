FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin_web/package.json apps/admin_web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --prefer-offline --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

COPY . .
ENV DATABASE_URL=postgresql://massage:massage@postgres:5432/massage_vn?schema=public
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npm run build --workspace @massage-vn/api

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/packages ./packages

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "@massage-vn/api"]
