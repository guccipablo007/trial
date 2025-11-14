# camsu-connect

Community web app for members, admins, and secretaries.

Stack: Next.js 14, TypeScript, Supabase (Auth/Postgres/RLS/Realtime).

## Setup

1. Create a Supabase project and copy the URL and anon key.
2. Copy `.env.example` to `.env.local` and fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Run the SQL in `supabase/schema.sql` in your Supabase SQL editor.
4. Install deps and run the app:

```bash
npm install
npm run dev
```

## Routes

- `/login` – Sign in, password reset
- `/signup` – Create account (goes to pending until admin activates)
- `/` – Dashboard
- `/members` – Directory, activation/disable (admin only controls)
- `/finance` – Loans and fines
- `/projects` – Projects and disbursements/contributions
- `/announcements` – Announcements
- `/meetings` – Meetings and minutes (rich text)
- `/admin` – Admin controls

## Notes

- Roles: `system_admin`, `secretary`, `member`. Member is read-only.
- New signups are `pending` until activated by an admin.
- Secretary can manage: meetings, announcements, fines, loans, minutes, projects.
- Loans default interest rate: 0.5% (stored as 0.5).
- Fines: free-form amounts and reasons (e.g., lateness, insubordination, non-payment of dues).

