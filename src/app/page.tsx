'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import DemoSwipeCards from '@/components/DemoSwipeCards';

// ─── Constants ───────────────────────────────────────────────────────────────

const DISTRICTS = [
  'Central', 'Sheung Wan', 'Wan Chai', 'Causeway Bay',
  'Kennedy Town', 'TST', 'Mong Kok', 'Aberdeen', 'Sai Kung',
];

const MODES = [
  {
    icon: '💑',
    label: 'Couples',
    title: 'Date Night.',
    body: 'Both of you swipe the same hidden gems. The app reveals only where you both said yes.',
    badge: 'Most Popular',
    accent: '#c9622a',
  },
  {
    icon: '👯',
    label: 'Friends',
    title: 'Group Dinner.',
    body: "Share a link. Everyone swipes independently. The app finds the consensus — no more endless WhatsApp debates.",
    badge: undefined,
    accent: '#c4922a',
  },
  {
    icon: '🙋',
    label: 'Solo',
    title: 'Just Me.',
    body: "Exploring the city alone? Swipe through gems you'd never find on Google Maps.",
    badge: undefined,
    accent: '#4a7c6f',
  },
];

const STEPS = [
  {
    num: '01',
    title: 'Set your taste',
    desc: 'Select cuisines, dietary needs, and budget. Twine tailors every gem to your palate.',
  },
  {
    num: '02',
    title: 'Share a session',
    desc: 'One link, sent via WhatsApp. Your partner joins in seconds — no account needed.',
  },
  {
    num: '03',
    title: 'Swipe hidden gems',
    desc: "Tinder-style cards, swiped independently. Neither of you sees the other's choices.",
  },
  {
    num: '04',
    title: 'See your match ✦',
    desc: 'The places you both unearthed, revealed together. Your next meal — decided.',
  },
];

const FEATURES = [
  { icon: '🔍', text: 'Under-the-radar only — we filter out chain restaurants and tourist traps' },
  { icon: '🇭🇰', text: 'Built for Hong Kong — MTR proximity, district filters, Cantonese + English' },
  { icon: '💑', text: 'Made for together — swipe with your person, not alone' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function DistrictPill({ label }: { label: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        letterSpacing: '0.05em',
        color: hovered ? '#c9622a' : '#7a7060',
        border: `1px solid ${hovered ? '#c9622a' : '#332e28'}`,
        borderRadius: '4px',
        padding: '5px 14px',
        whiteSpace: 'nowrap',
        cursor: 'default',
        transition: 'color 0.2s, border-color 0.2s',
        userSelect: 'none',
      }}
    >
      {label}
    </span>
  );
}


function ModeCard({
  icon, label, title, body, badge, accent,
}: {
  icon: string; label: string; title: string; body: string; badge?: string; accent: string;
}) {
  return (
    <div
      style={{
        background: '#1a1714',
        border: '1px solid #332e28',
        borderLeft: `4px solid ${accent}`,
        padding: '32px',
        position: 'relative',
      }}
    >
      {badge && (
        <span
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            letterSpacing: '0.08em',
            color: accent,
            border: `1px solid ${accent}`,
            borderRadius: '4px',
            padding: '3px 8px',
            opacity: 0.85,
          }}
        >
          {badge}
        </span>
      )}
      <div style={{ fontSize: '26px', marginBottom: '14px' }}>{icon}</div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: accent,
          marginBottom: '8px',
          opacity: 0.8,
        }}
      >
        {label}
      </div>
      <h3
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '22px',
          fontWeight: 700,
          color: '#f0e8d8',
          margin: '0 0 12px',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 300,
          fontSize: '15px',
          lineHeight: 1.7,
          color: '#7a7060',
          margin: 0,
        }}
      >
        {body}
      </p>
    </div>
  );
}

function StepCard({ num, title, desc, last }: { num: string; title: string; desc: string; last: boolean }) {
  return (
    <div
      style={{
        padding: '0 40px 0 0',
        borderRight: last ? 'none' : '1px dashed #332e28',
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '52px',
          fontWeight: 700,
          color: '#c9622a',
          lineHeight: 1,
          marginBottom: '16px',
          opacity: 0.85,
        }}
      >
        {num}
      </div>
      <h4
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 600,
          fontSize: '16px',
          color: '#f0e8d8',
          margin: '0 0 10px',
        }}
      >
        {title}
      </h4>
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 300,
          fontSize: '14px',
          lineHeight: 1.7,
          color: '#7a7060',
          margin: 0,
        }}
      >
        {desc}
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();

  // Redirect already-authenticated users straight into the app
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace('/home');
    });
  }, [router]);

  useEffect(() => {
    const handle = () => setScrolled(window.scrollY > 72);
    window.addEventListener('scroll', handle, { passive: true });
    return () => window.removeEventListener('scroll', handle);
  }, []);

  return (
    <div
      style={{
        background: '#12100e',
        color: '#f0e8d8',
        fontFamily: 'var(--font-sans)',
        overflowX: 'hidden',
      }}
    >

      {/* ══════════════════════════════════════════════════
          NAV
      ══════════════════════════════════════════════════ */}
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '52px',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 clamp(20px, 5vw, 80px)',
          background: scrolled ? 'rgba(18,16,14,0.88)' : '#12100e',
          backdropFilter: scrolled ? 'blur(14px)' : 'none',
          borderBottom: `1px solid ${scrolled ? '#3d3730' : '#332e28'}`,
          transition: 'background 0.3s, border-color 0.3s, backdrop-filter 0.3s',
        }}
      >
        {/* Logo */}
        <span
          style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: '22px',
            color: '#e07840',
            userSelect: 'none',
            letterSpacing: '-0.01em',
          }}
        >
          ✦ Twine
        </span>

        {/* Nav actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <NavLink href="/auth" label="Sign In" />
          <EmberButton href="/auth" label="Get Started" size="sm" />
        </div>
      </nav>


      {/* ══════════════════════════════════════════════════
          SECTION 1 — HERO
      ══════════════════════════════════════════════════ */}
      <section
        style={{
          minHeight: '100vh',
          paddingTop: '52px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Warm amber glow behind hero */}
        <div
          style={{
            position: 'absolute',
            top: '5%',
            left: '-5%',
            width: '65%',
            height: '70%',
            background: 'radial-gradient(ellipse, rgba(201,98,42,0.12) 0%, transparent 60%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 'clamp(24px, 4vw, 60px)',
            padding: '0 clamp(24px, 6vw, 100px)',
            maxWidth: '1400px',
            margin: '0 auto',
            width: '100%',
          }}
        >
          {/* ── Left: copy (60%) ── */}
          <div style={{ flex: '0 0 60%', minWidth: 0 }}>
            {/* Eyebrow */}
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.12em',
                color: '#c9622a',
                marginBottom: '20px',
                textTransform: 'uppercase',
                opacity: 0.9,
              }}
            >
              ✦ Hong Kong Restaurant Discovery
            </div>

            {/* Headline */}
            <h1 style={{ margin: '0 0 6px', lineHeight: 1.02 }}>
              <span
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-serif)',
                  fontSize: 'clamp(48px, 7vw, 96px)',
                  fontWeight: 700,
                  color: '#f0e8d8',
                  letterSpacing: '-0.02em',
                }}
              >
                The city holds
              </span>
              <span
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-serif)',
                  fontSize: 'clamp(48px, 7vw, 96px)',
                  fontWeight: 700,
                  fontStyle: 'italic',
                  color: '#e07840',
                  letterSpacing: '-0.02em',
                }}
              >
                secrets worth sharing.
              </span>
            </h1>

            {/* Subheadline */}
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 300,
                fontSize: 'clamp(15px, 1.5vw, 18px)',
                lineHeight: 1.7,
                color: '#7a7060',
                maxWidth: '480px',
                margin: '24px 0 36px',
              }}
            >
              Twine surfaces Hong Kong&apos;s hidden gem restaurants. Swipe with your partner. Find the places only locals know.
            </p>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <EmberButton href="/auth" label="Start Discovering →" size="lg" />
              <GhostButton href="#how-it-works" label="How it works ↓" />
            </div>
          </div>

          {/* ── Right: interactive demo card stack (40%) ── */}
          <div
            style={{
              flex: '0 0 40%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 'clamp(400px, 50vw, 500px)',
              paddingTop: '20px',
              paddingBottom: '40px',
              overflow: 'hidden',
            }}
          >
            <DemoSwipeCards />
          </div>
        </div>

        {/* ── District pills ── */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            marginTop: '56px',
            paddingBottom: '52px',
          }}
        >
          <div
            style={{
              overflowX: 'auto',
              padding: '0 clamp(24px, 6vw, 100px)',
              scrollbarWidth: 'none',
            }}
          >
            <div style={{ display: 'flex', gap: '8px', width: 'max-content' }}>
              {DISTRICTS.map((d) => (
                <DistrictPill key={d} label={d} />
              ))}
            </div>
          </div>
          {/* Fade-right hint */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '80px',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, #12100e)',
              pointerEvents: 'none',
            }}
          />
        </div>
      </section>


      {/* ══════════════════════════════════════════════════
          SECTION 2 — THREE MODES
      ══════════════════════════════════════════════════ */}
      <section
        style={{
          padding: 'clamp(72px, 10vw, 120px) clamp(24px, 6vw, 100px)',
          borderTop: '1px solid #332e28',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#c9622a',
            textAlign: 'center',
            marginBottom: '12px',
            opacity: 0.8,
          }}
        >
          Modes
        </p>
        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 'clamp(22px, 3vw, 38px)',
            color: '#f0e8d8',
            textAlign: 'center',
            margin: '0 auto 48px',
            maxWidth: '680px',
          }}
        >
          One app. Three ways to find your next meal.
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '16px',
            maxWidth: '1100px',
            margin: '0 auto',
          }}
        >
          {MODES.map((m) => (
            <ModeCard key={m.label} {...m} />
          ))}
        </div>
      </section>


      {/* ══════════════════════════════════════════════════
          SECTION 3 — HOW IT WORKS
      ══════════════════════════════════════════════════ */}
      <section
        id="how-it-works"
        style={{
          padding: 'clamp(72px, 10vw, 120px) clamp(24px, 6vw, 100px)',
          background: '#1a1714',
          borderTop: '1px solid #332e28',
          borderBottom: '1px solid #332e28',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#c9622a',
            marginBottom: '12px',
            opacity: 0.8,
          }}
        >
          The process
        </p>
        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 700,
            fontSize: 'clamp(24px, 3vw, 40px)',
            color: '#f0e8d8',
            margin: '0 0 56px',
          }}
        >
          How Twine works
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '40px 0',
            maxWidth: '1100px',
          }}
        >
          {STEPS.map((step, i) => (
            <StepCard key={i} {...step} last={i === STEPS.length - 1} />
          ))}
        </div>
      </section>


      {/* ══════════════════════════════════════════════════
          SECTION 4 — HIDDEN GEMS PROMISE
      ══════════════════════════════════════════════════ */}
      <section
        style={{
          padding: 'clamp(72px, 10vw, 120px) clamp(24px, 6vw, 100px)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Centre glow */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '900px',
            height: '500px',
            background: 'radial-gradient(ellipse, rgba(201,98,42,0.09) 0%, transparent 60%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '60px',
            maxWidth: '1100px',
            margin: '0 auto',
            position: 'relative',
            zIndex: 1,
            alignItems: 'center',
          }}
        >
          {/* Left: quote */}
          <div>
            <blockquote
              style={{
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: 'clamp(20px, 2.4vw, 30px)',
                lineHeight: 1.55,
                color: '#f0e8d8',
                margin: 0,
                borderLeft: '3px solid #c9622a',
                paddingLeft: '28px',
              }}
            >
              &ldquo;Not the most reviewed. Not the most famous. The ones worth finding.&rdquo;
            </blockquote>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: '#7a7060',
                letterSpacing: '0.06em',
                marginTop: '20px',
                paddingLeft: '28px',
              }}
            >
              — The Twine promise
            </p>
          </div>

          {/* Right: feature rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {FEATURES.map(({ icon, text }) => (
              <div key={text} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '18px', flexShrink: 0, lineHeight: 1.4 }}>{icon}</span>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 300,
                    fontSize: '15px',
                    lineHeight: 1.7,
                    color: '#7a7060',
                  }}
                >
                  {text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════
          SECTION 5 — CTA FOOTER BAND
      ══════════════════════════════════════════════════ */}
      <section
        style={{
          background: '#1a1714',
          borderTop: '1px solid #332e28',
          padding: 'clamp(64px, 10vw, 100px) clamp(24px, 6vw, 100px)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '600px',
            height: '300px',
            background: 'radial-gradient(ellipse, rgba(201,98,42,0.08) 0%, transparent 65%)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#c9622a',
              marginBottom: '16px',
              opacity: 0.8,
            }}
          >
            Get started
          </p>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: 700,
              fontSize: 'clamp(24px, 3.5vw, 36px)',
              color: '#f0e8d8',
              margin: '0 0 36px',
            }}
          >
            Ready to find your hidden gem?
          </h2>
          <EmberButton href="/auth" label="Create your first session — it's free →" size="lg" />
        </div>
      </section>


      {/* ══════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════ */}
      <footer
        style={{
          background: '#12100e',
          borderTop: '1px solid #332e28',
          padding: '20px clamp(24px, 6vw, 100px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <span style={footerText}>© Twine HK 2025</span>
        <div style={{ display: 'flex', gap: '28px' }}>
          <FooterLink href="/privacy" label="Privacy Policy" />
          <FooterLink href="mailto:hello@twine.hk" label="Contact" />
        </div>
        <span style={footerText}>Made for Hong Kong 🇭🇰</span>
      </footer>

    </div>
  );
}

// ─── Shared style helpers ──────────────────────────────────────────────────────

const footerText: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '10px',
  letterSpacing: '0.05em',
  color: '#7a7060',
};

function NavLink({ href, label }: { href: string; label: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontFamily: 'var(--font-sans)',
        fontSize: '14px',
        color: hovered ? '#f0e8d8' : '#7a7060',
        textDecoration: 'none',
        transition: 'color 0.2s',
      }}
    >
      {label}
    </a>
  );
}

function EmberButton({ href, label, size }: { href: string; label: string; size: 'sm' | 'lg' }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-block',
        fontFamily: 'var(--font-sans)',
        fontWeight: 500,
        fontSize: size === 'lg' ? '15px' : '13px',
        color: '#f0e8d8',
        background: hovered ? '#e07840' : '#c9622a',
        borderRadius: '4px',
        padding: size === 'lg' ? '14px 28px' : '8px 18px',
        textDecoration: 'none',
        transition: 'background 0.2s',
        letterSpacing: '0.01em',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </a>
  );
}

function GhostButton({ href, label }: { href: string; label: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-block',
        fontFamily: 'var(--font-sans)',
        fontWeight: 500,
        fontSize: '15px',
        color: hovered ? '#e07840' : '#c9622a',
        background: hovered ? 'rgba(201,98,42,0.08)' : 'transparent',
        border: `1px solid ${hovered ? '#e07840' : '#c9622a'}`,
        borderRadius: '4px',
        padding: '14px 28px',
        textDecoration: 'none',
        transition: 'all 0.2s',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </a>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        letterSpacing: '0.05em',
        color: hovered ? '#f0e8d8' : '#7a7060',
        textDecoration: 'none',
        transition: 'color 0.2s',
      }}
    >
      {label}
    </a>
  );
}
