'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase';
import type { PlaceResult } from '@/types/place';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SavedPlace {
  id: string;
  place_id: string;
  place_data: PlaceResult;
  is_visited: boolean;
  visit_rating: number | null;
  visit_note: string | null;
  list_name: string | null;
  created_at: string;
}

interface DeleteToast {
  dbId: string;
  name: string;
  timerId: ReturnType<typeof setTimeout>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DISTRICTS = [
  'All', 'Central', 'Sheung Wan', 'Wan Chai', 'Causeway Bay',
  'Kennedy Town', 'TST', 'Mong Kok', 'Aberdeen', 'Sai Kung',
] as const;

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'recent',   label: 'Recently saved' },
  { value: 'rating',   label: 'Rating' },
  { value: 'distance', label: 'Distance' },
];

type Tab = 'all' | 'visited' | 'lists';

// ── Helpers ───────────────────────────────────────────────────────────────────

function photoSrc(name: string | null | undefined) {
  if (!name) return null;
  return `/api/places/photo?name=${encodeURIComponent(name)}&maxWidthPx=400`;
}

// ── Stars (interactive) ───────────────────────────────────────────────────────

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <span style={{ display: 'inline-flex', gap: '3px' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          onClick={() => onChange?.(n)}
          style={{
            fontSize: '22px', lineHeight: 1,
            color: value >= n ? '#ffa500' : 'rgba(255,255,255,0.12)',
            cursor: onChange ? 'pointer' : 'default',
          }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

// ── Visit bottom sheet ────────────────────────────────────────────────────────

function VisitSheet({
  saved,
  onClose,
  onSave,
}: {
  saved: SavedPlace;
  onClose: () => void;
  onSave: (dbId: string, rating: number, note: string, listName: string) => Promise<void>;
}) {
  const [rating,   setRating]   = useState(saved.visit_rating ?? 0);
  const [note,     setNote]     = useState(saved.visit_note ?? '');
  const [listName, setListName] = useState(saved.list_name ?? '');
  const [saving,   setSaving]   = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(saved.id, rating, note, listName);
    setSaving(false);
    onClose();
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200 }}
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#111118',
          borderRadius: '24px 24px 0 0',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          padding: '20px 24px 44px', zIndex: 201,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div style={{ width: '36px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px' }} />
        </div>

        <h3 style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '18px', letterSpacing: '-0.01em', color: '#f8f8ff', margin: '0 0 4px' }}>
          {saved.place_data?.name ?? 'Unknown Restaurant'}
        </h3>
        <p style={{ fontSize: '11px', fontWeight: 600, color: '#ff6b35', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 24px' }}>
          Mark as Visited
        </p>

        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(248,248,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 10px' }}>
            Your rating
          </p>
          <Stars value={rating} onChange={setRating} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(248,248,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px' }}>
            Leave a note
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="How was it? What would you order again?"
            rows={3}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '14px',
              color: '#f8f8ff',
              padding: '12px 16px',
              fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: '14px',
              resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.55,
            }}
            onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#ff6b35'; }}
            onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
          />
        </div>

        <div style={{ marginBottom: '28px' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(248,248,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px' }}>
            Add to list (optional)
          </p>
          <input
            type="text"
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            placeholder='"Date Night", "Work Lunch"…'
            style={{
              width: '100%', height: '48px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '14px',
              color: '#f8f8ff', padding: '0 16px',
              fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: '14px',
              outline: 'none', boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#ff6b35'; }}
            onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%', height: '52px',
            background: saving ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #ff6b35, #ffa500)',
            border: 'none',
            borderRadius: '9999px',
            fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '15px',
            letterSpacing: '0.02em',
            color: saving ? 'rgba(248,248,255,0.35)' : '#fff',
            cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: saving ? 'none' : '0 0 20px rgba(255,107,53,0.3)',
          }}
        >
          {saving ? 'Saving…' : 'Save ✓'}
        </button>
      </motion.div>
    </>
  );
}

// ── Saved card ────────────────────────────────────────────────────────────────

function SavedCard({
  saved,
  onDelete,
  onVisitTap,
}: {
  saved: SavedPlace;
  onDelete: (s: SavedPlace) => void;
  onVisitTap: (s: SavedPlace) => void;
}) {
  const router   = useRouter();
  const place    = saved.place_data ?? {} as PlaceResult;
  const src      = photoSrc(place.photoName ?? null);
  const district = place.districtName ?? (place.address ?? '').split(',')[0]?.trim() ?? '';
  const mapsUrl  = `https://www.google.com/maps/dir/?api=1&destination_place_id=${place.id ?? ''}&travelmode=transit`;

  return (
    <div
      onClick={() => router.push(`/place/${encodeURIComponent(place.id)}`)}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px',
        overflow: 'hidden',
        cursor: 'pointer',
        breakInside: 'avoid',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      {/* Photo */}
      <div style={{ position: 'relative', height: '160px', background: '#111118' }}>
        {src ? (
          <Image src={src} alt={place.name ?? ''} fill unoptimized sizes="280px" style={{ objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px' }}>🍜</div>
        )}
        {/* Gradient */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 60%, rgba(10,10,15,0.72) 100%)', pointerEvents: 'none' }} />
        {/* Visited pill */}
        {saved.is_visited && (
          <div style={{ position: 'absolute', top: '8px', left: '8px', background: 'rgba(10,10,15,0.82)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '9999px', padding: '3px 9px', backdropFilter: 'blur(4px)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#10b981', letterSpacing: '0.06em', fontWeight: 600 }}>Visited ✓</span>
          </div>
        )}
        {/* Gem badge */}
        {place.hidden_gem && (
          <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(10,10,15,0.82)', border: '1px solid rgba(255,107,53,0.4)', borderRadius: '9999px', padding: '3px 9px', backdropFilter: 'blur(4px)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#ff6b35', fontWeight: 600 }}>✦</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px' }}>
        <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '14px', letterSpacing: '-0.01em', color: '#f8f8ff', margin: '0 0 4px', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {place.name ?? 'Unknown Restaurant'}
        </p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(248,248,255,0.35)', margin: '0 0 10px' }}>
          {[district, place.priceLabel ?? null].filter(Boolean).join(' · ')}
        </p>
        {/* Actions (stop propagation so they don't open the sheet) */}
        <div style={{ display: 'flex', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Directions"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '28px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', textDecoration: 'none', fontSize: '14px' }}
          >
            🗺
          </a>
          <button
            onClick={() => onVisitTap(saved)}
            title="Rate visit"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '28px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
          >
            ★
          </button>
          <button
            onClick={() => onDelete(saved)}
            title="Remove"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '28px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}

// ── List section ──────────────────────────────────────────────────────────────

function ListSection({
  name, items, onDelete, onVisitTap,
}: {
  name: string;
  items: SavedPlace[];
  onDelete: (s: SavedPlace) => void;
  onVisitTap: (s: SavedPlace) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginBottom: '28px' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ width: '100%', background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '0 0 12px' }}
      >
        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '16px', letterSpacing: '-0.01em', color: '#f8f8ff' }}>
          {name} <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(248,248,255,0.35)', fontWeight: 400 }}>({items.length})</span>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} style={{ color: 'rgba(248,248,255,0.35)', fontSize: '14px' }}>▾</motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }} style={{ overflow: 'hidden' }}
          >
            <div style={{ columns: 2, columnGap: '12px' }}>
              {items.map((s) => (
                <div key={s.id} style={{ breakInside: 'avoid', marginBottom: '12px' }}>
                  <SavedCard saved={s} onDelete={onDelete} onVisitTap={onVisitTap} />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onCta, isFiltered }: { onCta: () => void; isFiltered: boolean }) {
  return (
    <div style={{ textAlign: 'center', padding: '64px 0' }}>
      <div
        style={{
          fontSize: '96px',
          background: 'linear-gradient(135deg, #ff6b35, #ffa500)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          opacity: 0.2,
          lineHeight: 1,
          marginBottom: '24px',
          userSelect: 'none',
        }}
      >
        ✦
      </div>
      <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '20px', letterSpacing: '-0.02em', color: 'rgba(248,248,255,0.6)', margin: '0 0 8px' }}>
        {isFiltered ? 'No places match this filter.' : 'Your gem collection is empty.'}
      </h2>
      {!isFiltered && (
        <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: '14px', color: 'rgba(248,248,255,0.35)', margin: '0 0 28px' }}>
          Start a session to save places you love.
        </p>
      )}
      {!isFiltered && (
        <button
          onClick={onCta}
          style={{
            height: '52px', padding: '0 28px',
            background: 'linear-gradient(135deg, #ff6b35, #ffa500)',
            border: 'none',
            borderRadius: '9999px',
            fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '15px',
            letterSpacing: '0.02em',
            color: '#fff', cursor: 'pointer',
            boxShadow: '0 0 20px rgba(255,107,53,0.3)',
          }}
        >
          Find a Hidden Gem →
        </button>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SavedPage() {
  const router = useRouter();

  const [places,     setPlaces]     = useState<SavedPlace[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState<Tab>('all');
  const [sortBy,     setSortBy]     = useState('recent');
  const [district,   setDistrict]   = useState('All');
  const [toast,      setToast]      = useState<DeleteToast | null>(null);
  const [visitSheet, setVisitSheet] = useState<SavedPlace | null>(null);
  const [listInput,  setListInput]  = useState(false);
  const [newList,    setNewList]    = useState('');

  const pendingDeletes = useRef<Set<string>>(new Set());

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth'); return; }
      const res = await fetch(`/api/saved?userId=${user.id}`)
      const data = await res.json()
      setPlaces((data.places ?? []) as SavedPlace[])
      setLoading(false)
    })
  }, [router]);

  // ── Delete with undo ──────────────────────────────────────────────────────

  const handleDelete = useCallback((saved: SavedPlace) => {
    pendingDeletes.current.add(saved.id);
    setPlaces((prev) => prev.filter((p) => p.id !== saved.id));
    if (toast) clearTimeout(toast.timerId);

    const timerId = setTimeout(async () => {
      if (!pendingDeletes.current.has(saved.id)) return;
      pendingDeletes.current.delete(saved.id);
      setToast(null);
      const supabase = createClient();
      await supabase.from('saved_places').delete().eq('id', saved.id);
    }, 5000);

    setToast({ dbId: saved.id, name: saved.place_data?.name ?? 'Place', timerId });
  }, [toast]);

  function handleUndo() {
    if (!toast) return;
    clearTimeout(toast.timerId);
    pendingDeletes.current.delete(toast.dbId);
    setToast(null);
    // Reload from DB to restore
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('saved_places')
        .select('id, place_id, place_data, is_visited, visit_rating, visit_note, list_name, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => setPlaces((data as SavedPlace[]) ?? []));
    });
  }

  // ── Visit save ────────────────────────────────────────────────────────────

  const handleVisitSave = useCallback(async (
    dbId: string,
    rating: number,
    note: string,
    listName: string,
  ) => {
    const supabase = createClient();
    await supabase.from('saved_places').update({
      is_visited:   true,
      visit_rating: rating  || null,
      visit_note:   note    || null,
      list_name:    listName || null,
    }).eq('id', dbId);

    setPlaces((prev) =>
      prev.map((p) =>
        p.id === dbId
          ? { ...p, is_visited: true, visit_rating: rating || null, visit_note: note || null, list_name: listName || null }
          : p
      )
    );
  }, []);

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered = (() => {
    let result = [...places];
    if (activeTab === 'visited') result = result.filter((p) => p.is_visited);
    if (district !== 'All') {
      result = result.filter((p) =>
        (p.place_data?.address ?? '').toLowerCase().includes(district.toLowerCase())
      );
    }
    if (sortBy === 'rating') {
      result.sort((a, b) => (b.place_data.rating ?? 0) - (a.place_data.rating ?? 0));
    }
    return result;
  })();

  const lists = (() => {
    const groups: Record<string, SavedPlace[]> = {};
    for (const p of places) {
      const key = p.list_name || 'Uncategorised';
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    return groups;
  })();

  const visitedCount = places.filter((p) => p.is_visited).length;

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'rgba(248,248,255,0.35)', letterSpacing: '0.06em' }}>
          Loading your collection…
        </span>
      </div>
    );
  }

  return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh', color: '#f8f8ff', fontFamily: 'var(--font-sans)', paddingBottom: '56px' }}>

      {/* ── Header ── */}
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '32px clamp(16px, 4vw, 40px) 0' }}>
        <button
          onClick={() => router.push('/home')}
          style={{ background: 'none', border: 'none', color: 'rgba(248,248,255,0.35)', cursor: 'pointer', fontSize: '18px', padding: '0 0 16px', display: 'block', lineHeight: 1 }}
        >
          ←
        </button>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: '28px', letterSpacing: '-0.03em', color: '#f8f8ff', margin: '0 0 6px' }}>
          Saved Gems 💎
        </h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(248,248,255,0.35)', margin: '0 0 28px', letterSpacing: '0.06em' }}>
          {places.length} place{places.length !== 1 ? 's' : ''} saved · {visitedCount} visited
        </p>

        {/* Tabs + Sort row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '9999px', padding: '4px', border: '1px solid rgba(255,255,255,0.08)' }}>
            {(['all', 'visited', 'lists'] as Tab[]).map((tab) => {
              const label = tab === 'all' ? 'All Saved' : tab === 'visited' ? 'Visited ✓' : 'Lists';
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '6px 14px',
                    background: active ? 'linear-gradient(135deg, #ff6b35, #ffa500)' : 'transparent',
                    border: 'none',
                    borderRadius: '9999px',
                    fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '13px',
                    color: active ? '#fff' : 'rgba(248,248,255,0.5)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: active ? '0 0 12px rgba(255,107,53,0.3)' : 'none',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '9999px',
              color: 'rgba(248,248,255,0.6)',
              fontFamily: 'var(--font-mono)', fontSize: '11px',
              padding: '6px 12px', cursor: 'pointer', outline: 'none', flexShrink: 0,
            }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} style={{ background: '#111118' }}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* District chips */}
        {activeTab !== 'lists' && (
          <div style={{
            display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '24px',
            marginLeft: 'clamp(-16px, -4vw, -40px)', paddingLeft: 'clamp(16px, 4vw, 40px)',
            paddingRight: 'clamp(16px, 4vw, 40px)', scrollbarWidth: 'none',
          }}>
            {DISTRICTS.map((d) => {
              const active = district === d;
              return (
                <button
                  key={d}
                  onClick={() => setDistrict(d)}
                  style={{
                    flexShrink: 0, padding: '6px 14px',
                    background: active ? 'rgba(255,107,53,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${active ? 'rgba(255,107,53,0.35)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: '9999px',
                    fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '12px',
                    color: active ? '#ff6b35' : 'rgba(248,248,255,0.5)',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
                    boxShadow: active ? '0 0 8px rgba(255,107,53,0.2)' : 'none',
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Main content ── */}
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '0 clamp(16px, 4vw, 40px)' }}>

        {/* Lists tab */}
        {activeTab === 'lists' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
              {listInput ? (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    autoFocus
                    value={newList}
                    onChange={(e) => setNewList(e.target.value)}
                    placeholder="List name…"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newList.trim()) { setNewList(''); setListInput(false); }
                      if (e.key === 'Escape') setListInput(false);
                    }}
                    style={{
                      height: '36px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid #ff6b35',
                      borderRadius: '9999px',
                      color: '#f8f8ff', padding: '0 14px',
                      fontFamily: 'var(--font-sans)', fontSize: '13px', outline: 'none', width: '160px',
                    }}
                  />
                  <button onClick={() => setListInput(false)} style={{ background: 'none', border: 'none', color: 'rgba(248,248,255,0.35)', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
                </div>
              ) : (
                <button
                  onClick={() => setListInput(true)}
                  style={{
                    height: '36px', padding: '0 16px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    borderRadius: '9999px',
                    fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em',
                    color: '#ff6b35', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  Create List +
                </button>
              )}
            </div>
            {Object.keys(lists).length === 0 ? (
              <EmptyState onCta={() => router.push('/home')} isFiltered={false} />
            ) : (
              Object.entries(lists).map(([name, items]) => (
                <ListSection key={name} name={name} items={items} onDelete={handleDelete} onVisitTap={setVisitSheet} />
              ))
            )}
          </div>
        )}

        {/* All / Visited tabs */}
        {activeTab !== 'lists' && (
          filtered.length === 0 ? (
            <EmptyState onCta={() => router.push('/home')} isFiltered={places.length > 0} />
          ) : (
            <div style={{ columns: 2, columnGap: '12px' }}>
              {filtered.map((saved) => (
                <div key={saved.id} style={{ breakInside: 'avoid', marginBottom: '12px' }}>
                  <SavedCard saved={saved} onDelete={handleDelete} onVisitTap={setVisitSheet} />
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Visit sheet */}
      <AnimatePresence>
        {visitSheet && (
          <VisitSheet saved={visitSheet} onClose={() => setVisitSheet(null)} onSave={handleVisitSave} />
        )}
      </AnimatePresence>

      {/* Delete toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            style={{
              position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(17,17,24,0.95)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '14px',
              padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '16px',
              zIndex: 300, whiteSpace: 'nowrap',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: '13px', color: 'rgba(248,248,255,0.6)' }}>
              Removed <strong style={{ color: '#f8f8ff', fontWeight: 600 }}>{toast.name}</strong>
            </span>
            <button
              onClick={handleUndo}
              style={{ background: 'none', border: 'none', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '13px', color: '#ff6b35', cursor: 'pointer', padding: 0 }}
            >
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
