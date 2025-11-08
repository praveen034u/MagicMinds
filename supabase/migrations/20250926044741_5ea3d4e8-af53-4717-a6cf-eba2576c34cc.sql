-- Create friends system
CREATE TABLE public.friends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL,
  addressee_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(requester_id, addressee_id)
);

-- Create game rooms
CREATE TABLE public.game_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code TEXT NOT NULL UNIQUE,
  host_child_id UUID NOT NULL,
  game_id TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  max_players INTEGER NOT NULL DEFAULT 4,
  current_players INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  has_ai_player BOOLEAN NOT NULL DEFAULT false,
  ai_player_name TEXT,
  ai_player_avatar TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create room participants
CREATE TABLE public.room_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL,
  child_id UUID,
  player_name TEXT NOT NULL,
  player_avatar TEXT,
  is_ai BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create game sessions for multiplayer
CREATE TABLE public.multiplayer_game_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL,
  game_data JSONB,
  current_turn_player_id UUID,
  game_state TEXT NOT NULL DEFAULT 'active' CHECK (game_state IN ('active', 'paused', 'finished')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multiplayer_game_sessions ENABLE ROW LEVEL SECURITY;

-- Friends policies
CREATE POLICY "Users can view their own friendships" 
ON public.friends 
FOR SELECT 
USING (
  requester_id IN (
    SELECT c.id FROM children_profiles c 
    JOIN parent_profiles p ON c.parent_id = p.id
    WHERE p.auth0_user_id = current_setting('app.current_auth0_user_id', true)
  ) OR
  addressee_id IN (
    SELECT c.id FROM children_profiles c 
    JOIN parent_profiles p ON c.parent_id = p.id
    WHERE p.auth0_user_id = current_setting('app.current_auth0_user_id', true)
  )
);

CREATE POLICY "Users can create friend requests" 
ON public.friends 
FOR INSERT 
WITH CHECK (
  requester_id IN (
    SELECT c.id FROM children_profiles c 
    JOIN parent_profiles p ON c.parent_id = p.id
    WHERE p.auth0_user_id = current_setting('app.current_auth0_user_id', true)
  )
);

-- Game rooms policies
CREATE POLICY "Users can view and manage their game rooms" 
ON public.game_rooms 
FOR ALL 
USING (
  host_child_id IN (
    SELECT c.id FROM children_profiles c 
    JOIN parent_profiles p ON c.parent_id = p.id
    WHERE p.auth0_user_id = current_setting('app.current_auth0_user_id', true)
  ) OR
  id IN (
    SELECT rp.room_id FROM room_participants rp
    WHERE rp.child_id IN (
      SELECT c.id FROM children_profiles c 
      JOIN parent_profiles p ON c.parent_id = p.id
      WHERE p.auth0_user_id = current_setting('app.current_auth0_user_id', true)
    )
  )
);

-- Room participants policies
CREATE POLICY "Users can view and manage room participants" 
ON public.room_participants 
FOR ALL 
USING (
  child_id IN (
    SELECT c.id FROM children_profiles c 
    JOIN parent_profiles p ON c.parent_id = p.id
    WHERE p.auth0_user_id = current_setting('app.current_auth0_user_id', true)
  ) OR
  room_id IN (
    SELECT gr.id FROM game_rooms gr
    WHERE gr.host_child_id IN (
      SELECT c.id FROM children_profiles c 
      JOIN parent_profiles p ON c.parent_id = p.id
      WHERE p.auth0_user_id = current_setting('app.current_auth0_user_id', true)
    )
  )
);

-- Game sessions policies
CREATE POLICY "Users can view and manage their game sessions" 
ON public.multiplayer_game_sessions 
FOR ALL 
USING (
  room_id IN (
    SELECT gr.id FROM game_rooms gr
    WHERE gr.host_child_id IN (
      SELECT c.id FROM children_profiles c 
      JOIN parent_profiles p ON c.parent_id = p.id
      WHERE p.auth0_user_id = current_setting('app.current_auth0_user_id', true)
    ) OR
    gr.id IN (
      SELECT rp.room_id FROM room_participants rp
      WHERE rp.child_id IN (
        SELECT c.id FROM children_profiles c 
        JOIN parent_profiles p ON c.parent_id = p.id
        WHERE p.auth0_user_id = current_setting('app.current_auth0_user_id', true)
      )
    )
  )
);

-- Add triggers for updated_at
CREATE TRIGGER update_friends_updated_at
  BEFORE UPDATE ON public.friends
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_game_rooms_updated_at
  BEFORE UPDATE ON public.game_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_multiplayer_game_sessions_updated_at
  BEFORE UPDATE ON public.multiplayer_game_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();