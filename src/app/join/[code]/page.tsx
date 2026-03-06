'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionInfo {
  sessionId: string;
  mode: 'couples' | 'friends' | 'solo';
  participantCount: number;
  host: { display_name: string | null; avatar_url: string | null } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MODE_META = {
  couples: { emoji: '💑', label: 'Date Night',    accent: '#c9622a' },
  friends: { emoji: '👯', label: 'Group Dinner',  accent: '#c4922a' },
  solo:    { emoji: '🙋', label: 'Solo Session',  accent: '#4a7c6f' },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JoinPage() {
  const params  = useParams();
  const router  = useRouter();
  const code    = (params.code as string).toUpperCase();

  const [session,   setSession]   = useState<SessionInfo | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [notFound,  setNotFound]  = useState(false);
  const [name,      setName]      = useState('');
  const [joining,   setJoining]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [nameHover, setNameFocus] = useState(false);

  // ── Fetch session info ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/session/join?code=${code}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setNotFound(true); }
        else { setSession(data); }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [code]);

  // ── Join handler ───────────────────────────────────────────────────────────
  async function handleJoin() {
    if (!name.trim()) return;
    setJoining(true);
    setError(null);
    try {
      const res = await fetch('/api/session/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, guestName: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not join session');
      router.push(`/session/${data.sessionId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setJoining(false);
    }
  }

  // ── Render states ──────────────────────────────────────────────────────────

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#12100e',
    color: '#f0e8d8',
    fontFamily: 'var(--font-sans)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    position: 'relative',
    overflow: 'hidden',
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#7a7060', letterSpacing: '0.06em' }}>
          Looking up session…
        </span>
      </div>
    );
  }

  if (notFound || !session) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', maxWidth: '340px' }}>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: '#f0e8d8', marginBottom: '12px' }}>
            Session not found.
          </p>
          <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: '15px', color: '#7a7060', marginBottom: '28px' }}>
            This session may have expired or the code is incorrect. Check the link and try again.
          </p>
          <a
            href="/"
            style={{
              fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: '14px',
              color: '#c9622a', textDecoration: 'none',
            }}
          >
            ← Back to Twine
          </a>
        </div>
      </div>
    );
  }

  const meta = MODE_META[session.mode];
  const hostName = session.host?.display_name ?? 'Someone';
  const others = Math.max(0, session.participantCount - 1);

  return (
    <div style={containerStyle}>
      {/* Ambient glow */}
      <div
        style={{
          position: 'fixed',
          top: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '400px',
          background: 'radial-gradient(ellipse, rgba(201,98,42,0.09) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '440px',
          background: '#1a1714',
          border: '1px solid #332e28',
          borderRadius: '8px',
          padding: '40px 36px',
        }}
      >
        {/* Logo */}
        <p
          style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: '20px',
            color: '#e07840',
            margin: '0 0 28px',
          }}
        >
          ✦ Twine
        </p>

        {/* Session badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: `rgba(${meta.accent === '#c9622a' ? '201,98,42' : meta.accent === '#c4922a' ? '196,146,42' : '74,124,111'},0.08)`,
            border: `1px solid ${meta.accent}44`,
            borderRadius: '4px',
            padding: '5px 12px',
            marginBottom: '24px',
          }}
        >
          <span style={{ fontSize: '16px' }}>{meta.emoji}</span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: meta.accent,
            }}
          >
            {meta.label}
          </span>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 700,
            fontSize: '26px',
            color: '#f0e8d8',
            margin: '0 0 12px',
            lineHeight: 1.25,
          }}
        >
          You&apos;ve been invited to find a hidden gem 🍜
        </h1>

        {/* Session meta */}
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 300,
            fontSize: '14px',
            color: '#7a7060',
            margin: '0 0 32px',
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: '#f0e8d8', fontWeight: 500 }}>{hostName}</strong> is looking for a hidden gem
          {others > 0 && (
            <>
              {' '}· {others} other{others !== 1 ? 's' : ''} already joined
            </>
          )}
        </p>

        {/* Code badge */}
        <div
          style={{
            background: '#221e1a',
            border: '1px solid #332e28',
            borderRadius: '4px',
            padding: '10px 14px',
            marginBottom: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#7a7060', letterSpacing: '0.06em' }}>
            SESSION CODE
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', color: '#c9622a', letterSpacing: '0.2em', fontWeight: 500 }}>
            {code}
          </span>
        </div>

        {/* Name input */}
        <label
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#7a7060',
            display: 'block',
            marginBottom: '8px',
          }}
        >
          What should we call you?
        </label>
        <input
          type="text"
          placeholder="Your name"
          value={name}
          maxLength={30}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          onFocus={() => setNameFocus(true)}
          onBlur={() => setNameFocus(false)}
          autoFocus
          style={{
            width: '100%',
            height: '48px',
            background: '#221e1a',
            border: `1px solid ${nameHover ? '#c9622a' : '#332e28'}`,
            borderRadius: '4px',
            color: '#f0e8d8',
            fontFamily: 'var(--font-sans)',
            fontSize: '16px',
            padding: '0 16px',
            marginBottom: '12px',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s',
          }}
        />

        {error && (
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: '#c9622a',
              margin: '0 0 12px',
              letterSpacing: '0.03em',
            }}
          >
            {error}
          </p>
        )}

        {/* Join button */}
        <JoinButton
          label={joining ? 'Joining…' : 'Join Session →'}
          disabled={!name.trim() || joining}
          onClick={handleJoin}
        />

        {/* Divider + sign-in link */}
        <div style={{ borderTop: '1px solid #332e28', margin: '24px 0 16px' }} />
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 300,
            fontSize: '13px',
            color: '#7a7060',
            textAlign: 'center',
            margin: 0,
          }}
        >
          Have an account?{' '}
          <a
            href={`/auth?next=/join/${code}`}
            style={{ color: '#c9622a', textDecoration: 'none' }}
          >
            Sign in instead
          </a>
        </p>
      </motion.div>
    </div>
  );
}

function JoinButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
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
        height: '50px',
        background: disabled ? '#2a2520' : hovered ? '#e07840' : '#c9622a',
        border: 'none',
        borderRadius: '4px',
        fontFamily: 'var(--font-sans)',
        fontWeight: 500,
        fontSize: '16px',
        color: disabled ? '#7a7060' : '#f0e8d8',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s',
      }}
    >
      {label}
    </button>
  );
}
