-- Add foreign key constraints for better data integrity and enable joins
ALTER TABLE public.friends 
ADD CONSTRAINT friends_requester_id_fkey 
FOREIGN KEY (requester_id) REFERENCES public.children_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.friends 
ADD CONSTRAINT friends_addressee_id_fkey 
FOREIGN KEY (addressee_id) REFERENCES public.children_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.game_rooms 
ADD CONSTRAINT game_rooms_host_child_id_fkey 
FOREIGN KEY (host_child_id) REFERENCES public.children_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.room_participants 
ADD CONSTRAINT room_participants_room_id_fkey 
FOREIGN KEY (room_id) REFERENCES public.game_rooms(id) ON DELETE CASCADE;

ALTER TABLE public.room_participants 
ADD CONSTRAINT room_participants_child_id_fkey 
FOREIGN KEY (child_id) REFERENCES public.children_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.multiplayer_game_sessions 
ADD CONSTRAINT multiplayer_game_sessions_room_id_fkey 
FOREIGN KEY (room_id) REFERENCES public.game_rooms(id) ON DELETE CASCADE;