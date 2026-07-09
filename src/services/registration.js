import { COURSE_CAPACITIES, COURSE_ORDER } from '../constants';
import { supabase } from '../supabase';
import { normalizeRegisterNumber } from '../utils';

function mapRegistration(row) {
  if (!row) return null;
  return {
    id: row.id,
    googleUid: row.google_uid,
    googleEmail: row.google_email,
    registerNumber: row.register_number,
    studentName: row.student_name,
    selectedCourse: row.selected_course,
    createdAt: row.created_at
  };
}

function mapCourse(row) {
  return {
    name: row.name,
    capacity: Number(row.capacity ?? COURSE_CAPACITIES[row.name] ?? 0),
    filled: Number(row.filled ?? 0)
  };
}

export async function registerStudent({ user, registerNumber, studentName, selectedCourse }) {
  if (!user) throw new Error('Please sign in again before registering.');
  if (!COURSE_ORDER.includes(selectedCourse)) throw new Error('Invalid course selected.');

  const cleanRegisterNumber = normalizeRegisterNumber(registerNumber);
  const cleanStudentName = studentName.trim().replace(/\s+/g, ' ');
  if (!cleanRegisterNumber || !cleanStudentName) {
    throw new Error('Register Number and Student Name are required.');
  }

  const { data, error } = await supabase.rpc('register_student', {
    p_register_number: cleanRegisterNumber,
    p_student_name: cleanStudentName,
    p_selected_course: selectedCourse
  });

  if (error) throw error;
  return mapRegistration(Array.isArray(data) ? data[0] : data);
}

export async function getMyRegistration(user) {
  if (!user) return null;
  const { data, error } = await supabase
    .from('registrations')
    .select('*')
    .eq('google_uid', user.id)
    .maybeSingle();

  if (error) throw error;
  return mapRegistration(data);
}

export async function listRegistrations() {
  const { data, error } = await supabase
    .from('registrations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map(mapRegistration);
}

export async function listCourses() {
  const { data, error } = await supabase
    .from('courses')
    .select('name, capacity, filled')
    .order('name', { ascending: true });

  if (error) throw error;
  const found = new Map(data.map((course) => [course.name, mapCourse(course)]));
  return COURSE_ORDER.map((name) => found.get(name) || {
    name,
    capacity: COURSE_CAPACITIES[name],
    filled: 0
  });
}

export async function getCourseSetupStatus() {
  const courses = await listCourses();
  return COURSE_ORDER.map((course) => {
    const data = courses.find((item) => item.name === course);
    const expectedCapacity = COURSE_CAPACITIES[course];
    return {
      course,
      exists: Boolean(data),
      capacity: Number(data?.capacity ?? 0),
      filled: Number(data?.filled ?? 0),
      expectedCapacity,
      valid: Boolean(data) && Number(data.capacity) === expectedCapacity && Number(data.filled ?? 0) >= 0
    };
  });
}

export async function seedMissingCourses() {
  const rows = COURSE_ORDER.map((name) => ({
    name,
    capacity: COURSE_CAPACITIES[name],
    filled: 0
  }));

  const { error } = await supabase
    .from('courses')
    .upsert(rows, { onConflict: 'name', ignoreDuplicates: true });

  if (error) throw error;
  return getCourseSetupStatus();
}
