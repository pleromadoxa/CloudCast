import { Link } from 'react-router-dom';
import { LegalDocument, LegalList, LegalSection } from '../../components/legal/LegalDocument';
import { SITE_LEGAL } from '../../config/siteLegal';

export function TermsPage() {
  return (
    <LegalDocument title="Terms of Service">
      <LegalSection title="1. Agreement">
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of {SITE_LEGAL.productName} (
          {SITE_LEGAL.brandLine}), operated by {SITE_LEGAL.companyName} (&quot;{SITE_LEGAL.companyShortName},&quot; &quot;we,&quot; &quot;us&quot;).
          By creating an account or using the service, you agree to these Terms and our{' '}
          <Link to="/legal/privacy" className="text-mixer-red hover:underline">Privacy Policy</Link>.
        </p>
      </LegalSection>

      <LegalSection title="2. Service description">
        <p>
          CloudCast provides browser-based multi-source video mixing, mobile camera pairing, PGM output, optional cloud
          recording storage, and RTMP streaming to third-party platforms. Features vary by subscription plan.
        </p>
      </LegalSection>

      <LegalSection title="3. Accounts & eligibility">
        <LegalList items={[
          'You must be at least 16 years old (or the age of digital consent in your jurisdiction) to use CloudCast.',
          'You are responsible for safeguarding credentials and all activity under your account.',
          'You must provide accurate registration information and keep it current.',
          'We may suspend or terminate accounts that violate these Terms or our Acceptable Use Policy.',
        ]} />
      </LegalSection>

      <LegalSection title="4. Subscription plans & billing">
        <p>
          Paid plans (Pro, Pro Master) are described on our <Link to="/pricing" className="text-mixer-red hover:underline">pricing page</Link>.
          Until integrated payment processing is live, plan changes may be applied manually or via promotional coupons for testing.
          When billing launches, subscriptions renew per the plan selected unless cancelled. See our{' '}
          <Link to="/legal/refunds" className="text-mixer-red hover:underline">Refund Policy</Link>.
        </p>
      </LegalSection>

      <LegalSection title="5. Your content & broadcasts">
        <p>
          You retain ownership of video, audio, and metadata you upload or stream through CloudCast. You grant Regal a
          limited license to host, process, transmit, and store your content solely to provide the service. You represent
          that you have all rights necessary to stream and record your content, including music, talent releases, and
          platform terms (YouTube, Twitch, Facebook, etc.).
        </p>
      </LegalSection>

      <LegalSection title="6. Prohibited conduct">
        <p>
          See our <Link to="/legal/acceptable-use" className="text-mixer-red hover:underline">Acceptable Use Policy</Link>{' '}
          for detailed restrictions. We may remove content or suspend access for illegal streams, copyright infringement,
          harassment, malware distribution, or attempts to bypass plan limits or security controls.
        </p>
      </LegalSection>

      <LegalSection title="7. Third-party services">
        <p>
          CloudCast integrates with third-party streaming platforms and infrastructure providers. We are not responsible for
          third-party outages, policy enforcement, or monetization decisions on external platforms.
        </p>
      </LegalSection>

      <LegalSection title="8. Disclaimers">
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE.&quot; TO THE MAXIMUM EXTENT PERMITTED BY LAW, REGAL DISCLAIMS ALL
          WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          Live production involves technical risk; you are responsible for backup plans and compliance with broadcast regulations.
        </p>
      </LegalSection>

      <LegalSection title="9. Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, REGAL&apos;S TOTAL LIABILITY FOR ANY CLAIM ARISING FROM THESE TERMS OR THE
          SERVICE SHALL NOT EXCEED THE GREATER OF (A) AMOUNTS YOU PAID US IN THE TWELVE MONTHS BEFORE THE CLAIM OR (B) USD $100.
          WE ARE NOT LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS,
          DATA LOSS, OR BROADCAST INTERRUPTION.
        </p>
      </LegalSection>

      <LegalSection title="10. Indemnification">
        <p>
          You will defend and indemnify Regal against claims arising from your content, streams, violation of these Terms,
          or infringement of third-party rights.
        </p>
      </LegalSection>

      <LegalSection title="11. Governing law & disputes">
        <p>
          These Terms are governed by the laws of the {SITE_LEGAL.governingLaw}, without regard to conflict-of-law rules.
          Disputes shall be resolved in the state or federal courts located in Atlanta, Georgia, and you consent to personal
          jurisdiction there. EU/UK consumers retain mandatory local rights where applicable.
        </p>
      </LegalSection>

      <LegalSection title="12. Changes">
        <p>
          We may update these Terms. Material changes will be notified via email or in-app notice at least 30 days before
          effectiveness when practicable. Continued use after the effective date constitutes acceptance.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
