-- =====================================================================
-- ShelfLife: full database setup for every screen in the Figma.
-- Paste this whole file into Supabase -> SQL Editor -> New query -> Run.
-- Safe to run on top of the tables you already created.
-- =====================================================================

-- ---------- Columns added to existing tables ----------
alter table items add column if not exists category text;
alter table items add column if not exists unit text;
alter table items add column if not exists finished_at timestamptz;
alter table circles add column if not exists invite_code text unique
  default upper(substr(md5(random()::text), 1, 6));
update circles set invite_code = upper(substr(md5(random()::text), 1, 6)) where invite_code is null;

-- ---------- New tables ----------
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url text,
  phone text,
  dietary text[] default '{}',
  notifications boolean default true,
  created_at timestamptz default now()
);

create table if not exists circle_join_requests (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid references circles on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  status text default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz default now(),
  unique (circle_id, user_id)
);

create table if not exists grocery_items (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid references circles on delete cascade,
  added_by uuid references auth.users on delete cascade not null default auth.uid(),
  name text not null,
  quantity text,
  category text default 'Other',
  checked boolean default false,
  checked_by uuid references auth.users,
  created_at timestamptz default now()
);

create table if not exists circle_requests (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid references circles on delete cascade not null,
  requester_id uuid references auth.users on delete cascade not null default auth.uid(),
  item_name text not null,
  status text default 'open' check (status in ('open', 'fulfilled', 'cancelled')),
  fulfilled_by uuid references auth.users,
  created_at timestamptz default now()
);

create table if not exists circle_activity (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid references circles on delete cascade not null,
  actor_id uuid references auth.users on delete cascade not null default auth.uid(),
  message text not null,
  created_at timestamptz default now()
);

create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ingredients text[] not null default '{}',
  diet_tags text[] not null default '{}',
  owner_id uuid references auth.users on delete cascade default auth.uid(), -- null = built-in "App" recipe
  created_at timestamptz default now()
);

create table if not exists recipe_favorites (
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  recipe_id uuid references recipes on delete cascade not null,
  primary key (user_id, recipe_id)
);

-- ---------- Helper functions (security definer avoids RLS loops) ----------
create or replace function my_circle_ids() returns setof uuid
language sql security definer stable set search_path = public as $$
  select circle_id from circle_members where user_id = auth.uid()
$$;

create or replace function my_circle_mates() returns setof uuid
language sql security definer stable set search_path = public as $$
  select distinct user_id from circle_members
  where circle_id in (select circle_id from circle_members where user_id = auth.uid())
$$;

create or replace function is_circle_owner(c uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from circles where id = c and created_by = auth.uid())
$$;

-- Ask to join a circle with its invite code. Returns the circle name.
create or replace function request_join(code text) returns text
language plpgsql security definer set search_path = public as $$
declare c circles%rowtype;
begin
  select * into c from circles where invite_code = upper(trim(code));
  if c.id is null then raise exception 'No circle with that code'; end if;
  if exists (select 1 from circle_members where circle_id = c.id and user_id = auth.uid()) then
    raise exception 'You are already in this circle';
  end if;
  insert into circle_join_requests (circle_id, user_id) values (c.id, auth.uid())
    on conflict (circle_id, user_id) do update set status = 'pending', created_at = now();
  return c.name;
end $$;

create or replace function approve_join(request_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r circle_join_requests%rowtype;
begin
  select * into r from circle_join_requests where id = request_id;
  if r.id is null or not is_circle_owner(r.circle_id) then raise exception 'Not allowed'; end if;
  insert into circle_members (circle_id, user_id) values (r.circle_id, r.user_id) on conflict do nothing;
  update circle_join_requests set status = 'approved' where id = request_id;
  insert into circle_activity (circle_id, actor_id, message)
    values (r.circle_id, r.user_id, coalesce((select display_name from profiles where id = r.user_id), 'Someone') || ' joined the circle');
end $$;

create or replace function remove_member(c uuid, member uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_circle_owner(c) then raise exception 'Only the owner can remove members'; end if;
  delete from circle_members where circle_id = c and user_id = member;
end $$;

-- Creator automatically becomes a member
create or replace function add_creator_as_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into circle_members (circle_id, user_id) values (new.id, new.created_by) on conflict do nothing;
  return new;
end $$;
drop trigger if exists circles_add_creator on circles;
create trigger circles_add_creator after insert on circles
  for each row execute function add_creator_as_member();

-- Every new account gets a profile
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name) values (new.id, split_part(new.email, '@', 1)) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
-- Profiles for accounts that already exist
insert into profiles (id, display_name)
  select id, split_part(email, '@', 1) from auth.users on conflict do nothing;

-- ---------- Row Level Security ----------
alter table profiles enable row level security;
alter table circles enable row level security;
alter table circle_members enable row level security;
alter table circle_join_requests enable row level security;
alter table items enable row level security;
alter table grocery_items enable row level security;
alter table circle_requests enable row level security;
alter table circle_activity enable row level security;
alter table recipes enable row level security;
alter table recipe_favorites enable row level security;

-- Drop the policies from the first setup so these replace them
drop policy if exists "own items" on items;
drop policy if exists "circle sees shared items" on items;
drop policy if exists "see own memberships" on circle_members;
drop policy if exists "join circles" on circle_members;
drop policy if exists "see my circles" on circles;
drop policy if exists "create circles" on circles;
drop policy if exists "see relevant requests" on ingredient_requests;
drop policy if exists "make requests" on ingredient_requests;
drop policy if exists "owner answers requests" on ingredient_requests;
-- (and this file's own, so re-running is safe)
drop policy if exists "profiles read" on profiles;
drop policy if exists "profiles write" on profiles;
drop policy if exists "circles read" on circles;
drop policy if exists "circles create" on circles;
drop policy if exists "circles owner update" on circles;
drop policy if exists "circles owner delete" on circles;
drop policy if exists "members read" on circle_members;
drop policy if exists "members leave" on circle_members;
drop policy if exists "join requests read" on circle_join_requests;
drop policy if exists "join requests owner update" on circle_join_requests;
drop policy if exists "items own" on items;
drop policy if exists "items circle read" on items;
drop policy if exists "grocery circle" on grocery_items;
drop policy if exists "requests circle" on circle_requests;
drop policy if exists "activity read" on circle_activity;
drop policy if exists "activity write" on circle_activity;
drop policy if exists "recipes read" on recipes;
drop policy if exists "recipes write" on recipes;
drop policy if exists "favorites own" on recipe_favorites;

create policy "profiles read" on profiles for select using (
  id = auth.uid()
  or id in (select my_circle_mates())
  or id in (select user_id from circle_join_requests where is_circle_owner(circle_id))
);
create policy "profiles write" on profiles for all using (id = auth.uid()) with check (id = auth.uid());

create policy "circles read" on circles for select using (id in (select my_circle_ids()) or created_by = auth.uid());
create policy "circles create" on circles for insert with check (created_by = auth.uid());
create policy "circles owner update" on circles for update using (created_by = auth.uid());
create policy "circles owner delete" on circles for delete using (created_by = auth.uid());

create policy "members read" on circle_members for select using (circle_id in (select my_circle_ids()));
create policy "members leave" on circle_members for delete using (user_id = auth.uid());

create policy "join requests read" on circle_join_requests for select using (user_id = auth.uid() or is_circle_owner(circle_id));
create policy "join requests owner update" on circle_join_requests for update using (is_circle_owner(circle_id));

create policy "items own" on items for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "items circle read" on items for select using (owner_id in (select my_circle_mates()));

create policy "grocery circle" on grocery_items for all
  using (added_by = auth.uid() or circle_id in (select my_circle_ids()))
  with check (added_by = auth.uid() or circle_id in (select my_circle_ids()));

create policy "requests circle" on circle_requests for all
  using (circle_id in (select my_circle_ids()))
  with check (circle_id in (select my_circle_ids()));

create policy "activity read" on circle_activity for select using (circle_id in (select my_circle_ids()));
create policy "activity write" on circle_activity for insert with check (circle_id in (select my_circle_ids()) and actor_id = auth.uid());

create policy "recipes read" on recipes for select using (
  owner_id is null or owner_id = auth.uid() or owner_id in (select my_circle_mates())
);
create policy "recipes write" on recipes for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "favorites own" on recipe_favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Profile photos ----------
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
drop policy if exists "avatar upload" on storage.objects;
drop policy if exists "avatar update" on storage.objects;
create policy "avatar upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Built-in "App" recipes ----------
insert into recipes (name, ingredients, diet_tags, owner_id)
select * from (values
  ('Strawberry spinach salad', array['strawberr','spinach','almond','feta','balsamic','olive oil','onion'], array['vegetarian','gluten-free'], null::uuid),
  ('Cheddar omelet', array['egg','cheddar','butter','milk','pepper'], array['vegetarian','gluten-free','nut-free'], null),
  ('Tomato soup', array['tomato','onion','garlic','butter','cream','broth','basil','bread','salt'], array['vegetarian','nut-free'], null),
  ('Veggie stir fry', array['broccoli','pepper','carrot','onion','garlic','soy sauce','rice','oil'], array['vegan','vegetarian','dairy-free','nut-free'], null),
  ('Banana oat smoothie', array['banana','oat','milk','yogurt','honey'], array['vegetarian','nut-free'], null),
  ('Greek yogurt parfait', array['yogurt','berr','granola','honey'], array['vegetarian'], null),
  ('Chicken burrito bowl', array['chicken','rice','bean','salsa','cheese','lettuce','avocado'], array['gluten-free','nut-free'], null),
  ('Pasta primavera', array['pasta','tomato','spinach','garlic','olive oil','parmesan','zucchini'], array['vegetarian','nut-free'], null),
  ('Avocado toast', array['bread','avocado','lemon','egg','salt','pepper'], array['vegetarian','dairy-free','nut-free'], null),
  ('Black bean tacos', array['tortilla','bean','salsa','avocado','lime','onion','cilantro'], array['vegan','vegetarian','dairy-free','nut-free'], null),
  ('Lemon garlic salmon', array['salmon','lemon','garlic','butter','rice','asparagus'], array['pescatarian','gluten-free','nut-free'], null),
  ('Grilled cheese', array['bread','cheese','butter'], array['vegetarian','nut-free'], null),
  ('Fried rice', array['rice','egg','pea','carrot','onion','soy sauce','oil'], array['vegetarian','dairy-free','nut-free'], null),
  ('Peanut butter banana toast', array['bread','peanut butter','banana','honey'], array['vegetarian','dairy-free'], null)
) as v(name, ingredients, diet_tags, owner_id)
where not exists (select 1 from recipes where owner_id is null);
