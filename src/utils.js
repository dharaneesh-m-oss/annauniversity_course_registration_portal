export function normalizeRegisterNumber(value) {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

export function csvEscape(value) {
  const normalized = value === null || value === undefined ? '' : String(value);
  return `"${normalized.replaceAll('"', '""')}"`;
}

export function formatTimestamp(value) {
  if (!value) return '';
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    hour12: true
  }).format(date);
}

export function friendlyFirestoreError(error, action = 'access Firestore') {
  if (!error) return '';

  if (error.code === 'permission-denied' || /Missing or insufficient permissions/i.test(error.message || '')) {
    return `Firestore blocked this request while trying to ${action}. Deploy firestore.rules, then sign in with the authorized admin email and click "Verify / Create Courses" once. If you are a student, ask admin to complete setup first.`;
  }

  if (error.code === 'unavailable') {
    return 'Firestore is temporarily unavailable or the network is unstable. Please retry after a few seconds.';
  }

  if (error.code === 'not-found') {
    return 'Required Firestore data is missing. Admin must click "Verify / Create Courses" before registration opens.';
  }

  return error.message || `Could not ${action}.`;
}

export function toExcelCsv(rows) {
  const header = ['Google Email', 'Register Number', 'Student Name', 'Course', 'Registration Time'];
  const body = rows.map((row) => [
    row.googleEmail,
    row.registerNumber,
    row.studentName,
    row.selectedCourse,
    formatTimestamp(row.createdAt)
  ]);

  return [header, ...body].map((line) => line.map(csvEscape).join(',')).join('\r\n');
}
