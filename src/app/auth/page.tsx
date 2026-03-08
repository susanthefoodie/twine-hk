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
      <rect x="1.5" y="3.5" width="15" height="11" rx="1.5" stroke="#7a7060" strokeWidth="1.4" />
      <path d="M1.5 5.5L9 10.5l7.5-5" stroke="#7a7060" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// ─── Auth button component ────────────────────────────────────────────────────

function AuthButton({
  onClick,
  icon,
  label,
  disabled = false,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        height: '44px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        background: '#221e1a',
        border: `1px solid ${hovered ? '#c9622a' : '#332e28'}`,
        borderRadius: '4px',
        fontFamily: 'var(--font-sans)',
        fontWeight: 500,
        fontSize: '15px',
        color: '#f0e8d8',
        cursor: 'pointer',
        transition: 'border-color 0.2s',
      }}
    >
      {icon}
      {label}
    </button>
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
        background: '#12100e',
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
          background:
            'radial-gradient(ellipse, rgba(201,98,42,0.08) 0%, transparent 60%)',
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
          background: '#1a1714',
          border: '1px solid #332e28',
          borderRadius: '8px',
          padding: '48px',
        }}
      >
        {/* Logo */}
        <p
          style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: '28px',
            color: '#e07840',
            textAlign: 'center',
            margin: '0 0 24px',
          }}
        >
          ✦ Twine
        </p>

        {/* Headline */}
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 700,
            fontSize: '26px',
            color: '#f0e8d8',
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
              background: 'rgba(201,98,42,0.08)',
              border: '1px solid rgba(201,98,42,0.25)',
              borderRadius: '4px',
              padding: '10px 14px',
              marginBottom: '20px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: '#c9622a',
              letterSpacing: '0.03em',
            }}
          >
            Something went wrong. Please try signing in again.
          </div>
        )}

        {/* Google */}
        <div style={{ marginBottom: '10px' }}>
          <AuthButton onClick={handleGoogle} icon={<GoogleIcon />} label="Continue with Google" />
        </div>

        {/* Email */}
        <div style={{ marginBottom: '16px' }}>
          <AuthButton
            onClick={() => setShowEmail(true)}
            icon={<MailIcon />}
            label="Continue with Email"
          />
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
                          height: '44px',
                          background: '#221e1a',
                          border: '1px solid #3d3730',
                          borderRadius: '4px',
                          color: '#f0e8d8',
                          fontFamily: 'var(--font-sans)',
                          fontSize: '15px',
                          padding: '0 14px',
                          marginBottom: error ? '8px' : '10px',
                          outline: 'none',
                          boxSizing: 'border-box',
                          transition: 'border-color 0.2s',
                        }}
                        onFocus={(e) =>
                          (e.currentTarget.style.borderColor = '#c9622a')
                        }
                        onBlur={(e) =>
                          (e.currentTarget.style.borderColor = '#3d3730')
                        }
                      />

                      {error && (
                        <p
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '11px',
                            color: '#c9622a',
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
                          height: '44px',
                          background:
                            !loading && email.trim() && sendHover
                              ? '#e07840'
                              : !loading && email.trim()
                              ? '#c9622a'
                              : '#2a2520',
                          border: 'none',
                          borderRadius: '4px',
                          fontFamily: 'var(--font-sans)',
                          fontWeight: 500,
                          fontSize: '15px',
                          color:
                            !loading && email.trim() ? '#f0e8d8' : '#7a7060',
                          cursor:
                            !loading && email.trim() ? 'pointer' : 'not-allowed',
                          transition: 'background 0.2s',
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
                        background: 'rgba(74,124,111,0.08)',
                        border: '1px solid rgba(74,124,111,0.25)',
                        borderRadius: '4px',
                        padding: '14px 16px',
                        fontFamily: 'var(--font-sans)',
                        fontWeight: 300,
                        fontSize: '14px',
                        color: '#4a7c6f',
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
          <div style={{ flex: 1, height: '1px', background: '#332e28' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#3d3730', letterSpacing: '0.06em' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: '#332e28' }} />
        </div>

        {/* Guest button */}
        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={() => router.push('/guest')}
            style={{
              width: '100%',
              height: '44px',
              background: 'transparent',
              border: '1px solid #332e28',
              borderRadius: '4px',
              fontFamily: 'var(--font-sans)',
              fontWeight: 400,
              fontSize: '14px',
              color: '#7a7060',
              cursor: 'pointer',
              transition: 'border-color 0.2s, color 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = '#7a7060';
              (e.currentTarget as HTMLElement).style.color = '#9a8f7e';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = '#332e28';
              (e.currentTarget as HTMLElement).style.color = '#7a7060';
            }}
          >
            Try as Guest — no sign up needed
          </button>
        </div>

        {/* Privacy note */}
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: '#7a7060',
            textAlign: 'center',
            margin: 0,
            letterSpacing: '0.03em',
            lineHeight: 1.7,
          }}
        >
          By continuing you agree to our{' '}
          <a
            href="/privacy"
            style={{ color: '#c9622a', textDecoration: 'none' }}
          >
            Privacy Policy
          </a>
          . No spam, ever.
        </p>
      </motion.div>
    </div>
  );
}
