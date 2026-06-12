import { LegalDocument, LegalList, LegalSection } from '../../components/legal/LegalDocument';
import { SITE_LEGAL } from '../../config/siteLegal';

export function SecurityPage() {
  return (
    <LegalDocument title="Security & Compliance">
      <LegalSection title="Our commitment">
        <p>CloudCast is built for professional broadcast workflows. We implement defense-in-depth across application, database, and infrastructure layers.</p>
      </LegalSection>
      <LegalSection title="Technical controls">
        <LegalList items={[
          'TLS encryption in transit for all web and API traffic.',
          'Row Level Security (RLS) on Supabase tables — users access only their data.',
          'Stream keys stored encrypted; admin views show masked keys only.',
          'Role-based admin access with audit logging for privileged actions.',
          'Separate Regal Mesh (peer) vs Regal Cloud (relay) isolation per plan.',
          'Automated error reporting with severity classification.',
        ]} />
      </LegalSection>
      <LegalSection title="Organizational measures">
        <LegalList items={[
          'Least-privilege access for employees and contractors.',
          'Security review for schema changes and admin RPCs.',
          'Incident response procedures with customer notification for material breaches.',
          'Vendor due diligence for subprocessors (see Subprocessors page).',
        ]} />
      </LegalSection>
      <LegalSection title="Vulnerability disclosure">
        <p>
          Report security issues responsibly to {SITE_LEGAL.securityEmail}. We aim to acknowledge within 3 business days.
          Please do not test against production without written authorization.
        </p>
      </LegalSection>
      <LegalSection title="Compliance roadmap">
        <p>
          We align with SOC 2 Type II and GDPR requirements. Enterprise customers may request our DPA and security questionnaire.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
