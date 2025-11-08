-- Add in_room flag to children_profiles table
ALTER TABLE public.children_profiles 
ADD COLUMN in_room boolean DEFAULT false;

-- Update existing records to set in_room based on current room participation
UPDATE public.children_profiles 
SET in_room = true 
WHERE id IN (
  SELECT DISTINCT rp.child_id 
  FROM room_participants rp
  JOIN game_rooms gr ON rp.room_id = gr.id
  WHERE gr.status IN ('waiting', 'playing')
  AND rp.child_id IS NOT NULL
);