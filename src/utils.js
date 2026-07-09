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
