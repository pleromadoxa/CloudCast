import { LegalDocument, LegalList, LegalSection } from '../../components/legal/LegalDocument';

export function AcceptableUsePage() {
  return (
    <LegalDocument title="Acceptable Use Policy">
      <LegalSection title="Purpose">
        <p>CloudCast is for lawful live and recorded video production. You must not use the service to harm others or violate law.</p>
      </LegalSection>
      <LegalSection title="Prohibited uses">
        <LegalList items={[
          'Streaming illegal content, violence incitement, exploitation, or non-consensual imagery.',
          'Copyright or trademark infringement without authorization.',
          'Harassment, hate speech, or targeted abuse.',
          'Distributing malware, phishing, or attempting unauthorized access to systems.',
          'Circumventing plan limits, sharing accounts to evade billing, or scraping the service.',
          'Interfering with other users’ sessions or Regal infrastructure (DDoS, spam pairing codes).',
          'Misrepresenting affiliation with Regal or CloudCast.',
        ]} />
      </LegalSection>
      <LegalSection title="Streaming platform compliance">
        <p>You must comply with YouTube, Twitch, Facebook, and other platform community guidelines and monetization rules.</p>
      </LegalSection>
      <LegalSection title="Enforcement">
        <p>We may warn, throttle, suspend, or terminate accounts and report illegal activity to authorities. Appeals: legal@cloudcast.regal.</p>
      </LegalSection>
    </LegalDocument>
  );
}
