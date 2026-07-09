# MIT Course Registration Portal

Production-ready Course Registration Portal for Madras Institute of Technology, Anna University.

The app now uses Supabase Auth and Supabase Postgres. Student registration is handled by one SQL function so duplicate register numbers, duplicate Google accounts, and course seat limits are checked inside the database transaction.

## Stack

- React + Vite
- Tailwind CSS
- Supabase Auth with Google OAuth
- Supabase Postgres
- Vercel deployment config included

## Supabase Setup

1. Create a Supabase project.
2. Go to `SQL Editor`.
3. Open `supabase-schema.sql` from this repository.
4. Paste the full script and click `Run`.
5. Go to `Authentication` > `Providers` > `Google` and enable Google.
6. In Google Cloud OAuth, add this authorized redirect URI:

```text
https://juxpythwroesnzeaiydm.supabase.co/auth/v1/callback
```

7. Add these redirect URLs in Supabase Auth URL settings:

```text
http://localhost:5173
https://aucpmitians.vercel.app
```

Use your exact Vercel domain if it is different.

## Environment Variables

Set these in `.env.local` for local development and in Vercel Project Settings for production:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
VITE_APP_URL=https://aucpmitians.vercel.app
```

Get both values from Supabase:

`Project Settings` > `API`

Use the public `anon` key, not the service role key.

Set Supabase `Authentication` > `URL Configuration` like this:

```text
Site URL:
https://aucpmitians.vercel.app

Redirect URLs:
http://localhost:5173
https://aucpmitians.vercel.app
```

## Database Tables

```text
courses
  name
  capacity
  filled
  created_at
  updated_at

registrations
  id
  google_uid
  google_email
  register_number
  student_name
  selected_course
  created_at
```

## Data Integrity

The client calls:

```text
register_student(register_number, student_name, selected_course)
```

The SQL function:

1. Requires a signed-in Supabase user.
2. Normalizes the register number.
3. Locks the selected course row.
4. Rejects duplicate Google accounts.
5. Rejects duplicate register numbers.
6. Rejects full courses.
7. Increments the course filled count.
8. Creates the registration row.

If any step fails, Postgres rolls back the transaction.

## Local Development

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

## Build

```bash
npm run build
```

## Deploy on Vercel

1. Push this project to GitHub.
2. Import the repository in Vercel.
3. Add `VITE_SUPABASE_URL`.
4. Add `VITE_SUPABASE_ANON_KEY`.
5. Deploy.

## Admin Dashboard

Sign in with:

```text
dharaneesh963@gmail.com
```

The dashboard includes:

- Total registrations
- Course-wise counts
- Remaining seats
- Search by Register Number or Name
- Filter by Course
- CSV download

## Verification

After deploying:

1. Sign in with Google.
2. Submit one student registration.
3. Open Supabase `Table Editor`.
4. Check `registrations` for the saved row.
5. Check `courses.filled` increased by 1.
