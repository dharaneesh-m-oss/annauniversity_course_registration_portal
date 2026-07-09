export const ADMIN_EMAIL = 'dharaneesh963@gmail.com';

export const COURSE_ORDER = ['IoT', 'Robotics', 'Space Electronics', 'RTL'];

export const COURSE_CAPACITIES = {
  IoT: 35,
  Robotics: 40,
  'Space Electronics': 35,
  RTL: 40
};

export const initialCourseState = COURSE_ORDER.reduce((acc, course) => {
  acc[course] = {
    capacity: COURSE_CAPACITIES[course],
    filled: 0
  };
  return acc;
}, {});
