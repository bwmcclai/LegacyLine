# Legacy Line — Noblesville Schools

> A premium audio-legacy app for Noblesville graduating seniors to leave voice messages for the next generation of Millers.

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Create your `.env.local`
```bash
cp .env.local.example .env.local
```
Then fill in your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Set up Supabase

**Database:** Run `supabase/schema.sql` in your Supabase SQL Editor.

**Storage Buckets:** In Supabase → Storage, create two **public** buckets:
- `legacy-audio`
- `legacy-selfies`

For each bucket, set policies:
- **INSERT**: allow all (`true`)
- **SELECT**: allow all (`true`)

### 4. Run locally
```bash
npm run dev
```

### 5. Deploy to Vercel
1. Push to GitHub
2. Import repo in Vercel
3. Add the two env vars in Vercel project settings
4. Deploy!

---

## NFC Tag Setup (tagstotap.com)

| Tag | URL |
|-----|-----|
| **Recording tag** | `https://your-domain.com/record` |
| **Listening wall tag** | `https://your-domain.com/` |

---

## Pages

- **`/`** — The Legacy Wall: immersive Three.js visualization where 50 orbs form the Noblesville "N". Gold orbs = recorded messages; tap to play.
- **`/record`** — The recording page: intro → record (up to 20s) → review → name + selfie → submit.

## Tech Stack
- Next.js 14 (App Router)
- Three.js + React Three Fiber + Drei
- Framer Motion
- Tailwind CSS (Noblesville black & gold theme)
- Supabase (Postgres + Storage)
