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
    accent: '#ff6b35',
  },
  {
    icon: '👯',
    label: 'Friends',
    title: 'Group Dinner.',
    body: "Share a link. Everyone swipes independently. The app finds the consensus — no more endless WhatsApp debates.",
    badge: undefined,
    accent: '#ffa500',
  },
  {
    icon: '🙋',
    label: 'Solo',
    title: 'Just Me.',
    body: "Exploring the city alone? Swipe through gems you'd never find on Google Maps.",
    badge: undefined,
    accent: '#10b981',
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
        color: hovered ? '#ff6b35' : 'rgba(248,248,255,0.35)',
        border: `1px solid ${hovered ? 'rgba(255,107,53,0.4)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: '9999px',
        padding: '5px 14px',
        whiteSpace: 'nowrap',
        cursor: 'default',
        transition: 'color 0.2s, border-color 0.2s',
        userSelect: 'none',
        background: hovered ? 'rgba(255,107,53,0.08)' : 'rgba(255,255,255,0.04)',
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
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px',
        padding: '32px',
        position: 'relative',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: `0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06), -4px 0 20px ${accent}22`,
      }}
    >
      {badge && (
        <span
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#ff6b35',
            background: 'rgba(255,107,53,0.15)',
            border: '1px solid rgba(255,107,53,0.3)',
            borderRadius: '9999px',
            padding: '3px 10px',
          }}
        >
          {badge}
        </span>
      )}
      <div style={{ fontSize: '32px', marginBottom: '16px' }}>{icon}</div>
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: accent,
          marginBottom: '10px',
        }}
      >
        {label}
      </div>
      <h3
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '22px',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: '#f8f8ff',
          margin: '0 0 12px',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 400,
          fontSize: '15px',
          lineHeight: 1.7,
          color: 'rgba(248,248,255,0.6)',
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
        borderRight: last ? 'none' : '1px dashed rgba(255,255,255,0.08)',
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: '52px',
          fontWeight: 800,
          background: 'linear-gradient(135deg, #ff6b35, #ffa500)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          lineHeight: 1,
          marginBottom: '16px',
        }}
      >
        {num}
      </div>
      <h4
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 700,
          fontSize: '16px',
          letterSpacing: '-0.01em',
          color: '#f8f8ff',
          margin: '0 0 10px',
        }}
      >
        {title}
      </h4>
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 400,
          fontSize: '14px',
          lineHeight: 1.7,
          color: 'rgba(248,248,255,0.6)',
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
        background: '#0a0a0f',
        color: '#f8f8ff',
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
          height: '56px',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 clamp(20px, 5vw, 80px)',
          background: scrolled ? 'rgba(10,10,15,0.85)' : '#0a0a0f',
          backdropFilter: scrolled ? 'blur(20px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
          borderBottom: `1px solid ${scrolled ? 'rgba(255,255,255,0.08)' : 'transparent'}`,
          transition: 'background 0.3s, border-color 0.3s, backdrop-filter 0.3s',
        }}
      >
        {/* Logo */}
        <span
          style={{
            fontSize: '22px',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            background: 'linear-gradient(135deg, #ff6b35, #ffa500)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            userSelect: 'none',
          }}
        >
          twine HK
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
          paddingTop: '56px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Hero glow */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '60%',
            background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255,107,53,0.12), transparent)',
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
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.12em',
                color: '#ff6b35',
                marginBottom: '20px',
                textTransform: 'uppercase',
                background: 'rgba(255,107,53,0.15)',
                border: '1px solid rgba(255,107,53,0.3)',
                borderRadius: '9999px',
                padding: '4px 14px',
                display: 'inline-block',
              }}
            >
              ✦ Hong Kong Restaurant Discovery
            </div>

            {/* Headline */}
            <h1 style={{ margin: '0 0 6px', lineHeight: 1.08, letterSpacing: '-0.03em' }}>
              <span
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'clamp(48px, 7vw, 80px)',
                  fontWeight: 800,
                  color: '#f8f8ff',
                  letterSpacing: '-0.03em',
                }}
              >
                The city holds
              </span>
              <span
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'clamp(48px, 7vw, 80px)',
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  background: 'linear-gradient(135deg, #ff6b35, #ffa500)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Hidden Gems.
              </span>
            </h1>

            {/* Subheadline */}
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 400,
                fontSize: 'clamp(15px, 1.5vw, 18px)',
                lineHeight: 1.7,
                color: 'rgba(248,248,255,0.6)',
                maxWidth: '480px',
                margin: '24px 0 36px',
              }}
            >
              Twine surfaces Hong Kong&apos;s hidden gem restaurants. Swipe with your partner. Find the places only locals know.
            </p>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <EmberButton href="/auth" label="Start Discovering →" size="lg" />
              <GhostButton href="/guest" label="Try as Guest" />
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
              background: 'linear-gradient(90deg, transparent, #0a0a0f)',
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
          borderTop: '1px solid rgba(255,255,255,0.08)',
          background: '#111118',
        }}
      >
        <p
          style={{
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#ff6b35',
            textAlign: 'center',
            marginBottom: '12px',
          }}
        >
          Modes
        </p>
        <h2
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 800,
            fontSize: 'clamp(22px, 3vw, 38px)',
            letterSpacing: '-0.03em',
            color: '#f8f8ff',
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
          background: '#0a0a0f',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <p
          style={{
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#ff6b35',
            marginBottom: '12px',
          }}
        >
          The process
        </p>
        <h2
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 800,
            fontSize: 'clamp(24px, 3vw, 40px)',
            letterSpacing: '-0.03em',
            color: '#f8f8ff',
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
          background: '#111118',
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
            background: 'radial-gradient(ellipse, rgba(255,107,53,0.08) 0%, transparent 60%)',
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
                fontFamily: 'var(--font-sans)',
                fontStyle: 'italic',
                fontWeight: 600,
                fontSize: 'clamp(20px, 2.4vw, 28px)',
                lineHeight: 1.55,
                letterSpacing: '-0.02em',
                color: '#f8f8ff',
                margin: 0,
                borderLeft: '3px solid #ff6b35',
                paddingLeft: '28px',
              }}
            >
              &ldquo;Not the most reviewed. Not the most famous. The ones worth finding.&rdquo;
            </blockquote>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'rgba(248,248,255,0.35)',
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
                    fontWeight: 400,
                    fontSize: '15px',
                    lineHeight: 1.7,
                    color: 'rgba(248,248,255,0.6)',
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
          background: '#0a0a0f',
          borderTop: '1px solid rgba(255,255,255,0.08)',
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
            background: 'radial-gradient(ellipse, rgba(255,107,53,0.1) 0%, transparent 65%)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p
            style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#ff6b35',
              marginBottom: '16px',
            }}
          >
            Get started
          </p>
          <h2
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 800,
              fontSize: 'clamp(24px, 3.5vw, 36px)',
              letterSpacing: '-0.03em',
              color: '#f8f8ff',
              margin: '0 0 36px',
            }}
          >
            Ready to find your hidden gem?
          </h2>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <EmberButton href="/auth" label="Create your first session — it's free →" size="lg" />
            <GhostButton href="/guest" label="Try as Guest" />
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════ */}
      <footer
        style={{
          background: '#0a0a0f',
          borderTop: '1px solid rgba(255,255,255,0.08)',
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
  fontSize: '11px',
  letterSpacing: '0.05em',
  color: 'rgba(248,248,255,0.35)',
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
        fontWeight: 500,
        color: hovered ? '#f8f8ff' : 'rgba(248,248,255,0.6)',
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
        fontWeight: 600,
        fontSize: size === 'lg' ? '15px' : '13px',
        color: '#fff',
        background: 'linear-gradient(135deg, #ff6b35, #ffa500)',
        borderRadius: '9999px',
        padding: size === 'lg' ? '14px 28px' : '8px 18px',
        textDecoration: 'none',
        transition: 'all 0.2s ease',
        letterSpacing: '0.02em',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        boxShadow: hovered
          ? '0 0 28px rgba(255,107,53,0.5), 0 4px 16px rgba(0,0,0,0.4)'
          : '0 0 20px rgba(255,107,53,0.3), 0 4px 12px rgba(0,0,0,0.4)',
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
        color: hovered ? '#f8f8ff' : 'rgba(248,248,255,0.6)',
        background: hovered ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: '9999px',
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
        fontSize: '11px',
        letterSpacing: '0.05em',
        color: hovered ? '#f8f8ff' : 'rgba(248,248,255,0.35)',
        textDecoration: 'none',
        transition: 'color 0.2s',
      }}
    >
      {label}
    </a>
  );
}
