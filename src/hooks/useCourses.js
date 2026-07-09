import { useEffect, useMemo, useState } from 'react';
import { COURSE_ORDER, initialCourseState } from '../constants';
import { isSupabaseConfigured, supabase } from '../supabase';
import { listCourses } from '../services/registration';
import { friendlySupabaseError } from '../utils';

export function useCourses(enabled = true, options = {}) {
  const [courses, setCourses] = useState(initialCourseState);
  const [loading, setLoading] = useState(isSupabaseConfigured && enabled);
  const [error, setError] = useState('');
  const { silentPermissionErrors = false } = options;

  useEffect(() => {
    if (!isSupabaseConfigured || !enabled) {
      setCourses(initialCourseState);
      setLoading(false);
      setError('');
      return undefined;
    }

    let active = true;

    async function loadCourses() {
      try {
        const rows = await listCourses();
        if (!active) return;
        setCourses(Object.fromEntries(rows.map((course) => [course.name, course])));
        setError('');
      } catch (err) {
        if (!active) return;
        const denied = err.code === '42501' || /permission denied|row-level security/i.test(err.message || '');
        setError(silentPermissionErrors && denied ? '' : friendlySupabaseError(err, 'read live seat availability'));
      } finally {
        if (active) setLoading(false);
      }
    }

    setLoading(true);
    loadCourses();

    const channel = supabase
      .channel('public:courses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courses' }, loadCourses)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [enabled, silentPermissionErrors]);

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
