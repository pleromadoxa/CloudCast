-- Pro: 50GB cloud storage for video recordings
-- Pro Master: 100GB cloud storage for video recordings

UPDATE subscription_plans
SET
  features = jsonb_build_array(
    '5 video inputs (4 mobile + 1 IP camera URL)',
    'Regal Cloud — HD streaming',
    'Global low-latency delivery',
    'Full mixer controls',
    'Multi-stream to YouTube, Twitch & Custom',
    '50GB cloud storage for video recordings'
  )
WHERE id = 'pro';

UPDATE subscription_plans
SET
  features = jsonb_build_array(
    '11 video inputs (8 mobile + 2 USB + 1 IP camera URL)',
    'Regal Cloud — UHD streaming',
    'Priority support',
    'Multi-stream + multiple YouTube accounts',
    '100GB cloud storage for video recordings'
  )
WHERE id = 'pro_master';
