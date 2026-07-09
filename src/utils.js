export function normalizeRegisterNumber(value) {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

export function csvEscape(value) {
  const normalized = value === null || value === undefined ? '' : String(value);
  return `"${normalized.replaceAll('"', '""')}"`;
}

export function formatTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    hour12: true
  }).format(date);
}

export function friendlySupabaseError(error, action = 'access Supabase') {
  if (!error) return '';

  const message = error.message || '';
  if (error.code === '42501' || /permission denied|row-level security/i.test(message)) {
    return `Cannot ${action} yet because Supabase SQL policies are not installed. Run supabase-schema.sql once in Supabase SQL Editor.`;
  }

  if (error.code === '23505' || /duplicate key/i.test(message)) {
    return 'This Google account or Register Number is already registered.';
  }

  if (/Course Full/i.test(message)) {
    return 'Course Full';
  }

  if (/Failed to fetch|NetworkError/i.test(message)) {
    return 'Supabase is temporarily unavailable or the network is unstable. Please retry after a few seconds.';
  }

  return message || `Could not ${action}.`;
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
