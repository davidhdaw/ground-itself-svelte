# Local Supabase Setup Guide

This guide will help you set up a local Supabase instance for development using Docker.

## Prerequisites

- Docker Desktop installed and running
- Node.js and npm installed

## Quick Start

If you just want to get started quickly:

1. **Install Supabase CLI** (choose one):
   ```bash
   # Option A: Homebrew (macOS - Recommended)
   brew install supabase/tap/supabase
   
   # Option B: npm
   npm install -g supabase
   
   # Option C: Use npx (no installation)
   npx supabase@latest start
   ```

2. **Start Supabase**:
   ```bash
   supabase start
   ```
   Copy the API URL and anon key from the output.

3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with the credentials from step 2
   ```

4. **Run migrations**:
   ```bash
   supabase db reset
   ```

5. **Generate TypeScript types**:
   ```bash
   npm run supabase:types
   ```

6. **Access Supabase Studio**: http://127.0.0.1:54323

---

## Detailed Setup Guide

### Option 1: Using Supabase CLI (Recommended)

The Supabase CLI provides the best developer experience and automatically manages Docker containers.

### 1. Install Supabase CLI

**Option A: Using Homebrew (Recommended for macOS)**

```bash
brew install supabase/tap/supabase
```

**Option B: Using npm**

If you encounter permission errors with npm, you may need to fix npm permissions first:
```bash
sudo chown -R $(whoami) ~/.npm
```

Then install:
```bash
npm install -g supabase
```

**Option C: Using npx (No installation required)**

You can use npx to run Supabase CLI without installing globally:
```bash
npx supabase@latest start
```

**Verify Installation:**

After installation, verify it works:
```bash
supabase --version
```

### 2. Initialize Supabase (if not already done)

```bash
supabase init
```

This creates the `supabase/` directory structure if it doesn't exist.

### 3. Start Supabase

```bash
supabase start
```

This command will:
- Pull the required Docker images
- Start all Supabase services (PostgreSQL, Auth, Storage, Realtime, etc.)
- Display connection credentials

**Important**: Save the output! It will show:
- API URL (usually `http://127.0.0.1:54321`)
- Anon Key (for `PUBLIC_SUPABASE_ANON_KEY`)
- Service Role Key (for admin operations)
- Database URL
- Studio URL (usually `http://127.0.0.1:54323`)

### 4. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Then edit `.env` and add the values from step 3:

```env
PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
PUBLIC_SUPABASE_ANON_KEY=<your-anon-key-from-supabase-start>
```

### 5. Run Database Migrations

The migration file is already created at `supabase/migrations/001_initial_schema.sql`. To apply it:

```bash
supabase db reset
```

This will:
- Reset the database
- Run all migrations in `supabase/migrations/`
- Seed the database with any seed files

### 6. Access Supabase Studio

Open your browser and navigate to:
```
http://127.0.0.1:54323
```

This is the Supabase Studio web interface where you can:
- View and edit database tables
- Test API endpoints
- Manage authentication
- View logs

## Option 2: Manual Docker Compose (Alternative)

If you prefer not to use the CLI, you can use Docker Compose directly. However, the Supabase CLI is strongly recommended as it handles configuration and updates automatically.

### 1. Clone Supabase Docker Repository

```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your desired settings
```

### 3. Start Services

```bash
docker-compose up -d
```

### 4. Access Supabase Studio

Navigate to `http://localhost:8000`

**Note**: This method requires manual configuration and is more complex. The CLI method is recommended.

## Useful Commands

### Stop Supabase
```bash
supabase stop
```

### View Logs
```bash
supabase logs
```

### Reset Database (applies all migrations)
```bash
supabase db reset
```

### Generate TypeScript Types
After your schema is set up, generate TypeScript types:

```bash
supabase gen types typescript --local > src/lib/supabase/types.ts
```

### Check Status
```bash
supabase status
```

## Troubleshooting

### Port Already in Use
If you get port conflicts, you can modify ports in `supabase/config.toml`.

### Docker Not Running
Make sure Docker Desktop is running before starting Supabase.

### Reset Everything
If something goes wrong:
```bash
supabase stop
supabase start
supabase db reset
```

## Next Steps

After setting up Supabase locally:

1. ✅ Verify the connection by checking Supabase Studio
2. ✅ Run the migration: `supabase db reset`
3. ✅ Generate TypeScript types: `supabase gen types typescript --local > src/lib/supabase/types.ts`
4. ✅ Update your `.env` file with the correct credentials
5. ✅ Test the connection by running your SvelteKit app

## Production Deployment

When ready to deploy to production:
1. Create a Supabase project at https://supabase.com
2. Link your local project: `supabase link --project-ref <your-project-ref>`
3. Push migrations: `supabase db push`
4. Update production environment variables
