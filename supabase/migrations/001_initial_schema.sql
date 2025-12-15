-- ============================================================================
-- Consolidated Migration: Initial Schema with Anonymous Authentication
-- ============================================================================
-- This migration consolidates all previous migrations and implements
-- anonymous authentication support. Anonymous users now have proper auth.uid()
-- values, simplifying RLS policies to use a single pattern: user_id = auth.uid()
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Games table
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    current_phase INTEGER NOT NULL DEFAULT 0 CHECK (current_phase >= 0 AND current_phase <= 4),
    ten_flag BOOLEAN NOT NULL DEFAULT false,
    focused_flag BOOLEAN NOT NULL DEFAULT false,
    cycle INTEGER NOT NULL DEFAULT 1 CHECK (cycle >= 1 AND cycle <= 4),
    roll INTEGER CHECK (roll >= 1 AND roll <= 6),
    play_length TEXT CHECK (play_length IN ('Days', 'Weeks', 'Years', 'Decades', 'Centuries', 'Millennia')),
    location TEXT NOT NULL DEFAULT '',
    selected_tens TEXT[] DEFAULT ARRAY[]::TEXT[],
    confirmed_player_ids UUID[] DEFAULT ARRAY[]::UUID[],
    players_ready_to_end_phase UUID[] DEFAULT ARRAY[]::UUID[],
    current_turn_player_id UUID,
    last_turn_player_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes on games table
CREATE INDEX idx_games_code ON games(code);
CREATE INDEX idx_games_title ON games(title);

-- Players table
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    turn_order INTEGER NOT NULL,
    connected BOOLEAN NOT NULL DEFAULT true,
    confirm_location BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(game_id, turn_order)
);

-- Create index on game_id for faster queries
CREATE INDEX idx_players_game_id ON players(game_id);

-- Add foreign key constraints for games table
ALTER TABLE games ADD CONSTRAINT fk_games_current_turn_player 
    FOREIGN KEY (current_turn_player_id) REFERENCES players(id) ON DELETE SET NULL;
ALTER TABLE games ADD CONSTRAINT fk_games_last_turn_player 
    FOREIGN KEY (last_turn_player_id) REFERENCES players(id) ON DELETE SET NULL;

-- Face card prompts table (Phase 2 - Establishing)
CREATE TABLE face_card_prompts (
    id INTEGER PRIMARY KEY CHECK (id >= 1 AND id <= 12),
    prompt TEXT NOT NULL
);

-- Numbered card prompts table (Phase 3 - Drawing Cards)
CREATE TABLE numbered_card_prompts (
    id SERIAL PRIMARY KEY,
    card_number INTEGER NOT NULL CHECK (card_number >= 2 AND card_number <= 9),
    draw_order INTEGER NOT NULL CHECK (draw_order >= 1 AND draw_order <= 4),
    prompt TEXT NOT NULL,
    UNIQUE(card_number, draw_order)
);

-- Turns table (tracks drawn cards and prompts)
CREATE TABLE turns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    face_prompt_id INTEGER REFERENCES face_card_prompts(id),
    card_number INTEGER CHECK (card_number >= 2 AND card_number <= 9),
    draw_order INTEGER CHECK (draw_order >= 1 AND draw_order <= 4),
    numbered_prompt_id INTEGER REFERENCES numbered_card_prompts(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (face_prompt_id IS NOT NULL AND card_number IS NULL AND draw_order IS NULL AND numbered_prompt_id IS NULL) OR
        (face_prompt_id IS NULL AND card_number IS NOT NULL AND draw_order IS NOT NULL AND numbered_prompt_id IS NOT NULL)
    )
);

-- Create indexes for turns table
CREATE INDEX idx_turns_game_id ON turns(game_id);
CREATE INDEX idx_turns_player_id ON turns(player_id);
CREATE INDEX idx_turns_face_prompt_id ON turns(face_prompt_id) WHERE face_prompt_id IS NOT NULL;
CREATE INDEX idx_turns_card_number ON turns(card_number) WHERE card_number IS NOT NULL;

-- Create unique indexes for turns table (partial unique constraints)
-- Unique constraint for face cards: each prompt can only be drawn once per game
CREATE UNIQUE INDEX idx_turns_unique_face_card 
    ON turns(game_id, face_prompt_id) 
    WHERE face_prompt_id IS NOT NULL;

-- Unique constraint for numbered cards: each card+draw_order combo can only be drawn once per game
CREATE UNIQUE INDEX idx_turns_unique_numbered_card 
    ON turns(game_id, card_number, draw_order) 
    WHERE card_number IS NOT NULL AND draw_order IS NOT NULL;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on games table
CREATE TRIGGER update_games_updated_at
    BEFORE UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to allow players to confirm their location
-- This function validates that the player belongs to the game and adds them to confirmed_player_ids
-- Uses SECURITY DEFINER to allow updates to games table even for anonymous users
CREATE OR REPLACE FUNCTION confirm_player_location(game_id_param UUID, player_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    player_exists BOOLEAN;
    already_confirmed BOOLEAN;
BEGIN
    -- Verify the player exists and belongs to this game
    SELECT EXISTS (
        SELECT 1 FROM players 
        WHERE id = player_id_param 
        AND game_id = game_id_param
    ) INTO player_exists;
    
    IF NOT player_exists THEN
        RAISE EXCEPTION 'Player does not belong to this game';
    END IF;
    
    -- Check if already confirmed
    SELECT player_id_param = ANY(confirmed_player_ids) INTO already_confirmed
    FROM games WHERE id = game_id_param;
    
    IF already_confirmed THEN
        RETURN TRUE; -- Already confirmed, return success
    END IF;
    
    -- Add player to confirmed list
    UPDATE games 
    SET confirmed_player_ids = array_append(confirmed_player_ids, player_id_param),
        updated_at = NOW()
    WHERE id = game_id_param;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION confirm_player_location(UUID, UUID) TO authenticated, anon;

-- Function to allow players to unconfirm their location
-- This function validates that the player belongs to the game and removes them from confirmed_player_ids
CREATE OR REPLACE FUNCTION unconfirm_player_location(game_id_param UUID, player_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    player_exists BOOLEAN;
BEGIN
    -- Verify the player exists and belongs to this game
    SELECT EXISTS (
        SELECT 1 FROM players 
        WHERE id = player_id_param 
        AND game_id = game_id_param
    ) INTO player_exists;
    
    IF NOT player_exists THEN
        RAISE EXCEPTION 'Player does not belong to this game';
    END IF;
    
    -- Remove player from confirmed list
    UPDATE games 
    SET confirmed_player_ids = array_remove(confirmed_player_ids, player_id_param),
        updated_at = NOW()
    WHERE id = game_id_param;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION unconfirm_player_location(UUID, UUID) TO authenticated, anon;

-- Function to allow players to indicate they're ready to end the phase
-- This function validates that the player belongs to the game and adds them to players_ready_to_end_phase
-- If all players agree, automatically ends the phase
CREATE OR REPLACE FUNCTION ready_to_end_phase(game_id_param UUID, player_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    player_exists BOOLEAN;
    already_ready BOOLEAN;
    all_players_ready BOOLEAN;
    total_players INTEGER;
    ready_count INTEGER;
BEGIN
    -- Verify the player exists and belongs to this game
    SELECT EXISTS (
        SELECT 1 FROM players 
        WHERE id = player_id_param 
        AND game_id = game_id_param
    ) INTO player_exists;
    
    IF NOT player_exists THEN
        RAISE EXCEPTION 'Player does not belong to this game';
    END IF;
    
    -- Check if already ready
    SELECT player_id_param = ANY(players_ready_to_end_phase) INTO already_ready
    FROM games WHERE id = game_id_param;
    
    IF already_ready THEN
        RETURN TRUE; -- Already ready, return success
    END IF;
    
    -- Add player to ready list
    UPDATE games 
    SET players_ready_to_end_phase = array_append(players_ready_to_end_phase, player_id_param),
        updated_at = NOW()
    WHERE id = game_id_param;
    
    -- Check if all players are ready (after adding this player)
    SELECT COUNT(*) INTO total_players
    FROM players
    WHERE game_id = game_id_param;
    
    SELECT array_length(players_ready_to_end_phase, 1) INTO ready_count
    FROM games
    WHERE id = game_id_param;
    
    -- If all players are ready, end the phase (move to phase 3)
    -- Note: ready_count includes the player we just added
    IF ready_count >= total_players AND total_players > 0 THEN
        UPDATE games
        SET current_phase = 3,
            players_ready_to_end_phase = ARRAY[]::UUID[],
            updated_at = NOW()
        WHERE id = game_id_param;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION ready_to_end_phase(UUID, UUID) TO authenticated, anon;

-- Function to allow players to unready (remove themselves from ready list)
CREATE OR REPLACE FUNCTION unready_to_end_phase(game_id_param UUID, player_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    player_exists BOOLEAN;
BEGIN
    -- Verify the player exists and belongs to this game
    SELECT EXISTS (
        SELECT 1 FROM players 
        WHERE id = player_id_param 
        AND game_id = game_id_param
    ) INTO player_exists;
    
    IF NOT player_exists THEN
        RAISE EXCEPTION 'Player does not belong to this game';
    END IF;
    
    -- Remove player from ready list
    UPDATE games 
    SET players_ready_to_end_phase = array_remove(players_ready_to_end_phase, player_id_param),
        updated_at = NOW()
    WHERE id = game_id_param;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION unready_to_end_phase(UUID, UUID) TO authenticated, anon;

-- Enable Row Level Security (RLS)
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE face_card_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE numbered_card_prompts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES - Simplified for Anonymous Authentication
-- ============================================================================
-- All policies now use the simple pattern: user_id = auth.uid()
-- This works for both anonymous users (who have auth.uid()) and authenticated users
-- ============================================================================

-- RLS Policies for games table
-- Anyone can read games (needed for joining with code)
CREATE POLICY "Games are viewable by everyone" ON games
    FOR SELECT USING (true);

-- Authenticated users (including anonymous) can create games
-- Note: Anonymous users typically won't create games, but this allows it
CREATE POLICY "Authenticated users can create games" ON games
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Players can update game state (server validates permissions)
-- This allows anonymous and authenticated players to update game state
-- Server-side code validates that only appropriate players can update specific fields
CREATE POLICY "Players can update game state" ON games
    FOR UPDATE USING (true) WITH CHECK (true);

-- RLS Policies for players table
-- Anyone can read players in a game
CREATE POLICY "Players are viewable by everyone" ON players
    FOR SELECT USING (true);

-- Anyone can insert players (for anonymous and authenticated joining)
CREATE POLICY "Anyone can create players" ON players
    FOR INSERT WITH CHECK (true);

-- Players can update themselves (simplified: user_id = auth.uid())
-- This works for both anonymous and authenticated users
CREATE POLICY "Players can update themselves" ON players
    FOR UPDATE USING (user_id = auth.uid());

-- Game creators can delete players from their games
CREATE POLICY "Game creators can delete players" ON players
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM games 
            WHERE games.id = players.game_id 
            AND games.created_by = auth.uid()
        )
    );

-- RLS Policies for turns table
-- Anyone can read turns in a game
CREATE POLICY "Turns are viewable by everyone" ON turns
    FOR SELECT USING (true);

-- Players can create turns for themselves (simplified: user_id = auth.uid())
-- This works for both anonymous and authenticated users
CREATE POLICY "Players can create turns" ON turns
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM players 
            WHERE players.id = turns.player_id 
            AND players.user_id = auth.uid()
        )
    );

-- RLS Policies for face_card_prompts table
-- Anyone can read prompts
CREATE POLICY "Face card prompts are viewable by everyone" ON face_card_prompts
    FOR SELECT USING (true);

-- RLS Policies for numbered_card_prompts table
-- Anyone can read prompts
CREATE POLICY "Numbered card prompts are viewable by everyone" ON numbered_card_prompts
    FOR SELECT USING (true);

-- Seed face card prompts (Phase 2 - Establishing prompts)
INSERT INTO face_card_prompts (id, prompt) VALUES
(1, 'What is the history of this place?'),
(2, 'What is the geography of this place?'),
(3, 'What is the culture of this place?'),
(4, 'What is the economy of this place?'),
(5, 'What is the politics of this place?'),
(6, 'What is the religion of this place?'),
(7, 'What is the technology of this place?'),
(8, 'What is the art of this place?'),
(9, 'What is the food of this place?'),
(10, 'What is the language of this place?'),
(11, 'What is the architecture of this place?'),
(12, 'What is the wildlife of this place?')
ON CONFLICT (id) DO NOTHING;

-- Seed numbered card prompts (Phase 3 - Drawing Cards)
-- Card 2 prompts
INSERT INTO numbered_card_prompts (card_number, draw_order, prompt) VALUES
(2, 1, 'What changes happen here over time?'),
(2, 2, 'What grows or develops in this place?'),
(2, 3, 'What decays or fades in this place?'),
(2, 4, 'What remains constant in this place?')
ON CONFLICT (card_number, draw_order) DO NOTHING;

-- Card 3 prompts
INSERT INTO numbered_card_prompts (card_number, draw_order, prompt) VALUES
(3, 1, 'Who lives here?'),
(3, 2, 'Who visits here?'),
(3, 3, 'Who avoids this place?'),
(3, 4, 'Who is remembered here?')
ON CONFLICT (card_number, draw_order) DO NOTHING;

-- Card 4 prompts
INSERT INTO numbered_card_prompts (card_number, draw_order, prompt) VALUES
(4, 1, 'What is hidden here?'),
(4, 2, 'What is revealed here?'),
(4, 3, 'What is forgotten here?'),
(4, 4, 'What is celebrated here?')
ON CONFLICT (card_number, draw_order) DO NOTHING;

-- Card 5 prompts
INSERT INTO numbered_card_prompts (card_number, draw_order, prompt) VALUES
(5, 1, 'What conflicts occur here?'),
(5, 2, 'What agreements are made here?'),
(5, 3, 'What compromises happen here?'),
(5, 4, 'What disputes arise here?')
ON CONFLICT (card_number, draw_order) DO NOTHING;

-- Card 6 prompts
INSERT INTO numbered_card_prompts (card_number, draw_order, prompt) VALUES
(6, 1, 'What is built here?'),
(6, 2, 'What is destroyed here?'),
(6, 3, 'What is repaired here?'),
(6, 4, 'What is abandoned here?')
ON CONFLICT (card_number, draw_order) DO NOTHING;

-- Card 7 prompts
INSERT INTO numbered_card_prompts (card_number, draw_order, prompt) VALUES
(7, 1, 'What is learned here?'),
(7, 2, 'What is taught here?'),
(7, 3, 'What is discovered here?'),
(7, 4, 'What is forgotten here?')
ON CONFLICT (card_number, draw_order) DO NOTHING;

-- Card 8 prompts
INSERT INTO numbered_card_prompts (card_number, draw_order, prompt) VALUES
(8, 1, 'What is created here?'),
(8, 2, 'What is destroyed here?'),
(8, 3, 'What is transformed here?'),
(8, 4, 'What is preserved here?')
ON CONFLICT (card_number, draw_order) DO NOTHING;

-- Card 9 prompts
INSERT INTO numbered_card_prompts (card_number, draw_order, prompt) VALUES
(9, 1, 'What is lost here?'),
(9, 2, 'What is found here?'),
(9, 3, 'What is sought here?'),
(9, 4, 'What is given up here?')
ON CONFLICT (card_number, draw_order) DO NOTHING;

-- Enable Supabase Realtime for tables
-- Add tables to the supabase_realtime publication so changes are broadcast
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE turns;

-- Enable REPLICA IDENTITY FULL for tables used with Supabase Realtime
-- This ensures UPDATE events include all columns, not just changed ones
ALTER TABLE games REPLICA IDENTITY FULL;
ALTER TABLE players REPLICA IDENTITY FULL;
ALTER TABLE turns REPLICA IDENTITY FULL;
