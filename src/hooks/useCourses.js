import { useEffect, useMemo, useState } from 'react';
import { onSnapshot, query } from 'firebase/firestore';
import { COURSE_ORDER, initialCourseState } from '../constants';
import { isFirebaseConfigured } from '../firebase';
import { coursesCollection } from '../services/registration';
import { friendlyFirestoreError } from '../utils';

export function useCourses(enabled = true) {
  const [courses, setCourses] = useState(initialCourseState);
  const [loading, setLoading] = useState(isFirebaseConfigured && enabled);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isFirebaseConfigured || !enabled) {
      setCourses(initialCourseState);
      setLoading(false);
      setError('');
      return undefined;
    }
    setLoading(true);
    return onSnapshot(
      query(coursesCollection()),
      (snapshot) => {
        const next = { ...initialCourseState };
        snapshot.forEach((courseDoc) => {
          next[courseDoc.id] = {
            ...next[courseDoc.id],
            ...courseDoc.data()
          };
        });
        setCourses(next);
        setLoading(false);
      },
      (err) => {
        setError(friendlyFirestoreError(err, 'read live seat availability'));
        setLoading(false);
      }
    );
  }, [enabled]);

  const list = useMemo(
    () =>
      COURSE_ORDER.map((name) => {
        const capacity = Number(courses[name]?.capacity ?? 0);
        const filled = Number(courses[name]?.filled ?? 0);
        return {
          name,
          capacity,
          filled,
          remaining: Math.max(capacity - filled, 0),
          full: filled >= capacity
        };
      }),
    [courses]
  );

  return { courses, list, loading, error };
}
