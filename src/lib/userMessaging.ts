/** User-facing copy — never expose third-party infrastructure names in the product UI. */

export const USER_MSG = {
  backendNotConfigured: 'CloudCast backend is not configured. Copy .env.example to .env and set your project credentials.',
  backendUnavailable: 'CloudCast services are unavailable.',
  cloudStorageUnavailable: 'CloudCast cloud storage is unavailable.',
  cloudStorageUploadFailed: 'Upload to Regal Cloud storage failed.',
  cloudStorageRequestFailed: 'Cloud storage request failed.',
  regalCloudRequestFailed: 'Regal Cloud request failed.',
  recordingSavedLocal: 'Recording saved locally.',
  recordingUpgradeHint: 'Upgrade to Pro for Regal Cloud recording storage.',
  recordingSavedCloud: 'Recording saved locally and uploaded to Regal Cloud storage.',
  symphonySavedCloud: 'Project saved to Regal Cloud Archive.',
  symphonyLoadFailed: 'Could not load project from Regal Cloud Archive.',
  regalCloudReconnecting: 'Reconnecting Regal Cloud…',
} as const;
