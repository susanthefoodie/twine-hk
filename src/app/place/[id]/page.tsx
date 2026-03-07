'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { createClient } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlaceDetail {
  id: string;
  name: string;
  chineseName: string | null;
  rating: number;
  reviewCount: number;
  priceLevel: number;
  priceLabel: string;
  photos: string[];             // photo resource names
  openNow: boolean | null;
  weekdayDescriptions: string[];
  address: string;
  phone: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
  editorialSummary: string | null;
  primaryType: string | null;
}

// ── Stars ─────────────────────────────────────────────────────────────────────

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: '1px' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} style={{ color: rating >= n - 0.5 ? '#c4922a' : '#3d3730', fontSize: size }}>★</span>
      ))}
    </span>
  );
}

// ── Interactive stars (visit rating) ─────────────────────────────────────────

function RatingPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <span style={{ display: 'inline-flex', gap: '4px' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} onClick={() => onChange(n)} style={{ fontSize: '24px', color: value >= n ? '#c4922a' : '#3d3730', cursor: 'pointer', lineHeight: 1 }}>★</span>
      ))}
    </span>
  );
}

// ── Photo carousel ────────────────────────────────────────────────────────────

function PhotoCarousel({ photos }: { photos: string[] }) {
  const [index, setIndex]       = useState(0);
  const [direction, setDir]     = useState(0);
  const [dragging, setDragging] = useState(false);

  function go(next: number) {
    if (next < 0 || next >= photos.length) return;
    setDir(next > index ? 1 : -1);
    setIndex(next);
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    setDragging(false);
    if (info.offset.x < -50) go(index + 1);
    else if (info.offset.x > 50) go(index - 1);
  }

  const variants = {
    enter:  (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (d: number) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
  };

  const src = photos[index]
    ? `/api/places/photo?name=${encodeURIComponent(photos[index])}&maxWidthPx=800`
    : null;

  return (
    <div>
      <div style={{ position: 'relative', height: '280px', overflow: 'hidden', background: '#0e0c0a' }}>
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={index}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragStart={() => setDragging(true)}
            onDragEnd={handleDragEnd}
            style={{ position: 'absolute', inset: 0, cursor: dragging ? 'grabbing' : 'grab' }}
          >
            {src ? (
              <Image src={src} alt="" fill unoptimized priority sizes="100vw" style={{ objectFit: 'cover', pointerEvents: 'none', userSelect: 'none' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px' }}>🍜</div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Tap zones */}
        {index > 0 && (
          <button onClick={() => go(index - 1)} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '25%', background: 'transparent', border: 'none', cursor: 'pointer' }} />
        )}
        {index < photos.length - 1 && (
          <button onClick={() => go(index + 1)} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '25%', background: 'transparent', border: 'none', cursor: 'pointer' }} />
        )}
      </div>

      {/* Counter */}
      {photos.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', padding: '10px 0 4px' }}>
          {/* Dots */}
          <div style={{ display: 'flex', gap: '5px' }}>
            {photos.map((_, i) => (
              <div
                key={i}
                onClick={() => go(i)}
                style={{
                  width: i === index ? '16px' : '6px', height: '6px',
                  borderRadius: '3px', background: i === index ? '#c9622a' : '#332e28',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              />
            ))}
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#7a7060', letterSpacing: '0.04em' }}>
            {index + 1} / {photos.length}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Hours collapsible ─────────────────────────────────────────────────────────

function Hours({ openNow, weekdays }: { openNow: boolean | null; weekdays: string[] }) {
  const [open, setOpen] = useState(false);
  const today = new Date().getDay(); // 0=Sun
  // weekdayDescriptions is Mon–Sun (index 0=Mon), but JS getDay() 0=Sun
  // Adjust: JS Sunday(0) → weekdays index 6; Mon(1) → 0; …
  const todayIdx = today === 0 ? 6 : today - 1;
  const todayHours = weekdays[todayIdx] ?? null;

  if (!weekdays.length && openNow === null) return null;

  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        {openNow !== null && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.06em',
            color: openNow ? '#4a7c6f' : '#c9622a',
            background: openNow ? 'rgba(74,124,111,0.12)' : 'rgba(201,98,42,0.12)',
            border: `1px solid ${openNow ? '#4a7c6f44' : '#c9622a44'}`,
            borderRadius: '4px', padding: '3px 9px',
          }}>
            {openNow ? '● Open now' : '● Closed'}
          </span>
        )}
        {todayHours && (
          <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: '13px', color: '#f0e8d8' }}>
            {todayHours.replace(/^[^:]+:\s*/, '')}
          </span>
        )}
      </div>

      {weekdays.length > 0 && (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            style={{ background: 'none', border: 'none', padding: 0, fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: '12px', color: '#7a7060', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            Full hours
            <motion.span animate={{ rotate: open ? 180 : 0 }} style={{ display: 'inline-block', fontSize: '10px' }}>↓</motion.span>
          </button>
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }} style={{ overflow: 'hidden', marginTop: '10px' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {weekdays.map((line, i) => {
                    const [day, hours] = line.split(': ');
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: i === todayIdx ? '#f0e8d8' : '#7a7060', fontWeight: i === todayIdx ? 500 : 300, minWidth: '80px' }}>{day}</span>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: i === todayIdx ? '#f0e8d8' : '#7a7060', fontWeight: i === todayIdx ? 500 : 300, textAlign: 'right' }}>{hours ?? 'Closed'}</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

// ── Been here sheet ───────────────────────────────────────────────────────────

function BeenHereSheet({
  placeId,
  placeName,
  savedId,
  onClose,
}: {
  placeId: string;
  placeName: string;
  savedId: string | null;
  onClose: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [note,   setNote]   = useState('');
  const [saving, setSaving] = useState(false);
  const [done,   setDone]   = useState(false);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    await supabase.from('saved_places').upsert({
      user_id:      user.id,
      place_id:     placeId,
      is_visited:   true,
      visit_rating: rating || null,
      visit_note:   note || null,
    }, { onConflict: 'user_id,place_id', ignoreDuplicates: false });

    setSaving(false);
    setDone(true);
    setTimeout(onClose, 900);
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 300 }} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#1a1714', borderRadius: '12px 12px 0 0', borderTop: '1px solid #332e28', padding: '20px 24px 48px', zIndex: 301 }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div style={{ width: '36px', height: '4px', background: '#3d3730', borderRadius: '2px' }} />
        </div>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '18px', color: '#f0e8d8', margin: '0 0 4px' }}>{placeName}</h3>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#c9622a', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 24px' }}>
          Been Here?
        </p>

        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#7a7060', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 10px' }}>Your rating</p>
          <RatingPicker value={rating} onChange={setRating} />
        </div>

        <div style={{ marginBottom: '28px' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#7a7060', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px' }}>Leave a note</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What did you think? What did you order?"
            rows={3}
            style={{ width: '100%', background: '#221e1a', border: '1px solid #332e28', borderRadius: '4px', color: '#f0e8d8', padding: '10px 12px', fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: '14px', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.55 }}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving || done}
          style={{ width: '100%', height: '50px', background: done ? '#4a7c6f' : saving ? '#2a2520' : '#c9622a', border: 'none', borderRadius: '4px', fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: '15px', color: '#f0e8d8', cursor: done || saving ? 'default' : 'pointer' }}
        >
          {done ? '✓ Saved!' : saving ? 'Saving…' : 'Mark as Visited →'}
        </button>
      </motion.div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id     = params.id as string;

  const [place,       setPlace]       = useState<PlaceDetail | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [savedId,     setSavedId]     = useState<string | null>(null);
  const [saved,       setSaved]       = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [beenHere,    setBeenHere]    = useState(false);
  const [shareErr,    setShareErr]    = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const [detailRes, supabase] = [
        fetch(`/api/places/detail?id=${encodeURIComponent(id)}`),
        createClient(),
      ];

      const [res, { data: { user } }] = await Promise.all([
        detailRes,
        supabase.auth.getUser(),
      ]);

      if (!res.ok) { setError('Place not found.'); setLoading(false); return; }
      const data = (await res.json()) as PlaceDetail;
      setPlace(data);

      // Check if already saved
      if (user) {
        const { data: savedRow } = await supabase
          .from('saved_places')
          .select('id')
          .eq('user_id', user.id)
          .eq('place_id', id)
          .maybeSingle();
        if (savedRow) { setSaved(true); setSavedId(savedRow.id); }
      }

      setLoading(false);
    }
    load();
  }, [id]);

  // ── Save toggle ───────────────────────────────────────────────────────────

  async function handleSaveToggle() {
    if (saving || !place) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth'); return; }

    if (saved && savedId) {
      await supabase.from('saved_places').delete().eq('id', savedId);
      setSaved(false); setSavedId(null);
    } else {
      const { data } = await supabase.from('saved_places').upsert(
        { user_id: user.id, place_id: id, place_data: place },
        { onConflict: 'user_id,place_id', ignoreDuplicates: false }
      ).select('id').maybeSingle();
      setSaved(true);
      setSavedId(data?.id ?? null);
    }
    setSaving(false);
  }

  // ── Copy address ──────────────────────────────────────────────────────────

  async function handleCopy() {
    if (!place) return;
    try {
      await navigator.clipboard.writeText(place.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  // ── Share ─────────────────────────────────────────────────────────────────

  async function handleShare() {
    if (!place) return;
    const text = `Check out ${place.name} — a hidden gem I found on Twine 🍜✨\n${place.address}\n\ntwine.hk`;
    try {
      if (navigator.share) {
        await navigator.share({ title: place.name, text, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(text);
        setShareErr(true);
        setTimeout(() => setShareErr(false), 2000);
      }
    } catch {}
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#12100e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#7a7060', letterSpacing: '0.06em' }}>Loading…</span>
      </div>
    );
  }

  if (error || !place) {
    return (
      <div style={{ minHeight: '100vh', background: '#12100e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: '#f0e8d8', marginBottom: '12px' }}>{error ?? 'Something went wrong.'}</p>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#c9622a', fontFamily: 'var(--font-sans)', cursor: 'pointer', fontSize: '14px' }}>← Go back</button>
        </div>
      </div>
    );
  }

  const district  = place.address.split(',')[0]?.trim() ?? '';
  const chopeUrl  = `https://www.chope.co/singapore-restaurants/search?q=${encodeURIComponent(place.name)}&utm_source=twine&utm_medium=app`;
  const mapsUrl   = `https://www.google.com/maps/dir/?api=1&destination_place_id=${place.id}&travelmode=transit`;
  const openRice  = `https://www.openrice.com/en/hongkong/restaurants?where=${encodeURIComponent(place.name)}`;

  return (
    <div style={{ background: '#12100e', minHeight: '100vh', color: '#f0e8d8', fontFamily: 'var(--font-sans)', paddingBottom: '48px' }}>

      {/* ── Back button overlay ── */}
      <button
        onClick={() => router.back()}
        style={{
          position: 'fixed', top: '16px', left: '16px', zIndex: 50,
          background: 'rgba(18,16,14,0.8)', border: '1px solid #332e28',
          borderRadius: '50%', width: '40px', height: '40px',
          color: '#f0e8d8', fontSize: '18px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)',
        }}
      >
        ←
      </button>

      {/* ── Photo carousel ── */}
      <PhotoCarousel photos={place.photos} />

      {/* ── Content ── */}
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px clamp(16px, 4vw, 32px)' }}>

        {/* Name */}
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '28px', color: '#f2ebe0', margin: '0 0 4px', lineHeight: 1.2 }}>
          {place.name}
        </h1>
        {place.chineseName && (
          <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '16px', color: '#9a8f7e', margin: '0 0 16px' }}>
            {place.chineseName}
          </p>
        )}

        {/* Metadata pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {district && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#7a7060', background: '#221e1a', border: '1px solid #332e28', borderRadius: '4px', padding: '3px 9px' }}>
              {district}
            </span>
          )}
          {place.primaryType && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#7a7060', background: '#221e1a', border: '1px solid #332e28', borderRadius: '4px', padding: '3px 9px' }}>
              {place.primaryType}
            </span>
          )}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#c4922a', padding: '3px 0' }}>
            {place.priceLabel}
          </span>
        </div>

        {/* Rating */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Stars rating={place.rating} size={14} />
          <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: '14px', color: '#9a8f7e' }}>
            {(place.rating ?? 0).toFixed(1)}
          </span>
          <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: '13px', color: '#7a7060' }}>
            ({(place.reviewCount ?? 0).toLocaleString()} reviews)
          </span>
        </div>

        {/* Hours */}
        <Hours openNow={place.openNow} weekdays={place.weekdayDescriptions} />

        {/* Address */}
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: '14px', color: '#9a8f7e', margin: 0, lineHeight: 1.6, flex: 1 }}>
            {place.address}
          </p>
          <button
            onClick={handleCopy}
            title="Copy address"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: copied ? '#c9622a' : '#7a7060' }}>
              {copied ? 'Copied!' : '⎘'}
            </span>
          </button>
        </div>

        {/* Phone */}
        {place.phone && (
          <p style={{ marginBottom: '12px' }}>
            <a href={`tel:${place.phone}`} style={{ fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: '14px', color: '#c9622a', textDecoration: 'none' }}>
              📞 {place.phone}
            </a>
          </p>
        )}

        {/* Website */}
        {place.website && (
          <p style={{ marginBottom: '20px' }}>
            <a href={place.website} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: '14px', color: '#c9622a', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}>
              🔗 {new URL(place.website).hostname}
            </a>
          </p>
        )}

        {/* Editorial summary */}
        {place.editorialSummary && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{ borderTop: '1px solid #332e28', marginBottom: '20px' }} />
            <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '16px', color: '#c4922a', margin: 0, lineHeight: 1.7 }}>
              {place.editorialSummary}
            </p>
          </div>
        )}

        {/* ── Action buttons ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '52px', background: '#c9622a', borderRadius: '4px', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '16px', color: '#f0e8d8', textDecoration: 'none', transition: 'background 0.15s' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#e07840'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#c9622a'; }}
          >
            Get Directions 🚇
          </a>

          <a
            href={chopeUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '44px', background: '#221e1a', border: '1px solid #c9622a', borderRadius: '4px', fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: '15px', color: '#c9622a', textDecoration: 'none', transition: 'background 0.15s' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(201,98,42,0.08)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#221e1a'; }}
          >
            Book via Chope 🎟
          </a>

          <a
            href={openRice}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '38px', background: '#1a1714', border: '1px solid #332e28', borderRadius: '4px', fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: '13px', color: '#7a7060', textDecoration: 'none' }}
          >
            View on OpenRice
          </a>
        </div>

        {/* ── Secondary actions row ── */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '32px' }}>
          <button
            onClick={handleShare}
            style={{ background: 'none', border: 'none', fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: '13px', color: shareErr ? '#c4922a' : '#7a7060', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {shareErr ? '✓ Copied!' : '↗ Share'}
          </button>

          <button
            onClick={handleSaveToggle}
            disabled={saving}
            style={{ background: 'none', border: 'none', fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: '13px', color: saved ? '#c9622a' : '#7a7060', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            {saved ? '♥ Saved' : '♡ Save'}
          </button>
        </div>

        {/* ── Been here banner ── */}
        <button
          onClick={() => setBeenHere(true)}
          style={{
            width: '100%', background: '#1a1714', border: '1px solid #332e28',
            borderRadius: '8px', padding: '18px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer',
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '15px', color: '#f0e8d8', margin: '0 0 2px' }}>
              Been here?
            </p>
            <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: '13px', color: '#7a7060', margin: 0 }}>
              Mark as visited and leave a note →
            </p>
          </div>
          <span style={{ fontSize: '24px', flexShrink: 0 }}>📝</span>
        </button>
      </div>

      {/* ── Been here sheet ── */}
      <AnimatePresence>
        {beenHere && (
          <BeenHereSheet
            placeId={id}
            placeName={place.name}
            savedId={savedId}
            onClose={() => setBeenHere(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
