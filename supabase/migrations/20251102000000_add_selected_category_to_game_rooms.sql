-- Add selected_category to game_rooms so hosts can choose a theme and other clients can react
ALTER TABLE public.game_rooms
ADD COLUMN IF NOT EXISTS selected_category TEXT;

-- Ensure updated_at trigger still works (no-op if present)
