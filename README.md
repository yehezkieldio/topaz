# Topaz

Personal reading tracker and metadata hub for fanfiction, webnovels, and online fiction.

## Development

Topaz is a Bun-first Next.js app backed by PostgreSQL, Drizzle, tRPC, NextAuth, and Biome/Ultracite.

```bash
bun install
cp .env.example .env
bun run db:push
bun dev
```

For local PostgreSQL with Docker:

```bash
just dev-up
```

## Environment

Required local variables:

- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_DISCORD_ID`
- `AUTH_DISCORD_SECRET`
- `ALLOWED_DISCORD_ID`

## Commands

- `bun run typecheck` - run TypeScript through `tsgo`
- `bun run lint` - run Biome checks
- `bun run check` - run Ultracite checks
- `bun run fix` - apply Ultracite fixes
- `bun run format` - apply Biome formatting
- `bun run db:generate` - generate Drizzle migrations
- `bun run db:migrate` - apply Drizzle migrations
- `bun run db:studio` - open Drizzle Studio
