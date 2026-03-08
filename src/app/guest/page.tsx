'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import SwipeCard, { SwipeActions } from '@/components/SwipeCard'
import type { PlaceResult } from '@/types/place'

const UPSELL_TRIGGER = 3 // show upsell after this many right swipes

// ── Upsell popup ──────────────────────────────────────────────────────────────

function UpsellPopup({
  likedCount,
  onSignUp,
  onDismiss,
}: {
  likedCount: number;
  onSignUp: () => void;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(18,16,14,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
      onClick={onDismiss}
    >
      <motion.div
        initial={{ scale: 0.88, y: 32 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1a1714', border: '1px solid #c4922a44',
          borderRadius: '12px', padding: '40px 32px',
          maxWidth: '360px', width: '100%', textAlign: 'center',
        }}
      >
        <p style={{ fontSize: '36px', margin: '0 0 16px' }}>💾</p>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '22px', color: '#f0e8d8', margin: '0 0 10px' }}>
          You&apos;ve liked {likedCount} gems!
        </h2>
        <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: '14px', color: '#7a7060', margin: '0 0 28px', lineHeight: 1.6 }}>
          Sign up free to save these hidden gems, build your collection, and share sessions with friends.
        </p>
        <button
          onClick={onSignUp}
          style={{
            width: '100%', height: '50px', background: '#c9622a', border: 'none',
            borderRadius: '4px', fontFamily: 'var(--font-sans)', fontWeight: 500,
            fontSize: '15px', color: '#f0e8d8', cursor: 'pointer', marginBottom: '12px',
          }}
        >
          Create Account — it&apos;s free →
        </button>
        <button
          onClick={onDismiss}
          style={{
            width: '100%', height: '44px', background: 'none',
            border: '1px solid #332e28', borderRadius: '4px',
            fontFamily: 'var(--font-sans)', fontWeight: 400,
            fontSize: '14px', color: '#7a7060', cursor: 'pointer',
          }}
        >
          Keep swiping
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Location screen ───────────────────────────────────────────────────────────

function LocationScreen({
  onGrant,
  loading,
  error,
}: {
  onGrant: () => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div style={centreStyle}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: '#1a1714', border: '1px solid #332e28',
          borderRadius: '8px', padding: '48px 36px',
          maxWidth: '380px', width: '100%', textAlign: 'center',
        }}
      >
        <p style={{ fontSize: '40px', margin: '0 0 20px' }}>📍</p>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '24px', color: '#f0e8d8', margin: '0 0 12px' }}>
          Allow location to find hidden gems near you
        </h2>
        <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: '14px', color: '#7a7060', margin: '0 0 32px', lineHeight: 1.6 }}>
          We&apos;ll find Hong Kong&apos;s best-kept secrets near you. Your location is never stored or shared.
        </p>
        <button
          onClick={onGrant}
          disabled={loading}
          style={{
            width: '100%', height: '50px',
            background: loading ? '#2a2520' : '#c9622a',
            border: 'none', borderRadius: '4px', color: '#f0e8d8',
            fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: '16px',
            cursor: loading ? 'not-allowed' : 'pointer', marginBottom: '12px',
          }}
        >
          {loading ? 'Getting location…' : 'Allow Location Access →'}
        </button>
        {error && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#7a7060', margin: 0 }}>
            {error}
          </p>
        )}
      </motion.div>
    </div>
  );
}

// ── End screen ────────────────────────────────────────────────────────────────

function EndScreen({
  likedCount,
  onSignUp,
  onRestart,
}: {
  likedCount: number;
  onSignUp: () => void;
  onRestart: () => void;
}) {
  return (
    <div style={centreStyle}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: 'center', maxWidth: '340px', padding: '0 24px' }}
      >
        <p style={{ fontSize: '48px', margin: '0 0 20px' }}>✦</p>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '24px', color: '#f0e8d8', margin: '0 0 12px' }}>
          You liked {likedCount} hidden gem{likedCount !== 1 ? 's' : ''}!
        </h2>
        <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: '14px', color: '#7a7060', margin: '0 0 32px', lineHeight: 1.6 }}>
          {likedCount > 0
            ? 'Sign up free to save them forever, share sessions with friends, and discover more.'
            : 'Sign up to start a real session and find your perfect hidden gem.'}
        </p>
        {likedCount > 0 && (
          <button
            onClick={onSignUp}
            style={{
              width: '100%', height: '52px', background: '#c9622a', border: 'none',
              borderRadius: '4px', fontFamily: 'var(--font-sans)', fontWeight: 500,
              fontSize: '15px', color: '#f0e8d8', cursor: 'pointer', marginBottom: '12px',
            }}
          >
            Save my {likedCount} gem{likedCount !== 1 ? 's' : ''} — Create Account →
          </button>
        )}
        <button
          onClick={onRestart}
          style={{
            width: '100%', height: '44px', background: 'none',
            border: '1px solid #332e28', borderRadius: '4px',
            fontFamily: 'var(--font-sans)', fontWeight: 400,
            fontSize: '14px', color: '#7a7060', cursor: 'pointer', marginBottom: '12px',
          }}
        >
          Swipe more places
        </button>
        <a
          href="/auth"
          style={{
            display: 'block', fontFamily: 'var(--font-mono)', fontSize: '11px',
            color: '#c9622a', textDecoration: 'none', letterSpacing: '0.06em',
          }}
        >
          Sign up / Log in →
        </a>
      </motion.div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GuestPage() {
  const router = useRouter()

  // Location
  const [coords,          setCoords]          = useState<{ lat: number; lng: number } | null>(null)
  const [locationGranted, setLocationGranted] = useState(false)
  const [locLoading,      setLocLoading]      = useState(false)
  const [locError,        setLocError]        = useState<string | null>(null)

  // Places
  const [places,    setPlaces]    = useState<PlaceResult[]>([])
  const [cardIndex, setCardIndex] = useState(0)
  const [loading,   setLoading]   = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const fetchingRef = useRef(false)
  const [swiped,   setSwiped]   = useState<string[]>([])
  const [swiping,  setSwiping]  = useState(false)

  // Guest state
  const [liked,        setLiked]        = useState<PlaceResult[]>([])
  const [banner,       setBanner]       = useState(true)
  const [showUpsell,   setShowUpsell]   = useState(false)
  const [upsellShown,  setUpsellShown]  = useState(false)

  // Persist liked places to localStorage
  useEffect(() => {
    if (liked.length > 0) {
      localStorage.setItem('guest_liked', JSON.stringify(liked))
    }
  }, [liked])

  // Show upsell after UPSELL_TRIGGER likes
  useEffect(() => {
    if (liked.length >= UPSELL_TRIGGER && !upsellShown) {
      setShowUpsell(true)
      setUpsellShown(true)
    }
  }, [liked.length, upsellShown])

  // ── Location ──────────────────────────────────────────────────────────────

  function handleGrantLocation() {
    setLocLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocLoading(false)
        setLocationGranted(true)
      },
      () => {
        // Fallback: Central Hong Kong
        setCoords({ lat: 22.2831, lng: 114.1552 })
        setLocError('Using Central, HK as your location.')
        setLocLoading(false)
        setLocationGranted(true)
      },
      { timeout: 10000, maximumAge: 60000 }
    )
  }

  // ── Fetch places ──────────────────────────────────────────────────────────

  const fetchPlaces = useCallback(async (lat: number, lng: number, alreadySwiped: string[]) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)

    const hkHour = parseInt(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong', hour: 'numeric', hour12: false })
    )

    const radii = [2000, 5000, 10000]
    let fetched: PlaceResult[] = []

    for (const radius of radii) {
      try {
        const res = await fetch('/api/places', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng, radiusMetres: radius, hkHour, alreadySwiped }),
        })
        const data = await res.json()
        fetched = data?.places ?? []
        if (fetched.length >= 8) break
      } catch {
        // Try next radius
      }
    }

    if (fetched.length > 0) {
      setPlaces((prev) => [...prev, ...fetched])
    }
    setHasLoaded(true)
    setLoading(false)
    fetchingRef.current = false
  }, [])

  useEffect(() => {
    if (coords && locationGranted) {
      fetchPlaces(coords.lat, coords.lng, [])
    }
  }, [coords, locationGranted, fetchPlaces])

  // ── Swipe handler ─────────────────────────────────────────────────────────

  async function handleSwipe(direction: 'yes' | 'skip') {
    const place = places[cardIndex]
    if (!place || swiping) return
    setSwiping(true)

    const newSwiped = [...swiped, place.id]
    setSwiped(newSwiped)

    if (direction === 'yes') {
      setLiked((prev) => [...prev, place])
    }

    const nextIndex = cardIndex + 1
    setCardIndex(nextIndex)
    setSwiping(false)

    if (coords && places.length - nextIndex <= 5 && !fetchingRef.current) {
      fetchPlaces(coords.lat, coords.lng, newSwiped)
    }
  }

  // ── Sign up with liked places ─────────────────────────────────────────────

  function handleSignUp() {
    const ids = liked.map((p) => p.id).join(',')
    router.push(ids ? `/auth?liked=${ids}` : '/auth')
  }

  // ── Restart ───────────────────────────────────────────────────────────────

  function handleRestart() {
    setCardIndex(0)
    setPlaces([])
    setSwiped([])
    setHasLoaded(false)
    setUpsellShown(false)
    if (coords) {
      fetchPlaces(coords.lat, coords.lng, [])
    }
  }

  // ── Screens ───────────────────────────────────────────────────────────────

  if (!locationGranted) {
    return <LocationScreen onGrant={handleGrantLocation} loading={locLoading} error={locError} />
  }

  if (locLoading || (loading && places.length === 0)) {
    return (
      <div style={centreStyle}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#7a7060', letterSpacing: '0.06em' }}>
          Finding hidden gems…
        </span>
      </div>
    )
  }

  const remaining = places.slice(cardIndex)

  if (!loading && remaining.length === 0 && hasLoaded) {
    return <EndScreen likedCount={liked.length} onSignUp={handleSignUp} onRestart={handleRestart} />
  }

  const visibleCards = remaining.slice(0, 3)

  return (
    <div style={{ ...centreStyle, flexDirection: 'column', gap: 0, paddingTop: 0 }}>

      {/* Guest banner */}
      <AnimatePresence>
        {banner && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
              background: 'rgba(196,146,42,0.1)',
              borderBottom: '1px solid rgba(196,146,42,0.25)',
              padding: '10px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
            }}
          >
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#c4922a', flex: 1 }}>
              💎 Guest mode —{' '}
              <a href="/auth" style={{ color: '#c9622a', textDecoration: 'underline' }}>
                sign up free
              </a>{' '}
              to save your matches
            </span>
            <button
              onClick={() => setBanner(false)}
              style={{ background: 'none', border: 'none', color: '#c4922a', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '0 0 0 8px', flexShrink: 0 }}
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upsell popup */}
      <AnimatePresence>
        {showUpsell && (
          <UpsellPopup
            likedCount={liked.length}
            onSignUp={handleSignUp}
            onDismiss={() => setShowUpsell(false)}
          />
        )}
      </AnimatePresence>

      {/* Main content */}
      <div
        style={{
          width: '100%', maxWidth: '480px',
          display: 'flex', flexDirection: 'column',
          paddingTop: banner ? '48px' : '0',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 20px 0',
        }}>
          <a
            href="/"
            style={{ color: '#7a7060', fontSize: '20px', textDecoration: 'none', lineHeight: 1 }}
          >
            ←
          </a>
          <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '18px', color: '#e07840' }}>
            ✦ Twine
          </span>
          {liked.length > 0 ? (
            <button
              onClick={handleSignUp}
              style={{
                background: 'none', border: '1px solid #332e28', borderRadius: '4px',
                color: '#c4922a', fontFamily: 'var(--font-mono)', fontSize: '10px',
                letterSpacing: '0.06em', padding: '5px 10px', cursor: 'pointer',
              }}
            >
              {liked.length} Liked 💾
            </button>
          ) : (
            <span style={{ width: '70px' }} />
          )}
        </div>

        {/* Card stack */}
        <div style={{
          flex: 1, width: '100%', maxWidth: '480px',
          padding: '24px 20px 0',
          position: 'relative', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ position: 'relative', height: '520px', marginBottom: '32px' }}>
            <AnimatePresence>
              {visibleCards.map((place, i) => (
                <SwipeCard
                  key={place.id + '_' + (cardIndex + i)}
                  place={place}
                  stackIndex={i}
                  onSwipe={i === 0 ? handleSwipe : () => {}}
                  onSave={() => {}}
                />
              ))}
            </AnimatePresence>

            {loading && remaining.length <= 5 && (
              <div style={{
                position: 'absolute', bottom: -20, left: '50%', transform: 'translateX(-50%)',
                fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#7a7060', letterSpacing: '0.06em',
              }}>
                Loading more…
              </div>
            )}
          </div>

          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#7a7060',
            letterSpacing: '0.08em', textAlign: 'center', margin: '0 0 20px',
          }}>
            {Math.min(swiped.length + 1, places.length)} / {places.length} places · guest mode
          </p>

          <SwipeActions
            onSkip={() => handleSwipe('skip')}
            onYes={() => handleSwipe('yes')}
            disabled={swiping || remaining.length === 0}
          />

          <p style={{
            fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: '11px', color: '#7a7060',
            textAlign: 'center', margin: '16px 0 0',
          }}>
            Swipe right or tap ✓ to like · sign up to save
          </p>
        </div>
      </div>

      {/* Floating liked counter — shows when liked > 0 and upsell was dismissed */}
      <AnimatePresence>
        {liked.length > 0 && !showUpsell && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            style={{
              position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
              zIndex: 40,
            }}
          >
            <button
              onClick={handleSignUp}
              style={{
                background: '#1a1714', border: '1px solid #c9622a44',
                borderRadius: '24px', padding: '10px 20px',
                display: 'flex', alignItems: 'center', gap: '8px',
                fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#c4922a',
                cursor: 'pointer', whiteSpace: 'nowrap',
                boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
              }}
            >
              💾 {liked.length} liked so far — Sign up to save them
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const centreStyle: React.CSSProperties = {
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
}
