-- Add play_again_request JSONB column to game_rooms to support rematch signaling
ALTER TABLE public.game_rooms
ADD COLUMN IF NOT EXISTS play_again_request JSONB;

-- No-op for updated_at trigger
