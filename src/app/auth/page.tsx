'use client';

import { useEffect, useState, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';

// ─── Icons ────────────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908C16.658 14.042 17.64 11.734 17.64 9.2z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="3.5" width="15" height="11" rx="1.5" stroke="rgba(248,248,255,0.6)" strokeWidth="1.4" />
      <path d="M1.5 5.5L9 10.5l7.5-5" stroke="rgba(248,248,255,0.6)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthContent />
    </Suspense>
  );
}

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendHover, setSendHover] = useState(false);

  const urlError = searchParams.get('error');

  // Redirect if already authenticated; also recover any guest liked places
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(async ({ data: { user } }) => {
        if (user) {
          // Recover guest liked places from localStorage and save them
          try {
            const raw = localStorage.getItem('guest_liked');
            if (raw) {
              const likedPlaces = JSON.parse(raw);
              for (const place of likedPlaces) {
                await fetch('/api/saved/add', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: user.id, placeId: place.id, placeData: place }),
                });
              }
              localStorage.removeItem('guest_liked');
            }
          } catch {
            // Non-fatal
          }
          router.replace('/home');
        }
      });
  }, [router]);

  async function handleGoogle() {
    setError(null);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/auth/callback',
      },
    });
  }

  async function handleMagicLink() {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin + '/auth/callback',
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setEmailSent(true);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: 'fixed',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '400px',
          background: 'radial-gradient(ellipse, rgba(255,107,53,0.12) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '420px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
          padding: '48px',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {/* Logo */}
        <p
          style={{
            fontSize: '32px',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            textAlign: 'center',
            margin: '0 0 24px',
            background: 'linear-gradient(135deg, #ff6b35, #ffa500)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          twine <span style={{ WebkitTextFillColor: '#ff6b35' }}>HK</span>
        </p>

        {/* Headline */}
        <h1
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 700,
            fontSize: '24px',
            letterSpacing: '-0.02em',
            color: '#f8f8ff',
            textAlign: 'center',
            margin: '0 0 32px',
            lineHeight: 1.3,
          }}
        >
          Find your hidden gem together.
        </h1>

        {/* URL-driven error (e.g. auth callback failed) */}
        {urlError && (
          <div
            style={{
              background: 'rgba(255,107,53,0.1)',
              border: '1px solid rgba(255,107,53,0.3)',
              borderRadius: '14px',
              padding: '10px 14px',
              marginBottom: '20px',
              fontSize: '12px',
              color: '#ff6b35',
              letterSpacing: '0.03em',
            }}
          >
            Something went wrong. Please try signing in again.
          </div>
        )}

        {/* Google */}
        <div style={{ marginBottom: '10px' }}>
          <button
            onClick={handleGoogle}
            style={{
              width: '100%',
              height: '52px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              background: '#fff',
              border: 'none',
              borderRadius: '9999px',
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
              fontSize: '15px',
              color: '#111',
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.9'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </div>

        {/* Email */}
        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={() => setShowEmail(true)}
            style={{
              width: '100%',
              height: '52px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: '9999px',
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              fontSize: '15px',
              color: 'rgba(248,248,255,0.6)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
              (e.currentTarget as HTMLElement).style.color = '#f8f8ff';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
              (e.currentTarget as HTMLElement).style.color = 'rgba(248,248,255,0.6)';
            }}
          >
            <MailIcon />
            Continue with Email
          </button>
        </div>

        {/* Animated email section */}
        <AnimatePresence>
          {showEmail && (
            <motion.div
              key="email-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ paddingBottom: '16px' }}>
                <AnimatePresence mode="wait">
                  {!emailSent ? (
                    <motion.div
                      key="form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleMagicLink()}
                        autoFocus
                        style={{
                          width: '100%',
                          height: '48px',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '14px',
                          color: '#f8f8ff',
                          fontFamily: 'var(--font-sans)',
                          fontSize: '15px',
                          padding: '0 16px',
                          marginBottom: error ? '8px' : '10px',
                          outline: 'none',
                          boxSizing: 'border-box',
                          transition: 'border-color 0.2s',
                        }}
                        onFocus={(e) =>
                          (e.currentTarget.style.borderColor = '#ff6b35')
                        }
                        onBlur={(e) =>
                          (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')
                        }
                      />

                      {error && (
                        <p
                          style={{
                            fontSize: '12px',
                            color: '#ff6b35',
                            margin: '0 0 10px',
                            letterSpacing: '0.03em',
                          }}
                        >
                          {error}
                        </p>
                      )}

                      <button
                        onClick={handleMagicLink}
                        disabled={loading || !email.trim()}
                        onMouseEnter={() => setSendHover(true)}
                        onMouseLeave={() => setSendHover(false)}
                        style={{
                          width: '100%',
                          height: '48px',
                          background: !loading && email.trim()
                            ? 'linear-gradient(135deg, #ff6b35, #ffa500)'
                            : 'rgba(255,255,255,0.05)',
                          border: 'none',
                          borderRadius: '9999px',
                          fontFamily: 'var(--font-sans)',
                          fontWeight: 600,
                          fontSize: '15px',
                          color: !loading && email.trim() ? '#fff' : 'rgba(248,248,255,0.35)',
                          cursor: !loading && email.trim() ? 'pointer' : 'not-allowed',
                          transition: 'all 0.2s',
                          boxShadow: !loading && email.trim() && sendHover
                            ? '0 0 20px rgba(255,107,53,0.4)'
                            : !loading && email.trim()
                            ? '0 0 12px rgba(255,107,53,0.25)'
                            : 'none',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {loading ? 'Sending…' : 'Send Magic Link'}
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{
                        background: 'rgba(16,185,129,0.08)',
                        border: '1px solid rgba(16,185,129,0.25)',
                        borderRadius: '14px',
                        padding: '14px 16px',
                        fontFamily: 'var(--font-sans)',
                        fontWeight: 400,
                        fontSize: '14px',
                        color: '#10b981',
                        lineHeight: 1.6,
                      }}
                    >
                      Check your inbox — we sent you a link 📬
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Divider with "or" */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            margin: '4px 0 14px',
          }}
        >
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ fontSize: '11px', color: 'rgba(248,248,255,0.2)', letterSpacing: '0.06em' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
        </div>

        {/* Guest button */}
        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={() => router.push('/guest')}
            style={{
              width: '100%',
              height: '48px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: '9999px',
              fontFamily: 'var(--font-sans)',
              fontWeight: 400,
              fontSize: '14px',
              color: 'rgba(248,248,255,0.6)',
              cursor: 'pointer',
              transition: 'border-color 0.2s, color 0.2s, background 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.25)';
              (e.currentTarget as HTMLElement).style.color = '#f8f8ff';
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.14)';
              (e.currentTarget as HTMLElement).style.color = 'rgba(248,248,255,0.6)';
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
            }}
          >
            Try as Guest — no sign up needed
          </button>
        </div>

        {/* Privacy note */}
        <p
          style={{
            fontSize: '11px',
            color: 'rgba(248,248,255,0.35)',
            textAlign: 'center',
            margin: 0,
            letterSpacing: '0.03em',
            lineHeight: 1.7,
          }}
        >
          By continuing you agree to our{' '}
          <a
            href="/privacy"
            style={{ color: '#ff6b35', textDecoration: 'none' }}
          >
            Privacy Policy
          </a>
          . No spam, ever.
        </p>
      </motion.div>
    </div>
  );
}
