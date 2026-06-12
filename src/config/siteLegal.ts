/** Company & legal metadata — keep in sync with email templates in supabase/functions/_shared/legal.ts */
export const SITE_LEGAL = {
  productName: 'CloudCast',
  companyName: 'Quantum Regal Digital Labs',
  companyShortName: 'Quantum Regal',
  brandLine: 'CloudCast by Quantum Regal',
  tagline: 'Professional multi-source video mixing',
  supportEmail: 'support@cloudcast.regal',
  legalEmail: 'legal@cloudcast.regal',
  privacyEmail: 'privacy@cloudcast.regal',
  securityEmail: 'security@cloudcast.regal',
  dpoEmail: 'privacy@cloudcast.regal',
  address: {
    line1: 'Quantum Regal Digital Labs',
    line2: '1200 Broadcast Way, Suite 400',
    city: 'Atlanta',
    region: 'GA',
    postal: '30303',
    country: 'United States',
  },
  governingLaw: 'State of Georgia, United States',
  lastUpdated: 'June 10, 2025',
  effectiveDate: 'June 10, 2025',
} as const;

export const LEGAL_NAV = [
  { to: '/legal/terms', label: 'Terms of Service' },
  { to: '/legal/privacy', label: 'Privacy Policy' },
  { to: '/legal/cookies', label: 'Cookie Policy' },
  { to: '/legal/acceptable-use', label: 'Acceptable Use' },
  { to: '/legal/security', label: 'Security' },
  { to: '/legal/sla', label: 'SLA' },
  { to: '/legal/refunds', label: 'Refunds' },
  { to: '/legal/dpa', label: 'DPA' },
  { to: '/legal/subprocessors', label: 'Subprocessors' },
] as const;
