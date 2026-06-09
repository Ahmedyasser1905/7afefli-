-- Migrate plan column in user_subscriptions to be a dynamic UUID foreign key referencing plans(id)
ALTER TABLE public.user_subscriptions DROP COLUMN IF EXISTS plan CASCADE;
ALTER TABLE public.user_subscriptions RENAME COLUMN plan_id TO plan;
