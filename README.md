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

3. **Set up HTTPS for mobile testing** (optional):

   ```bash
   # Install mkcert if not already installed
   brew install mkcert

   # Run the HTTPS setup script
   ./scripts/setup-https.sh
   ```

   This generates SSL certificates for localhost and your local IP address, enabling HTTPS access from mobile devices on the same network.

4. **Start development server**:

   ```bash
   npm run dev
   ```

   The server will automatically use HTTPS if certificates are present. Access it at:
   - Local: `https://localhost:5173`
   - Mobile (same network): `https://YOUR_LOCAL_IP:5173` (IP shown by setup script)

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

## HTTPS Setup for Mobile Testing

To test on mobile devices over your local network:

1. **Run the HTTPS setup script**:

   ```bash
   ./scripts/setup-https.sh
   ```

   This will:
   - Install the mkcert CA (requires password once)
   - Detect your local IP address
   - Generate SSL certificates for localhost and your local IP

2. **Install the root CA on your mobile device** (required for HTTPS to work):

   **For iOS:**
   - Get your Mac's local IP: `ipconfig getifaddr en0`
   - On your Mac, run: `mkcert -CAROOT` to see the CA directory
   - Copy `rootCA.pem` from that directory to your iPhone (via AirDrop, email, or iCloud)
   - On iPhone: Settings → General → VPN & Device Management → Install the profile
   - Enable "Full Trust" for the root certificate in Settings → General → About → Certificate Trust Settings

   **For Android:**
   - Get your Mac's local IP: `ipconfig getifaddr en0`
   - On your Mac, run: `mkcert -CAROOT` to see the CA directory
   - Copy `rootCA.pem` from that directory to your Android device
   - On Android: Settings → Security → Install from storage → Select the certificate
   - Name it "mkcert" and set it as a "VPN and apps" certificate

3. **Start the dev server**:

   ```bash
   npm run dev
   ```

4. **Access from mobile**:
   - Find your local IP (shown by setup script, or run `ipconfig getifaddr en0` on macOS)
   - On your mobile device, navigate to: `https://YOUR_LOCAL_IP:5173`
   - The connection should now be trusted (no security warnings)

**Troubleshooting**:

- If the setup script can't detect your IP, manually add it: `mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost.pem localhost 127.0.0.1 ::1 YOUR_LOCAL_IP`
- Make sure your mobile device is on the same WiFi network
- Ensure your Mac's firewall allows incoming connections on port 5173
- If you still see security warnings, verify the root CA is installed and trusted on your mobile device

## Documentation

- [SETUP.md](./SETUP.md) - Local Supabase setup guide
- [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) - Implementation plan and progress
