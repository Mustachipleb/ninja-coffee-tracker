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
# Set DATABASE_URL for prisma generate (just needs to be set, actual DB not required)
ENV DATABASE_URL="file:./prisma/dev.db"
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
RUN mkdir -p /data
ENV DATABASE_URL="file:/data/coffee.db"
# Mount a volume over /data to persist the SQLite database across container
# restarts/recreations (it is NOT under /app/prisma, which only holds the
# schema/migrations baked into the image).
VOLUME /data
# Apply any pending migrations to the SQLite file, then start the app.
#
# Optionally set ADMIN_USERNAME and ADMIN_PASSWORD to auto-create a first
# admin user on startup (only if no user with that name exists yet).
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
