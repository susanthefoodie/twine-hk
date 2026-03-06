'use client';

import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

// ── Tab definitions ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'home',     icon: '🏠', label: 'Home',     href: '/home'    },
  { id: 'discover', icon: '🃏', label: 'Discover',  href: '/home'    },
  { id: 'saved',    icon: '🗂',  label: 'Saved',    href: '/saved'   },
  { id: 'profile',  icon: '👤', label: 'Profile',  href: '/profile' },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export default function BottomNav() {
  const pathname = usePathname();
  const router   = useRouter();

  function activeTab() {
    if (pathname.startsWith('/saved'))   return 'saved';
    if (pathname.startsWith('/profile')) return 'profile';
    if (pathname.startsWith('/home'))    return 'home';
    return 'home';
  }

  const current = activeTab();

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '60px',
        background: 'rgba(18,16,14,0.96)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid #332e28',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 0,
          width: '100%',
          maxWidth: '480px',
        }}
      >
        {TABS.map((tab) => {
          const isActive = tab.id === current || (tab.id === 'discover' && current === 'home' && tab.href === '/home');

          return (
            <motion.button
              key={tab.id}
              onClick={() => router.push(tab.href)}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              style={{
                flex: 1,
                height: '60px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                position: 'relative',
              }}
            >
              <span style={{ fontSize: '20px', lineHeight: 1 }}>{tab.icon}</span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: isActive ? '#c9622a' : '#7a7060',
                  transition: 'color 0.15s',
                }}
              >
                {tab.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="nav-dot"
                  style={{
                    position: 'absolute',
                    bottom: '6px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    background: '#c9622a',
                  }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
