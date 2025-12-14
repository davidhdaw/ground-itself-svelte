-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Note: Realtime is a separate service in Supabase, not a PostgreSQL extension
-- Realtime is automatically enabled for tables in the public schema

-- Games table
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
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

-- Create index on game code for fast lookups
CREATE INDEX idx_games_code ON games(code);

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

-- Face card prompts table (reference data - static prompts)
CREATE TABLE face_card_prompts (
    id INTEGER PRIMARY KEY CHECK (id >= 1 AND id <= 12),
    prompt_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Numbered card prompts table (reference data - static prompts)
CREATE TABLE numbered_card_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_number INTEGER NOT NULL CHECK (card_number >= 2 AND card_number <= 9),
    draw_order INTEGER NOT NULL CHECK (draw_order >= 1 AND draw_order <= 4),
    prompt_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(card_number, draw_order)
);

-- Turns table (game events - tracks card draws)
CREATE TABLE turns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    turn_number INTEGER NOT NULL,
    drawn_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Face card fields (for Phase 2 - Establishing)
    face_prompt_id INTEGER REFERENCES face_card_prompts(id) ON DELETE RESTRICT,
    -- Numbered card fields (for Phase 3 - Drawing Cards)
    card_number INTEGER CHECK (card_number >= 2 AND card_number <= 9),
    draw_order INTEGER CHECK (draw_order >= 1 AND draw_order <= 4),
    -- Constraint: exactly one of face_prompt_id OR (card_number AND draw_order) must be set
    CONSTRAINT check_turn_type CHECK (
        (face_prompt_id IS NOT NULL AND card_number IS NULL AND draw_order IS NULL) OR
        (face_prompt_id IS NULL AND card_number IS NOT NULL AND draw_order IS NOT NULL)
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
CREATE POLICY "Anyone can join games as a player" ON players
    FOR INSERT WITH CHECK (true);

-- Players can update their own player record
CREATE POLICY "Players can update their own record" ON players
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        -- Allow updates if no user_id (anonymous players can update their own record)
        user_id IS NULL
    );

-- RLS Policies for turns table
-- Anyone can read turns in a game
CREATE POLICY "Turns are viewable by everyone" ON turns
    FOR SELECT USING (true);

-- Players can insert turns
CREATE POLICY "Players can create turns" ON turns
    FOR INSERT WITH CHECK (true);

-- RLS Policies for prompt tables (reference data - read-only for everyone)
CREATE POLICY "Face card prompts are viewable by everyone" ON face_card_prompts
    FOR SELECT USING (true);

CREATE POLICY "Numbered card prompts are viewable by everyone" ON numbered_card_prompts
    FOR SELECT USING (true);

-- Note: Realtime is automatically enabled for all tables in the public schema in local Supabase
-- For production deployment, enable Realtime for these tables in the Supabase Dashboard:
-- - games
-- - players  
-- - turns

-- Seed face_card_prompts table with 12 establishing prompts
INSERT INTO face_card_prompts (id, prompt_text) VALUES
(1, 'What was this place in the past? How long ago was that?'),
(2, 'What was the greatest moment in this place''s history? (An innovation? A discovery? A revolution? A new sapling? The emergence of a cycle of cicadas?)'),
(3, 'If there are inhabitants, what are the visions for the future that they hold?'),
(4, 'Who lives here? What is an average person like in this place? What do they look like? What do they wear? -OR- Describe the flora and fauna. What is the landscape like? What animals and plants call it home?'),
(5, 'Who or what (a person, landmark, society) has been in this place the longest? How did they come to be here?'),
(6, 'What stories are told in or about this place? Does it have legends or myths? Does it have religion?'),
(7, 'What is this placed named or called? Who named it, and for what reason?'),
(8, 'What is valued in this place? What is it known to have in excess?'),
(9, 'Who or what is in power here? (Is it a ruler? An apex predator? A series of laws that govern society? The weather?)'),
(10, 'What are the threats to this place? Are these threats to the materiality of the place, or the people that live in it?'),
(11, 'What was the greatest tragedy in this place''s past? How is it remembered?'),
(12, 'If there are multiple people who live here, what are they divided on? What are the points of contention that are fought over? -OR- If there are not multiple people, what resources do the plants, animals, or visitors to our place vie for?')
ON CONFLICT (id) DO NOTHING;

-- Seed numbered_card_prompts table with prompts for cards 2-9 (4 prompts each)
-- Card 2 prompts
INSERT INTO numbered_card_prompts (card_number, draw_order, prompt_text) VALUES
(2, 1, 'What re the plants like in our place? The rocks? The Soil?'),
(2, 2, 'It is time to plant "the seedlings." What are the seedlings and where are they planted? What is the harvest that is hoped for?'),
(2, 3, 'The harvest day has arrived. What is being harvested, for what purpose, and how is it being stored?'),
(2, 4, 'Sometimes change is so slow that the world shifts unnoticed. What is the groundswell that has been taking place so quietly?'),
-- Card 3 prompts
(3, 1, 'Name a monument, marker, statue, or other physicalized memory that exists in our place. What does it mark?'),
(3, 2, 'What is produced in our place right now, and how does it make its way into the wider world? (Is this export a physical good? Knowledge? Something else?)'),
(3, 3, 'A major modification is made to the enviroment of our place? What is this change? Was it made my someone or did is simply come to pass?'),
(3, 4, 'A breakthrough moment (in technology, arts, politics, philosophy, or daily life) tips the scales of a power balance. What was this breakthrough, and how does it play our socially?'),
-- Card 4 prompts
(4, 1, 'What do people listen to and perform here? What is considered folk art?'),
(4, 2, 'What do people in our place argue about for fun (whether at the bar, in the square, or in other social spaces?)'),
(4, 3, 'A new style, fad, or devotion sweeps our place. What is it? Who cares about it?'),
(4, 4, 'A bad decision leaves marks on the land. What was this decision, and what trace does it leave?'),
-- Card 5 prompts
(5, 1, 'What is the primary building or natural material in our place?'),
(5, 2, '"The bar" opens their doors to all. What is the bar and who is a regular there? - OR - "The church" changes a core mandate. What is the church, and what about their worldview has shifted?'),
(5, 3, 'Something new has been constructed, and stands where there was once something else. What was once there, and what has replaced it?'),
(5, 4, 'A creative or artistic achievement is unveiled. What is it? How is it received?'),
-- Card 6 prompts
(6, 1, 'What are the stars like in our place? The sky? The weather?'),
(6, 2, 'What secrets are kept in our place? Why are they kept? By who and from whom?'),
(6, 3, 'There is a union. Is it political? Emotional? Marital? What is newly aligned?'),
(6, 4, 'Someone is found guilty and is punished. What did they do, and what is the punishment?'),
-- Card 7 prompts
(7, 1, 'What is the most horrible thing in or about our place'),
(7, 2, 'Someone returns to our place changed. Who are they, and how are they different?'),
(7, 3, 'Something small but noticable is destroyed. What was it, and who or what destroyed it.'),
(7, 4, 'A natural or architechtural disaster strikes with no warning, leaving something in ruins. What was this disaster?'),
-- Card 8 prompts
(8, 1, 'What is the most beautiful thing in or about our place'),
(8, 2, 'Invent a specific street, building, corner, overlook, or meeting-place. What is it called officially, and what do the locals call it?'),
(8, 3, 'A forgotten aspect to our place is recovered. What is it? A corner? A basement? A hidden garden?'),
(8, 4, 'A previous alliance shows cracks. There is bickering and infighting. Who is fighting? What are they fighting about'),
-- Card 9 prompts
(9, 1, 'What does success look like in our place? What do the inhabitants want?'),
(9, 2, 'The news is dramatic, and tensions are high. What is the news? How is this reaction physicalized in space?'),
(9, 3, 'Someone (or a group of people) comes to our place. Who are they, and why have they come? Do they bring anything with them?'),
(9, 4, 'The future feels unsure, and the talk of our place has turned to preperations. What preparations are being taken and for what?')
ON CONFLICT (card_number, draw_order) DO NOTHING;
