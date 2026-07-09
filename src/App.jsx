import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  GraduationCap,
  Loader2,
  LogIn,
  LogOut,
  Search,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { onSnapshot, orderBy, query } from 'firebase/firestore';
import { ADMIN_EMAIL, COURSE_ORDER } from './constants';
import { isFirebaseConfigured, missingFirebaseConfig } from './firebase';
import { useAuth } from './hooks/useAuth';
import { useCourses } from './hooks/useCourses';
import {
  getCourseSetupStatus,
  getMyRegistration,
  registerStudent,
  registrationsCollection,
  seedMissingCourses
} from './services/registration';
import { formatTimestamp, toExcelCsv } from './utils';

function friendlyAuthError(error) {
  if (!error) return '';
  if (error.code === 'auth/unauthorized-domain') {
    return 'Google sign-in is blocked because this local domain is not authorized in Firebase. Add 127.0.0.1 and localhost in Firebase Authentication > Settings > Authorized domains.';
  }
  if (error.code === 'auth/popup-closed-by-user') {
    return 'Google sign-in was closed before completion.';
  }
  return error.message || 'Google sign-in failed. Please try again.';
}

function Header({ user, signOut }) {
  return (
    <header className="bg-white">
      <div className="border-b-4 border-mit-red bg-mit-ink text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wide">
          <span>Official MIT Course Registration</span>
          <span>Anna University</span>
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-md bg-mit-red text-white">
            <GraduationCap size={28} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-mit-red">
              Madras Institute of Technology
            </p>
            <h1 className="text-2xl font-semibold text-mit-ink">Course Registration Portal</h1>
            <p className="text-sm text-slate-600">For MIT, By MITians</p>
          </div>
        </div>
        {user ? (
          <button className="btn-secondary" onClick={signOut} type="button">
            <LogOut size={18} aria-hidden="true" />
            Sign out
          </button>
        ) : null}
      </div>
    </header>
  );
}

function StatusStrip() {
  return (
    <section className="status-strip" aria-label="Portal status">
      <div className="status-item">
        <Database size={18} aria-hidden="true" />
        <span>Atomic Firestore transactions</span>
      </div>
      <div className="status-item">
        <UserCheck size={18} aria-hidden="true" />
        <span>One registration per student</span>
      </div>
      <div className="status-item">
        <Clock3 size={18} aria-hidden="true" />
        <span>Live seat counters after sign-in</span>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-mit-line bg-white py-6 text-center text-sm text-slate-600">
      <p className="font-medium text-mit-ink">Developed by Team MITians</p>
      <p>Madras Institute of Technology</p>
    </footer>
  );
}

function Notice({ type = 'info', children }) {
  const isError = type === 'error';
  const isSuccess = type === 'success';
  return (
    <div className={`notice ${isError ? 'notice-error' : ''} ${isSuccess ? 'notice-success' : ''}`}>
      {isSuccess ? <CheckCircle2 size={19} /> : <AlertCircle size={19} />}
      <span>{children}</span>
    </div>
  );
}

function CourseAvailability({ courses }) {
  return (
    <section className="form-panel">
      <div className="section-title">
        <h2>Live Seat Availability</h2>
        <p>Updated in real time from Firestore course counters.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {courses.map((course) => (
          <div className="course-row" key={course.name}>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-mit-ink">{course.name}</p>
              <p className="text-sm text-slate-600">
                {course.full ? 'FULL' : `${course.remaining} / ${course.capacity} Remaining`}
              </p>
              <div className="seat-track" aria-hidden="true">
                <div
                  className={course.full ? 'seat-fill seat-fill-full' : 'seat-fill'}
                  style={{ width: `${course.capacity ? (course.filled / course.capacity) * 100 : 0}%` }}
                />
              </div>
            </div>
            <span className={course.full ? 'pill pill-full' : 'pill'}>
              {course.full ? 'FULL' : `${course.filled}/${course.capacity}`}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SignInPanel({ onSignIn, authError, signingIn }) {
  return (
    <section className="form-panel">
      <div className="section-title">
        <h2>Student Sign In</h2>
        <p>Use your Google account before opening the registration form.</p>
      </div>
      {authError ? <Notice type="error">{authError}</Notice> : null}
      <button className="btn-primary w-full justify-center sm:w-auto" disabled={signingIn} onClick={onSignIn} type="button">
        {signingIn ? <Loader2 className="animate-spin" size={19} /> : <LogIn size={19} aria-hidden="true" />}
        {signingIn ? 'Opening Google sign-in' : 'Continue with Google'}
      </button>
    </section>
  );
}

function StudentRegistration({ user, courses }) {
  const [form, setForm] = useState({ registerNumber: '', studentName: '', selectedCourse: '' });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [existing, setExisting] = useState(null);
  const [checkingStored, setCheckingStored] = useState(true);

  useEffect(() => {
    let active = true;
    setCheckingStored(true);
    setError('');
    getMyRegistration(user)
      .then((storedRegistration) => {
        if (!active) return;
        setExisting(storedRegistration);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Could not verify existing registration.');
      })
      .finally(() => {
        if (active) setCheckingStored(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    const preventRefresh = (event) => {
      if (!submitting) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventRefresh);
    return () => window.removeEventListener('beforeunload', preventRefresh);
  }, [submitting]);

  async function onSubmit(event) {
    event.preventDefault();
    if (submitting || existing) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await registerStudent({ user, ...form });
      const storedRegistration = await getMyRegistration(user);
      if (!storedRegistration) {
        throw new Error('Registration committed, but the saved document could not be verified. Please contact admin before retrying.');
      }
      setExisting(storedRegistration);
      setMessage('Registration Successful. Saved in Firestore.');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingStored) {
    return (
      <section className="form-panel">
        <div className="loading-line">
          <Loader2 className="animate-spin" size={18} />
          Checking saved registration
        </div>
      </section>
    );
  }

  if (existing) {
    return (
      <section className="form-panel">
        <Notice type="success">{message || 'Saved registration found in Firestore.'}</Notice>
        <div className="confirmation-grid">
          <span>Register Number</span>
          <strong>{existing.registerNumber}</strong>
          <span>Student Name</span>
          <strong>{existing.studentName}</strong>
          <span>Course</span>
          <strong>{existing.selectedCourse}</strong>
        </div>
      </section>
    );
  }

  return (
    <section className="form-panel">
      <div className="section-title">
        <h2>Registration Form</h2>
        <p>All fields are mandatory. Submit only after verifying your details.</p>
      </div>
      {error ? <Notice type="error">{error}</Notice> : null}
      {message ? <Notice type="success">{message}</Notice> : null}
      <form className="space-y-5" onSubmit={onSubmit}>
        <label className="field-label">
          Register Number
          <input
            required
            autoComplete="off"
            className="text-input"
            disabled={submitting}
            maxLength={20}
            onChange={(event) => setForm((prev) => ({ ...prev, registerNumber: event.target.value }))}
            placeholder="Example: 2024501001"
            value={form.registerNumber}
          />
        </label>
        <label className="field-label">
          Student Name
          <input
            required
            autoComplete="name"
            className="text-input"
            disabled={submitting}
            maxLength={80}
            onChange={(event) => setForm((prev) => ({ ...prev, studentName: event.target.value }))}
            placeholder="Enter full name"
            value={form.studentName}
          />
        </label>
        <label className="field-label">
          Course Choice
          <select
            required
            className="text-input"
            disabled={submitting}
            onChange={(event) => setForm((prev) => ({ ...prev, selectedCourse: event.target.value }))}
            value={form.selectedCourse}
          >
            <option value="">Select a course</option>
            {courses.map((course) => (
              <option disabled={course.full} key={course.name} value={course.name}>
                {course.name} {course.full ? '(FULL)' : `(${course.remaining} seats left)`}
              </option>
            ))}
          </select>
        </label>
        <button className="btn-primary w-full justify-center" disabled={submitting} type="submit">
          {submitting ? <Loader2 className="animate-spin" size={19} /> : <CheckCircle2 size={19} />}
          {submitting ? 'Submitting' : 'Submit Registration'}
        </button>
      </form>
    </section>
  );
}

function AdminLogin({ user, onSignIn, authError, signingIn }) {
  const denied = user && user.email !== ADMIN_EMAIL;
  return (
    <section className="form-panel">
      <div className="section-title">
        <h2>Admin Login</h2>
        <p>Authorized Google account only.</p>
      </div>
      {denied ? <Notice type="error">Access Denied</Notice> : null}
      {authError ? <Notice type="error">{authError}</Notice> : null}
      <button className="btn-secondary w-full justify-center" disabled={signingIn} onClick={onSignIn} type="button">
        {signingIn ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} aria-hidden="true" />}
        {signingIn ? 'Opening Google sign-in' : 'Admin Login'}
      </button>
    </section>
  );
}

function AdminDashboard({ courses }) {
  const [registrations, setRegistrations] = useState([]);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ search: '', course: 'All' });
  const [setupStatus, setSetupStatus] = useState([]);
  const [setupMessage, setSetupMessage] = useState('');
  const [setupLoading, setSetupLoading] = useState(true);

  useEffect(() => {
    return onSnapshot(
      query(registrationsCollection(), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setRegistrations(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      },
      (err) => setError(err.message)
    );
  }, []);

  useEffect(() => {
    let active = true;
    setSetupLoading(true);
    getCourseSetupStatus()
      .then((status) => {
        if (active) setSetupStatus(status);
      })
      .catch((err) => {
        if (active) setSetupMessage(err.message || 'Could not check Firestore course setup.');
      })
      .finally(() => {
        if (active) setSetupLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return registrations.filter((item) => {
      const courseMatch = filters.course === 'All' || item.selectedCourse === filters.course;
      const searchMatch =
        !search ||
        item.registerNumber?.toLowerCase().includes(search) ||
        item.studentName?.toLowerCase().includes(search);
      return courseMatch && searchMatch;
    });
  }, [filters, registrations]);

  const courseCounts = useMemo(() => {
    const counts = Object.fromEntries(COURSE_ORDER.map((course) => [course, 0]));
    registrations.forEach((registration) => {
      counts[registration.selectedCourse] = (counts[registration.selectedCourse] ?? 0) + 1;
    });
    return counts;
  }, [registrations]);

  function downloadCsv() {
    const csv = `\uFEFF${toExcelCsv(filtered)}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mit-course-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function onSeedCourses() {
    setSetupLoading(true);
    setSetupMessage('');
    try {
      const status = await seedMissingCourses();
      setSetupStatus(status);
      setSetupMessage('Course storage setup verified. Missing course documents were created if needed.');
    } catch (err) {
      setSetupMessage(err.message || 'Could not create course documents.');
    } finally {
      setSetupLoading(false);
    }
  }

  const setupReady = setupStatus.length === COURSE_ORDER.length && setupStatus.every((course) => course.valid);

  return (
    <section className="form-panel">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="section-title">
          <h2>Admin Dashboard</h2>
          <p>Live statistics, search, filters, and Excel-compatible CSV export.</p>
        </div>
        <button className="btn-primary" onClick={downloadCsv} type="button">
          <Download size={18} aria-hidden="true" />
          Download CSV
        </button>
      </div>
      {error ? <Notice type="error">{error}</Notice> : null}
      <div className="setup-box">
        <div>
          <p className="text-sm font-semibold text-slate-900">Firestore Storage Status</p>
          <p className="text-sm text-slate-600">
            {setupReady
              ? 'Ready: course documents exist and registrations can be stored.'
              : 'Needs setup: create the required course documents before student registration.'}
          </p>
        </div>
        <button className="btn-secondary" disabled={setupLoading} onClick={onSeedCourses} type="button">
          {setupLoading ? <Loader2 className="animate-spin" size={18} /> : <Database size={18} />}
          {setupLoading ? 'Checking storage' : 'Verify / Create Courses'}
        </button>
      </div>
      {setupMessage ? <Notice type={setupReady ? 'success' : 'error'}>{setupMessage}</Notice> : null}
      <div className="stats-grid">
        <div className="stat-card">
          <span>Total Registrations</span>
          <strong>{registrations.length}</strong>
        </div>
        {courses.map((course) => (
          <div className="stat-card" key={course.name}>
            <span>{course.name}</span>
            <strong>{courseCounts[course.name] ?? 0}</strong>
            <small>{course.remaining} remaining</small>
          </div>
        ))}
      </div>
      <div className="filters">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <input
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            placeholder="Search by Register Number or Name"
            value={filters.search}
          />
        </label>
        <select
          className="text-input"
          onChange={(event) => setFilters((prev) => ({ ...prev, course: event.target.value }))}
          value={filters.course}
        >
          <option>All</option>
          {COURSE_ORDER.map((course) => (
            <option key={course}>{course}</option>
          ))}
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Google Email</th>
              <th>Register Number</th>
              <th>Student Name</th>
              <th>Course</th>
              <th>Registration Time</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((registration) => (
              <tr key={registration.id}>
                <td>{registration.googleEmail}</td>
                <td>{registration.registerNumber}</td>
                <td>{registration.studentName}</td>
                <td>{registration.selectedCourse}</td>
                <td>{formatTimestamp(registration.createdAt || registration.createdAtClient)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? <p className="empty-state">No registrations found.</p> : null}
      </div>
    </section>
  );
}

export default function App() {
  const { user, loading: authLoading, signIn, signOut } = useAuth();
  const { list: courses, loading: coursesLoading, error: coursesError } = useCourses(Boolean(user));
  const isAdmin = user?.email === ADMIN_EMAIL;
  const [authError, setAuthError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  async function handleSignIn() {
    setAuthError('');
    if (window.location.hostname === '127.0.0.1') {
      setAuthError(
        'Use http://localhost:5173 for local Google sign-in, or add 127.0.0.1 in Firebase Authentication > Settings > Authorized domains.'
      );
      return;
    }
    setSigningIn(true);
    try {
      await signIn();
    } catch (error) {
      setAuthError(friendlyAuthError(error));
    } finally {
      setSigningIn(false);
    }
  }

  if (!isFirebaseConfigured) {
    return (
      <main className="min-h-screen bg-mit-paper p-4">
        <div className="mx-auto mt-10 max-w-2xl">
          <Notice type="error">
            Firebase environment variables are missing: {missingFirebaseConfig.join(', ')}
          </Notice>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-mit-paper text-mit-ink">
      <Header user={user} signOut={signOut} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <StatusStrip />
        <div className="grid gap-5 lg:grid-cols-[0.95fr_1.35fr]">
          <div className="space-y-5">
            <CourseAvailability courses={courses} />
            <AdminLogin authError={authError} onSignIn={handleSignIn} signingIn={signingIn} user={user} />
          </div>
          <div className="space-y-5">
            {authLoading || coursesLoading ? (
              <section className="form-panel">
                <div className="loading-line">
                  <Loader2 className="animate-spin" size={18} />
                  Loading portal
                </div>
              </section>
            ) : user ? (
              <StudentRegistration courses={courses} user={user} />
            ) : (
              <SignInPanel authError={authError} onSignIn={handleSignIn} signingIn={signingIn} />
            )}
            {coursesError ? <Notice type="error">{coursesError}</Notice> : null}
            {isAdmin ? <AdminDashboard courses={courses} /> : null}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
