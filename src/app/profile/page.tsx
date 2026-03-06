'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_pro: boolean;
}

interface Stats {
  sessions: number;
  gemsFound: number;
  visited: number;
}

// ── Big avatar ────────────────────────────────────────────────────────────────

function BigAvatar({ url, name }: { url: string | null; name: string }) {
  const initials = name
    .split(' ')
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);

  return (
    <div style={{
      width: '80px', height: '80px',
      borderRadius: '50%',
      border: '2px solid #332e28',
      overflow: 'hidden',
      background: '#221e1a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {url ? (
        <Image src={url} alt={name} width={80} height={80} style={{ borderRadius: '50%', objectFit: 'cover' }} />
      ) : (
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontStyle: 'italic', color: '#c9622a' }}>
          {initials || '?'}
        </span>
      )}
    </div>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────────────────

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div style={{
      flex: 1,
      background: '#1a1714',
      border: '1px solid #332e28',
      borderRadius: '8px',
      padding: '16px 12px',
      textAlign: 'center',
    }}>
      <div style={{
        fontFamily: 'var(--font-serif)', fontWeight: 700,
        fontSize: '28px', color: '#f0e8d8', lineHeight: 1, marginBottom: '6px',
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '9px',
        letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7060',
      }}>
        {label}
      </div>
    </div>
  );
}

// ── Settings row ──────────────────────────────────────────────────────────────

function SettingsRow({
  icon, label, right, onClick, destructive, noBorder,
}: {
  icon: string; label: string; right?: React.ReactNode;
  onClick?: () => void; destructive?: boolean; noBorder?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', padding: '16px 0',
        background: 'none', border: 'none',
        borderBottom: noBorder ? 'none' : '1px solid #221e1a',
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left',
        opacity: hovered && onClick ? 0.8 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{icon}</span>
        <span style={{
          fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: '15px',
          color: destructive ? '#c9622a' : '#f0e8d8',
        }}>
          {label}
        </span>
      </div>
      {right !== undefined ? right : (onClick && <span style={{ color: '#3d3730', fontSize: '18px' }}>›</span>)}
    </button>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: '44px', height: '24px', borderRadius: '12px',
        background: on ? '#c9622a' : '#332e28',
        border: 'none', cursor: 'pointer',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <motion.div
        animate={{ x: on ? 22 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{
          position: 'absolute', top: '2px', left: 0,
          width: '20px', height: '20px',
          borderRadius: '50%', background: '#f0e8d8',
        }}
      />
    </button>
  );
}

// ── Pro upgrade card ──────────────────────────────────────────────────────────

function ProUpgradeCard({
  onUpgrade, upgrading,
}: {
  onUpgrade: (priceId: string) => void; upgrading: boolean;
}) {
  const features = [
    'Unlimited sessions per month',
    'Early access to new neighbourhoods',
    'Priority hidden gem scoring',
    'Export your gem collection',
    'Remove ads from swipe feed',
  ];

  // These are replaced with real Stripe price IDs in .env.local
  const monthlyId = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY ?? 'replace_me';
  const annualId  = process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL  ?? 'replace_me';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: '#1a1714', border: '1px solid #c4922a55',
        borderRadius: '12px', padding: '28px 24px', marginBottom: '24px',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Gold glow */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: '200px', height: '200px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(196,146,42,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <span style={{ color: '#c4922a', fontSize: '20px' }}>✦</span>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '20px', color: '#c4922a', margin: 0 }}>
          Upgrade to Pro
        </h3>
      </div>
      <p style={{
        fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: '13px',
        color: '#7a7060', margin: '0 0 20px', lineHeight: 1.6,
      }}>
        Unlock the full Twine experience for hidden gem hunters.
      </p>

      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {features.map((f) => (
          <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#c4922a', fontSize: '11px', flexShrink: 0 }}>✦</span>
            <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: '13px', color: '#9a8f7e' }}>{f}</span>
          </li>
        ))}
      </ul>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={() => onUpgrade(monthlyId)}
          disabled={upgrading}
          style={{
            flex: 1, padding: '14px 12px', background: '#c9622a', border: 'none',
            borderRadius: '6px', fontFamily: 'var(--font-sans)', fontWeight: 600,
            fontSize: '14px', color: '#f0e8d8',
            cursor: upgrading ? 'not-allowed' : 'pointer',
            opacity: upgrading ? 0.6 : 1, transition: 'opacity 0.2s',
          }}
        >
          HK$38 / month
        </button>
        <button
          onClick={() => onUpgrade(annualId)}
          disabled={upgrading}
          style={{
            flex: 1, padding: '14px 12px', background: 'transparent',
            border: '1px solid #c4922a', borderRadius: '6px',
            fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: '14px', color: '#c4922a',
            cursor: upgrading ? 'not-allowed' : 'pointer',
            opacity: upgrading ? 0.6 : 1, transition: 'opacity 0.2s',
          }}
        >
          HK$288 / year
        </button>
      </div>
      <p style={{
        fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#3d3730',
        letterSpacing: '0.05em', textAlign: 'center', margin: '12px 0 0',
      }}>
        Cancel anytime · Billed via Stripe
      </p>
    </motion.div>
  );
}

// ── Edit name sheet ───────────────────────────────────────────────────────────

function EditNameSheet({
  currentName, onSave, onClose,
}: {
  currentName: string; onSave: (name: string) => void; onClose: () => void;
}) {
  const [value, setValue] = useState(currentName);
  return (
    <>
      <motion.div
        key="bd"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200 }}
      />
      <motion.div
        key="sh"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#1a1714', borderRadius: '12px 12px 0 0',
          borderTop: '1px solid #332e28', padding: '24px 24px 40px', zIndex: 201,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div style={{ width: '36px', height: '4px', background: '#3d3730', borderRadius: '2px' }} />
        </div>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '18px', color: '#f0e8d8', margin: '0 0 20px' }}>
          Edit display name
        </h3>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={40}
          placeholder="Your name"
          style={{
            width: '100%', height: '48px',
            background: '#221e1a', border: '1px solid #332e28', borderRadius: '6px',
            padding: '0 14px', fontFamily: 'var(--font-sans)', fontSize: '15px',
            color: '#f0e8d8', outline: 'none', boxSizing: 'border-box',
          }}
        />
        <button
          onClick={() => { if (value.trim()) { onSave(value.trim()); onClose(); } }}
          style={{
            marginTop: '16px', width: '100%', height: '50px',
            background: '#c9622a', border: 'none', borderRadius: '6px',
            fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: '15px',
            color: '#f0e8d8', cursor: 'pointer',
          }}
        >
          Save →
        </button>
      </motion.div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileContent />
    </Suspense>
  );
}

function ProfileContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const justUpgraded = searchParams.get('upgraded') === 'true';

  const [user,         setUser]         = useState<User | null>(null);
  const [profile,      setProfile]      = useState<Profile | null>(null);
  const [stats,        setStats]        = useState<Stats>({ sessions: 0, gemsFound: 0, visited: 0 });
  const [loading,      setLoading]      = useState(true);
  const [langZh,       setLangZh]       = useState(false);
  const [notifs,       setNotifs]       = useState(true);
  const [editOpen,     setEditOpen]     = useState(false);
  const [upgrading,    setUpgrading]    = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [upgradedBanner, setUpgradedBanner] = useState(justUpgraded);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { router.push('/auth'); return; }
      setUser(u);

      const [
        { data: prof },
        { data: sessions },
        { data: saved },
      ] = await Promise.all([
        supabase.from('profiles').select('id, display_name, avatar_url, is_pro').eq('id', u.id).maybeSingle(),
        supabase.from('sessions').select('id').eq('host_user_id', u.id),
        supabase.from('saved_places').select('id, is_visited').eq('user_id', u.id),
      ]);

      setProfile(prof as Profile ?? null);
      const sessionCount = sessions?.length ?? 0;
      const visitedCount = saved?.filter((s) => s.is_visited).length ?? 0;
      setStats({ sessions: sessionCount, gemsFound: 0, visited: visitedCount });
      setLoading(false);
    }
    load();
  }, [router]);

  useEffect(() => {
    if (!upgradedBanner) return;
    const t = setTimeout(() => setUpgradedBanner(false), 5000);
    return () => clearTimeout(t);
  }, [upgradedBanner]);

  const handleSaveName = useCallback(async (name: string) => {
    if (!user) return;
    const supabase = createClient();
    await supabase.from('profiles').update({ display_name: name }).eq('id', user.id);
    setProfile((prev) => prev ? { ...prev, display_name: name } : prev);
  }, [user]);

  const handleUpgrade = useCallback(async (priceId: string) => {
    if (!user) return;
    setUpgrading(true);
    setUpgradeError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, userId: user.id, userEmail: user.email }),
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setUpgradeError(data.error ?? 'Could not start checkout');
        setUpgrading(false);
      }
    } catch {
      setUpgradeError('Something went wrong. Please try again.');
      setUpgrading(false);
    }
  }, [user]);

  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth');
  }, [router]);

  const displayName =
    profile?.display_name ??
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split('@')[0] ??
    'You';

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#12100e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#7a7060', letterSpacing: '0.06em' }}>
          Loading…
        </span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#12100e', color: '#f0e8d8', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        height: '52px',
        background: 'rgba(18,16,14,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #332e28',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: '12px',
      }}>
        <button
          onClick={() => router.push('/home')}
          style={{ background: 'none', border: 'none', color: '#7a7060', cursor: 'pointer', fontSize: '20px', padding: 0 }}
        >
          ←
        </button>
        <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '18px', color: '#e07840', flex: 1 }}>
          ✦ Twine
        </span>
      </header>

      {/* Upgraded banner */}
      <AnimatePresence>
        {upgradedBanner && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ background: 'rgba(74,124,111,0.12)', borderBottom: '1px solid #4a7c6f44', overflow: 'hidden' }}
          >
            <p style={{
              padding: '12px 20px', margin: 0,
              fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#4a7c6f',
            }}>
              ✓ You&apos;re now a Pro member. Welcome to the full experience!
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 20px 80px' }}>

        {/* ── Avatar + name + email ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
          <BigAvatar url={profile?.avatar_url ?? null} name={displayName} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{
                fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '24px',
                color: '#f0e8d8', margin: 0, lineHeight: 1.2,
              }}>
                {displayName}
              </h1>
              {profile?.is_pro && (
                <span style={{
                  background: 'rgba(196,146,42,0.12)', border: '1px solid #c4922a55',
                  borderRadius: '4px', padding: '2px 8px',
                  fontFamily: 'var(--font-mono)', fontSize: '9px',
                  letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c4922a', flexShrink: 0,
                }}>
                  ✦ Pro
                </span>
              )}
            </div>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#7a7060',
              letterSpacing: '0.04em', margin: '6px 0 0',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {user?.email ?? ''}
            </p>
          </div>
        </div>

        {/* ── Stats ── */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '32px' }}>
          <StatTile value={stats.sessions}  label="Sessions"  />
          <StatTile value={stats.gemsFound} label="Gems Found" />
          <StatTile value={stats.visited}   label="Visited"    />
        </div>

        {/* ── Upgrade card (non-pro only) ── */}
        {!profile?.is_pro && (
          <>
            <ProUpgradeCard onUpgrade={handleUpgrade} upgrading={upgrading} />
            {upgradeError && (
              <p style={{
                fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#c9622a',
                margin: '-16px 0 20px', letterSpacing: '0.03em',
              }}>
                {upgradeError}
              </p>
            )}
          </>
        )}

        {/* ── Account settings ── */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: '9px',
            letterSpacing: '0.12em', textTransform: 'uppercase', color: '#3d3730', margin: '0 0 4px',
          }}>
            Account
          </p>
          <div style={{ background: '#1a1714', border: '1px solid #332e28', borderRadius: '8px', padding: '0 16px' }}>
            <SettingsRow icon="✏️" label="Edit display name" onClick={() => setEditOpen(true)} />
            <SettingsRow icon="🍜" label="Edit preferences" onClick={() => router.push('/onboarding')} />
            <SettingsRow
              icon="🌐" label="Language"
              right={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: langZh ? '#c4922a' : '#7a7060' }}>
                    {langZh ? '繁中' : 'EN'}
                  </span>
                  <Toggle on={langZh} onChange={setLangZh} />
                </div>
              }
            />
            <SettingsRow icon="🔔" label="Notifications" noBorder right={<Toggle on={notifs} onChange={setNotifs} />} />
          </div>
        </div>

        {/* ── More ── */}
        <div style={{ marginBottom: '32px' }}>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: '9px',
            letterSpacing: '0.12em', textTransform: 'uppercase', color: '#3d3730', margin: '0 0 4px',
          }}>
            More
          </p>
          <div style={{ background: '#1a1714', border: '1px solid #332e28', borderRadius: '8px', padding: '0 16px' }}>
            <SettingsRow icon="🔒" label="Privacy Policy" onClick={() => window.open('https://twine.hk/privacy', '_blank')} />
            <SettingsRow icon="📧" label="Contact support" onClick={() => window.open('mailto:hello@twine.hk', '_blank')} />
            <SettingsRow icon="🚪" label="Sign out" onClick={handleSignOut} destructive noBorder />
          </div>
        </div>

        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#221e1a', textAlign: 'center', letterSpacing: '0.08em' }}>
          Twine v0.1.0 · Hong Kong
        </p>
      </main>

      {/* Edit name sheet */}
      <AnimatePresence>
        {editOpen && (
          <EditNameSheet
            currentName={profile?.display_name ?? displayName}
            onSave={handleSaveName}
            onClose={() => setEditOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
