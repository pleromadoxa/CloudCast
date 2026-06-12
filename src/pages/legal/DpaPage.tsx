import { LegalDocument, LegalList, LegalSection } from '../../components/legal/LegalDocument';
import { SITE_LEGAL } from '../../config/siteLegal';

export function DpaPage() {
  return (
    <LegalDocument title="Data Processing Agreement">
      <LegalSection title="Parties">
        <p>
          This DPA forms part of the agreement between the Customer (&quot;Controller&quot;) and {SITE_LEGAL.companyName} (&quot;Processor&quot;)
          when Customer uses CloudCast to process personal data on behalf of end users or talent appearing in streams.
        </p>
      </LegalSection>
      <LegalSection title="Subject matter & duration">
        <p>Processing occurs for the duration of the subscription to provide mixing, storage, and streaming services per Customer instructions.</p>
      </LegalSection>
      <LegalSection title="Processor obligations">
        <LegalList items={[
          'Process personal data only on documented instructions.',
          'Ensure personnel confidentiality.',
          'Implement appropriate technical and organizational measures (see Security page).',
          'Assist with data subject requests and DPIAs where feasible.',
          'Delete or return data upon termination, subject to legal retention.',
          'Make available information necessary to demonstrate compliance.',
        ]} />
      </LegalSection>
      <LegalSection title="Subprocessors">
        <p>Customer authorizes use of subprocessors listed at /legal/subprocessors. We provide 30 days notice of material changes.</p>
      </LegalSection>
      <LegalSection title="International transfers">
        <p>Standard Contractual Clauses (2021) are incorporated by reference for EEA/UK transfers.</p>
      </LegalSection>
      <LegalSection title="Executing the DPA">
        <p>Enterprise customers: contact {SITE_LEGAL.legalEmail} for a countersigned copy.</p>
      </LegalSection>
    </LegalDocument>
  );
}
