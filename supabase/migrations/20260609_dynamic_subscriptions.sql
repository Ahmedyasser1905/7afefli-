-- Remove the default constraint from the plan column
ALTER TABLE public.user_subscriptions ALTER COLUMN plan DROP DEFAULT;

-- Change the plan column type to TEXT so it is no longer bound to the subscription_plan ENUM
ALTER TABLE public.user_subscriptions ALTER COLUMN plan TYPE text USING plan::text;

-- Drop the subscription_plan ENUM type if it exists to clean up
DROP TYPE IF EXISTS public.subscription_plan CASCADE;
