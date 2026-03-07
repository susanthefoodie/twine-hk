'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import SwipeCard, { SwipeActions } from '@/components/SwipeCard';
import type { PlaceResult } from '@/types/place';
import { nearestMTRStation } from '@/lib/hkMTRStations';
import type { MTRStation } from '@/lib/hkMTRStations';
import { createClient } from '@/lib/supabase';

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

interface MatchedPlace {
  place: PlaceResult;
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
        background: 'rgba(18,16,14,0.92)',
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
          background: '#1a1714', border: '1px solid #c4922a55',
          borderRadius: '12px', padding: '40px 32px', maxWidth: '380px', width: '100%',
          textAlign: 'center',
        }}
      >
        <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '16px', color: '#c4922a', margin: '0 0 12px' }}>
          ✦ It&apos;s a match!
        </p>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '26px', color: '#f0e8d8', margin: '0 0 8px' }}>
          {place.name}
        </h2>
        <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: '14px', color: '#7a7060', margin: '0 0 28px' }}>
          {place.address}
        </p>
        {place.editorialSummary && (
          <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: '14px', color: '#9a8f7e', margin: '0 0 28px', lineHeight: 1.6 }}>
            {place.editorialSummary}
          </p>
        )}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(place.name + ' ' + place.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1, height: '48px', background: '#c9622a', border: 'none',
              borderRadius: '4px', color: '#f0e8d8',
              fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: '15px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              textDecoration: 'none', cursor: 'pointer',
            }}
          >
            Directions →
          </a>
          <button
            onClick={onDismiss}
            style={{
              flex: 1, height: '48px', background: '#221e1a', border: '1px solid #332e28',
              borderRadius: '4px', color: '#7a7060',
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

  const [session,     setSession]     = useState<SessionInfo | null>(null);
  const [sessionErr,  setSessionErr]  = useState<string | null>(null);
  const [places,      setPlaces]      = useState<PlaceResult[]>([]);
  const [cardIndex,   setCardIndex]   = useState(0);
  const [swiped,      setSwiped]      = useState<string[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [match,       setMatch]       = useState<MatchedPlace | null>(null);
  const [matchHistory, setMatchHistory] = useState<PlaceResult[]>([]);
  const [swiping,     setSwiping]     = useState(false);
  const [showMatches, setShowMatches] = useState(false);

  const { coords, locError, locLoading, request: requestLocation } = useLocation();
  const [locationGranted, setLocationGranted] = useState(false);
  const [nearestStation,  setNearestStation]  = useState<MTRStation | null>(null);
  const [savedToast,      setSavedToast]      = useState<string | null>(null);

  const fetchingRef = useRef(false);

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

    // For MTR mode: find nearest station and search from there at 800m
    let searchLat = lat;
    let searchLng = lng;
    if (isMTR) {
      const station = nearestMTRStation(lat, lng);
      setNearestStation(station);
      searchLat = station.lat;
      searchLng = station.lng;
    }

    try {
      const res = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: searchLat,
          lng: searchLng,
          radiusMetres: isMTR ? 99999 : (session.filters?.radiusMetres ?? 2000),
          cuisines:     session.filters?.cuisines,
          budgetLevels: session.filters?.budgetLevels,
          openNow:      session.filters?.openNow,
          hkHour,
          sessionId,
          alreadySwiped,
        }),
      });
      const data = await res.json();
      const incoming = data?.places ?? [];
      if (incoming.length > 0) {
        setPlaces((prev) => [...prev, ...incoming]);
      }
    } finally {
      setLoadingPlaces(false);
      fetchingRef.current = false;
    }
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

  // ── Auto-save on right swipe ─────────────────────────────────────────────

  async function silentSaveSwipedPlace(place: PlaceResult) {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('saved_places').upsert({
        user_id: user.id,
        place_id: place.id,
        place_name: place.name,
        place_data: place,
        list_name: 'Swiped Right',
        is_visited: false,
      }, { onConflict: 'user_id,place_id' });
    } catch (e) {
      console.log('[auto-save] silent error:', e);
    }
  }

  // ── Swipe handler ────────────────────────────────────────────────────────

  async function handleSwipe(direction: 'yes' | 'skip') {
    const place = places[cardIndex];
    if (!place || swiping) return;

    setSwiping(true);
    const newSwiped = [...swiped, place.id];
    setSwiped(newSwiped);

    // Record swipe
    if (!place.isFeatured) {
      try {
        const res = await fetch('/api/session/swipe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            placeId: place.id,
            direction,
            placeData: place,
          }),
        });
        const data = await res.json();
        if (data.matched && data.place) {
          setMatch({ place: data.place });
          setMatchHistory((prev) => [...prev, data.place]);
        }
      } catch {
        // Non-fatal
      }

      // Auto-save on right swipe (non-blocking, silent)
      if (direction === 'yes') {
        silentSaveSwipedPlace(place);
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

  // ── Save place ───────────────────────────────────────────────────────────

  async function handleSave(place: PlaceResult) {
    try {
      const supabase = createClient();
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
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: '#f0e8d8', marginBottom: '12px' }}>
            {sessionErr}
          </p>
          <a href="/home" style={{ color: '#c9622a', fontFamily: 'var(--font-sans)', fontSize: '14px' }}>
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
            background: '#1a1714', border: '1px solid #332e28',
            borderRadius: '8px', padding: '48px 36px', maxWidth: '380px', width: '100%',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '40px', margin: '0 0 20px' }}>📍</p>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '24px', color: '#f0e8d8', margin: '0 0 12px' }}>
            Share your location
          </h2>
          <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: '14px', color: '#7a7060', margin: '0 0 32px', lineHeight: 1.6 }}>
            We&apos;ll find hidden gems near you. Your location is never stored or shared.
          </p>
          <button
            onClick={handleGrantLocation}
            style={{
              width: '100%', height: '50px', background: '#c9622a', border: 'none',
              borderRadius: '4px', color: '#f0e8d8',
              fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            Enable Location →
          </button>
          {locError && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#7a7060', marginTop: '16px' }}>
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
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#7a7060', letterSpacing: '0.06em' }}>
          Finding hidden gems…
        </span>
      </div>
    );
  }

  // ── Render: empty state ──────────────────────────────────────────────────

  const remaining = places.slice(cardIndex);
  if (!loadingPlaces && remaining.length === 0) {
    return (
      <div style={containerStyle}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: 'center', maxWidth: '320px' }}
        >
          <p style={{ fontSize: '48px', margin: '0 0 16px' }}>🍜</p>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '22px', color: '#f0e8d8', margin: '0 0 10px' }}>
            You&apos;ve seen them all!
          </h2>
          <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: '14px', color: '#7a7060', margin: '0 0 28px' }}>
            {matchHistory.length > 0
              ? `You matched ${matchHistory.length} place${matchHistory.length !== 1 ? 's' : ''}.`
              : 'Try expanding your filters to see more places.'}
          </p>
          {matchHistory.length > 0 && (
            <button
              onClick={() => router.push(`/results/${sessionId}`)}
              style={{
                width: '100%', height: '50px', background: '#c9622a', border: 'none',
                borderRadius: '4px', color: '#f0e8d8',
                fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: '15px',
                cursor: 'pointer', marginBottom: '12px',
              }}
            >
              See Your Matches →
            </button>
          )}
          <button
            onClick={() => router.push('/home')}
            style={{
              width: '100%', height: '44px', background: 'none',
              border: '1px solid #332e28', borderRadius: '4px', color: '#7a7060',
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
        padding: '20px 20px 0',
      }}>
        <button
          onClick={() => router.push('/home')}
          style={{ background: 'none', border: 'none', color: '#7a7060', cursor: 'pointer', fontSize: '20px', padding: 0 }}
        >
          ←
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '18px', color: '#e07840' }}>
            ✦ Twine
          </span>
          {nearestStation && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '9px',
              color: '#7a7060', letterSpacing: '0.06em',
            }}>
              🚇 Near {nearestStation.name} MTR
            </span>
          )}
        </div>
        {matchHistory.length > 0 ? (
          <button
            onClick={() => router.push(`/results/${sessionId}`)}
            style={{
              background: 'none', border: '1px solid #332e28', borderRadius: '4px',
              color: '#c4922a', fontFamily: 'var(--font-mono)', fontSize: '10px',
              letterSpacing: '0.06em', padding: '5px 10px', cursor: 'pointer',
            }}
          >
            {matchHistory.length} MATCH{matchHistory.length !== 1 ? 'ES' : ''}
          </button>
        ) : <span style={{ width: '70px' }} />}
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
              fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#7a7060', letterSpacing: '0.06em',
            }}>
              Loading more…
            </div>
          )}
        </div>

        {/* Counter */}
        <p style={{
          fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#7a7060',
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
          fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: '11px', color: '#7a7060',
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
              background: '#1a1714', border: '1px solid #4a7c6f55',
              borderRadius: '6px', padding: '10px 18px', zIndex: 200,
              fontFamily: 'var(--font-mono)', fontSize: '11px',
              color: '#4a7c6f', letterSpacing: '0.06em',
              whiteSpace: 'nowrap',
            }}
          >
            ✦ Saved to your collection
          </motion.div>
        )}
      </AnimatePresence>

      {/* Match popup */}
      <AnimatePresence>
        {match && (
          <MatchPopup
            place={match.place}
            onDismiss={() => setMatch(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Shared container style ────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#12100e',
  color: '#f0e8d8',
  fontFamily: 'var(--font-sans)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0',
  position: 'relative',
  overflow: 'hidden',
};
