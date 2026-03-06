'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

// ─── Data ─────────────────────────────────────────────────────────────────────

const CUISINES = [
  { id: 'cantonese',   emoji: '🍜', label: 'Cantonese' },
  { id: 'hotpot',      emoji: '🫕', label: 'Hot Pot' },
  { id: 'japanese',    emoji: '🍣', label: 'Japanese' },
  { id: 'korean',      emoji: '🇰🇷', label: 'Korean' },
  { id: 'western',     emoji: '🍕', label: 'Western' },
  { id: 'se_asian',    emoji: '🥘', label: 'SE Asian' },
  { id: 'indian',      emoji: '🇮🇳', label: 'Indian' },
  { id: 'cafe',        emoji: '☕', label: 'Café / Brunch' },
  { id: 'bar_bites',   emoji: '🍻', label: 'Bar Bites' },
  { id: 'dessert',     emoji: '🍡', label: 'Dessert' },
  { id: 'fast_casual', emoji: '🍔', label: 'Fast Casual' },
  { id: 'other_asian', emoji: '🌏', label: 'Other Asian' },
];

const DIETARY = [
  { id: 'none',          emoji: '✓',  label: 'No restrictions' },
  { id: 'vegetarian',    emoji: '🥗', label: 'Vegetarian' },
  { id: 'vegan',         emoji: '🌱', label: 'Vegan' },
  { id: 'halal',         emoji: '🌙', label: 'Halal' },
  { id: 'no_pork',       emoji: '🚫', label: 'No Pork' },
  { id: 'gluten_free',   emoji: '🌾', label: 'Gluten-free' },
  { id: 'dairy_free',    emoji: '🥛', label: 'Dairy-free' },
  { id: 'nut_free',      emoji: '🥜', label: 'Nut-free' },
  { id: 'shellfish_free',emoji: '🦐', label: 'Shellfish-free' },
];

const BUDGETS = [
  { id: 'budget',   tier: '$',    name: 'Budget',      desc: 'Under HK$100 · Cha chaan tengs, dai pai dongs' },
  { id: 'midrange', tier: '$$',   name: 'Mid-range',   desc: 'HK$100–250 · Most casual restaurants' },
  { id: 'special',  tier: '$$$',  name: 'Special',     desc: 'HK$250–500 · Nicer nights out' },
  { id: 'fine',     tier: '$$$$', name: 'Fine Dining', desc: 'HK$500+ · The special ones' },
];

const MEAL_TIMES = [
  { id: 'breakfast',     emoji: '🌅', label: 'Breakfast',     desc: 'before 11am' },
  { id: 'brunch',        emoji: '🥞', label: 'Brunch',        desc: '10am – 2pm' },
  { id: 'lunch',         emoji: '🍱', label: 'Lunch',         desc: '12 – 3pm' },
  { id: 'afternoon_tea', emoji: '🫖', label: 'Afternoon Tea', desc: '2 – 5pm' },
  { id: 'dinner',        emoji: '🍽️', label: 'Dinner',        desc: '6 – 10pm' },
  { id: 'late_night',    emoji: '🌃', label: 'Late Night',    desc: 'after 10pm' },
  { id: 'drinks',        emoji: '🍻', label: 'Drinks & Bar',  desc: '' },
];

const RADII = [
  { id: '500',  label: '500m',             sub: 'Walking distance',  metres: 500,   icon: null },
  { id: '1000', label: '1 km',             sub: 'Easy stroll',       metres: 1000,  icon: null },
  { id: '2000', label: '2 km',             sub: 'Short ride',        metres: 2000,  icon: null },
  { id: '5000', label: '5 km',             sub: 'Worth travelling',  metres: 5000,  icon: null },
  { id: 'mtr',  label: 'Near any MTR',     sub: 'MTR accessible',    metres: 99999, icon: '🚇' },
];

const STEPS = [
  { title: 'What are you into?',                 sub: "Pick everything you love. We'll surface hidden gems that match." },
  { title: 'Any needs we should know about?',    sub: "We'll make sure every gem works for you." },
  { title: "What's your usual spend per person?",sub: "We'll show you gems within your comfort zone." },
  { title: 'When are you usually eating?',       sub: 'Helps us match gems that are actually open.' },
  { title: 'How far will you travel?',           sub: "We'll filter nearby hidden gems to this range." },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Selections {
  cuisines: string[];
  dietary: string[];
  budgets: string[];
  mealTimes: string[];
  radius: number | null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <h2
        style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: 'clamp(24px, 5vw, 32px)',
          color: '#f0e8d8',
          margin: '0 0 10px',
          lineHeight: 1.25,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 300,
          fontSize: '15px',
          color: '#7a7060',
          margin: 0,
          lineHeight: 1.6,
        }}
      >
        {sub}
      </p>
    </div>
  );
}

function Tile({
  emoji,
  label,
  selected,
  onClick,
  center = true,
}: {
  emoji?: string;
  label: string;
  selected: boolean;
  onClick: () => void;
  center?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: selected
          ? 'rgba(201,98,42,0.08)'
          : hovered
          ? '#221e1a'
          : '#1a1714',
        border: `${selected ? 2 : 1}px solid ${
          selected ? '#c9622a' : hovered ? '#3d3730' : '#332e28'
        }`,
        borderRadius: '8px',
        padding: '16px 12px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: center ? 'center' : 'flex-start',
        gap: '8px',
        transition: 'background 0.15s, border-color 0.15s',
        textAlign: center ? 'center' : 'left',
        width: '100%',
      }}
    >
      {emoji && (
        <span style={{ fontSize: '26px', lineHeight: 1 }}>{emoji}</span>
      )}
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          fontSize: '13px',
          color: selected ? '#c9622a' : '#f0e8d8',
          lineHeight: 1.3,
          transition: 'color 0.15s',
        }}
      >
        {label}
      </span>
    </button>
  );
}

function BudgetTile({
  tier,
  name,
  desc,
  selected,
  onClick,
}: {
  tier: string;
  name: string;
  desc: string;
  selected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: selected
          ? 'rgba(201,98,42,0.08)'
          : hovered
          ? '#221e1a'
          : '#1a1714',
        border: `${selected ? 2 : 1}px solid ${
          selected ? '#c9622a' : hovered ? '#3d3730' : '#332e28'
        }`,
        borderRadius: '8px',
        padding: '20px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '6px',
        transition: 'background 0.15s, border-color 0.15s',
        textAlign: 'left',
        minHeight: '110px',
        width: '100%',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '16px',
          letterSpacing: '0.05em',
          color: selected ? '#c9622a' : '#c4922a',
          transition: 'color 0.15s',
        }}
      >
        {tier}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 600,
          fontSize: '15px',
          color: selected ? '#c9622a' : '#f0e8d8',
          transition: 'color 0.15s',
        }}
      >
        {name}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 300,
          fontSize: '12px',
          color: '#7a7060',
          lineHeight: 1.5,
        }}
      >
        {desc}
      </span>
    </button>
  );
}

function RadiusPill({
  label,
  sub,
  icon,
  selected,
  onClick,
}: {
  label: string;
  sub: string;
  icon: string | null;
  selected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flexShrink: 0,
        background: selected
          ? 'rgba(201,98,42,0.08)'
          : hovered
          ? '#221e1a'
          : '#1a1714',
        border: `${selected ? 2 : 1}px solid ${
          selected ? '#c9622a' : hovered ? '#3d3730' : '#332e28'
        }`,
        borderRadius: '8px',
        padding: '20px 24px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        minWidth: '120px',
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {icon && <span style={{ fontSize: '24px' }}>{icon}</span>}
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '15px',
          fontWeight: 500,
          color: selected ? '#c9622a' : '#f0e8d8',
          letterSpacing: '0.03em',
          transition: 'color 0.15s',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 300,
          fontSize: '11px',
          color: '#7a7060',
        }}
      >
        {sub}
      </span>
    </button>
  );
}

// ─── Slide animation variants ─────────────────────────────────────────────────

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -60 : 60,
    opacity: 0,
  }),
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [[step, direction], setStep] = useState<[number, number]>([0, 1]);
  const [selections, setSelections] = useState<Selections>({
    cuisines: [],
    dietary: [],
    budgets: [],
    mealTimes: [],
    radius: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const TOTAL = 5;

  function toggle(
    field: 'cuisines' | 'dietary' | 'budgets' | 'mealTimes',
    id: string
  ) {
    setSelections((prev) => ({
      ...prev,
      [field]: prev[field].includes(id)
        ? prev[field].filter((x) => x !== id)
        : [...prev[field], id],
    }));
  }

  function setRadius(metres: number) {
    setSelections((prev) => ({ ...prev, radius: metres }));
  }

  function canContinue(): boolean {
    switch (step) {
      case 0: return selections.cuisines.length > 0;
      case 1: return selections.dietary.length > 0;
      case 2: return selections.budgets.length > 0;
      case 3: return selections.mealTimes.length > 0;
      case 4: return selections.radius !== null;
      default: return false;
    }
  }

  function goNext() {
    if (!canContinue()) return;
    if (step < TOTAL - 1) {
      setStep([step + 1, 1]);
    } else {
      handleSubmit();
    }
  }

  function goBack() {
    if (step > 0) setStep([step - 1, -1]);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth');
        return;
      }

      // Ensure profile row exists BEFORE preferences (preferences has a FK to profiles)
      const { error: profileErr } = await supabase
        .from('profiles')
        .upsert(
          {
            id:           user.id,
            display_name: (user.user_metadata?.full_name as string | undefined) ?? null,
            avatar_url:   (user.user_metadata?.avatar_url  as string | undefined) ?? null,
          },
          { onConflict: 'id', ignoreDuplicates: true }
        );
      if (profileErr) console.error('[onboarding] profiles upsert error:', profileErr.message);

      // Save preferences (upsert — re-doing onboarding is allowed)
      const { error: prefErr } = await supabase
        .from('preferences')
        .upsert(
          {
            user_id: user.id,
            cuisines: selections.cuisines,
            dietary: selections.dietary,
            budget_levels: selections.budgets,
            meal_times: selections.mealTimes,
            radius_metres: selections.radius ?? 1500,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (prefErr) throw prefErr;

      router.push('/home');
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : 'Something went wrong — try again.'
      );
      setSubmitting(false);
    }
  }

  // ── Step content ────────────────────────────────────────────────────────────

  function renderContent() {
    const meta = STEPS[step];

    switch (step) {
      // Step 1 — Cuisines
      case 0:
        return (
          <>
            <StepHeader title={meta.title} sub={meta.sub} />
            <div
              className="grid gap-3"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
              }}
            >
              {CUISINES.map((c) => (
                <Tile
                  key={c.id}
                  emoji={c.emoji}
                  label={c.label}
                  selected={selections.cuisines.includes(c.id)}
                  onClick={() => toggle('cuisines', c.id)}
                />
              ))}
            </div>
          </>
        );

      // Step 2 — Dietary
      case 1:
        return (
          <>
            <StepHeader title={meta.title} sub={meta.sub} />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
              }}
            >
              {DIETARY.map((d) => (
                <Tile
                  key={d.id}
                  emoji={d.emoji}
                  label={d.label}
                  selected={selections.dietary.includes(d.id)}
                  onClick={() => toggle('dietary', d.id)}
                />
              ))}
            </div>
          </>
        );

      // Step 3 — Budget
      case 2:
        return (
          <>
            <StepHeader title={meta.title} sub={meta.sub} />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '10px',
              }}
            >
              {BUDGETS.map((b) => (
                <BudgetTile
                  key={b.id}
                  tier={b.tier}
                  name={b.name}
                  desc={b.desc}
                  selected={selections.budgets.includes(b.id)}
                  onClick={() => toggle('budgets', b.id)}
                />
              ))}
            </div>
          </>
        );

      // Step 4 — Meal times
      case 3:
        return (
          <>
            <StepHeader title={meta.title} sub={meta.sub} />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '10px',
              }}
            >
              {MEAL_TIMES.map((m) => (
                <div
                  key={m.id}
                  style={{ display: 'flex', flexDirection: 'column' }}
                >
                  <button
                    onClick={() => toggle('mealTimes', m.id)}
                    style={{
                      background: selections.mealTimes.includes(m.id)
                        ? 'rgba(201,98,42,0.08)'
                        : '#1a1714',
                      border: `${
                        selections.mealTimes.includes(m.id) ? 2 : 1
                      }px solid ${
                        selections.mealTimes.includes(m.id)
                          ? '#c9622a'
                          : '#332e28'
                      }`,
                      borderRadius: '8px',
                      padding: '16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      textAlign: 'left',
                      transition: 'background 0.15s, border-color 0.15s',
                      width: '100%',
                    }}
                  >
                    <span style={{ fontSize: '22px', flexShrink: 0 }}>
                      {m.emoji}
                    </span>
                    <div>
                      <div
                        style={{
                          fontFamily: 'var(--font-sans)',
                          fontWeight: 500,
                          fontSize: '13px',
                          color: selections.mealTimes.includes(m.id)
                            ? '#c9622a'
                            : '#f0e8d8',
                          transition: 'color 0.15s',
                        }}
                      >
                        {m.label}
                      </div>
                      {m.desc && (
                        <div
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '10px',
                            color: '#7a7060',
                            letterSpacing: '0.03em',
                            marginTop: '2px',
                          }}
                        >
                          {m.desc}
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </>
        );

      // Step 5 — Radius
      case 4:
        return (
          <>
            <StepHeader title={meta.title} sub={meta.sub} />
            <div
              style={{
                overflowX: 'auto',
                paddingBottom: '8px',
                marginLeft: '-24px',
                paddingLeft: '24px',
                marginRight: '-24px',
                paddingRight: '24px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  width: 'max-content',
                }}
              >
                {RADII.map((r) => (
                  <RadiusPill
                    key={r.id}
                    label={r.label}
                    sub={r.sub}
                    icon={r.icon}
                    selected={selections.radius === r.metres}
                    onClick={() => setRadius(r.metres)}
                  />
                ))}
              </div>
            </div>

            {/* Radius context line */}
            <div
              style={{
                marginTop: '28px',
                padding: '16px',
                background: '#1a1714',
                border: '1px solid #332e28',
                borderRadius: '8px',
                fontFamily: 'var(--font-sans)',
                fontWeight: 300,
                fontSize: '13px',
                color: '#7a7060',
                lineHeight: 1.6,
              }}
            >
              ✦ We use this to filter gems on Google Maps &amp; within our curated list — you can always change it per session.
            </div>
          </>
        );

      default:
        return null;
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const isReady = canContinue() && !submitting;

  return (
    <div
      style={{
        height: '100dvh',
        background: '#12100e',
        color: '#f0e8d8',
        fontFamily: 'var(--font-sans)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── Progress bar ── */}
      <div style={{ height: '3px', background: '#332e28', flexShrink: 0 }}>
        <motion.div
          style={{ height: '100%', background: '#c9622a', transformOrigin: 'left' }}
          animate={{ width: `${((step + 1) / TOTAL) * 100}%` }}
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        />
      </div>

      {/* ── Nav row ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 24px',
          flexShrink: 0,
        }}
      >
        <AnimatePresence>
          {step > 0 ? (
            <motion.button
              key="back"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              onClick={goBack}
              style={{
                background: 'none',
                border: 'none',
                color: '#7a7060',
                cursor: 'pointer',
                fontSize: '22px',
                padding: '4px 8px 4px 0',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              ←
            </motion.button>
          ) : (
            <div style={{ width: '32px' }} />
          )}
        </AnimatePresence>

        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: '#7a7060',
            letterSpacing: '0.08em',
          }}
        >
          {step + 1} of {TOTAL}
        </span>
      </div>

      {/* ── Step content ── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 24px 0',
        }}
      >
        <div
          style={{
            maxWidth: '560px',
            margin: '0 auto',
            width: '100%',
          }}
        >
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ paddingBottom: '32px' }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── CTA footer ── */}
      <div
        style={{
          flexShrink: 0,
          background: '#12100e',
          borderTop: '1px solid #332e28',
          padding: '16px 24px 20px',
        }}
      >
        <div style={{ maxWidth: '560px', margin: '0 auto', width: '100%' }}>
          {submitError && (
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: '#c9622a',
                marginBottom: '10px',
                letterSpacing: '0.03em',
              }}
            >
              {submitError}
            </p>
          )}
          <motion.button
            onClick={goNext}
            disabled={!isReady}
            animate={{
              background: isReady ? '#c9622a' : '#2a2520',
            }}
            whileHover={isReady ? { background: '#e07840' } : {}}
            transition={{ duration: 0.2 }}
            style={{
              width: '100%',
              height: '52px',
              border: 'none',
              borderRadius: '4px',
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              fontSize: '16px',
              color: isReady ? '#f0e8d8' : '#7a7060',
              cursor: isReady ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting
              ? 'Saving your taste…'
              : step === TOTAL - 1
              ? 'Find My Hidden Gems ✦'
              : 'Continue →'}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
