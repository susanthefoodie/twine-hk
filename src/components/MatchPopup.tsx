'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase';
import type { PlaceResult } from '@/types/place';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MatchPopupProps {
  place: PlaceResult;
  sessionMode: 'couples' | 'friends' | 'solo';
  matchCount: number;
  onDismiss: () => void;
}

// ── Confetti ──────────────────────────────────────────────────────────────────

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  delay: number;
}

function buildParticles(count: number): Particle[] {
  const colors = ['#c9622a', '#c4922a', '#e07840', '#f2ebe0', '#4a7c6f'];
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 2 * Math.PI + Math.random() * 0.4;
    const dist  = 70 + Math.random() * 130;
    return {
      id:    i,
      x:     Math.cos(angle) * dist,
      y:     Math.sin(angle) * dist,
      color: colors[i % colors.length],
      size:  3 + Math.random() * 6,
      delay: Math.random() * 0.25,
    };
  });
}

function Confetti() {
  const particles = useRef<Particle[]>(buildParticles(20)).current;
  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        pointerEvents: 'none',
        zIndex: 510,
      }}
    >
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.2 }}
          transition={{ duration: 0.85, delay: p.delay, ease: [0.2, 0, 0.6, 1] }}
          style={{
            position: 'absolute',
            width:  p.size,
            height: p.size,
            borderRadius: '50%',
            background: p.color,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </div>
  );
}

// ── Stars ─────────────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: '1px', alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          style={{
            color: rating >= n - 0.5 ? '#c4922a' : '#3d3730',
            fontSize: '12px',
          }}
        >
          ★
        </span>
      ))}
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: '#7a7060',
          marginLeft: '5px',
        }}
      >
        {rating.toFixed(1)}
      </span>
    </span>
  );
}

// ── Save button ───────────────────────────────────────────────────────────────

function SaveButton({ place }: { place: PlaceResult }) {
  const [saved,  setSaved]  = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (saved || saving) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from('saved_places')
        .upsert(
          { user_id: user.id, place_id: place.id, place_data: place },
          { onConflict: 'user_id,place_id', ignoreDuplicates: true }
        );
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      onClick={handleSave}
      disabled={saving}
      style={{
        background: 'none',
        border: 'none',
        fontFamily: 'var(--font-sans)',
        fontWeight: 400,
        fontSize: '13px',
        color: saved ? '#4a7c6f' : '#7a7060',
        cursor: saved ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: 0,
      }}
    >
      {saved ? '✓ Saved' : saving ? 'Saving…' : '🔖 Save for later'}
    </button>
  );
}

// ── MatchPopup ────────────────────────────────────────────────────────────────

export default function MatchPopup({
  place,
  sessionMode,
  matchCount,
  onDismiss,
}: MatchPopupProps) {
  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const photoSrc = place.photoName
    ? `/api/places/photo?name=${encodeURIComponent(place.photoName)}&maxWidthPx=800`
    : null;

  const modeLabel =
    sessionMode === 'couples' ? 'YOU BOTH CHOSE THIS HIDDEN GEM'
    : sessionMode === 'friends' ? 'YOUR GROUP FOUND THIS GEM'
    : 'YOUR HIDDEN GEM FOR TONIGHT';

  // district = first segment of address before first comma
  const district = place.address.split(',')[0]?.trim() ?? '';

  const mapsUrl  = `https://www.google.com/maps/dir/?api=1&destination_place_id=${place.id}&travelmode=transit`;
  const waText   = encodeURIComponent(
    `We found a hidden gem! 🍜✨\n*${place.name}*\n${district}\n\nFound together on Twine — twine.hk/join`
  );
  const waUrl    = `https://wa.me/?text=${waText}`;

  return (
    <AnimatePresence>
      {/* ── Backdrop ── */}
      <motion.div
        key="match-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={onDismiss}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 500,
          background: 'rgba(10,8,6,0.94)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          overflowY: 'auto',
        }}
      >
        {/* Radial glow */}
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background:
              'radial-gradient(ellipse at 50% 40%, rgba(201,98,42,0.25) 0%, transparent 60%)',
            pointerEvents: 'none',
          }}
        />

        {/* Confetti (rendered outside the card so it fans freely) */}
        <Confetti />

        {/* ── Card ── */}
        <motion.div
          key="match-card"
          initial={{ scale: 0.88, opacity: 0 }}
          animate={{ scale: 1,    opacity: 1 }}
          exit={{    scale: 0.88, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'relative',
            zIndex: 1,
            width: '90vw',
            maxWidth: '400px',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 32px 80px rgba(0,0,0,0.75)',
            flexShrink: 0,
          }}
        >
          {/* ── Photo ── */}
          <div
            style={{
              position: 'relative',
              height: '300px',
              background: '#0e0c0a',
              borderRadius: '12px 12px 0 0',
              overflow: 'hidden',
            }}
          >
            {photoSrc ? (
              <Image
                src={photoSrc}
                alt={place.name}
                fill
                priority
                unoptimized
                sizes="400px"
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
                  fontSize: '64px',
                }}
              >
                🍜
              </div>
            )}

            {/* Bottom-fade gradient */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(to bottom, transparent 35%, rgba(10,8,6,0.88) 100%)',
                pointerEvents: 'none',
              }}
            />

            {/* Pulsing gold badge */}
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                background: 'rgba(196,146,42,0.18)',
                border: '1px solid rgba(196,146,42,0.55)',
                borderRadius: '6px',
                padding: '5px 11px',
                backdropFilter: 'blur(8px)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.08em',
                  color: '#c4922a',
                }}
              >
                ✦ {matchCount > 1 ? `Match #${matchCount}` : "It's a match!"}
              </span>
            </motion.div>
          </div>

          {/* ── Body ── */}
          <div
            style={{
              background: '#1a1714',
              borderRadius: '0 0 12px 12px',
              padding: '24px',
            }}
          >
            {/* Mode label */}
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: '#c9622a',
                margin: '0 0 10px',
              }}
            >
              {modeLabel}
            </p>

            {/* Name */}
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontWeight: 700,
                fontSize: '26px',
                color: '#f2ebe0',
                margin: '0 0 12px',
                lineHeight: 1.2,
              }}
            >
              {place.name}
            </h2>

            {/* Metadata row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap',
                marginBottom: place.editorialSummary ? '14px' : '20px',
              }}
            >
              {district && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: '#7a7060',
                    background: '#221e1a',
                    border: '1px solid #332e28',
                    borderRadius: '4px',
                    padding: '3px 8px',
                  }}
                >
                  {district}
                </span>
              )}
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: '#c4922a',
                }}
              >
                {place.priceLabel}
              </span>
              <Stars rating={place.rating ?? 0} />
            </div>

            {/* Editorial summary */}
            {place.editorialSummary && (
              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 300,
                  fontStyle: 'italic',
                  fontSize: '14px',
                  color: '#c4922a',
                  margin: '0 0 20px',
                  lineHeight: 1.65,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                } as React.CSSProperties}
              >
                {place.editorialSummary}
              </p>
            )}

            {/* Action buttons */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                marginBottom: '18px',
              }}
            >
              {/* Directions */}
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '48px',
                  background: '#221e1a',
                  border: '1px solid #c4922a',
                  borderRadius: '4px',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 600,
                  fontSize: '15px',
                  color: '#c4922a',
                  textDecoration: 'none',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    'rgba(196,146,42,0.08)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = '#221e1a';
                }}
              >
                Get Directions 🚇
              </a>
            </div>

            {/* Secondary actions */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
              }}
            >
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 400,
                  fontSize: '13px',
                  color: '#25d366',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Share on WhatsApp
              </a>

              <SaveButton place={place} />
            </div>

            {/* Dismiss */}
            <button
              onClick={onDismiss}
              style={{
                display: 'block',
                margin: '0 auto',
                background: 'none',
                border: 'none',
                fontFamily: 'var(--font-sans)',
                fontWeight: 400,
                fontSize: '13px',
                color: '#7a7060',
                cursor: 'pointer',
                textDecoration: 'underline',
                textDecorationColor: '#3d3730',
              }}
            >
              Keep Swiping →
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
