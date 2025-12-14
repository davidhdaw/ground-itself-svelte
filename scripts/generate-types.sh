#!/bin/bash
# Generate TypeScript types from Supabase schema
# Usage: ./scripts/generate-types.sh

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "Error: Supabase CLI is not installed."
    echo "Install it with: npm install -g supabase"
    exit 1
fi

# Check if Supabase is running
if ! supabase status &> /dev/null; then
    echo "Error: Supabase is not running."
    echo "Start it with: supabase start"
    exit 1
fi

# Generate types
echo "Generating TypeScript types from Supabase schema..."
supabase gen types typescript --local > src/lib/supabase/types.ts

if [ $? -eq 0 ]; then
    echo "✅ Types generated successfully at src/lib/supabase/types.ts"
else
    echo "❌ Failed to generate types"
    exit 1
fi
