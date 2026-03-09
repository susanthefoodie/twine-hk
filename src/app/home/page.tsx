'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  display_name: string | null;
  avatar_url:   string | null;
}

interface RecentSession {
  id:         string;
  mode:       string;
  created_at: string;
  share_code: string;
}

interface CreatedSession {
  sessionId: string;
  shareCode: string;
  joinUrl:   string;
}

type Mode = 'couples' | 'friends' | 'solo';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All', 'Cantonese', 'Japanese', 'Korean', 'Western', 'Café', 'Bar', 'Dessert',
] as const;

const DISTANCES = [
  { label: '500 m', metres: 500 },
  { label: '1 km',  metres: 1000 },
  { label: '3 km',  metres: 3000 },
  { label: '🚇 MTR', metres: 99999 },
] as const;

const BUDGETS = ['$', '$$', '$$$', '$$$$'] as const;

const MODES = [
  {
    id:        'couples' as Mode,
    emoji:     '💑',
    modeLabel: 'DATE NIGHT',
    title:     'Find a hidden gem together.',
    body:      'You and your partner each swipe secretly. Twine reveals only the places you both chose.',
    accent:    '#ff6b35',
    ctaLabel:  'Start Session →',
    ctaKind:   'ember' as const,
    sharePrompt: 'your partner',
  },
  {
    id:        'friends' as Mode,
    emoji:     '👯',
    modeLabel: 'GROUP DINNER',
    title:     'Finally agree on somewhere.',
    body:      'Share a link to your friend group. Everyone swipes independently. Your collective gem is revealed.',
    accent:    '#ffa500',
    ctaLabel:  'Start Session →',
    ctaKind:   'gold' as const,
    sharePrompt: 'your group',
  },
  {
    id:        'solo' as Mode,
    emoji:     '🙋',
    modeLabel: 'JUST ME',
    title:     'Explore the city alone.',
    body:      'A personal swipe feed of under-the-radar spots, filtered to exactly your taste.',
    accent:    '#38bdf8',
    ctaLabel:  'Start Swiping →',
    ctaKind:   'sage' as const,
    sharePrompt: '',
  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = parseInt(
    new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Hong_Kong',
      hour: 'numeric',
      hour12: false,
    })
  );
  if (h >= 5  && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  return 'evening';
}

function getFirstName(profile: Profile | null, user: User | null): string {
  if (profile?.display_name) return profile.display_name.split(' ')[0];
  const googleName = user?.user_metadata?.full_name as string | undefined;
  if (googleName) return googleName.split(' ')[0];
  if (user?.email) return user.email.split('@')[0];
  return 'there';
}

function relativeDate(dateStr: string): string {
  const diff = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 86_400_000
  );
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7)  return `${diff} days ago`;
  return new Date(dateStr).toLocaleDateString('en-HK', {
    month: 'short',
    day: 'numeric',
  });
}

const MODE_EMOJI: Record<string, string> = {
  couples: '💑',
  friends: '👯',
  solo:    '🙋',
};

const MODE_DISPLAY: Record<string, string> = {
  couples: 'Date Night',
  friends: 'Group Dinner',
  solo:    'Solo',
};

// ─── Small shared components ──────────────────────────────────────────────────

function Avatar({
  url,
  name,
  onClick,
}: {
  url: string | null;
  name: string;
  onClick: () => void;
}) {
  const initials = name
    .split(' ')
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);

  return (
    <button
      onClick={onClick}
      style={{
        width: '38px',
        height: '38px',
        borderRadius: '50%',
        border: '2px solid transparent',
        backgroundImage: 'linear-gradient(#ffffff, #ffffff), linear-gradient(135deg, #ff6b35, #ffa500)',
        backgroundOrigin: 'border-box',
        backgroundClip: 'padding-box, border-box',
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        padding: 0,
      }}
    >
      {url ? (
        <Image src={url} alt={name} width={40} height={40} style={{ borderRadius: '50%', objectFit: 'cover' }} />
      ) : (
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 600, color: '#ff6b35' }}>
          {initials || '?'}
        </span>
      )}
    </button>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: '44px',
        height: '24px',
        borderRadius: '12px',
        background: on ? '#ff6b35' : 'rgba(0,0,0,0.1)',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
        boxShadow: on ? '0 0 12px rgba(255,107,53,0.4)' : 'none',
      }}
    >
      <motion.div
        animate={{ x: on ? 22 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{
          position: 'absolute',
          top: '2px',
          left: 0,
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: '#ffffff',
        }}
      />
    </button>
  );
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: 'Inter, sans-serif',
      fontSize: '10px',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: 'rgba(15,15,15,0.35)',
      margin: '0 0 10px',
      fontWeight: 500,
    }}>
      {children}
    </p>
  );
}

function CopyIcon({ done }: { done: boolean }) {
  if (done) return <span style={{ fontSize: '16px', color: '#10b981' }}>✓</span>;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1" stroke="rgba(15,15,15,0.4)" strokeWidth="1.3" />
      <path d="M10.5 5.5V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v6.5a1 1 0 0 0 1 1H5.5"
            stroke="rgba(15,15,15,0.4)" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

// ─── Mode card ────────────────────────────────────────────────────────────────

function ModeCard({
  emoji, modeLabel, title, body, accent, ctaLabel, ctaKind,
  onCta,
}: {
  emoji: string; modeLabel: string; title: string; body: string;
  accent: string; ctaLabel: string; ctaKind: 'ember' | 'gold' | 'sage';
  onCta: () => void;
}) {
  const [ctaHover, setCtaHover] = useState(false);

  const isEmber = ctaKind === 'ember';

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: '20px',
        padding: '28px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div style={{ fontSize: '40px', lineHeight: 1 }}>{emoji}</div>
      <div style={{
        fontFamily: 'Inter, sans-serif',
        fontSize: '10px',
        letterSpacing: '0.12em',
        color: accent,
        textTransform: 'uppercase',
        fontWeight: 600,
      }}>
        {modeLabel}
      </div>
      <h3 style={{
        fontFamily: 'Inter, sans-serif',
        fontWeight: 700,
        fontSize: '20px',
        color: '#0f0f0f',
        margin: 0,
        lineHeight: 1.2,
        letterSpacing: '-0.02em',
      }}>
        {title}
      </h3>
      <p style={{
        fontFamily: 'Inter, sans-serif',
        fontWeight: 400,
        fontSize: '14px',
        color: 'rgba(15,15,15,0.55)',
        lineHeight: 1.7,
        margin: 0,
        flex: 1,
      }}>
        {body}
      </p>
      <button
        onClick={onCta}
        onMouseEnter={() => setCtaHover(true)}
        onMouseLeave={() => setCtaHover(false)}
        style={{
          marginTop: '4px',
          padding: '12px 22px',
          background: isEmber
            ? (ctaHover ? 'linear-gradient(135deg, #ff7f50, #ffb300)' : 'linear-gradient(135deg, #ff6b35, #ffa500)')
            : (ctaHover ? `${accent}22` : `${accent}11`),
          border: isEmber ? 'none' : `1px solid ${accent}66`,
          borderRadius: '9999px',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 600,
          fontSize: '14px',
          color: isEmber ? '#fff' : accent,
          cursor: 'pointer',
          transition: 'all 0.2s',
          alignSelf: 'flex-start',
          boxShadow: isEmber && ctaHover ? '0 4px 20px rgba(255,107,53,0.4)' : isEmber ? '0 2px 12px rgba(255,107,53,0.25)' : 'none',
        }}
      >
        {ctaLabel}
      </button>
    </div>
  );
}

// ─── Recent session chip ──────────────────────────────────────────────────────

function SessionChip({
  session,
  onClick,
}: {
  session: RecentSession;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flexShrink: 0,
        width: '180px',
        background: hovered ? 'rgba(0,0,0,0.04)' : '#ffffff',
        border: `1px solid ${hovered ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: '16px',
        padding: '16px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div style={{ fontSize: '18px', marginBottom: '8px' }}>
        {MODE_EMOJI[session.mode] ?? '✦'}
      </div>
      <div style={{
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        fontSize: '13px',
        color: '#0f0f0f',
        marginBottom: '4px',
      }}>
        {MODE_DISPLAY[session.mode] ?? session.mode}
      </div>
      <div style={{
        fontFamily: 'Inter, sans-serif',
        fontSize: '10px',
        color: 'rgba(15,15,15,0.35)',
        letterSpacing: '0.04em',
        marginBottom: '10px',
      }}>
        {relativeDate(session.created_at)}
      </div>
      <div style={{
        fontFamily: 'Inter, sans-serif',
        fontSize: '10px',
        fontWeight: 500,
        color: '#ff6b35',
        letterSpacing: '0.04em',
      }}>
        ✦ View results
      </div>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();

  // User & profile
  const [user,    setUser]    = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Page data
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);

  // Bottom sheet
  const [sheetMode,    setSheetMode]    = useState<Mode | null>(null);
  const [sheetView,    setSheetView]    = useState<'filters' | 'share'>('filters');
  const [createdSess,  setCreatedSess]  = useState<CreatedSession | null>(null);
  const [creating,     setCreating]     = useState(false);
  const [createError,  setCreateError]  = useState<string | null>(null);
  const [copied,       setCopied]       = useState(false);
  const [copiedLink,   setCopiedLink]   = useState(false);

  // Filters
  const [categories,     setCategories]     = useState<string[]>([]);
  const [distanceMetres, setDistanceMetres] = useState<number>(1000);
  const [budgets,        setBudgets]        = useState<string[]>([]);
  const [openNow,        setOpenNow]        = useState(false);

  // PWA install prompt
  const [pwaPrompt,     setPwaPrompt]     = useState<'android' | 'ios' | null>(null);
  const deferredInstall = useRef<{ prompt: () => void; userChoice: Promise<{ outcome: string }> } | null>(null);

  // Weather state
  const [typhoonActive, setTyphoonActive] = useState(false);
  const [rainyDay,      setRainyDay]      = useState(false);
  const [hkHour,        setHkHour]        = useState<number>(() =>
    parseInt(new Date().toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong', hour: 'numeric', hour12: false }))
  );

  const greeting   = getGreeting();
  const firstName  = getFirstName(profile, user);
  const sheetModeConfig = MODES.find((m) => m.id === sheetMode);

  // ── Data loading ─────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { router.push('/auth'); return; }
      setUser(u);

      const [{ data: prof }, sessionsRes] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('id', u.id)
            .maybeSingle(),
          fetch('/api/sessions/recent'),
        ]);

      setProfile(prof);

      if (sessionsRes.ok) {
        const { sessions } = await sessionsRes.json() as { sessions: RecentSession[] };
        setRecentSessions(sessions ?? []);
      } else {
        console.error('[home] failed to load recent sessions:', sessionsRes.status);
        setRecentSessions([]);
      }
    }
    load();
  }, [router]);

  // ── Weather / typhoon check ───────────────────────────────────────────────

  useEffect(() => {
    async function checkWeather() {
      try {
        // HK Observatory typhoon signal
        const warnRes = await fetch(
          'https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warnsum&lang=en'
        );
        if (warnRes.ok) {
          const warn = await warnRes.json() as Record<string, { actionCode: string }>;
          const signalCode = parseInt(warn?.WTCSGNL?.actionCode ?? '0');
          if (signalCode >= 8) {
            setTyphoonActive(true);
            setDistanceMetres(1000); // auto-set radius to 1km
          }
        }

        // Open-Meteo for rain
        const meteoRes = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=22.3&longitude=114.2&current=weathercode&timezone=Asia%2FHong_Kong'
        );
        if (meteoRes.ok) {
          const meteo = await meteoRes.json() as { current?: { weathercode?: number } };
          const code = meteo.current?.weathercode ?? 0;
          if (code >= 51) setRainyDay(true);
        }
      } catch {
        // Non-fatal — weather banners are best-effort
      }
    }

    checkWeather();
    // Refresh hour every minute
    const tick = setInterval(() => {
      setHkHour(parseInt(new Date().toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong', hour: 'numeric', hour12: false })));
    }, 60_000);
    return () => clearInterval(tick);
  }, []);

  // ── PWA install prompt (after 3rd session) ───────────────────────────────

  useEffect(() => {
    const count = parseInt(localStorage.getItem('twine_session_count') ?? '0');
    if (count < 3) return;
    if (localStorage.getItem('twine_pwa_dismissed')) return;

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isInStandalone = ('standalone' in navigator) && (navigator as unknown as { standalone: boolean }).standalone;
    if (isInStandalone) return; // already installed

    if (isIOS) {
      setPwaPrompt('ios');
      return;
    }

    // Android: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      deferredInstall.current = e as unknown as { prompt: () => void; userChoice: Promise<{ outcome: string }> };
      setPwaPrompt('android');
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // ── Sheet helpers ────────────────────────────────────────────────────────

  const openSheet = useCallback((mode: Mode) => {
    setSheetMode(mode);
    setSheetView('filters');
    setCreatedSess(null);
    setCreateError(null);
    setCategories([]);
    setDistanceMetres(1000);
    setBudgets([]);
    setOpenNow(false);
    setCopied(false);
    setCopiedLink(false);
  }, []);

  const closeSheet = useCallback(() => {
    setSheetMode(null);
    setCreating(false);
  }, []);

  function toggleCategory(cat: string) {
    if (cat === 'All') { setCategories([]); return; }
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  function toggleBudget(b: string) {
    setBudgets((prev) =>
      prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]
    );
  }

  async function handleCreateSession() {
    if (!sheetMode) return;
    setCreating(true);
    setCreateError(null);
    try {
      // Track session count for PWA prompt
      const prevCount = parseInt(localStorage.getItem('twine_session_count') ?? '0');
      localStorage.setItem('twine_session_count', String(prevCount + 1));

      const res = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: sheetMode,
          filters: { categories, distanceMetres, budgets, openNow, hkHour },
        }),
      });

      // Guard against empty or non-JSON responses (e.g. Next.js 500 with no body)
      let data: Record<string, unknown> = {};
      const text = await res.text();
      console.log('[home] /api/session/create response:', res.status, text);
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Server error (${res.status}) — check terminal logs`);
      }
      if (!res.ok) throw new Error((data.error as string) ?? `Failed to create session (${res.status})`);
      const sess = data as unknown as CreatedSession;
      setCreatedSess(sess);
      if (sheetMode === 'solo') {
        router.push(`/session/${sess.sessionId}`);
      } else {
        setSheetView('share');
      }
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setCreating(false);
    }
  }

  async function handleCopy(text: string, which: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(text);
      if (which === 'code') {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    } catch {}
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        background: '#faf9f7',
        minHeight: '100vh',
        color: '#0f0f0f',
        fontFamily: 'Inter, sans-serif',
      }}
    >

      {/* ════════════════════════════════════════════════════════
          TOP BAR
      ════════════════════════════════════════════════════════ */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          height: '60px',
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 clamp(16px, 4vw, 48px)',
        }}
      >
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 800,
            fontSize: '18px',
            background: 'linear-gradient(135deg, #ff6b35, #ffa500)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            userSelect: 'none',
          }}
        >
          twine HK
        </span>
        <Avatar
          url={profile?.avatar_url ?? null}
          name={firstName}
          onClick={() => router.push('/profile')}
        />
      </header>

      {/* ════════════════════════════════════════════════════════
          WEATHER / TIME BANNERS
      ════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {typhoonActive && (
          <motion.div
            key="typhoon"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden', background: 'rgba(255,107,53,0.08)', borderBottom: '1px solid rgba(255,107,53,0.25)' }}
          >
            <p style={{
              padding: '10px clamp(16px, 4vw, 48px)',
              margin: 0,
              fontFamily: 'Inter, sans-serif',
              fontSize: '11px',
              fontWeight: 500,
              color: '#ff6b35',
              letterSpacing: '0.06em',
            }}>
              🌀 Typhoon Signal 8+ · Radius auto-set to 1 km · Stay safe!
            </p>
          </motion.div>
        )}
        {!typhoonActive && rainyDay && (
          <motion.div
            key="rain"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden', background: 'rgba(255,165,0,0.06)', borderBottom: '1px solid rgba(255,165,0,0.2)' }}
          >
            <p style={{
              padding: '10px clamp(16px, 4vw, 48px)',
              margin: 0,
              fontFamily: 'Inter, sans-serif',
              fontSize: '11px',
              fontWeight: 500,
              color: '#ffa500',
              letterSpacing: '0.06em',
            }}>
              🌧 Rainy day in HK · Indoor spots and cafés surfaced
            </p>
          </motion.div>
        )}
        {!typhoonActive && (
          hkHour >= 5 && hkHour < 11 ? (
            <motion.div key="morning" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', background: 'rgba(56,189,248,0.06)', borderBottom: '1px solid rgba(56,189,248,0.15)' }}>
              <p style={{ padding: '10px clamp(16px, 4vw, 48px)', margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 500, color: '#38bdf8', letterSpacing: '0.06em' }}>
                🍵 Morning vibes · Dim sum & breakfast spots highlighted
              </p>
            </motion.div>
          ) : (hkHour >= 14 && hkHour < 18) ? (
            <motion.div key="tea" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', background: 'rgba(255,165,0,0.06)', borderBottom: '1px solid rgba(255,165,0,0.15)' }}>
              <p style={{ padding: '10px clamp(16px, 4vw, 48px)', margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 500, color: '#ffa500', letterSpacing: '0.06em' }}>
                ☕ Afternoon tea hour · Tea houses & cafés surfaced
              </p>
            </motion.div>
          ) : (hkHour >= 22 || hkHour < 5) ? (
            <motion.div key="night" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', background: 'rgba(139,92,246,0.06)', borderBottom: '1px solid rgba(139,92,246,0.15)' }}>
              <p style={{ padding: '10px clamp(16px, 4vw, 48px)', margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 500, color: '#a78bfa', letterSpacing: '0.06em' }}>
                🌙 Night owl mode · Bars, ramen, and izakayas surfaced
              </p>
            </motion.div>
          ) : null
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════
          PWA INSTALL PROMPT
      ════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {pwaPrompt && (
          <motion.div
            key="pwa"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{
              overflow: 'hidden',
              background: 'rgba(255,165,0,0.08)',
              borderBottom: '1px solid rgba(255,165,0,0.2)',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px clamp(16px, 4vw, 48px)',
              gap: '12px',
            }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>🏮</span>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '13px',
                color: '#ffa500',
                margin: 0,
                flex: 1,
              }}>
                {pwaPrompt === 'android'
                  ? 'Add Twine to your home screen for the best experience'
                  : "Tap the Share button → 'Add to Home Screen'"}
              </p>
              {pwaPrompt === 'android' && (
                <button
                  onClick={async () => {
                    if (!deferredInstall.current) return;
                    deferredInstall.current.prompt();
                    const { outcome } = await deferredInstall.current.userChoice;
                    if (outcome === 'accepted') localStorage.setItem('twine_pwa_dismissed', '1');
                    setPwaPrompt(null);
                  }}
                  style={{
                    padding: '7px 16px',
                    background: 'linear-gradient(135deg, #ff6b35, #ffa500)',
                    border: 'none',
                    borderRadius: '9999px',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                    fontSize: '12px',
                    color: '#fff',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  Install →
                </button>
              )}
              <button
                onClick={() => { localStorage.setItem('twine_pwa_dismissed', '1'); setPwaPrompt(null); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(15,15,15,0.35)',
                  cursor: 'pointer',
                  fontSize: '18px',
                  padding: '4px',
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════
          MAIN CONTENT
      ════════════════════════════════════════════════════════ */}
      <main
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '36px clamp(16px, 4vw, 48px) 100px',
        }}
      >

        {/* ── Greeting ── */}
        <div style={{ marginBottom: '40px' }}>
          <h1
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 700,
              fontSize: 'clamp(22px, 3.5vw, 32px)',
              color: 'rgba(15,15,15,0.55)',
              margin: '0 0 6px',
              letterSpacing: '-0.02em',
            }}
          >
            Good {greeting}, {firstName}.
          </h1>
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: '14px',
              color: 'rgba(15,15,15,0.3)',
              margin: 0,
            }}
          >
            What are you looking for tonight?
          </p>
        </div>

        {/* ── Mode cards ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px',
            marginBottom: '48px',
          }}
        >
          {MODES.map((m) => (
            <ModeCard
              key={m.id}
              emoji={m.emoji}
              modeLabel={m.modeLabel}
              title={m.title}
              body={m.body}
              accent={m.accent}
              ctaLabel={m.ctaLabel}
              ctaKind={m.ctaKind}
              onCta={() => openSheet(m.id)}
            />
          ))}
        </div>

        {/* ── Recent sessions ── */}
        {recentSessions.length > 0 && (
          <div>
            <h2
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                fontSize: '18px',
                color: '#0f0f0f',
                margin: '0 0 16px',
                letterSpacing: '-0.02em',
              }}
            >
              Recent sessions
            </h2>
            <div
              style={{
                display: 'flex',
                gap: '12px',
                overflowX: 'auto',
                paddingBottom: '8px',
                marginLeft: `clamp(-16px, -4vw, -48px)`,
                paddingLeft: `clamp(16px, 4vw, 48px)`,
                paddingRight: `clamp(16px, 4vw, 48px)`,
                scrollbarWidth: 'none',
              }}
            >
              {recentSessions.map((s) => (
                <SessionChip
                  key={s.id}
                  session={s}
                  onClick={() => router.push(`/results/${s.id}`)}
                />
              ))}
            </div>
          </div>
        )}

      </main>

      {/* ════════════════════════════════════════════════════════
          BOTTOM SHEET
      ════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {sheetMode && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeSheet}
              style={{
                position: 'fixed', inset: 0,
                background: 'rgba(0,0,0,0.75)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                zIndex: 200,
              }}
            />

            {/* Sheet */}
            <motion.div
              key="sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              style={{
                position: 'fixed',
                bottom: 0, left: 0, right: 0,
                background: '#ffffff',
                borderRadius: '24px 24px 0 0',
                borderTop: '1px solid rgba(0,0,0,0.08)',
                maxHeight: '88vh',
                overflowY: 'auto',
                zIndex: 201,
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}
            >
              {/* Drag handle */}
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
                <div style={{
                  width: '36px', height: '4px',
                  background: 'rgba(0,0,0,0.15)',
                  borderRadius: '2px',
                }} />
              </div>

              <AnimatePresence mode="wait">
                {sheetView === 'filters' ? (
                  <motion.div
                    key="filters"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    style={{ padding: '20px 24px 32px' }}
                  >
                    {/* Sheet header */}
                    <div style={{
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', marginBottom: '24px',
                    }}>
                      <h3 style={{
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 700,
                        fontSize: '20px',
                        color: '#0f0f0f',
                        margin: 0,
                        letterSpacing: '-0.02em',
                      }}>
                        New {sheetModeConfig?.emoji}{' '}
                        {sheetMode
                          ? sheetMode.charAt(0).toUpperCase() + sheetMode.slice(1)
                          : ''}{' '}
                        Session
                      </h3>
                      <button
                        onClick={closeSheet}
                        style={{
                          background: 'rgba(0,0,0,0.05)',
                          border: '1px solid rgba(0,0,0,0.08)',
                          borderRadius: '50%',
                          width: '32px',
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'rgba(15,15,15,0.5)',
                          cursor: 'pointer',
                          fontSize: '18px',
                          lineHeight: 1,
                          padding: 0,
                        }}
                      >
                        ×
                      </button>
                    </div>

                    {/* Filters label */}
                    <p style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '10px',
                      fontWeight: 600,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: '#ff6b35',
                      margin: '0 0 20px',
                      opacity: 0.8,
                    }}>
                      Quick filters
                    </p>

                    {/* ── Category chips ── */}
                    <div style={{ marginBottom: '24px' }}>
                      <FilterLabel>Cuisine</FilterLabel>
                      <div style={{
                        display: 'flex', gap: '8px',
                        overflowX: 'auto', paddingBottom: '4px',
                        marginLeft: '-24px', paddingLeft: '24px',
                        marginRight: '-24px', paddingRight: '24px',
                        scrollbarWidth: 'none',
                      }}>
                        {CATEGORIES.map((cat) => {
                          const active =
                            cat === 'All'
                              ? categories.length === 0
                              : categories.includes(cat);
                          return (
                            <ChipBtn
                              key={cat}
                              label={cat}
                              active={active}
                              onClick={() => toggleCategory(cat)}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* ── Distance ── */}
                    <div style={{ marginBottom: '24px' }}>
                      <FilterLabel>Distance</FilterLabel>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {DISTANCES.map((d) => (
                          <FilterPill
                            key={d.label}
                            label={d.label}
                            active={distanceMetres === d.metres}
                            onClick={() => setDistanceMetres(d.metres)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* ── Budget ── */}
                    <div style={{ marginBottom: '24px' }}>
                      <FilterLabel>Budget per person</FilterLabel>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {BUDGETS.map((b) => (
                          <FilterPill
                            key={b}
                            label={b}
                            active={budgets.includes(b)}
                            onClick={() => toggleBudget(b)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* ── Open Now ── */}
                    <div style={{
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '28px',
                    }}>
                      <div>
                        <p style={{
                          fontFamily: 'Inter, sans-serif',
                          fontWeight: 500,
                          fontSize: '14px',
                          color: '#0f0f0f',
                          margin: '0 0 2px',
                        }}>
                          Open now only
                        </p>
                        <p style={{
                          fontFamily: 'Inter, sans-serif',
                          fontWeight: 400,
                          fontSize: '12px',
                          color: 'rgba(15,15,15,0.35)',
                          margin: 0,
                        }}>
                          Filter to places open right now in HK
                        </p>
                      </div>
                      <Toggle on={openNow} onChange={setOpenNow} />
                    </div>

                    {/* Divider */}
                    <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', marginBottom: '20px' }} />

                    {createError && (
                      <p style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '11px',
                        color: '#ff6b35',
                        margin: '0 0 12px',
                        letterSpacing: '0.03em',
                      }}>
                        {createError}
                      </p>
                    )}

                    {/* Start session button */}
                    <EmberButton
                      label={creating ? 'Creating session…' : 'Start Session →'}
                      disabled={creating}
                      onClick={handleCreateSession}
                    />
                  </motion.div>

                ) : (
                  /* ── Share view ── */
                  <motion.div
                    key="share"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ padding: '20px 24px 32px' }}
                  >
                    {/* Header */}
                    <div style={{
                      display: 'flex', alignItems: 'flex-start',
                      justifyContent: 'space-between', marginBottom: '28px',
                    }}>
                      <div>
                        <p style={{
                          fontFamily: 'Inter, sans-serif',
                          fontSize: '10px',
                          fontWeight: 600,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: '#10b981',
                          margin: '0 0 6px',
                        }}>
                          ✓ Session created
                        </p>
                        <h3 style={{
                          fontFamily: 'Inter, sans-serif',
                          fontWeight: 700,
                          fontSize: '20px',
                          color: '#0f0f0f',
                          margin: 0,
                          letterSpacing: '-0.02em',
                        }}>
                          Share with {sheetModeConfig?.sharePrompt}
                        </h3>
                      </div>
                      <button
                        onClick={closeSheet}
                        style={{
                          background: 'rgba(0,0,0,0.05)',
                          border: '1px solid rgba(0,0,0,0.08)',
                          borderRadius: '50%',
                          width: '32px',
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'rgba(15,15,15,0.5)',
                          cursor: 'pointer',
                          fontSize: '18px',
                          lineHeight: 1,
                          padding: 0,
                        }}
                      >
                        ×
                      </button>
                    </div>

                    {/* Code */}
                    <div
                      style={{
                        background: '#ffffff',
                        border: '1px solid rgba(0,0,0,0.08)',
                        borderRadius: '16px',
                        padding: '24px',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        boxShadow: 'var(--shadow-md)',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'Inter, sans-serif',
                          fontSize: 'clamp(32px, 8vw, 48px)',
                          fontWeight: 800,
                          background: 'linear-gradient(135deg, #ff6b35, #ffa500)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          letterSpacing: '0.2em',
                          lineHeight: 1,
                        }}
                      >
                        {createdSess?.shareCode}
                      </span>
                      <button
                        onClick={() =>
                          handleCopy(createdSess?.shareCode ?? '', 'code')
                        }
                        title="Copy code"
                        style={{
                          background: 'none', border: 'none',
                          cursor: 'pointer', padding: '4px',
                          display: 'flex', alignItems: 'center',
                        }}
                      >
                        <CopyIcon done={copied} />
                      </button>
                    </div>

                    {/* Emphasis: no account needed */}
                    <div
                      style={{
                        background: 'rgba(16,185,129,0.08)',
                        border: '1px solid rgba(16,185,129,0.2)',
                        borderRadius: '12px',
                        padding: '10px 14px',
                        marginBottom: '20px',
                      }}
                    >
                      <p style={{
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 500,
                        fontSize: '13px',
                        color: '#10b981',
                        margin: 0,
                        lineHeight: 1.5,
                      }}>
                        They don&apos;t need an account to join — just the code or link.
                      </p>
                    </div>

                    {/* WhatsApp */}
                    {createdSess && (
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(
                          `Hey! I've started a Twine session — come swipe hidden gem restaurants with me 🍜✨ Join here: ${createdSess.joinUrl}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex', alignItems: 'center',
                          justifyContent: 'center', gap: '10px',
                          width: '100%', height: '52px',
                          background: '#25d366',
                          borderRadius: '9999px',
                          fontFamily: 'Inter, sans-serif',
                          fontWeight: 600,
                          fontSize: '15px',
                          color: '#fff',
                          textDecoration: 'none',
                          marginBottom: '10px',
                        }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        Share on WhatsApp
                      </a>
                    )}

                    {/* Copy link */}
                    <button
                      onClick={() =>
                        handleCopy(createdSess?.joinUrl ?? '', 'link')
                      }
                      style={{
                        width: '100%', height: '48px',
                        background: '#ffffff',
                        border: '1px solid rgba(0,0,0,0.12)',
                        borderRadius: '9999px',
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 500,
                        fontSize: '14px',
                        color: copiedLink ? '#10b981' : 'rgba(15,15,15,0.55)',
                        cursor: 'pointer',
                        transition: 'color 0.2s, border-color 0.2s',
                        marginBottom: '12px',
                      }}
                    >
                      {copiedLink ? '✓ Link copied!' : 'Copy Link'}
                    </button>

                    {/* Go to session */}
                    {createdSess && (
                      <button
                        onClick={() =>
                          router.push(`/session/${createdSess.sessionId}`)
                        }
                        style={{
                          width: '100%', height: '52px',
                          background: 'linear-gradient(135deg, #ff6b35, #ffa500)',
                          border: 'none',
                          borderRadius: '9999px',
                          fontFamily: 'Inter, sans-serif',
                          fontWeight: 600,
                          fontSize: '15px',
                          color: '#fff',
                          cursor: 'pointer',
                          boxShadow: '0 4px 20px rgba(255,107,53,0.35)',
                        }}
                      >
                        Begin swiping →
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sheet sub-components ─────────────────────────────────────────────────────

function ChipBtn({
  label, active, onClick,
}: {
  label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '6px 16px',
        background: active ? 'rgba(255,107,53,0.12)' : 'rgba(0,0,0,0.04)',
        border: `1px solid ${active ? '#ff6b35' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: '9999px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 500,
        fontSize: '13px',
        color: active ? '#ff6b35' : 'rgba(15,15,15,0.5)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
        boxShadow: active ? '0 0 12px rgba(255,107,53,0.2)' : 'none',
      }}
    >
      {label}
    </button>
  );
}

function FilterPill({
  label, active, onClick,
}: {
  label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 20px',
        background: active ? 'rgba(255,107,53,0.10)' : 'rgba(0,0,0,0.04)',
        border: `${active ? 2 : 1}px solid ${active ? '#ff6b35' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: '9999px',
        fontFamily: 'Inter, sans-serif',
        fontSize: '12px',
        fontWeight: 500,
        letterSpacing: '0.04em',
        color: active ? '#ff6b35' : 'rgba(15,15,15,0.45)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
        boxShadow: active ? '0 0 10px rgba(255,107,53,0.15)' : 'none',
      }}
    >
      {label}
    </button>
  );
}

function EmberButton({
  label, disabled, onClick,
}: {
  label: string; disabled: boolean; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        height: '52px',
        background: disabled
          ? 'rgba(0,0,0,0.05)'
          : hovered
            ? 'linear-gradient(135deg, #ff7f50, #ffb300)'
            : 'linear-gradient(135deg, #ff6b35, #ffa500)',
        border: 'none',
        borderRadius: '9999px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        fontSize: '16px',
        color: disabled ? 'rgba(15,15,15,0.25)' : '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        boxShadow: disabled ? 'none' : hovered ? '0 6px 24px rgba(255,107,53,0.5)' : '0 4px 16px rgba(255,107,53,0.35)',
      }}
    >
      {label}
    </button>
  );
}
