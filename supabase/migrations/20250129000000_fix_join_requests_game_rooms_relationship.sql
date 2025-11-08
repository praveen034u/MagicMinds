-- Fix join_requests table to add proper foreign key relationship to game_rooms
-- This migration adds a direct room_id reference to enable proper joins

-- Add room_id column to join_requests table
ALTER TABLE public.join_requests 
ADD COLUMN room_id UUID;

-- Create foreign key constraint to game_rooms
ALTER TABLE public.join_requests
ADD CONSTRAINT join_requests_room_id_fkey 
FOREIGN KEY (room_id) REFERENCES public.game_rooms(id) ON DELETE CASCADE;

-- Create an index for better performance on room_id lookups
CREATE INDEX idx_join_requests_room_id ON public.join_requests(room_id);

-- Update existing records to populate room_id based on room_code
-- This handles any existing data in the system
UPDATE public.join_requests 
SET room_id = (
  SELECT gr.id 
  FROM public.game_rooms gr 
  WHERE gr.room_code = join_requests.room_code
)
WHERE room_id IS NULL;

-- Add check constraint to ensure either room_id is set or room_code can be resolved
-- We'll keep room_code for now for backwards compatibility but room_id will be primary reference