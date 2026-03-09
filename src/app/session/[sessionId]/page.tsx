'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import SwipeCard, { SwipeActions } from '@/components/SwipeCard';
import type { PlaceResult } from '@/types/place';
import { nearestMTRStation } from '@/lib/hkMTRStations';
import type { MTRStation } from '@/lib/hkMTRStations';
import { createClient } from '@/lib/supabase';

// Module-level supabase instance (required for auto-save IIFE pattern)
const supabase = createClient();

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionInfo {
  id: string;
  mode: 'couples' | 'friends' | 'solo';
  filters: {
    cuisines?: string[];
    budgetLevels?: number[];
    openNow?: boolean;
    radiusMetres?: number;
    hkHour?: number;
  };
}

// ── Location helper ───────────────────────────────────────────────────────────

function useLocation() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [locLoading, setLocLoading] = useState(false);

  const request = useCallback(() => {
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocLoading(false);
      },
      () => {
        // Fallback: Central Hong Kong
        setCoords({ lat: 22.2855, lng: 114.1577 });
        setLocError('Using Central, HK as fallback location.');
        setLocLoading(false);
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  return { coords, locError, locLoading, request };
}

// ── Match popup ───────────────────────────────────────────────────────────────

function MatchPopup({ place, onDismiss }: { place: PlaceResult; onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(250,249,247,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
      onClick={onDismiss}
    >
      <motion.div
        initial={{ scale: 0.85, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 260 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          border: '1px solid rgba(255,107,53,0.35)',
          borderRadius: '20px',
          padding: '40px 32px',
          maxWidth: '380px',
          width: '100%',
          textAlign: 'center',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 0 40px rgba(255,107,53,0.2), 0 8px 40px rgba(0,0,0,0.15)',
        }}
      >
        <p style={{ fontSize: '32px', margin: '0 0 12px' }}>🎉</p>
        <p
          style={{
            fontSize: '14px',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            background: 'linear-gradient(135deg, #ff6b35, #ffa500)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            margin: '0 0 12px',
          }}
        >
          ✦ It&apos;s a match!
        </p>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '26px', letterSpacing: '-0.02em', color: '#0f0f0f', margin: '0 0 8px' }}>
          {place.name}
        </h2>
        <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: '14px', color: 'rgba(15,15,15,0.55)', margin: '0 0 28px' }}>
          {place.address}
        </p>
        {place.editorialSummary && (
          <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: '14px', color: 'rgba(15,15,15,0.5)', margin: '0 0 28px', lineHeight: 1.6 }}>
            {place.editorialSummary}
          </p>
        )}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(place.name + ' ' + place.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1, height: '48px',
              background: 'linear-gradient(135deg, #ff6b35, #ffa500)',
              border: 'none',
              borderRadius: '9999px',
              color: '#fff',
              fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '15px',
              letterSpacing: '0.02em',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              textDecoration: 'none', cursor: 'pointer',
              boxShadow: '0 0 16px rgba(255,107,53,0.3)',
            }}
          >
            Directions →
          </a>
          <button
            onClick={onDismiss}
            style={{
              flex: 1, height: '48px',
              background: '#ffffff',
              border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: '9999px',
              color: 'rgba(15,15,15,0.55)',
              fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: '15px',
              cursor: 'pointer',
            }}
          >
            Keep swiping
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SessionPage() {
  const params    = useParams();
  const router    = useRouter();
  const sessionId = params.sessionId as string;

  // Single identity: auth UUID for logged-in users, 'g_<timestamp>' for guests
  const [myId, setMyId] = useState<string | null>(null);
  const [session,     setSession]     = useState<SessionInfo | null>(null);
  const [sessionErr,  setSessionErr]  = useState<string | null>(null);
  const [places,      setPlaces]      = useState<PlaceResult[]>([]);
  const [cardIndex,   setCardIndex]   = useState(0);
  const [swiped,      setSwiped]      = useState<string[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [matchedPlace, setMatchedPlace] = useState<PlaceResult | null>(null);
  const [matchHistory, setMatchHistory] = useState<PlaceResult[]>([]);
  const [matchCount,  setMatchCount]  = useState(0);
  const [swiping,     setSwiping]     = useState(false);
  const [showMatches, setShowMatches] = useState(false);
  const [hasTriedExpansion, setHasTriedExpansion] = useState(false);

  const { coords, locError, locLoading, request: requestLocation } = useLocation();
  const [locationGranted, setLocationGranted] = useState(false);
  const [nearestStation,  setNearestStation]  = useState<MTRStation | null>(null);
  const [savedToast,      setSavedToast]      = useState<string | null>(null);

  const fetchingRef = useRef(false);

  // ── Resolve identity (auth user or guest) ────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) {
        setMyId(data.user.id);
        console.log('[session] auth user:', data.user.id);
      } else {
        let id = localStorage.getItem('twine_guest_id');
        if (!id) {
          id = 'g_' + Date.now();
          localStorage.setItem('twine_guest_id', id);
        }
        setMyId(id);
        console.log('[session] guest id:', id);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Guest: register as participant when myId is known ────────────────────

  useEffect(() => {
    if (!myId || !myId.startsWith('g_') || !sessionId) return;
    const guestName = localStorage.getItem('guest_name') ?? 'Guest';
    fetch('/api/session/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, guestId: myId, guestName }),
    })
      .then((r) => r.json())
      .then((d) => console.log('[session] guest joined:', d))
      .catch((e) => console.error('[session] guest join failed:', e));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, sessionId]);

  // ── Load session info ────────────────────────────────────────────────────

  useEffect(() => {
    fetch(`/api/session/info?id=${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setSessionErr(data.error);
        else setSession(data);
      })
      .catch(() => setSessionErr('Could not load session.'));
  }, [sessionId]);

  // ── Fetch places when location + session ready ───────────────────────────

  const fetchPlaces = useCallback(async (lat: number, lng: number, alreadySwiped: string[]) => {
    if (!session || fetchingRef.current) return;
    fetchingRef.current = true;
    setLoadingPlaces(true);

    const isMTR = (session.filters?.radiusMetres ?? 0) === 99999;
    const hkHour = parseInt(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong', hour: 'numeric', hour12: false })
    );

    let searchLat = lat;
    let searchLng = lng;
    if (isMTR) {
      const station = nearestMTRStation(lat, lng);
      setNearestStation(station);
      searchLat = station.lat;
      searchLng = station.lng;
    }

    // Try radii in sequence until we get enough places
    const radii = isMTR ? [800] : [2000, 5000, 10000];
    let fetched: PlaceResult[] = [];

    for (const radius of radii) {
      try {
        console.log(`FETCH ATTEMPT radius=${radius}`);
        const res = await fetch('/api/places', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: searchLat,
            lng: searchLng,
            radiusMetres: radius,
            cuisines:     session.filters?.cuisines,
            budgetLevels: session.filters?.budgetLevels,
            openNow:      session.filters?.openNow,
            hkHour,
            sessionId,
            alreadySwiped,
          }),
        });
        const data = await res.json();
        fetched = data?.places ?? [];
        console.log(`FETCH radius=${radius} returned ${fetched.length} places`);
        if (fetched.length >= 8) break;
      } catch (e) {
        console.error('fetchPlaces error at radius', radius, e);
      }
    }

    if (fetched.length > 0) {
      setPlaces((prev) => [...prev, ...fetched]);
    }
    setHasTriedExpansion(true);
    setLoadingPlaces(false);
    fetchingRef.current = false;
  }, [session, sessionId]);

  useEffect(() => {
    if (coords && session && locationGranted) {
      fetchPlaces(coords.lat, coords.lng, swiped);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, session, locationGranted]);

  // ── Handle location grant ────────────────────────────────────────────────

  function handleGrantLocation() {
    requestLocation();
    setLocationGranted(true);
  }

  // ── Swipe handler ────────────────────────────────────────────────────────

  async function handleSwipe(direction: 'yes' | 'skip') {
    const place = places[cardIndex];
    if (!place || swiping) return;

    setSwiping(true);
    const newSwiped = [...swiped, place.id];
    setSwiped(newSwiped);

    if (!place.isFeatured) {
      try {
        const res = await fetch('/api/session/swipe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionId,
            placeId: place.id,
            direction: direction === 'yes' ? 'right' : 'left',
            placeName: place.name ?? '',
            placeData: place,
            userId: myId,
          }),
        });
        const data = await res.json();
        if (data.matched) {
          const mp = data.place ?? place;
          setMatchedPlace(mp);
          setMatchHistory((prev) => [...prev, mp]);
        }
        refreshMatchCount();
      } catch (e) {
        console.error('swipe record failed:', e);
      }
    }

    const nextIndex = cardIndex + 1;
    setCardIndex(nextIndex);
    setSwiping(false);

    // Load more when 5 cards remain
    if (places.length - nextIndex <= 5 && coords && !fetchingRef.current) {
      fetchPlaces(coords.lat, coords.lng, newSwiped);
    }
  }

  // ── Refresh match count from server ──────────────────────────────────────

  const refreshMatchCount = useCallback(async () => {
    try {
      const res = await fetch(`/api/session/results?sessionId=${sessionId}`)
      if (res.ok) {
        const data = await res.json()
        const newCount = data.matches?.length ?? 0
        setMatchCount((prev) => {
          if (newCount > prev && data.matches?.length > 0) {
            const latest = data.matches[data.matches.length - 1]
            setMatchedPlace(latest?.place_data ?? null)
          }
          return newCount
        })
        console.log('[session] match count refreshed:', newCount)
      }
    } catch (e) {
      console.error('[session] match count refresh failed:', e)
    }
  }, [sessionId]);

  // ── Save place ───────────────────────────────────────────────────────────

  async function handleSave(place: PlaceResult) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('saved_places').upsert({
        user_id: user.id,
        place_id: place.id,
        place_name: place.name,
        place_data: place,
      }, { onConflict: 'user_id,place_id' });
      setSavedToast(place.name);
      setTimeout(() => setSavedToast(null), 3000);
    } catch {
      // Non-fatal
    }
  }

  // ── Render: error ────────────────────────────────────────────────────────

  if (sessionErr) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '20px', color: '#0f0f0f', marginBottom: '12px' }}>
            {sessionErr}
          </p>
          <a href="/home" style={{ color: '#ff6b35', fontFamily: 'var(--font-sans)', fontSize: '14px' }}>
            ← Back to home
          </a>
        </div>
      </div>
    );
  }

  // ── Render: location permission ──────────────────────────────────────────

  if (!locationGranted) {
    return (
      <div style={containerStyle}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: '#ffffff',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: '20px',
            padding: '48px 36px',
            maxWidth: '380px',
            width: '100%',
            textAlign: 'center',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <p style={{ fontSize: '40px', margin: '0 0 20px' }}>📍</p>
          <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '24px', letterSpacing: '-0.02em', color: '#0f0f0f', margin: '0 0 12px' }}>
            Share your location
          </h2>
          <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: '14px', color: 'rgba(15,15,15,0.55)', margin: '0 0 32px', lineHeight: 1.6 }}>
            We&apos;ll find hidden gems near you. Your location is never stored or shared.
          </p>
          <button
            onClick={handleGrantLocation}
            style={{
              width: '100%', height: '52px',
              background: 'linear-gradient(135deg, #ff6b35, #ffa500)',
              border: 'none',
              borderRadius: '9999px',
              color: '#fff',
              fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '16px',
              letterSpacing: '0.02em',
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(255,107,53,0.3)',
            }}
          >
            Enable Location →
          </button>
          {locError && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(15,15,15,0.35)', marginTop: '16px' }}>
              {locError}
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  // ── Render: loading ──────────────────────────────────────────────────────

  if (locLoading || (loadingPlaces && places.length === 0)) {
    return (
      <div style={containerStyle}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'rgba(15,15,15,0.35)', letterSpacing: '0.06em' }}>
          Finding hidden gems…
        </span>
      </div>
    );
  }

  // ── Render: empty state ──────────────────────────────────────────────────

  const remaining = places.slice(cardIndex);
  if (!loadingPlaces && remaining.length === 0 && hasTriedExpansion) {
    return (
      <div style={containerStyle}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: 'center', maxWidth: '320px' }}
        >
          <p style={{ fontSize: '48px', margin: '0 0 16px' }}>🍜</p>
          <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '22px', letterSpacing: '-0.02em', color: '#0f0f0f', margin: '0 0 10px' }}>
            You&apos;ve seen them all!
          </h2>
          <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: '14px', color: 'rgba(15,15,15,0.55)', margin: '0 0 28px' }}>
            {matchHistory.length > 0
              ? `You matched ${matchHistory.length} place${matchHistory.length !== 1 ? 's' : ''}.`
              : 'Try expanding your filters to see more places.'}
          </p>
          {matchHistory.length > 0 && (
            <button
              onClick={() => router.push(`/results/${sessionId}`)}
              style={{
                width: '100%', height: '52px',
                background: 'linear-gradient(135deg, #ff6b35, #ffa500)',
                border: 'none',
                borderRadius: '9999px',
                color: '#fff',
                fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '15px',
                letterSpacing: '0.02em',
                cursor: 'pointer',
                marginBottom: '12px',
                boxShadow: '0 0 20px rgba(255,107,53,0.3)',
              }}
            >
              See Your Matches →
            </button>
          )}
          <button
            onClick={() => router.push('/home')}
            style={{
              width: '100%', height: '48px',
              background: '#ffffff',
              border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: '9999px',
              color: 'rgba(15,15,15,0.55)',
              fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: '14px', cursor: 'pointer',
            }}
          >
            Back to home
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Render: card stack ───────────────────────────────────────────────────

  const visibleCards = remaining.slice(0, 3);

  return (
    <div style={{ ...containerStyle, flexDirection: 'column', gap: 0, paddingTop: 0 }}>
      {/* Header */}
      <div style={{
        width: '100%', maxWidth: '480px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        height: '60px',
        boxSizing: 'border-box',
      }}>
        <button
          onClick={() => router.push('/home')}
          style={{ background: 'none', border: 'none', color: 'rgba(15,15,15,0.35)', cursor: 'pointer', fontSize: '20px', padding: 0 }}
        >
          ←
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <span
            style={{
              fontSize: '18px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #ff6b35, #ffa500)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            ✦ twine
          </span>
          {nearestStation && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '9px',
              color: 'rgba(15,15,15,0.35)', letterSpacing: '0.06em',
            }}>
              🚇 Near {nearestStation.name} MTR
            </span>
          )}
        </div>
        <button
          onClick={() => router.push(`/results/${sessionId}`)}
          style={{
            background: matchCount > 0 ? 'rgba(255,107,53,0.12)' : 'rgba(0,0,0,0.04)',
            border: matchCount > 0 ? '1px solid rgba(255,107,53,0.3)' : '1px solid rgba(0,0,0,0.08)',
            borderRadius: '9999px',
            color: matchCount > 0 ? '#ff6b35' : 'rgba(15,15,15,0.35)',
            fontFamily: 'var(--font-mono)', fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.06em', padding: '5px 12px', cursor: 'pointer',
            boxShadow: matchCount > 0 ? '0 0 12px rgba(255,107,53,0.4)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          {matchCount} {matchCount === 1 ? 'Match' : 'Matches'} 🎯
        </button>
      </div>

      {/* Card stack area */}
      <div style={{
        flex: 1,
        width: '100%', maxWidth: '480px',
        padding: '24px 20px 0',
        position: 'relative',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Card slot */}
        <div style={{ position: 'relative', height: '520px', marginBottom: '32px' }}>
          <AnimatePresence>
            {visibleCards.map((place, i) => (
              <SwipeCard
                key={place.id + '_' + (cardIndex + i)}
                place={place}
                stackIndex={i}
                onSwipe={i === 0 ? handleSwipe : () => {}}
                onSave={handleSave}
              />
            ))}
          </AnimatePresence>

          {/* Loading more indicator */}
          {loadingPlaces && remaining.length <= 5 && (
            <div style={{
              position: 'absolute', bottom: -20, left: '50%', transform: 'translateX(-50%)',
              fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(15,15,15,0.35)', letterSpacing: '0.06em',
            }}>
              Loading more…
            </div>
          )}
        </div>

        {/* Counter */}
        <p style={{
          fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(15,15,15,0.35)',
          letterSpacing: '0.08em', textAlign: 'center', margin: '0 0 20px',
        }}>
          {Math.min(swiped.length + 1, places.length)} / {places.length} places
        </p>

        {/* Action buttons */}
        <SwipeActions
          onSkip={() => handleSwipe('skip')}
          onYes={() => handleSwipe('yes')}
          disabled={swiping || remaining.length === 0}
        />

        <p style={{
          fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: '11px', color: 'rgba(15,15,15,0.35)',
          textAlign: 'center', margin: '16px 0 0',
        }}>
          Swipe right or tap ✓ if you&apos;re interested
        </p>
      </div>

      {/* Saved toast */}
      <AnimatePresence>
        {savedToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: '14px', padding: '10px 18px', zIndex: 200,
              fontFamily: 'var(--font-mono)', fontSize: '11px',
              color: '#10b981', letterSpacing: '0.06em',
              whiteSpace: 'nowrap',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            ✦ Saved to your collection
          </motion.div>
        )}
      </AnimatePresence>

      {/* Match popup */}
      <AnimatePresence>
        {matchedPlace && (
          <MatchPopup
            place={matchedPlace}
            onDismiss={() => setMatchedPlace(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Shared container style ────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#faf9f7',
  color: '#0f0f0f',
  fontFamily: 'var(--font-sans)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0',
  position: 'relative',
  overflow: 'hidden',
};
