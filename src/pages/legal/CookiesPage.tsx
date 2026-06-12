import { LegalDocument, LegalList, LegalSection } from '../../components/legal/LegalDocument';

export function CookiesPage() {
  return (
    <LegalDocument title="Cookie Policy">
      <LegalSection title="What are cookies?">
        <p>Cookies and similar technologies (local storage, session storage) help CloudCast keep you signed in and remember preferences.</p>
      </LegalSection>
      <LegalSection title="Cookies we use">
        <LegalList items={[
          'Essential: CloudCast authentication session, security tokens — required for the service.',
          'Functional: mixer UI state, dismissed broadcast banners, audio unlock flags.',
          'Analytics: we may use privacy-focused analytics in the future; non-essential cookies will require consent where required by law.',
        ]} />
      </LegalSection>
      <LegalSection title="Managing cookies">
        <p>You can block cookies in your browser, but essential cookies are required to sign in and use the mixer dashboard.</p>
      </LegalSection>
    </LegalDocument>
  );
}
