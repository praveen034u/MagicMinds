-- Create table for tracking multiplayer game scores
CREATE TABLE public.multiplayer_game_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL,
  child_id UUID,
  player_name TEXT NOT NULL,
  player_avatar TEXT,
  is_ai BOOLEAN NOT NULL DEFAULT false,
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.multiplayer_game_scores ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for multiplayer game scores
CREATE POLICY "Users can view scores for rooms they are in" 
ON public.multiplayer_game_scores 
FOR SELECT 
USING (
  room_id IN (
    SELECT gr.id 
    FROM game_rooms gr 
    WHERE gr.host_child_id IN (
      SELECT c.id 
      FROM children_profiles c 
      JOIN parent_profiles p ON c.parent_id = p.id 
      WHERE p.auth0_user_id = current_setting('app.current_auth0_user_id', true)
    )
  ) OR 
  room_id IN (
    SELECT rp.room_id 
    FROM room_participants rp 
    WHERE rp.child_id IN (
      SELECT c.id 
      FROM children_profiles c 
      JOIN parent_profiles p ON c.parent_id = p.id 
      WHERE p.auth0_user_id = current_setting('app.current_auth0_user_id', true)
    )
  )
);

CREATE POLICY "Users can create and update scores for their children" 
ON public.multiplayer_game_scores 
FOR ALL 
USING (
  child_id IN (
    SELECT c.id 
    FROM children_profiles c 
    JOIN parent_profiles p ON c.parent_id = p.id 
    WHERE p.auth0_user_id = current_setting('app.current_auth0_user_id', true)
  ) OR
  room_id IN (
    SELECT gr.id 
    FROM game_rooms gr 
    WHERE gr.host_child_id IN (
      SELECT c.id 
      FROM children_profiles c 
      JOIN parent_profiles p ON c.parent_id = p.id 
      WHERE p.auth0_user_id = current_setting('app.current_auth0_user_id', true)
    )
  )
);

-- Add trigger for updating timestamp
CREATE TRIGGER update_multiplayer_game_scores_updated_at
BEFORE UPDATE ON public.multiplayer_game_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();