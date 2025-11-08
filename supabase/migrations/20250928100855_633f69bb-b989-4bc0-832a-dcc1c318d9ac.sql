-- Enable realtime for friends table
ALTER TABLE public.friends REPLICA IDENTITY FULL;

-- Add friends table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.friends;