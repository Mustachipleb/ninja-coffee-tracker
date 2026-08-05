FROM node:24-alpine AS development-dependencies-env
COPY . /app
WORKDIR /app
RUN npm ci

FROM node:24-alpine AS production-dependencies-env
COPY ./package.json package-lock.json /app/
WORKDIR /app
RUN npm ci --omit=dev

FROM node:24-alpine AS build-env
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN npx prisma generate
RUN npm run build

FROM node:24-alpine
COPY ./package.json package-lock.json /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
COPY --from=build-env /app/generated /app/generated
COPY --from=build-env /app/prisma /app/prisma
COPY --from=build-env /app/prisma.config.ts /app/prisma.config.ts
WORKDIR /app
ENV DATABASE_URL="file:/data/coffee.db"
# Apply any pending migrations to the SQLite file (mount a volume over
# /app/prisma to persist data across container restarts) then start the app.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
