-- Create table for join requests/invitations
CREATE TABLE public.join_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code TEXT NOT NULL,
  child_id UUID NOT NULL,
  player_name TEXT NOT NULL,
  player_avatar TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for join_requests
CREATE POLICY "Users can create join requests for their children" 
ON public.join_requests 
FOR INSERT 
WITH CHECK (child_id IN ( 
  SELECT c.id
  FROM children_profiles c
  JOIN parent_profiles p ON c.parent_id = p.id
  WHERE p.auth0_user_id = current_setting('app.current_auth0_user_id', true)
));

CREATE POLICY "Users can view join requests for their children" 
ON public.join_requests 
FOR SELECT 
USING (child_id IN ( 
  SELECT c.id
  FROM children_profiles c
  JOIN parent_profiles p ON c.parent_id = p.id
  WHERE p.auth0_user_id = current_setting('app.current_auth0_user_id', true)
));

CREATE POLICY "Room hosts can view and manage join requests for their rooms" 
ON public.join_requests 
FOR ALL
USING (room_code IN (
  SELECT gr.room_code 
  FROM game_rooms gr
  WHERE gr.host_child_id IN (
    SELECT c.id
    FROM children_profiles c
    JOIN parent_profiles p ON c.parent_id = p.id
    WHERE p.auth0_user_id = current_setting('app.current_auth0_user_id', true)
  )
));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_join_requests_updated_at
BEFORE UPDATE ON public.join_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();