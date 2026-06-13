-- Extended VP show state: pipeline nodes, PiP slots, graphics
ALTER TABLE public.prism_scenes
  ADD COLUMN IF NOT EXISTS extended_state jsonb NOT NULL DEFAULT '{}'::jsonb;
