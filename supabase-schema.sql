create table if not exists public.courses (
  name text primary key,
  capacity integer not null check (capacity > 0),
  filled integer not null default 0 check (filled >= 0 and filled <= capacity),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  google_uid uuid not null unique,
  google_email text not null,
  register_number text not null unique check (register_number ~ '^[A-Z0-9-]{3,20}$'),
  student_name text not null check (char_length(student_name) between 2 and 80),
  selected_course text not null references public.courses(name),
  created_at timestamptz not null default now()
);

insert into public.courses (name, capacity, filled)
values
  ('IoT', 35, 0),
  ('Robotics', 40, 0),
  ('Space Electronics', 35, 0),
  ('RTL', 40, 0)
on conflict (name) do update
set capacity = excluded.capacity,
    updated_at = now();

alter table public.courses enable row level security;
alter table public.registrations enable row level security;

drop policy if exists "Authenticated users can read courses" on public.courses;
create policy "Authenticated users can read courses"
on public.courses
for select
to authenticated
using (true);

drop policy if exists "Admin can maintain courses" on public.courses;
create policy "Admin can maintain courses"
on public.courses
for all
to authenticated
using ((auth.jwt() ->> 'email') = 'dharaneesh963@gmail.com')
with check ((auth.jwt() ->> 'email') = 'dharaneesh963@gmail.com');

drop policy if exists "Students can read own registration" on public.registrations;
create policy "Students can read own registration"
on public.registrations
for select
to authenticated
using (
  google_uid = auth.uid()
  or (auth.jwt() ->> 'email') = 'dharaneesh963@gmail.com'
);

create or replace function public.register_student(
  p_register_number text,
  p_student_name text,
  p_selected_course text
)
returns public.registrations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_register_number text := upper(regexp_replace(trim(p_register_number), '\s+', '', 'g'));
  v_student_name text := regexp_replace(trim(p_student_name), '\s+', ' ', 'g');
  v_course public.courses%rowtype;
  v_registration public.registrations%rowtype;
begin
  if v_uid is null then
    raise exception 'Please sign in again before registering.';
  end if;

  if p_selected_course not in ('IoT', 'Robotics', 'Space Electronics', 'RTL') then
    raise exception 'Invalid course selected.';
  end if;

  if v_register_number !~ '^[A-Z0-9-]{3,20}$' then
    raise exception 'Register Number must be 3 to 20 letters/numbers.';
  end if;

  if char_length(v_student_name) < 2 or char_length(v_student_name) > 80 then
    raise exception 'Student Name must be 2 to 80 characters.';
  end if;

  insert into public.courses (name, capacity, filled)
  values (
    p_selected_course,
    case
      when p_selected_course = 'IoT' then 35
      when p_selected_course = 'Robotics' then 40
      when p_selected_course = 'Space Electronics' then 35
      when p_selected_course = 'RTL' then 40
    end,
    0
  )
  on conflict (name) do nothing;

  select *
  into v_course
  from public.courses
  where name = p_selected_course
  for update;

  if v_course.filled >= v_course.capacity then
    raise exception 'Course Full';
  end if;

  if exists (select 1 from public.registrations where google_uid = v_uid) then
    raise exception 'This Google account is already registered.';
  end if;

  if exists (select 1 from public.registrations where register_number = v_register_number) then
    raise exception 'This Register Number is already registered.';
  end if;

  update public.courses
  set filled = filled + 1,
      updated_at = now()
  where name = p_selected_course;

  insert into public.registrations (
    google_uid,
    google_email,
    register_number,
    student_name,
    selected_course
  )
  values (
    v_uid,
    v_email,
    v_register_number,
    v_student_name,
    p_selected_course
  )
  returning * into v_registration;

  return v_registration;
end;
$$;

revoke all on function public.register_student(text, text, text) from public;
grant execute on function public.register_student(text, text, text) to authenticated;
