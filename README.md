<div align="center">

<img src="public/topaz.jpg" align="center" width="150px" height="150px">

<h3>Topaz</h3>
<p>A personal reading tracker and metadata hub for fanfiction, webnovels, and online fiction.</p>

</div>

---

## Overview

Topaz is a personal platform built to track, organize, and revisit my reading journey through fanfiction, webnovels, and serialized internet fiction. It is tailored specifically for fanfic and long-form web content. Topaz helps me catalog what I've read, what I'm currently reading, and what I want to return to, without relying on fragile browser bookmarks, cluttered spreadsheets, or unreliable third-party services.

## Features

- Track reading progress across multiple platforms (AO3, FFN, Wattpad, RoyalRoad, and more)
- Organize stories with custom tags and fandoms
- Monitor reading status (Reading, Completed, Paused, Plan to Read, Dropped)
- Rate stories and add personal notes
- Full-text search across titles, authors, descriptions, tags, and fandoms
- View detailed library statistics and insights

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) 20.x+ or [Bun](https://bun.sh/) 1.x+
- [PostgreSQL](https://www.postgresql.org/) 14.x+
- [Docker](https://www.docker.com/) (optional, for local PostgreSQL)
- [Discord Application](https://discord.com/developers/applications) (for authentication)

### Building from Source

1. **Clone the repository**

   ```bash
   git clone https://github.com/yehezkieldio/topaz.git
   cd topaz
   ```

2. **Install dependencies**

   Using Bun (recommended):
   ```bash
   bun install
   ```

3. **Set up environment variables**

   Copy the example environment file and fill in your credentials:
   ```bash
   cp .env.example .env
   ```

   Required environment variables:
   - `DATABASE_URL` - PostgreSQL connection string
   - `AUTH_SECRET` - Random secret for NextAuth (generate with `openssl rand -base64 32`)
   - `AUTH_DISCORD_ID` - Discord OAuth client ID
   - `AUTH_DISCORD_SECRET` - Discord OAuth client secret
   - `ALLOWED_DISCORD_ID` - Your Discord user ID (restricts entry creation to your account only)

4. **Set up the database**

   If using Docker for local development (requires [just](https://github.com/casey/just) command runner):
   ```bash
   just dev-up
   ```

   Or using Docker directly:
   ```bash
   docker compose up
   ```

   Push the database schema:
   ```bash
   bun run db:push
   ```

5. **Start the development server**

   ```bash
   bun dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

6. **Build for production**

   ```bash
   bun run build
   bun start
   ```

### Additional Commands

- `bun run db:generate` - Generate database migrations
- `bun run db:migrate` - Apply database migrations
- `bun run db:studio` - Open Drizzle Studio for database management
- `bun run check` - Run Biome linter and formatter checks
- `bun run typecheck` - Run TypeScript type checking

## License

This project is licensed under the [MIT license](LICENSE).
