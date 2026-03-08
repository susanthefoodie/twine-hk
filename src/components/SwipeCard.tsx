'use client';

import { useRef } from 'react';
import Image from 'next/image';
import {
  motion,
  useMotionValue,
  useTransform,
  useAnimation,
  PanInfo,
} from 'framer-motion';
import type { PlaceResult } from '@/types/place';

// ── Constants ─────────────────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 100; // px before card commits

// ── Star rating ───────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ letterSpacing: '0.05em', fontSize: '13px' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          style={{
            color: rating >= n ? '#c4922a' : rating >= n - 0.5 ? '#c4922a' : '#332e28',
            opacity: rating >= n - 0.5 ? 1 : 0.4,
          }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface SwipeCardProps {
  place: PlaceResult;
  stackIndex: number;  // 0 = top (active), 1 = second, 2 = third
  onSwipe: (direction: 'yes' | 'skip') => void;
  onSave?: (place: PlaceResult) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SwipeCard({ place, stackIndex, onSwipe, onSave }: SwipeCardProps) {
  const x = useMotionValue(0);
  const controls = useAnimation();
  const isDragging = useRef(false);

  // Derived visual transforms
  const rotate    = useTransform(x, [-300, 300], [-18, 18]);
  const yesOpacity  = useTransform(x, [40, 120], [0, 1]);
  const skipOpacity = useTransform(x, [-120, -40], [1, 0]);
  const cardScale  = stackIndex === 0 ? 1 : stackIndex === 1 ? 0.96 : 0.92;
  const cardY      = stackIndex === 0 ? 0  : stackIndex === 1 ? 14   : 26;
  const cardZ      = 10 - stackIndex;

  const isActive = stackIndex === 0;

  async function flyOut(dir: 'yes' | 'skip') {
    await controls.start({
      x: dir === 'yes' ? 500 : -500,
      opacity: 0,
      transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
    });
    onSwipe(dir);
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    isDragging.current = false;
    if (info.offset.x > SWIPE_THRESHOLD) {
      flyOut('yes');
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      flyOut('skip');
    } else {
      controls.start({ x: 0, rotate: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } });
    }
  }

  const photoSrc = place.photoName
    ? `/api/places/photo?name=${encodeURIComponent(place.photoName)}&maxWidthPx=800`
    : null;

  return (
    <motion.div
      animate={isActive ? controls : undefined}
      style={{
        position: 'absolute',
        inset: 0,
        x: isActive ? x : 0,
        rotate: isActive ? rotate : 0,
        scale: cardScale,
        y: cardY,
        zIndex: cardZ,
        transformOrigin: 'bottom center',
        background: '#1a1714',
        border: place.isFeatured ? '1px solid #c4922a55' : '1px solid #332e28',
        borderRadius: '12px',
        overflow: 'hidden',
        cursor: isActive ? 'grab' : 'default',
        userSelect: 'none',
        touchAction: 'none',
        boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
      }}
      drag={isActive ? 'x' : false}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.9}
      onDragStart={() => { isDragging.current = true; }}
      onDragEnd={handleDragEnd}
      whileTap={isActive ? { cursor: 'grabbing' } : undefined}
    >
      {/* ── Photo ─────────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: '100%', height: '52%', background: '#0e0c0a', flexShrink: 0 }}>
        {photoSrc ? (
          <Image
            src={photoSrc}
            alt={place.name}
            fill
            style={{ objectFit: 'cover', pointerEvents: 'none', draggable: false } as React.CSSProperties}
            sizes="(max-width: 480px) 100vw, 440px"
            priority={stackIndex === 0}
            unoptimized // proxy already serves resized image
          />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#332e28', fontSize: '48px',
          }}>
            🍜
          </div>
        )}

        {/* YES overlay */}
        {isActive && (
          <motion.div
            style={{
              position: 'absolute', top: 20, left: 20,
              border: '3px solid #4a7c6f', borderRadius: '6px',
              padding: '4px 12px',
              opacity: yesOpacity,
              pointerEvents: 'none',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '22px', color: '#4a7c6f', letterSpacing: '0.1em' }}>
              YES
            </span>
          </motion.div>
        )}

        {/* SKIP overlay */}
        {isActive && (
          <motion.div
            style={{
              position: 'absolute', top: 20, right: 20,
              border: '3px solid #c9622a', borderRadius: '6px',
              padding: '4px 12px',
              opacity: skipOpacity,
              pointerEvents: 'none',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '22px', color: '#c9622a', letterSpacing: '0.1em' }}>
              SKIP
            </span>
          </motion.div>
        )}

        {/* Featured badge */}
        {place.isFeatured && (
          <div style={{
            position: 'absolute', bottom: 10, left: 12,
            background: 'rgba(196,146,42,0.15)', border: '1px solid #c4922a55',
            borderRadius: '4px', padding: '3px 8px',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c4922a' }}>
              Featured
            </span>
          </div>
        )}

        {/* Hidden gem badge */}
        {place.hidden_gem && !place.isFeatured && (
          <div style={{
            position: 'absolute', bottom: 10, left: 12,
            background: 'rgba(74,124,111,0.15)', border: '1px solid #4a7c6f55',
            borderRadius: '4px', padding: '3px 8px',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a7c6f' }}>
              ✦ Hidden Gem
            </span>
          </div>
        )}
      </div>

      {/* ── Info ──────────────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 22px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Name + price */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '21px', color: '#f0e8d8', margin: 0, lineHeight: 1.2 }}>
              {place.name}
            </h2>
            {place.chineseName && (
              <p style={{
                fontFamily: 'var(--font-serif)', fontStyle: 'italic',
                fontSize: '14px', color: '#7a7060', margin: '3px 0 0',
              }}>
                {place.chineseName}
              </p>
            )}
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: '#c4922a', flexShrink: 0, marginTop: '2px' }}>
            {place.priceLabel}
          </span>
        </div>

        {/* Rating row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Stars rating={place.rating ?? 0} />
          <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: '12px', color: '#7a7060' }}>
            {(place.rating ?? 0).toFixed(1)} · {(place.reviewCount ?? 0).toLocaleString()} reviews
          </span>
        </div>

        {/* Editorial summary */}
        {place.editorialSummary && (
          <p style={{
            fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: '13px',
            color: '#9a8f7e', margin: 0, lineHeight: 1.55,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          } as React.CSSProperties}>
            {place.editorialSummary}
          </p>
        )}

        {/* Address */}
        <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: '12px', color: '#7a7060', margin: 0 }}>
          📍 {place.address}
        </p>

        {/* Open now + Save */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
          {place.openNow !== null ? (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em', color: place.openNow ? '#4a7c6f' : '#c9622a' }}>
              {place.openNow ? '● Open now' : '● Closed'}
            </span>
          ) : <span />}

          {onSave && isActive && (
            <button
              onClick={(e) => { e.stopPropagation(); onSave(place); }}
              style={{
                background: 'none', border: '1px solid #332e28', borderRadius: '4px',
                color: '#7a7060', fontFamily: 'var(--font-mono)', fontSize: '10px',
                letterSpacing: '0.06em', padding: '5px 10px', cursor: 'pointer',
              }}
            >
              SAVE
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Action buttons (exported for use in session page) ─────────────────────────

export function SwipeActions({
  onSkip,
  onYes,
  disabled,
}: {
  onSkip: () => void;
  onYes: () => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', alignItems: 'center' }}>
      {/* Skip */}
      <button
        onClick={onSkip}
        disabled={disabled}
        style={{
          width: '64px', height: '64px', borderRadius: '50%',
          background: '#1a1714', border: '1.5px solid #c9622a',
          color: '#c9622a', fontSize: '24px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: disabled ? 0.4 : 1,
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.background = '#c9622a22'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#1a1714'; }}
      >
        ✕
      </button>

      {/* Yes */}
      <button
        onClick={onYes}
        disabled={disabled}
        style={{
          width: '72px', height: '72px', borderRadius: '50%',
          background: '#1a1714', border: '1.5px solid #4a7c6f',
          color: '#4a7c6f', fontSize: '28px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: disabled ? 0.4 : 1,
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.background = '#4a7c6f22'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#1a1714'; }}
      >
        ✓
      </button>
    </div>
  );
}
