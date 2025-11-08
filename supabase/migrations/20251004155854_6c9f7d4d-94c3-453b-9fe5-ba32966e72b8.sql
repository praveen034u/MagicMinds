-- Add room_id column to join_requests if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'join_requests' 
        AND column_name = 'room_id'
    ) THEN
        ALTER TABLE public.join_requests ADD COLUMN room_id UUID;
    END IF;
END $$;

-- Create foreign key constraint if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'join_requests_room_id_fkey'
    ) THEN
        ALTER TABLE public.join_requests
        ADD CONSTRAINT join_requests_room_id_fkey 
        FOREIGN KEY (room_id) REFERENCES public.game_rooms(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create index for better performance if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_join_requests_room_id'
    ) THEN
        CREATE INDEX idx_join_requests_room_id ON public.join_requests(room_id);
    END IF;
END $$;

-- Update existing records to populate room_id based on room_code
UPDATE public.join_requests 
SET room_id = (
  SELECT gr.id 
  FROM public.game_rooms gr 
  WHERE gr.room_code = join_requests.room_code
)
WHERE room_id IS NULL AND EXISTS (
  SELECT 1 FROM public.game_rooms gr 
  WHERE gr.room_code = join_requests.room_code
);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';