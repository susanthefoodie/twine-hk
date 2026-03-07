'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

// ── Data ──────────────────────────────────────────────────────────────────────

const DEMO_PLACES = [
  {
    id: 'demo1',
    name: 'Seventh Son',
    nameZh: '家全七福',
    district: 'Wan Chai',
    type: 'Cantonese',
    rating: 4.6,
    reviews: 312,
    priceLabel: '$$$',
    photo: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&q=80',
    gem: true,
  },
  {
    id: 'demo2',
    name: 'Fook Lam Moon',
    nameZh: '福臨門',
    district: 'Wan Chai',
    type: 'Cantonese',
    rating: 4.5,
    reviews: 287,
    priceLabel: '$$$',
    photo: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80',
    gem: true,
  },
  {
    id: 'demo3',
    name: 'Kau Kee Restaurant',
    nameZh: '九記牛腩',
    district: 'Central',
    type: 'Beef Brisket Noodles',
    rating: 4.7,
    reviews: 198,
    priceLabel: '$',
    photo: 'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=600&q=80',
    gem: true,
  },
  {
    id: 'demo4',
    name: 'Lin Heung Tea House',
    nameZh: '蓮香樓',
    district: 'Sheung Wan',
    type: 'Dim Sum',
    rating: 4.4,
    reviews: 445,
    priceLabel: '$',
    photo: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=600&q=80',
    gem: true,
  },
  {
    id: 'demo5',
    name: "Mak's Noodle",
    nameZh: '麥奀雲吞麵世家',
    district: 'Central',
    type: 'Wonton Noodles',
    rating: 4.5,
    reviews: 334,
    priceLabel: '$',
    photo: 'https://images.unsplash.com/photo-1552611052-33e04de081de?w=600&q=80',
    gem: true,
  },
];

const CARD_W = 280;
const CARD_H = 380;

function sleep(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DemoSwipeCards() {
  const [topIndex, setTopIndex]   = useState(0);
  const [dragX,    setDragX]      = useState(0);
  const [flyX,     setFlyX]       = useState(0);
  const [isFlying, setIsFlying]   = useState(false);
  const [wigRot,   setWigRot]     = useState(0);
  const [done,     setDone]       = useState(false);

  const isDraggingRef = useRef(false);
  const isFlyingRef   = useRef(false);
  const startXRef     = useRef(0);
  const dragXRef      = useRef(0);
  const cardRef       = useRef<HTMLDivElement>(null);

  // ── Wiggle on mount ────────────────────────────────────────────────────────

  useEffect(() => {
    let alive = true;
    (async () => {
      await sleep(1000);
      for (let i = 0; i < 2; i++) {
        if (!alive) return;
        setWigRot(8);  await sleep(300);
        if (!alive) return;
        setWigRot(-8); await sleep(300);
        if (!alive) return;
        setWigRot(0);  await sleep(300);
      }
    })();
    return () => { alive = false; };
  }, []); // mount only

  // ── Fly a card off screen ──────────────────────────────────────────────────

  const doSwipe = useCallback((dir: 'left' | 'right') => {
    if (isFlyingRef.current) return;
    isFlyingRef.current = true;
    setIsFlying(true);
    setWigRot(0);
    setFlyX(dir === 'right' ? 700 : -700);
    setTimeout(() => {
      setTopIndex((prev) => {
        const next = prev + 1;
        if (next >= DEMO_PLACES.length) setDone(true);
        return next;
      });
      setDragX(0);
      setFlyX(0);
      setIsFlying(false);
      isFlyingRef.current = false;
    }, 380);
  }, []);

  // ── Mouse drag ────────────────────────────────────────────────────────────

  const onMouseDown = (e: React.MouseEvent) => {
    if (isFlyingRef.current) return;
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    dragXRef.current  = 0;
    setWigRot(0);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - startXRef.current;
      dragXRef.current = dx;
      setDragX(dx);
    };
    const onUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      const dx = dragXRef.current;
      if      (dx >  80) doSwipe('right');
      else if (dx < -80) doSwipe('left');
      else               setDragX(0);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [doSwipe]);

  // ── Touch drag (non-passive to allow preventDefault) ───────────────────────

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (isFlyingRef.current) return;
      isDraggingRef.current = true;
      startXRef.current = e.touches[0].clientX;
      dragXRef.current  = 0;
      setWigRot(0);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault(); // stop page scroll while swiping
      const dx = e.touches[0].clientX - startXRef.current;
      dragXRef.current = dx;
      setDragX(dx);
    };
    const onTouchEnd = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      const dx = dragXRef.current;
      if      (dx >  80) doSwipe('right');
      else if (dx < -80) doSwipe('left');
      else               setDragX(0);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    el.addEventListener('touchend',   onTouchEnd,   { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
    };
  }, [doSwipe, topIndex]); // re-attach when top card changes

  // ── Done state ─────────────────────────────────────────────────────────────

  if (done || topIndex >= DEMO_PLACES.length) {
    return (
      <div style={{
        width: `${CARD_W}px`,
        minHeight: `${CARD_H}px`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
        padding: '40px 24px',
        background: '#1a1714',
        border: '1px solid #332e28',
        borderRadius: '16px',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '20px', color: '#f0e8d8', margin: 0, lineHeight: 1.4 }}>
          Hundreds more hidden gems await.
        </p>
        <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: '13px', color: '#7a7060', margin: 0 }}>
          Sign up to discover restaurants only locals know.
        </p>
        <a
          href="/auth"
          style={{
            display: 'inline-block',
            background: '#c9622a',
            color: '#f0e8d8',
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
            fontSize: '14px',
            padding: '12px 24px',
            borderRadius: '4px',
            textDecoration: 'none',
            letterSpacing: '0.01em',
          }}
        >
          Sign up to discover more →
        </a>
      </div>
    );
  }

  // ── Compute visual state ───────────────────────────────────────────────────

  const visibles = [
    DEMO_PLACES[topIndex],
    DEMO_PLACES[topIndex + 1],
    DEMO_PLACES[topIndex + 2],
  ].filter(Boolean);

  const top = visibles[0];

  const effectiveX = isFlying ? flyX : dragX;
  const rotation   = isDraggingRef.current
    ? Math.min(20, Math.max(-20, dragX * 0.08))
    : isFlying
      ? Math.min(20, Math.max(-20, flyX * 0.08))
      : wigRot;

  const topTransition = isDraggingRef.current
    ? 'none'
    : isFlying
      ? 'transform 0.38s ease, opacity 0.38s ease'
      : 'transform 0.3s ease';

  const showLike = !isFlying && dragX >  40;
  const showPass = !isFlying && dragX < -40;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: 'relative',
        width: `${CARD_W}px`,
        height: `${CARD_H}px`,
        userSelect: 'none',
      }}
    >

      {/* ── Third card (deepest) ── */}
      {visibles[2] && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          transform: 'scale(0.90) translateY(16px)',
          transformOrigin: 'bottom center',
          borderRadius: '16px', overflow: 'hidden',
          background: '#1a1714', border: '1px solid #332e28',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={visibles[2].photo} alt="" style={{ width: '100%', height: '60%', objectFit: 'cover', display: 'block' }} />
        </div>
      )}

      {/* ── Second card ── */}
      {visibles[1] && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          transform: 'scale(0.95) translateY(8px)',
          transformOrigin: 'bottom center',
          borderRadius: '16px', overflow: 'hidden',
          background: '#1a1714', border: '1px solid #332e28',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={visibles[1].photo} alt="" style={{ width: '100%', height: '60%', objectFit: 'cover', display: 'block' }} />
        </div>
      )}

      {/* ── Top card (draggable) ── */}
      <div
        ref={cardRef}
        onMouseDown={onMouseDown}
        style={{
          position: 'absolute', inset: 0, zIndex: 30,
          transform: `translateX(${effectiveX}px) rotate(${rotation}deg)`,
          transformOrigin: 'bottom center',
          transition: topTransition,
          opacity: isFlying ? 0 : 1,
          borderRadius: '16px', overflow: 'hidden',
          background: '#1a1714', border: '1px solid #332e28',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          cursor: isDraggingRef.current ? 'grabbing' : 'grab',
        }}
      >
        {/* Photo */}
        <div style={{ position: 'relative', height: '60%', overflow: 'hidden', flexShrink: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={top.photo}
            alt={top.name}
            draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
          />
          {/* Gradient fade to card bottom */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%',
            background: 'linear-gradient(to bottom, transparent, #1a1714)',
            pointerEvents: 'none',
          }} />

          {/* LIKE badge */}
          {showLike && (
            <div style={{
              position: 'absolute', top: 16, left: 16,
              border: '3px solid #4a7c6f', borderRadius: '6px', padding: '3px 10px',
              pointerEvents: 'none',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '18px', color: '#4a7c6f', letterSpacing: '0.1em' }}>
                LIKE
              </span>
            </div>
          )}

          {/* PASS badge */}
          {showPass && (
            <div style={{
              position: 'absolute', top: 16, right: 16,
              border: '3px solid #c9622a', borderRadius: '6px', padding: '3px 10px',
              pointerEvents: 'none',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '18px', color: '#c9622a', letterSpacing: '0.1em' }}>
                PASS
              </span>
            </div>
          )}

          {/* Hidden gem badge */}
          {top.gem && (
            <div style={{
              position: 'absolute', bottom: 10, left: 12,
              background: 'rgba(74,124,111,0.15)', border: '1px solid rgba(74,124,111,0.5)',
              borderRadius: '4px', padding: '3px 8px', pointerEvents: 'none',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4a7c6f' }}>
                💎 Hidden Gem
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ padding: '14px 16px 14px', background: '#1a1714' }}>
          {/* Name */}
          <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '18px', color: '#f0e8d8', margin: '0 0 2px', lineHeight: 1.2 }}>
            {top.name}
          </h3>
          <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '12px', color: '#7a7060', margin: '0 0 10px' }}>
            {top.nameZh}
          </p>

          {/* District · Type · Price */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.05em',
              background: 'rgba(196,146,42,0.1)', border: '1px solid rgba(196,146,42,0.3)',
              borderRadius: '3px', padding: '2px 6px', color: '#c4922a',
            }}>
              {top.district}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#554e46' }}>·</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#7a7060', flexShrink: 0 }}>{top.type}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#c4922a', marginLeft: 'auto', flexShrink: 0 }}>{top.priceLabel}</span>
          </div>

          {/* Stars · rating · reviews */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} style={{ fontSize: '10px', color: top.rating >= n ? '#c4922a' : '#3d3730' }}>★</span>
            ))}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#7a7060', marginLeft: '5px' }}>
              {top.rating} · {top.reviews} reviews
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
