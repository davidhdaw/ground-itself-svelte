# Ground Itself - TTRPG Online

An online real-time version of "The Ground Itself" storytelling TTRPG built with Svelte 5, TypeScript, and Supabase.

## Getting Started

### Prerequisites

- Node.js and npm
- Docker Desktop (for local Supabase)

### Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up local Supabase**:
   See [SETUP.md](./SETUP.md) for detailed instructions, or follow the quick start:
   ```bash
   # Install Supabase CLI
   brew install supabase/tap/supabase  # or: npm install -g supabase
   
   # Start Supabase
   supabase start
   
   # Copy credentials to .env
   cp .env.example .env
   # Edit .env with credentials from 'supabase start' output
   
   # Run migrations
   supabase db reset
   
   # Generate TypeScript types
   npm run supabase:types
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

## Project Structure

- `src/lib/supabase/` - Supabase client utilities
- `src/routes/` - SvelteKit routes
- `supabase/migrations/` - Database migrations
- `MIGRATION_PLAN.md` - Implementation plan and progress

## Development

```bash
# Start dev server
npm run dev

# Type check
npm run check

# Lint
npm run lint

# Format code
npm run format
```

## Supabase Commands

```bash
npm run supabase:start    # Start Supabase
npm run supabase:stop     # Stop Supabase
npm run supabase:reset    # Reset database and apply migrations
npm run supabase:status   # Check Supabase status
npm run supabase:types    # Generate TypeScript types
```

## Documentation

- [SETUP.md](./SETUP.md) - Local Supabase setup guide
- [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) - Implementation plan and progress
