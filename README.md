# MIT Course Registration Portal

Production-ready Course Registration Portal for Madras Institute of Technology, Anna University.

The application prioritizes correctness and Firestore data integrity over visual complexity. Seat allocation is performed only inside a Firestore transaction. A successful registration updates the course seat counter, creates the registration document, and creates the register-number lock in the same atomic commit.

## Stack

- React + Vite
- Tailwind CSS
- Firebase Authentication with Google Sign-In
- Cloud Firestore
- Firebase SDK v10+
- Firebase Hosting config included
- Vercel deployment config included

## Critical Data Integrity Design

Registration uses `runTransaction` in `src/services/registration.js`.

Transaction flow:

1. Read `courses/{courseName}`.
2. Read `registrations/{googleUid}`.
3. Read `registerNumbers/{normalizedRegisterNumber}`.
4. Fail if the course is full.
5. Fail if the Google account already has a registration.
6. Fail if the Register Number already has a lock.
7. Increment `courses/{courseName}.filled`.
8. Create `registerNumbers/{normalizedRegisterNumber}`.
9. Create `registrations/{googleUid}`.
10. Commit.

If any step fails, Firestore rolls back the transaction. If one seat remains and 20 users submit at the same time, Firestore retries conflicting transactions and only one can commit the final seat increment.

The registration document ID is the Google UID, so browser refreshes, double clicks, or network retries cannot create multiple registration documents for the same Google account. The `registerNumbers` lock collection prevents a Register Number from being used twice.

## Firestore Collections

```text
courses/{courseName}
  capacity: number
  filled: number

registrations/{googleUid}
  googleUid: string
  googleEmail: string
  registerNumber: string
  registerNumberKey: string
  studentName: string
  selectedCourse: string
  createdAt: server timestamp
  createdAtClient: client timestamp fallback

registerNumbers/{normalizedRegisterNumber}
  googleUid: string
  registrationId: string
  selectedCourse: string
  createdAt: server timestamp
```

The helper `registerNumbers` collection is intentionally not readable by students or admins in the UI. It exists only to enforce Register Number uniqueness atomically.

## Firebase Setup

1. Create a Firebase project on the free Spark plan.
2. Enable Authentication > Sign-in method > Google.
3. Create a Cloud Firestore database.
4. Add a web app in Firebase project settings.
5. Copy `.env.example` to `.env.local` and fill in the Firebase web config:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

6. Deploy rules and indexes:

```bash
firebase deploy --only firestore
```

7. Seed course documents in Firestore using the values in `course-seed.json`:

```text
courses/IoT                  capacity: 35, filled: 0
courses/Robotics             capacity: 40, filled: 0
courses/Space Electronics    capacity: 35, filled: 0
courses/RTL                  capacity: 40, filled: 0
```

You can create these four documents from the Firebase Console while signed in as the authorized admin email.

## Security Rules

Security rules are in `firestore.rules`.

- Signed-in students can read course seat availability.
- Signed-in students can create exactly one registration document under their own Google UID.
- Students cannot list registrations or read another student's registration.
- Students can `get` only their own registration document because the client-side Firestore transaction must verify that the Google UID is unused before creating it.
- Students can `get` individual `registerNumbers` lock documents because the transaction must verify Register Number uniqueness. The lock documents contain no student name or email.
- Students cannot list `registerNumbers`.
- The authorized admin email `dharaneesh963@gmail.com` can read registrations for the dashboard and CSV export.
- Nobody can update or delete registrations.
- Course counter updates are accepted only when the same atomic write creates the matching registration and register-number lock.

If the app shows `Missing or insufficient permissions`, deploy Firestore rules first:

```bash
firebase deploy --only firestore
```

Then sign in with `dharaneesh963@gmail.com` and click **Verify / Create Courses** in the admin dashboard once.

## Local Development

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

For Google sign-in during local testing, prefer:

```text
http://localhost:5173/
```

If you use `http://127.0.0.1:5173/`, add `127.0.0.1` under Firebase Authentication > Settings > Authorized domains.

## Build

```bash
npm run build
```

## Deploy on Vercel

1. Push this project to a Git repository.
2. Import the repository in Vercel.
3. Set the six `VITE_FIREBASE_*` environment variables in Vercel project settings.
4. Deploy.

`vercel.json` is already configured for Vite single-page app routing.

## Admin Dashboard

Click **Admin Login** and sign in with:

```text
dharaneesh963@gmail.com
```

Any other Google account sees `Access Denied` and cannot access admin functionality.

The dashboard includes:

- Total registrations
- Course-wise counts
- Remaining seats
- Search by Register Number or Name
- Filter by Course
- Live updates
- Excel-compatible CSV download with UTF-8 BOM

## Operational Notes

- Show `Registration Successful` only after Firestore confirms the transaction commit.
- Keep the `filled` counters and registration documents in Firestore; do not cache confirmed registrations only in the browser.
- Do not manually edit `registrations` or `registerNumbers`.
- If a registration must be corrected, create a deliberate admin maintenance process outside this public portal and audit it carefully.
