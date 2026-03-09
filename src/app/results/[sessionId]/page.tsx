'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase';
import type { PlaceResult } from '@/types/place';

const supabase = createClient();

// ── Types ─────────────────────────────────────────────────────────────────────

interface Match {
  id: string;
  place_id: string;
  place_data: PlaceResult;
  match_score: number | null;
  is_visited: boolean;
}

interface SessionInfo {
  id: string;
  mode: 'couples' | 'friends' | 'solo';
}

interface AlmostMatch {
  place_id: string;
  place_data: PlaceResult;
  yes_count: number;
  total_count: number;
}

// ── Meta ──────────────────────────────────────────────────────────────────────

const MODE_META = {
  couples: { emoji: '💑', label: 'Date Night',   accent: '#ff6b35' },
  friends: { emoji: '👯', label: 'Group Dinner', accent: '#ffa500' },
  solo:    { emoji: '🙋', label: 'Solo',         accent: '#10b981' },
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function photoUrl(photoName: string | null): string | null {
  if (!photoName) return null;
  return `/api/places/photo?name=${encodeURIComponent(photoName)}&maxWidthPx=400`;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: '1px' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          style={{ color: rating >= n - 0.5 ? '#ffa500' : 'rgba(255,255,255,0.12)', fontSize: '11px' }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

// ── Visited toggle ────────────────────────────────────────────────────────────

function VisitedToggle({
  visited,
  onChange,
}: {
  visited: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(!visited); }}
      style={{
        flexShrink: 0,
        background: visited ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${visited ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: '9999px',
        padding: '4px 12px',
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        letterSpacing: '0.06em',
        fontWeight: 600,
        color: visited ? '#10b981' : 'rgba(248,248,255,0.35)',
        cursor: 'pointer',
        transition: 'all 0.2s',
        whiteSpace: 'nowrap',
      }}
    >
      {visited ? '✓ Visited' : 'Visited?'}
    </button>
  );
}

// ── Match card ────────────────────────────────────────────────────────────────

function MatchCard({
  match,
  highlighted,
  onVisitedToggle,
}: {
  match: Match;
  highlighted: boolean;
  onVisitedToggle: (id: string, visited: boolean) => void;
}) {
  const place     = match.place_data;
  const src       = photoUrl(place.photoName);
  const district  = place.address.split(',')[0]?.trim() ?? '';
  const chopeUrl  = `https://www.chope.co/singapore-restaurants/search?q=${encodeURIComponent(place.name)}&utm_source=twine&utm_medium=app`;
  const mapsUrl   = `https://www.google.com/maps/dir/?api=1&destination_place_id=${place.id}&travelmode=transit`;

  return (
    <motion.div
      layout
      animate={
        highlighted
          ? {
              boxShadow: [
                '0 4px 24px rgba(0,0,0,0.4)',
                '0 0 30px rgba(255,107,53,0.5)',
                '0 0 30px rgba(255,107,53,0.5)',
                '0 4px 24px rgba(0,0,0,0.4)',
              ],
              borderColor: ['rgba(255,255,255,0.08)', 'rgba(255,107,53,0.5)', 'rgba(255,107,53,0.5)', 'rgba(255,255,255,0.08)'],
            }
          : {}
      }
      transition={highlighted ? { duration: 3, times: [0, 0.15, 0.85, 1] } : {}}
      style={{
        background: match.is_visited ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px',
        padding: '16px',
        display: 'flex',
        gap: '16px',
        alignItems: 'flex-start',
        opacity: match.is_visited ? 0.5 : 1,
        transition: 'opacity 0.3s',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      {/* Photo */}
      <div
        style={{
          flexShrink: 0,
          width: '120px',
          height: '120px',
          borderRadius: '14px',
          overflow: 'hidden',
          background: '#111118',
          position: 'relative',
        }}
      >
        {src ? (
          <Image
            src={src}
            alt={place.name}
            fill
            unoptimized
            sizes="120px"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
            }}
          >
            🍜
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name + visited toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '8px',
            marginBottom: '7px',
          }}
        >
          <h3
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 700,
              fontSize: '16px',
              letterSpacing: '-0.01em',
              color: match.is_visited ? 'rgba(248,248,255,0.35)' : '#f8f8ff',
              margin: 0,
              lineHeight: 1.25,
              flex: 1,
              textDecoration: match.is_visited ? 'line-through' : 'none',
            }}
          >
            {place.name}
          </h3>
          <VisitedToggle
            visited={match.is_visited}
            onChange={(v) => onVisitedToggle(match.id, v)}
          />
        </div>

        {/* Pills */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
            marginBottom: '7px',
          }}
        >
          {district && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'rgba(248,248,255,0.35)',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '9999px',
                padding: '2px 8px',
                fontWeight: 600,
                letterSpacing: '0.04em',
              }}
            >
              {district}
            </span>
          )}
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: '#ffa500',
              fontWeight: 600,
            }}
          >
            {place.priceLabel}
          </span>
          {place.hidden_gem && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                color: '#ff6b35',
                background: 'rgba(255,107,53,0.15)',
                border: '1px solid rgba(255,107,53,0.3)',
                borderRadius: '9999px',
                padding: '2px 8px',
              }}
            >
              ✦ Hidden Gem
            </span>
          )}
        </div>

        {/* Rating */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '10px',
          }}
        >
          <Stars rating={place.rating ?? 0} />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'rgba(248,248,255,0.35)',
            }}
          >
            {(place.rating ?? 0).toFixed(1)}
          </span>
        </div>

        {/* Action links */}
        <div style={{ display: 'flex', gap: '16px' }}>
          <a
            href={chopeUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              fontSize: '12px',
              color: '#ff6b35',
              textDecoration: 'none',
            }}
          >
            Book via Chope →
          </a>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 400,
              fontSize: '12px',
              color: 'rgba(248,248,255,0.35)',
              textDecoration: 'none',
            }}
          >
            🚇 Directions
          </a>
        </div>
      </div>
    </motion.div>
  );
}

// ── Almost match card ─────────────────────────────────────────────────────────

function AlmostCard({ am }: { am: AlmostMatch }) {
  const place   = am.place_data;
  const src     = photoUrl(place.photoName);
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination_place_id=${place.id}&travelmode=transit`;

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '14px',
        padding: '12px',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        opacity: 0.72,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: '56px',
          height: '56px',
          borderRadius: '10px',
          overflow: 'hidden',
          background: '#111118',
          position: 'relative',
          filter: 'grayscale(0.5)',
        }}
      >
        {src ? (
          <Image
            src={src}
            alt={place.name}
            fill
            unoptimized
            sizes="56px"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
            }}
          >
            🍜
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 600,
            fontSize: '13px',
            color: 'rgba(248,248,255,0.5)',
            margin: '0 0 2px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {place.name}
        </p>
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'rgba(248,248,255,0.2)',
            margin: 0,
          }}
        >
          {am.yes_count}/{am.total_count} votes
        </p>
      </div>

      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          flexShrink: 0,
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          fontSize: '12px',
          color: '#ff6b35',
          textDecoration: 'none',
        }}
      >
        Reconsider?
      </a>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const params    = useParams();
  const router    = useRouter();
  const sessionId = params.sessionId as string;

  const [session,       setSession]       = useState<SessionInfo | null>(null);
  const [matches,       setMatches]       = useState<Match[]>([]);
  const [almostMatches, setAlmostMatches] = useState<AlmostMatch[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [highlighted,   setHighlighted]   = useState<string | null>(null);
  const [almostOpen,    setAlmostOpen]    = useState(false);

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ── Load ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/session/results?sessionId=${sessionId}`)
        const data = await res.json()

        if (!res.ok || data.error) {
          setError(data.error ?? 'Session not found.')
          setLoading(false)
          return
        }

        setSession(data.session as SessionInfo)
        setMatches((data.matches ?? []) as Match[])
        setAlmostMatches((data.almostMatches ?? []) as AlmostMatch[])
        setLoading(false)
      } catch {
        setError('Failed to load session.')
        setLoading(false)
      }
    }
    load()
  }, [sessionId]);

  // ── Visited toggle ────────────────────────────────────────────────────────

  const handleVisitedToggle = useCallback(async (matchId: string, visited: boolean) => {
    setMatches((prev) =>
      prev.map((m) => (m.id === matchId ? { ...m, is_visited: visited } : m))
    );
    await supabase
      .from('matches')
      .update({ is_visited: visited })
      .eq('id', matchId);
  }, []);

  // ── Decide for me ─────────────────────────────────────────────────────────

  function handleDecideForMe() {
    const unvisited = matches.filter((m) => !m.is_visited);
    const pool = unvisited.length > 0 ? unvisited : matches;
    if (pool.length === 0) return;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    setHighlighted(chosen.id);
    setTimeout(() => setHighlighted(null), 3500);
    cardRefs.current[chosen.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const meta     = session ? MODE_META[session.mode] : null;
  const topMatch = matches[0];

  if (loading) {
    return (
      <div style={centreStyle}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'rgba(248,248,255,0.35)', letterSpacing: '0.06em' }}>
          Loading matches…
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={centreStyle}>
        <div style={{ textAlign: 'center', padding: '0 24px' }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '20px', color: 'rgba(248,248,255,0.6)', marginBottom: '24px' }}>
            {error}
          </p>
          <button
            onClick={() => router.push('/home')}
            style={{
              height: '52px',
              padding: '0 28px',
              background: 'linear-gradient(135deg, #ff6b35, #ffa500)',
              border: 'none',
              borderRadius: '9999px',
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
              fontSize: '15px',
              letterSpacing: '0.02em',
              color: '#fff',
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(255,107,53,0.3)',
            }}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: '#0a0a0f',
        minHeight: '100vh',
        color: '#f8f8ff',
        fontFamily: 'var(--font-sans)',
        paddingBottom: matches.length > 0 ? '90px' : '48px',
      }}
    >
      {/* ── Top bar ── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          height: '60px',
          background: 'rgba(10,10,15,0.9)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 clamp(16px, 4vw, 40px)',
          gap: '12px',
        }}
      >
        <button
          onClick={() => router.push('/home')}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(248,248,255,0.35)',
            cursor: 'pointer',
            fontSize: '20px',
            padding: 0,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          ←
        </button>

        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 600,
            fontSize: '15px',
            letterSpacing: '-0.01em',
            color: '#f8f8ff',
          }}
        >
          Session Matches
        </span>

        {meta ? (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: meta.accent,
              background: `${meta.accent}18`,
              border: `1px solid ${meta.accent}44`,
              borderRadius: '9999px',
              padding: '3px 10px',
              flexShrink: 0,
            }}
          >
            {meta.emoji} {meta.label}
          </span>
        ) : (
          <span style={{ width: '80px' }} />
        )}
      </header>

      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '32px clamp(16px, 4vw, 40px) 0' }}>

        {matches.length === 0 ? (
          /* ── Empty state ── */
          <div style={{ textAlign: 'center', padding: '72px 0' }}>
            <div
              style={{
                fontSize: '120px',
                background: 'linear-gradient(135deg, #ff6b35, #ffa500)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                opacity: 0.2,
                lineHeight: 1,
                marginBottom: '28px',
                userSelect: 'none',
              }}
            >
              ✦
            </div>
            <h2
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 700,
                fontSize: '22px',
                letterSpacing: '-0.02em',
                color: 'rgba(248,248,255,0.6)',
                margin: '0 0 10px',
              }}
            >
              No gems unearthed yet.
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 400,
                fontSize: '14px',
                color: 'rgba(248,248,255,0.35)',
                margin: '0 0 32px',
              }}
            >
              Keep swiping — your hidden gem is out there.
            </p>
            <button
              onClick={() => router.push(`/session/${sessionId}`)}
              style={{
                height: '52px',
                padding: '0 28px',
                background: 'linear-gradient(135deg, #ff6b35, #ffa500)',
                border: 'none',
                borderRadius: '9999px',
                fontFamily: 'var(--font-sans)',
                fontWeight: 600,
                fontSize: '15px',
                letterSpacing: '0.02em',
                color: '#fff',
                cursor: 'pointer',
                boxShadow: '0 0 20px rgba(255,107,53,0.3)',
              }}
            >
              Keep Swiping →
            </button>
          </div>

        ) : (
          <>
            {/* ── Header ── */}
            <div style={{ position: 'relative', marginBottom: '28px' }}>
              {/* Amber glow */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '30%',
                  transform: 'translate(-50%, -50%)',
                  width: '320px',
                  height: '80px',
                  background: 'radial-gradient(ellipse, rgba(255,165,0,0.1) 0%, transparent 70%)',
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <h1
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 800,
                    fontSize: 'clamp(18px, 4vw, 26px)',
                    letterSpacing: '-0.03em',
                    color: '#f8f8ff',
                    margin: 0,
                    lineHeight: 1.3,
                  }}
                >
                  You found {matches.length} hidden gem{matches.length !== 1 ? 's' : ''} ✦
                </h1>

                <button
                  onClick={handleDecideForMe}
                  style={{
                    flexShrink: 0,
                    height: '38px',
                    padding: '0 14px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    borderRadius: '9999px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    color: '#ffa500',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,165,0,0.4)';
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,165,0,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.14)';
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                  }}
                >
                  🎲 Pick One
                </button>
              </div>
            </div>

            {/* ── Match cards ── */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginBottom: '40px',
              }}
            >
              {matches.map((match) => (
                <div
                  key={match.id}
                  ref={(el) => { cardRefs.current[match.id] = el; }}
                >
                  <MatchCard
                    match={match}
                    highlighted={highlighted === match.id}
                    onVisitedToggle={handleVisitedToggle}
                  />
                </div>
              ))}
            </div>

            {/* ── Almost matches ── */}
            {almostMatches.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <button
                  onClick={() => setAlmostOpen((v) => !v)}
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    padding: '0 0 14px',
                    gap: '8px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 500,
                      fontSize: '14px',
                      color: 'rgba(248,248,255,0.5)',
                      textAlign: 'left',
                    }}
                  >
                    Places where someone hesitated…
                  </span>
                  <motion.span
                    animate={{ rotate: almostOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ color: 'rgba(248,248,255,0.35)', fontSize: '14px', flexShrink: 0 }}
                  >
                    ▾
                  </motion.span>
                </button>

                <AnimatePresence>
                  {almostOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          paddingBottom: '8px',
                        }}
                      >
                        {almostMatches.map((am) => (
                          <AlmostCard key={am.place_id} am={am} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Sticky bottom CTA ── */}
      {matches.length > 0 && topMatch && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '12px clamp(16px, 4vw, 40px)',
            background: 'linear-gradient(to top, #0a0a0f 65%, transparent)',
            zIndex: 40,
          }}
        >
          <a
            href={`https://www.chope.co/singapore-restaurants/search?q=${encodeURIComponent(topMatch.place_data.name)}&utm_source=twine&utm_medium=app`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '52px',
              width: '100%',
              maxWidth: '680px',
              margin: '0 auto',
              background: 'linear-gradient(135deg, #ff6b35, #ffa500)',
              borderRadius: '9999px',
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
              fontSize: '15px',
              letterSpacing: '0.02em',
              color: '#fff',
              textDecoration: 'none',
              boxShadow: '0 0 24px rgba(255,107,53,0.35), 0 4px 16px rgba(0,0,0,0.4)',
              transition: 'box-shadow 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 36px rgba(255,107,53,0.5), 0 4px 16px rgba(0,0,0,0.4)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 24px rgba(255,107,53,0.35), 0 4px 16px rgba(0,0,0,0.4)';
            }}
          >
            Book the top gem via Chope →
          </a>
        </div>
      )}
    </div>
  );
}

const centreStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0a0a0f',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
