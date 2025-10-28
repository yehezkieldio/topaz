<div align="center">

<img src="public/topaz.jpg" align="center" width="150px" height="150px">

<h3>Topaz</h3>
<p>A personal reading tracker and metadata hub for fanfiction, webnovels, and online fiction.</p>

</div>

---

## Overview

Topaz is a personal platform built to track, organize, and revisit my reading journey through fanfiction, webnovels, and serialized internet fiction. It is tailored specifically for fanfic and long-form web content. Topaz helps me catalog what I've read, what I'm currently reading, and what I want to return to, without relying on fragile browser bookmarks, cluttered spreadsheets, or unreliable third-party services.

Built with modern web technologies, Topaz provides a fast, responsive, and intuitive interface for managing your digital reading library. While this space is built for me, it is open for anyone to explore, fork, and adapt for their own use.

## Features

- Track reading progress across multiple platforms (AO3, FFN, Wattpad, RoyalRoad, and more)
- Organize stories with custom tags and fandoms
- Monitor reading status (Reading, Completed, Paused, Plan to Read, Dropped)
- Rate stories and add personal notes
- Full-text search across titles, authors, descriptions, tags, and fandoms
- View detailed library statistics and insights
- Discord OAuth authentication for secure access
- Optimized performance with PostgreSQL materialized views and Next.js Cache Components
- Mobile-responsive design with dark mode support

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) 20+ or [Bun](https://bun.sh/) 1.0+
- [PostgreSQL](https://www.postgresql.org/) 14+
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

   Or using npm:
   ```bash
   npm install
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
   - `ALLOWED_DISCORD_ID` - Your Discord user ID (optional, restricts access to your account only)

4. **Set up the database**

   If using Docker for local development:
   ```bash
   just dev-up
   ```

   Push the database schema:
   ```bash
   npm run db:push
   ```

5. **Start the development server**

   Using Bun:
   ```bash
   bun dev
   ```

   Or using npm:
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

6. **Build for production**

   ```bash
   npm run build
   npm start
   ```

### Additional Commands

- `npm run db:generate` - Generate database migrations
- `npm run db:migrate` - Apply database migrations
- `npm run db:studio` - Open Drizzle Studio for database management
- `npm run check` - Run Biome linter and formatter checks
- `npm run typecheck` - Run TypeScript type checking

## License

This project is licensed under the [MIT license](LICENSE).
