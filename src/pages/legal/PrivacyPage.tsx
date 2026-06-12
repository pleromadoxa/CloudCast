import { Link } from 'react-router-dom';
import { LegalDocument, LegalList, LegalSection } from '../../components/legal/LegalDocument';
import { SITE_LEGAL } from '../../config/siteLegal';

export function PrivacyPage() {
  return (
    <LegalDocument title="Privacy Policy">
      <LegalSection title="1. Overview">
        <p>
          {SITE_LEGAL.companyName} (&quot;{SITE_LEGAL.companyShortName}&quot;) respects your privacy. This Policy explains how we collect, use, disclose,
          and protect personal data when you use {SITE_LEGAL.productName}. We process data as a controller for account and
          billing data, and as a processor for content you stream or store subject to our{' '}
          <Link to="/legal/dpa" className="text-mixer-red hover:underline">DPA</Link> for business customers.
        </p>
      </LegalSection>

      <LegalSection title="2. Data we collect">
        <LegalList items={[
          'Account data: name, email, password hash (via Supabase Auth), plan tier, profile settings.',
          'Usage data: mixer sessions, paired devices, access codes, stream destinations (RTMP URLs/keys encrypted at rest), activity logs.',
          'Content data: cloud recordings you upload, metadata (file name, size, duration).',
          'Technical data: IP address, browser type, device identifiers, error logs, heartbeat pings.',
          'Communications: support requests and transactional emails (signup, plan changes, storage alerts).',
          'Payment data: when billing launches, processed by our PCI-compliant payment provider — we do not store full card numbers.',
        ]} />
      </LegalSection>

      <LegalSection title="3. How we use data">
        <LegalList items={[
          'Provide, secure, and improve CloudCast.',
          'Authenticate users and enforce plan limits.',
          'Send transactional notifications you expect (not marketing without consent).',
          'Detect abuse, fraud, and security incidents.',
          'Comply with law and respond to lawful requests.',
          'Generate aggregated, de-identified analytics.',
        ]} />
      </LegalSection>

      <LegalSection title="4. Legal bases (EEA/UK)">
        <p>
          We rely on contract performance (providing the service), legitimate interests (security, product improvement),
          consent (optional cookies/marketing), and legal obligation where applicable.
        </p>
      </LegalSection>

      <LegalSection title="5. Sharing & subprocessors">
        <p>
          We share data with infrastructure providers listed in our{' '}
          <Link to="/legal/subprocessors" className="text-mixer-red hover:underline">Subprocessor list</Link>,
          including Supabase (database, auth, storage), email delivery (Resend), and streaming/CDN partners for Regal Cloud plans.
          We require subprocessors to protect data under contract.
        </p>
      </LegalSection>

      <LegalSection title="6. International transfers">
        <p>
          Data may be processed in the United States and other countries. We use Standard Contractual Clauses and supplementary
          measures for EEA/UK transfers where required.
        </p>
      </LegalSection>

      <LegalSection title="7. Retention">
        <p>
          Account data is retained while your account is active and for a reasonable period thereafter. Recordings are retained
          until you delete them or your account is closed. Logs may be retained up to 24 months for security and compliance.
        </p>
      </LegalSection>

      <LegalSection title="8. Your rights">
        <p>
          Depending on your location, you may have rights to access, correct, delete, port, restrict, or object to processing,
          and to withdraw consent. Contact {SITE_LEGAL.privacyEmail}. EU/UK residents may lodge a complaint with a supervisory authority.
        </p>
      </LegalSection>

      <LegalSection title="9. Children">
        <p>CloudCast is not directed to children under 16. We do not knowingly collect data from children.</p>
      </LegalSection>

      <LegalSection title="10. Security">
        <p>
          See our <Link to="/legal/security" className="text-mixer-red hover:underline">Security page</Link> for technical and
          organizational measures. No method of transmission is 100% secure.
        </p>
      </LegalSection>

      <LegalSection title="11. Contact">
        <p>
          Data protection inquiries: {SITE_LEGAL.privacyEmail} · {SITE_LEGAL.companyName},{' '}
          {SITE_LEGAL.address.line2}, {SITE_LEGAL.address.city}, {SITE_LEGAL.address.region} {SITE_LEGAL.address.postal}
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
