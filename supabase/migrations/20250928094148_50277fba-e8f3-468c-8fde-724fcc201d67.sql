-- Add online status column to children_profiles table
ALTER TABLE public.children_profiles 
ADD COLUMN is_online boolean DEFAULT false,
ADD COLUMN last_seen_at timestamp with time zone DEFAULT now();

-- Create index for better performance when querying online status
CREATE INDEX idx_children_profiles_online_status ON public.children_profiles(is_online, last_seen_at);