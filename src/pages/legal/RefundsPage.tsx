import { LegalDocument, LegalList, LegalSection } from '../../components/legal/LegalDocument';

export function RefundsPage() {
  return (
    <LegalDocument title="Refund & Cancellation Policy">
      <LegalSection title="Cancellation">
        <p>You may cancel a paid subscription at any time from your profile. Cancellation stops future charges; access continues until the end of the billing period.</p>
      </LegalSection>
      <LegalSection title="Refunds">
        <LegalList items={[
          '14-day money-back guarantee for first-time paid subscriptions if you have not exceeded plan fair-use thresholds.',
          'No refunds for partial months after the guarantee period except where required by law.',
          'Manually issued plans or coupon upgrades are non-refundable but may be revoked by support.',
          'EU/UK consumers retain statutory withdrawal rights for digital services where applicable.',
        ]} />
      </LegalSection>
      <LegalSection title="Downgrades">
        <p>Downgrading takes effect at the next billing cycle. Cloud recordings exceeding the new plan quota must be deleted before downgrade completes.</p>
      </LegalSection>
    </LegalDocument>
  );
}
