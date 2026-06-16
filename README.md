# Topaz

Personal reading tracker and metadata hub for fanfiction, webnovels, and online fiction.

## Development

Topaz is a Bun-first Next.js app backed by PostgreSQL, Drizzle, tRPC, NextAuth, and Biome/Ultracite.

```bash
bun install
cp .env.example .env
bun run db:prepare:v2
bun run db:push
bun run db:seed:v2
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
- `bun run db:prepare:v2` - install required V2 PostgreSQL extensions (`citext`, `pg_trgm`)
- `bun run db:push` - push the active schema to a local database
- `bun run db:seed:v2` - seed V2 reference data (`source_platform`, `taxonomy_kind`)
- `bun run db:seed:v2:fixture` - seed reference data plus one fixture library item for local UI verification
- `bun run db:studio` - open Drizzle Studio
- `bun run verify:v2:admin` - verify authenticated V2 admin tRPC create/update/taxonomy/filter/delete flow against a running dev server
- `bun run verify:v2:browser-admin` - verify Chrome-driven authenticated admin create/edit/delete UI flow against a running dev server
- `bun run verify:v2:public` - verify public V2 home/library render plus library search and filters against a running dev server

## V2 Local Reset

Topaz V2 is a hard cut from the old `story`/`progress` schema. For local development, reset the local database or use a fresh database before applying the V2 schema:

```bash
bun run db:prepare:v2
bun run db:push
bun run db:seed:v2
```

For a quick manual verification dataset:

```bash
bun run db:seed:v2:fixture
```
