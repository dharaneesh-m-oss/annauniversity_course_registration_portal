import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  runTransaction,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { COURSE_CAPACITIES, COURSE_ORDER } from '../constants';
import { normalizeRegisterNumber } from '../utils';

export async function registerStudent({ user, registerNumber, studentName, selectedCourse }) {
  if (!user) throw new Error('Please sign in again before registering.');
  if (!COURSE_ORDER.includes(selectedCourse)) throw new Error('Invalid course selected.');

  const cleanRegisterNumber = normalizeRegisterNumber(registerNumber);
  const cleanStudentName = studentName.trim().replace(/\s+/g, ' ');
  if (!cleanRegisterNumber || !cleanStudentName) {
    throw new Error('Register Number and Student Name are required.');
  }

  const courseRef = doc(db, 'courses', selectedCourse);
  const registrationRef = doc(db, 'registrations', user.uid);
  const registerNumberRef = doc(db, 'registerNumbers', cleanRegisterNumber);

  return runTransaction(db, async (transaction) => {
    const [courseSnap, existingRegistrationSnap, registerNumberSnap] = await Promise.all([
      transaction.get(courseRef),
      transaction.get(registrationRef),
      transaction.get(registerNumberRef)
    ]);

    if (!courseSnap.exists()) {
      throw new Error('Course setup is incomplete. Please contact the administrator.');
    }

    const course = courseSnap.data();
    const capacity = Number(course.capacity ?? COURSE_CAPACITIES[selectedCourse]);
    const filled = Number(course.filled ?? 0);

    if (existingRegistrationSnap.exists()) {
      throw new Error('This Google account is already registered.');
    }

    if (registerNumberSnap.exists()) {
      throw new Error('This Register Number is already registered.');
    }

    if (filled >= capacity) {
      throw new Error('Course Full');
    }

    const registration = {
      googleUid: user.uid,
      googleEmail: user.email,
      registerNumber: cleanRegisterNumber,
      registerNumberKey: cleanRegisterNumber,
      studentName: cleanStudentName,
      selectedCourse,
      createdAt: serverTimestamp(),
      createdAtClient: Timestamp.now()
    };

    transaction.update(courseRef, { filled: increment(1) });
    transaction.set(registerNumberRef, {
      googleUid: user.uid,
      registrationId: user.uid,
      selectedCourse,
      createdAt: serverTimestamp()
    });
    transaction.set(registrationRef, registration);

    return registration;
  }, { maxAttempts: 5 });
}

export async function getMyRegistration(user) {
  if (!user) return null;
  const snap = await getDoc(doc(db, 'registrations', user.uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getCourseSetupStatus() {
  const snapshot = await getDocs(coursesCollection());
  const existing = new Map(snapshot.docs.map((courseDoc) => [courseDoc.id, courseDoc.data()]));

  return COURSE_ORDER.map((course) => {
    const data = existing.get(course);
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
  const status = await getCourseSetupStatus();
  const missing = status.filter((course) => !course.exists);

  if (missing.length === 0) {
    return status;
  }

  const batch = writeBatch(db);
  missing.forEach(({ course }) => {
    batch.set(doc(db, 'courses', course), {
      capacity: COURSE_CAPACITIES[course],
      filled: 0
    });
  });
  await batch.commit();

  return getCourseSetupStatus();
}

export function coursesCollection() {
  return collection(db, 'courses');
}

export function registrationsCollection() {
  return collection(db, 'registrations');
}
