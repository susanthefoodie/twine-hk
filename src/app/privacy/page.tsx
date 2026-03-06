export default function PrivacyPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#12100e',
        color: '#f0e8d8',
        fontFamily: 'var(--font-sans)',
        padding: '48px clamp(16px, 5vw, 48px) 80px',
      }}
    >
      <div
        style={{
          maxWidth: '720px',
          margin: '0 auto',
          background: '#1a1714',
          border: '1px solid #332e28',
          borderRadius: '12px',
          padding: 'clamp(28px, 5vw, 56px) clamp(24px, 5vw, 56px)',
        }}
      >
        {/* Back link */}
        <a
          href="/"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.08em',
            color: '#7a7060',
            textDecoration: 'none',
            display: 'inline-block',
            marginBottom: '32px',
          }}
        >
          ← Back
        </a>

        {/* Title */}
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 700,
            fontSize: 'clamp(24px, 4vw, 32px)',
            color: '#f0e8d8',
            margin: '0 0 8px',
            lineHeight: 1.2,
          }}
        >
          Privacy Policy
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: '#7a7060',
            letterSpacing: '0.06em',
            margin: '0 0 40px',
          }}
        >
          Last updated: March 2026
        </p>

        <Section title="What we collect">
          <p>
            When you use Twine, we collect the following information to provide the service:
          </p>
          <ul>
            <li><strong>Account data</strong> — your email address and display name, provided when you sign in via Google or magic link.</li>
            <li><strong>Location data</strong> — your device&apos;s GPS coordinates, requested when you start a swipe session. Location is used only to find nearby restaurants and is never stored persistently on our servers.</li>
            <li><strong>Swipe history</strong> — the places you swipe right or left during sessions. This is used to prevent showing you the same places twice and to calculate matches with other participants.</li>
            <li><strong>Preferences</strong> — your cuisine preferences, dietary requirements, and budget range set during onboarding.</li>
            <li><strong>Saved places</strong> — restaurants you bookmark and any notes or ratings you add.</li>
          </ul>
        </Section>

        <Section title="How it's used">
          <p>The data we collect is used exclusively to:</p>
          <ul>
            <li>Personalise your swipe feed with restaurants that match your preferences and location.</li>
            <li>Match your swipes with other session participants to surface places you all liked.</li>
            <li>Remember your saved places and visit history across sessions.</li>
            <li>Improve the hidden gem scoring algorithm over time.</li>
          </ul>
          <p>
            We do not sell your personal data. We do not use your data for advertising profiling. We do not share your swipe data with restaurants or third parties.
          </p>
        </Section>

        <Section title="Third-party services">
          <p>Twine uses the following third-party services to operate:</p>
          <ul>
            <li>
              <strong>Google Places API</strong> — to retrieve restaurant data, photos, and opening hours near your location. Google&apos;s privacy policy governs how Google processes this data:{' '}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#c9622a' }}>
                policies.google.com/privacy
              </a>
            </li>
            <li>
              <strong>Supabase</strong> — a backend-as-a-service platform that stores your account data, session data, and saved places. Data is stored on servers in the Asia Pacific region. Supabase&apos;s privacy policy:{' '}
              <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#c9622a' }}>
                supabase.com/privacy
              </a>
            </li>
            <li>
              <strong>Stripe</strong> — used to process Pro subscription payments. Twine never stores your card details. Stripe&apos;s privacy policy:{' '}
              <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#c9622a' }}>
                stripe.com/privacy
              </a>
            </li>
          </ul>
        </Section>

        <Section title="Data retention">
          <p>
            Your account data, preferences, swipe history, and saved places are retained for as long as you have an active account. You may delete your account at any time by contacting us at the email address below, at which point all personal data will be permanently removed within 30 days.
          </p>
          <p>
            Anonymous session and matching data (with no personally identifiable information attached) may be retained for up to 12 months to improve the service.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            Under applicable privacy laws (including the Hong Kong Personal Data (Privacy) Ordinance), you have the right to:
          </p>
          <ul>
            <li>Access the personal data we hold about you.</li>
            <li>Request correction of inaccurate data.</li>
            <li>Request deletion of your data.</li>
            <li>Object to certain processing of your data.</li>
          </ul>
          <p>
            To exercise any of these rights, please contact us at the email below.
          </p>
        </Section>

        <Section title="Contact" last>
          <p>
            If you have questions, concerns, or requests regarding this privacy policy or your personal data, please contact:
          </p>
          <p>
            <strong style={{ color: '#f0e8d8' }}>Twine HK</strong>
            <br />
            <a href="mailto:privacy@twine.hk" style={{ color: '#c9622a' }}>privacy@twine.hk</a>
          </p>
        </Section>
      </div>
    </div>
  );
}

// ── Section helper ────────────────────────────────────────────────────────────

function Section({
  title, children, last,
}: {
  title: string; children: React.ReactNode; last?: boolean;
}) {
  return (
    <section
      style={{
        marginBottom: last ? 0 : '36px',
        paddingBottom: last ? 0 : '36px',
        borderBottom: last ? 'none' : '1px solid #221e1a',
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--font-serif)',
          fontWeight: 700,
          fontSize: '18px',
          color: '#f0e8d8',
          margin: '0 0 14px',
        }}
      >
        {title}
      </h2>
      <div
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 300,
          fontSize: '14px',
          lineHeight: 1.75,
          color: '#9a8f7e',
        }}
      >
        {children}
      </div>
    </section>
  );
}
