-- Pro: 5 total video inputs (4 mobile + 1 IP camera URL slot)
-- Pro Master: 11 total (8 mobile + 2 USB + 1 IP camera URL slot)

UPDATE subscription_plans
SET
  max_mobile_devices = 4,
  max_usb_devices = 0,
  max_total_channels = 5,
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
  max_mobile_devices = 8,
  max_usb_devices = 2,
  max_total_channels = 11,
  features = jsonb_build_array(
    '11 video inputs (8 mobile + 2 USB + 1 IP camera URL)',
    'Regal Cloud — UHD streaming',
    'Priority support',
    'Multi-stream + multiple YouTube accounts',
    '100GB cloud storage for video recordings'
  )
WHERE id = 'pro_master';
