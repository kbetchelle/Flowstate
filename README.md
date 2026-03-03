# Flowstate

Task and directory management app — rebuild.

- **Rebuild scope** is defined in [docs/APP_SPEC_REBUILD.md](docs/APP_SPEC_REBUILD.md).
- **Implementation order** is in [docs/BUILD_PHASES_GUIDE.md](docs/BUILD_PHASES_GUIDE.md).

## Setup

1. Copy `.env.example` to `.env` and set:
   - `VITE_SUPABASE_URL` — your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` — your Supabase anon/public key

2. Install dependencies and run:

   ```bash
   npm install
   npm run dev
   ```

Do not commit real keys; `.env` should be in `.gitignore`.
