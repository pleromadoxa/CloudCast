import { LegalDocument, LegalList, LegalSection } from '../../components/legal/LegalDocument';

export function SlaPage() {
  return (
    <LegalDocument title="Service Level Agreement">
      <LegalSection title="Scope">
        <p>This SLA applies to paid Pro and Pro Master subscriptions. Free tier is provided without uptime guarantees.</p>
      </LegalSection>
      <LegalSection title="Uptime commitment">
        <p>We target 99.5% monthly uptime for CloudCast dashboard, auth, and Regal Cloud signaling infrastructure, excluding scheduled maintenance (announced 48h ahead).</p>
      </LegalSection>
      <LegalSection title="Exclusions">
        <LegalList items={[
          'Third-party streaming platforms (YouTube, Twitch, Facebook).',
          'User network conditions, local browser limitations, or misconfigured RTMP.',
          'Regal Mesh direct peer connections (user-controlled networks).',
          'Force majeure events.',
        ]} />
      </LegalSection>
      <LegalSection title="Service credits">
        <p>If monthly uptime falls below 99.5%, eligible customers may request a pro-rated service credit within 30 days by contacting support. Credits are the sole remedy for SLA breaches.</p>
      </LegalSection>
      <LegalSection title="Support response targets">
        <LegalList items={[
          'Pro: email support within 2 business days.',
          'Pro Master: priority support within 1 business day.',
        ]} />
      </LegalSection>
    </LegalDocument>
  );
}
