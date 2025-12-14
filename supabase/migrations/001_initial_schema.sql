-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Note: Realtime is a separate service in Supabase, not a PostgreSQL extension
-- Realtime is automatically enabled for tables in the public schema

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

-- Enable Row Level Security (RLS)
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE face_card_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE numbered_card_prompts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for games table
-- Anyone can read games (needed for joining with code)
CREATE POLICY "Games are viewable by everyone" ON games
    FOR SELECT USING (true);

-- Authenticated users can create games
CREATE POLICY "Authenticated users can create games" ON games
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Game creators can update their games
CREATE POLICY "Game creators can update their games" ON games
    FOR UPDATE USING (auth.uid() = created_by);

-- RLS Policies for players table
-- Anyone can read players in a game
CREATE POLICY "Players are viewable by everyone" ON players
    FOR SELECT USING (true);

-- Anyone can insert players (for anonymous joining)
CREATE POLICY "Anyone can create players" ON players
    FOR INSERT WITH CHECK (true);

-- Players can update their own player record
CREATE POLICY "Players can update themselves" ON players
    FOR UPDATE USING (
        auth.uid() = user_id OR
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

-- Players can create turns for themselves
CREATE POLICY "Players can create turns" ON turns
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM players 
            WHERE players.id = turns.player_id 
            AND (players.user_id = auth.uid() OR auth.role() = 'authenticated')
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

