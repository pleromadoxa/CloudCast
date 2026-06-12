import { LegalDocument, LegalSection } from '../../components/legal/LegalDocument';

const SUBPROCESSORS = [
  { name: 'Supabase, Inc.', purpose: 'Database, authentication, file storage, edge functions', location: 'USA' },
  { name: 'Resend, Inc.', purpose: 'Transactional email delivery', location: 'USA' },
  { name: 'Cloudflare, Inc.', purpose: 'CDN, WebRTC/stream delivery (Regal Cloud plans)', location: 'Global' },
];

export function SubprocessorsPage() {
  return (
    <LegalDocument title="Subprocessors">
      <LegalSection title="Current subprocessors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-mixer-muted">
                <th className="py-2 pr-4">Provider</th>
                <th className="py-2 pr-4">Purpose</th>
                <th className="py-2">Location</th>
              </tr>
            </thead>
            <tbody>
              {SUBPROCESSORS.map((s) => (
                <tr key={s.name} className="border-b border-white/5">
                  <td className="py-3 pr-4 font-medium text-white">{s.name}</td>
                  <td className="py-3 pr-4">{s.purpose}</td>
                  <td className="py-3">{s.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>
      <LegalSection title="Updates">
        <p>Material subprocessor changes are announced via email to account holders and updated on this page with 30 days notice.</p>
      </LegalSection>
    </LegalDocument>
  );
}
