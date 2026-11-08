-- =====================================================================
-- ShelfLife v2: onboarding, stock check-ins, eco score, recipe steps.
-- Run this AFTER schema.sql. Paste into Supabase -> SQL Editor -> Run.
-- Safe to run more than once.
-- =====================================================================

-- Onboarding + extra profile fields
alter table profiles add column if not exists onboarded boolean default false;
alter table profiles add column if not exists avoid text;
-- People who already use the app skip onboarding
update profiles set onboarded = true where onboarded is distinct from true and created_at < now() - interval '1 minute';

-- Circle type (Roommates / Family / Friends)
alter table circles add column if not exists kind text default 'Roommates';

-- Stock tracking: how much is left (1 = full) and when it was last confirmed
alter table items add column if not exists amount_left numeric default 1;
alter table items add column if not exists checked_at timestamptz default now();
update items set checked_at = created_at where checked_at is null;

-- Recipe amounts, steps, servings
alter table recipes add column if not exists amounts text[] default '{}';
alter table recipes add column if not exists steps text[] default '{}';
alter table recipes add column if not exists servings int default 2;

-- Preview a circle before joining (name + member count), used in onboarding
create or replace function circle_preview(code text) returns table (name text, member_count int)
language sql security definer stable set search_path = public as $$
  select c.name, (select count(*)::int from circle_members m where m.circle_id = c.id)
  from circles c where c.invite_code = upper(trim(code))
$$;

-- Replace the built-in recipes with versions that have amounts and steps
delete from recipes where owner_id is null;
insert into recipes (name, ingredients, amounts, steps, servings, diet_tags, owner_id) values
('Strawberry spinach salad',
  array['Strawberries','Baby spinach','Feta','Walnuts','Olive oil','Balsamic vinegar','Salt'],
  array['250 g','100 g','50 g','30 g','2 tbsp','1 tbsp','1 pinch'],
  array['Rinse the strawberries and slice them in half.','Wash the spinach and pat it dry, then add it to a large bowl.','Whisk the olive oil, balsamic vinegar and a pinch of salt in a small cup.','Toss the spinach with half of the dressing.','Top with the strawberries, crumbled feta and walnuts.','Drizzle on the rest of the dressing and serve right away.'],
  2, array['vegetarian','gluten-free'], null),
('Cheddar omelet',
  array['Eggs','Cheddar','Butter','Milk','Black pepper'],
  array['3','30 g','1 tbsp','2 tbsp','1 pinch'],
  array['Whisk the eggs, milk and pepper in a bowl.','Melt the butter in a nonstick pan over medium heat.','Pour in the eggs and stir gently until they start to set.','Sprinkle the cheddar over one half.','Fold the omelet over and slide it onto a plate.'],
  1, array['vegetarian','gluten-free','nut-free'], null),
('Tomato soup',
  array['Tomatoes','Onion','Garlic','Butter','Cream','Broth','Basil','Salt'],
  array['800 g','1','2 cloves','2 tbsp','60 ml','500 ml','6 leaves','1 tsp'],
  array['Chop the onion and garlic.','Melt the butter in a pot and cook the onion until soft, about 6 minutes.','Add the garlic and cook 1 more minute.','Add the tomatoes, broth and salt. Simmer for 20 minutes.','Blend until smooth, then stir in the cream and torn basil.'],
  4, array['vegetarian','nut-free','gluten-free'], null),
('Veggie stir fry',
  array['Broccoli','Bell pepper','Carrot','Onion','Garlic','Soy sauce','Rice','Oil'],
  array['1 head','1','1','1/2','2 cloves','3 tbsp','2 cups cooked','1 tbsp'],
  array['Cook the rice if you have not already.','Slice all the vegetables into bite-size pieces.','Heat the oil in a large pan over high heat.','Stir-fry the onion, carrot and broccoli for 4 minutes.','Add the pepper and garlic and cook 2 more minutes.','Add the soy sauce, toss, and serve over rice.'],
  2, array['vegan','vegetarian','dairy-free','nut-free'], null),
('Banana oat smoothie',
  array['Banana','Oats','Milk','Yogurt','Honey'],
  array['1','1/4 cup','1 cup','1/2 cup','1 tsp'],
  array['Add everything to a blender.','Blend until smooth, about 30 seconds.','Pour and drink right away.'],
  1, array['vegetarian','nut-free'], null),
('Greek yogurt parfait',
  array['Greek yogurt','Berries','Granola','Honey'],
  array['1 cup','1/2 cup','1/3 cup','1 tsp'],
  array['Spoon half the yogurt into a glass.','Add half the berries and granola.','Repeat the layers and drizzle with honey.'],
  1, array['vegetarian'], null),
('Chicken burrito bowl',
  array['Chicken breast','Rice','Black beans','Salsa','Cheese','Lettuce','Avocado'],
  array['1','1 cup cooked','1/2 can','1/4 cup','1/4 cup','1 cup','1/2'],
  array['Season and cook the chicken in a pan for 6 to 7 minutes per side, then slice.','Warm the beans.','Add rice to a bowl and top with lettuce, beans and chicken.','Finish with salsa, cheese and sliced avocado.'],
  2, array['gluten-free','nut-free'], null),
('Pasta primavera',
  array['Pasta','Tomatoes','Baby spinach','Garlic','Olive oil','Parmesan','Zucchini'],
  array['200 g','1 cup','2 cups','2 cloves','2 tbsp','30 g','1'],
  array['Boil the pasta in salted water until tender.','Slice the zucchini and halve the tomatoes.','Cook the garlic and zucchini in olive oil for 4 minutes.','Add the tomatoes and spinach until the spinach wilts.','Toss with the drained pasta and top with parmesan.'],
  2, array['vegetarian','nut-free'], null),
('Avocado toast',
  array['Bread','Avocado','Lemon','Eggs','Salt'],
  array['2 slices','1','1/2','2','1 pinch'],
  array['Toast the bread.','Mash the avocado with lemon juice and salt.','Fry or poach the eggs.','Spread the avocado on the toast and top with the eggs.'],
  2, array['vegetarian','dairy-free','nut-free'], null),
('Black bean tacos',
  array['Tortillas','Black beans','Salsa','Avocado','Lime','Onion','Cilantro'],
  array['6','1 can','1/2 cup','1','1','1/2','1 handful'],
  array['Drain and warm the beans with a squeeze of lime.','Dice the onion and slice the avocado.','Warm the tortillas in a dry pan.','Fill with beans, salsa, avocado, onion and cilantro.'],
  3, array['vegan','vegetarian','dairy-free','nut-free'], null),
('Lemon garlic salmon',
  array['Salmon','Lemon','Garlic','Butter','Rice','Asparagus'],
  array['2 fillets','1','2 cloves','2 tbsp','1 cup cooked','1 bunch'],
  array['Heat the oven to 200°C (400°F).','Place the salmon and asparagus on a tray.','Melt the butter with garlic and lemon juice and pour it over.','Bake for 12 to 15 minutes.','Serve with rice and lemon wedges.'],
  2, array['pescatarian','gluten-free','nut-free'], null),
('Grilled cheese',
  array['Bread','Cheese','Butter'],
  array['2 slices','2 slices','1 tbsp'],
  array['Butter one side of each slice of bread.','Put the cheese between the unbuttered sides.','Cook in a pan over medium heat, 3 minutes per side, until golden.'],
  1, array['vegetarian','nut-free'], null),
('Fried rice',
  array['Rice','Eggs','Peas','Carrot','Onion','Soy sauce','Oil'],
  array['2 cups cooked','2','1/2 cup','1','1/2','2 tbsp','1 tbsp'],
  array['Dice the carrot and onion.','Heat the oil and cook the vegetables for 3 minutes.','Push them aside and scramble the eggs.','Add the rice and peas and stir-fry for 4 minutes.','Season with soy sauce and serve.'],
  2, array['vegetarian','dairy-free','nut-free'], null),
('Peanut butter banana toast',
  array['Bread','Peanut butter','Banana','Honey'],
  array['1 slice','1 tbsp','1/2','1 tsp'],
  array['Toast the bread.','Spread on the peanut butter.','Top with banana slices and a drizzle of honey.'],
  1, array['vegetarian','dairy-free'], null);

-- Profile photo upload policies (same as fix_avatars.sql)
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do update set public = true;

drop policy if exists "avatar upload" on storage.objects;
drop policy if exists "avatar update" on storage.objects;
drop policy if exists "avatar read" on storage.objects;
drop policy if exists "avatar delete" on storage.objects;

-- Anyone signed in can upload into their own folder: avatars/<their user id>/...
create policy "avatar upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
-- Uploads need read access to the bucket too
create policy "avatar read" on storage.objects for select
  using (bucket_id = 'avatars');
