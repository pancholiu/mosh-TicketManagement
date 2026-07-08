# Single-service image: Express serves both the API and the built React client
# from one origin (see server/src/app.ts). Bun runs the server's TypeScript
# source directly, so only the client needs a build step.

FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN bun install --frozen-lockfile

FROM deps AS build
COPY . .
RUN bunx prisma generate
RUN bun run --filter client build

FROM base AS release
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/server ./server
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/package.json ./package.json

EXPOSE 3000

# Applies pending migrations before the server (and its in-process pg-boss
# workers) start — there's no separate release phase on Railway.
CMD ["sh", "-c", "bunx prisma migrate deploy && bun server/src/index.ts"]
