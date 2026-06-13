-- Universal bundle enum values (separate migration — PG requires commit before use)

ALTER TYPE public.plan_tier ADD VALUE IF NOT EXISTS 'universal_essential';
ALTER TYPE public.plan_tier ADD VALUE IF NOT EXISTS 'universal_studio';
