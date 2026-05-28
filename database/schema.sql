CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    is_private BOOLEAN DEFAULT FALSE,
    pin_code TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lat NUMERIC(10, 8) NOT NULL,
    lng NUMERIC(11, 8) NOT NULL,
    text TEXT,
    media_type TEXT DEFAULT 'none',
    media_url TEXT,
    lifespan_days INTEGER DEFAULT 30,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pin_id UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pin_id, user_id, emoji)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_pins_group_id ON pins(group_id);
CREATE INDEX idx_pins_expires_at ON pins(expires_at);
CREATE INDEX idx_reactions_pin_id ON reactions(pin_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_all" ON users FOR SELECT USING (true);
CREATE POLICY "users_insert_own" ON users FOR INSERT WITH CHECK (true);

CREATE POLICY "groups_select_public" ON groups FOR SELECT USING (is_private = FALSE);
CREATE POLICY "groups_insert_any" ON groups FOR INSERT WITH CHECK (true);

CREATE POLICY "pins_select_active" ON pins FOR SELECT USING (
    expires_at IS NULL OR expires_at > NOW()
);
CREATE POLICY "pins_insert_any" ON pins FOR INSERT WITH CHECK (true);

CREATE POLICY "reactions_select_all" ON reactions FOR SELECT USING (true);
CREATE POLICY "reactions_insert_any" ON reactions FOR INSERT WITH CHECK (true);

-- ============================================
-- SEED DATA
-- ============================================

INSERT INTO groups (id, name, is_private)
VALUES ('00000000-0000-0000-0000-000000000001', 'Public Map', FALSE)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- CLEANUP FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_pins()
RETURNS void AS $$
BEGIN
    DELETE FROM pins WHERE expires_at IS NOT NULL AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
