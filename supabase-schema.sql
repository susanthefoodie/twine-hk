-- ============================================================
-- TWINE HK — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================


-- ============================================================
-- TABLES
-- ============================================================

-- profiles: one row per auth user, created on sign-up
CREATE TABLE IF NOT EXISTS profiles (
  id                 uuid        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email              text,
  display_name       text,
  avatar_url         text,
  is_pro             boolean     NOT NULL DEFAULT false,
  preferred_language text        NOT NULL DEFAULT 'en',
  gems_found         integer     NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- preferences: per-user discovery filter settings
CREATE TABLE IF NOT EXISTS preferences (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  cuisines       text[],
  dietary        text[],
  budget_levels  text[],
  meal_times     text[],
  radius_metres  integer     NOT NULL DEFAULT 1500,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- sessions: a swipe session (couples / friends / solo)
CREATE TABLE IF NOT EXISTS sessions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  mode              text        NOT NULL CHECK (mode IN ('couples', 'friends', 'solo')),
  host_user_id      uuid        REFERENCES profiles (id),
  share_code        text        NOT NULL UNIQUE,
  filters           jsonb       NOT NULL DEFAULT '{}',
  status            text        NOT NULL DEFAULT 'active',
  city              text        NOT NULL DEFAULT 'hong_kong',
  participant_count integer     NOT NULL DEFAULT 1,
  created_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL DEFAULT now() + interval '6 hours'
);

-- session_participants: everyone in a session (auth users or guests)
CREATE TABLE IF NOT EXISTS session_participants (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid        NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  user_id      uuid        REFERENCES profiles (id),
  guest_name   text,
  avatar_color text,
  joined_at    timestamptz NOT NULL DEFAULT now()
);

-- swipes: each left/right decision by a participant
CREATE TABLE IF NOT EXISTS swipes (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           uuid        NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  user_id              uuid        REFERENCES profiles (id),
  guest_participant_id uuid        REFERENCES session_participants (id),
  place_id             text        NOT NULL,
  direction            text        NOT NULL CHECK (direction IN ('right', 'left')),
  place_name           text,
  swiped_at            timestamptz NOT NULL DEFAULT now()
);

-- matches: places where ALL participants swiped right
CREATE TABLE IF NOT EXISTS matches (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid        NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  place_id     text        NOT NULL,
  place_data   jsonb       NOT NULL,
  match_score  integer     NOT NULL DEFAULT 0,
  is_visited   boolean     NOT NULL DEFAULT false,
  visit_note   text,
  user_rating  integer,
  matched_at   timestamptz NOT NULL DEFAULT now()
);

-- saved_places: user's personal saved/favourites list
CREATE TABLE IF NOT EXISTS saved_places (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  place_id   text        NOT NULL,
  place_data jsonb       NOT NULL,
  list_name  text        NOT NULL DEFAULT 'Favourites',
  is_visited boolean     NOT NULL DEFAULT false,
  saved_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, place_id)
);

-- featured_restaurants: B2B restaurant promotion tiers
CREATE TABLE IF NOT EXISTS featured_restaurants (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id        text    UNIQUE,
  restaurant_name text,
  district        text,
  plan_tier       text    CHECK (plan_tier IN ('starter', 'featured', 'premium')),
  monthly_fee_hkd integer,
  is_active       boolean NOT NULL DEFAULT true,
  plan_start      date,
  plan_end        date,
  contact_email   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferences           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_participants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE swipes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches               ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_places          ENABLE ROW LEVEL SECURITY;
ALTER TABLE featured_restaurants  ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- RLS POLICIES — profiles
-- ============================================================

CREATE POLICY "profiles: users read own row"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles: users insert own row"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles: users update own row"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- ============================================================
-- RLS POLICIES — preferences
-- ============================================================

CREATE POLICY "preferences: users read own"
  ON preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "preferences: users insert own"
  ON preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "preferences: users update own"
  ON preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ============================================================
-- RLS POLICIES — sessions
-- ============================================================

-- A user can see a session if they are the host or a participant
CREATE POLICY "sessions: participants can read"
  ON sessions FOR SELECT
  TO authenticated
  USING (
    host_user_id = auth.uid()
    OR id IN (
      SELECT session_id FROM session_participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "sessions: authenticated users can create"
  ON sessions FOR INSERT
  TO authenticated
  WITH CHECK (host_user_id = auth.uid());

CREATE POLICY "sessions: host can update"
  ON sessions FOR UPDATE
  TO authenticated
  USING (host_user_id = auth.uid())
  WITH CHECK (host_user_id = auth.uid());


-- ============================================================
-- RLS POLICIES — session_participants
-- ============================================================

-- Anyone in the session can see all participants in that session
CREATE POLICY "session_participants: members can read"
  ON session_participants FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT session_id FROM session_participants WHERE user_id = auth.uid()
      UNION
      SELECT id FROM sessions WHERE host_user_id = auth.uid()
    )
  );

CREATE POLICY "session_participants: authenticated users can join"
  ON session_participants FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());


-- ============================================================
-- RLS POLICIES — swipes
-- ============================================================

-- Users can see all swipes in sessions they belong to
CREATE POLICY "swipes: session members can read"
  ON swipes FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT session_id FROM session_participants WHERE user_id = auth.uid()
      UNION
      SELECT id FROM sessions WHERE host_user_id = auth.uid()
    )
  );

CREATE POLICY "swipes: users insert own"
  ON swipes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());


-- ============================================================
-- RLS POLICIES — matches
-- ============================================================

CREATE POLICY "matches: session members can read"
  ON matches FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT session_id FROM session_participants WHERE user_id = auth.uid()
      UNION
      SELECT id FROM sessions WHERE host_user_id = auth.uid()
    )
  );

-- Matches are written only by the check_for_match() function via service role
CREATE POLICY "matches: service role can insert"
  ON matches FOR INSERT
  TO service_role
  WITH CHECK (true);


-- ============================================================
-- RLS POLICIES — saved_places
-- ============================================================

CREATE POLICY "saved_places: users read own"
  ON saved_places FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "saved_places: users insert own"
  ON saved_places FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "saved_places: users update own"
  ON saved_places FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "saved_places: users delete own"
  ON saved_places FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());


-- ============================================================
-- RLS POLICIES — featured_restaurants
-- ============================================================

-- Any authenticated user can read active featured restaurants
CREATE POLICY "featured_restaurants: authenticated can read"
  ON featured_restaurants FOR SELECT
  TO authenticated
  USING (true);

-- Only service_role (admin / backend) can write
CREATE POLICY "featured_restaurants: service role insert"
  ON featured_restaurants FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "featured_restaurants: service role update"
  ON featured_restaurants FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "featured_restaurants: service role delete"
  ON featured_restaurants FOR DELETE
  TO service_role
  USING (true);


-- ============================================================
-- FUNCTION: check_for_match
-- Checks whether ALL active participants in a session have
-- swiped RIGHT on a given place. If so, inserts into matches.
-- Call this from the /api/session/swipe route after inserting
-- the swipe row.
-- ============================================================

CREATE OR REPLACE FUNCTION check_for_match(
  p_session_id uuid,
  p_place_id   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER   -- runs as owner so it can bypass RLS when inserting into matches
AS $$
DECLARE
  v_participant_count integer;
  v_right_swipe_count integer;
  v_already_matched   boolean;
BEGIN
  -- How many participants are in this session?
  SELECT participant_count
    INTO v_participant_count
    FROM sessions
   WHERE id = p_session_id;

  -- Has this place already been matched in this session?
  SELECT EXISTS (
    SELECT 1 FROM matches
     WHERE session_id = p_session_id
       AND place_id   = p_place_id
  ) INTO v_already_matched;

  IF v_already_matched THEN
    RETURN;
  END IF;

  -- How many distinct participants swiped right on this place?
  -- Covers both authenticated users (user_id) and guests (guest_participant_id).
  SELECT COUNT(DISTINCT
    COALESCE(user_id::text, guest_participant_id::text)
  )
    INTO v_right_swipe_count
    FROM swipes
   WHERE session_id = p_session_id
     AND place_id   = p_place_id
     AND direction  = 'right';

  -- If everyone swiped right, create the match
  IF v_right_swipe_count >= v_participant_count THEN
    INSERT INTO matches (
      session_id,
      place_id,
      place_data,
      match_score
    )
    VALUES (
      p_session_id,
      p_place_id,
      '{}'::jsonb,          -- place_data is enriched by the API route before/after calling this
      v_right_swipe_count
    )
    ON CONFLICT DO NOTHING; -- guard against race conditions
  END IF;
END;
$$;
