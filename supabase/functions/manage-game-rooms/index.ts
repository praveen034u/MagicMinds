import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Deno runtime global (keep typed as any for compatibility in editors)
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AI Friends data
const AI_FRIENDS = [
  { name: "Robo", avatar: "🤖", personality: "logical" },
  { name: "Spark", avatar: "⚡", personality: "energetic" },
  { name: "Luna", avatar: "🌙", personality: "calm" },
  { name: "Dash", avatar: "💨", personality: "speedy" },
  { name: "Pixel", avatar: "📱", personality: "techy" }
];

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

serve(async (req: any) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authToken = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!authToken) {
      throw new Error('No authorization token provided');
    }

    // Create a separate client for operations that bypass RLS (service role access)
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Set the auth token for RLS (for operations that need user context)
    supabase.auth.setSession({ access_token: authToken, refresh_token: '' });

    const { 
      action, 
      child_id, 
      game_id, 
      difficulty, 
      room_name, 
      room_code, 
      friend_ids = [],
      room_id,
      request_id,
      approve,
      invitation_id,
      total_questions
    } = await req.json();

    console.log('Received request:', { action, child_id, game_id, room_code });

    switch (action) {
      case 'create_room':
        // Check if user is already in any active room using the room_id column
        const { data: userProfile } = await supabase
          .from('children_profiles')
          .select('room_id')
          .eq('id', child_id)
          .single();

        if (userProfile?.room_id) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'You are currently in another room. Please leave that room first.' 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const roomCode = generateRoomCode();
        const finalRoomName = room_name || `${game_id} Room`;

        // Create the game room
        const { data: newRoom, error: roomError } = await supabase
          .from('game_rooms')
          .insert({
            room_code: roomCode,
            host_child_id: child_id,
            game_id,
            difficulty,
            max_players: 4,
            current_players: 1,
            status: 'waiting'
          })
          .select()
          .single();

        if (roomError) throw roomError;

        // Get host info
        const { data: hostProfile } = await supabase
          .from('children_profiles')
          .select('name, avatar')
          .eq('id', child_id)
          .single();

        // Add host as participant
        await supabase
          .from('room_participants')
          .insert({
            room_id: newRoom.id,
            child_id: child_id,
            player_name: hostProfile?.name || 'Host',
            player_avatar: hostProfile?.avatar || '👤',
            is_ai: false
          });

        // Set host as in room
        await supabase
          .from('children_profiles')
          .update({ room_id: newRoom.id } as any)
          .eq('id', child_id);

        // If no friends available, add AI player
        if (friend_ids.length === 0) {
          const aiFriend = AI_FRIENDS[Math.floor(Math.random() * AI_FRIENDS.length)];
          
          await supabase
            .from('room_participants')
            .insert({
              room_id: newRoom.id,
              player_name: aiFriend.name,
              player_avatar: aiFriend.avatar,
              is_ai: true
            });

          await supabase
            .from('game_rooms')
            .update({ 
              current_players: 2,
              has_ai_player: true,
              ai_player_name: aiFriend.name,
              ai_player_avatar: aiFriend.avatar
            })
            .eq('id', newRoom.id);
        }

        return new Response(
          JSON.stringify({ success: true, data: { ...newRoom, room_code: roomCode } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'join_room':
        // Check if user is already in any active room using the room_id column
        const { data: joiningUserProfile } = await supabase
          .from('children_profiles')
          .select('room_id')
          .eq('id', child_id)
          .single();

        if (joiningUserProfile?.room_id) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'You are currently in another room. Please leave that room first.' 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Find room by code
        const { data: room, error: findError } = await supabase
          .from('game_rooms')
          .select('*')
          .eq('room_code', room_code)
          .eq('status', 'waiting')
          .single();

        if (findError || !room) {
          return new Response(
            JSON.stringify({ success: false, error: 'Room not found or not available' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (room.current_players >= room.max_players) {
          return new Response(
            JSON.stringify({ success: false, error: 'Room is full' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get player info
        const { data: playerProfile } = await supabase
          .from('children_profiles')
          .select('name, avatar')
          .eq('id', child_id)
          .single();

        // Add player to room
        await supabase
          .from('room_participants')
          .insert({
            room_id: room.id,
            child_id: child_id,
            player_name: playerProfile?.name || 'Player',
            player_avatar: playerProfile?.avatar || '👤',
            is_ai: false
          });

        // Set player as in room
        await supabase
          .from('children_profiles')
          .update({ room_id: room.id } as any)
          .eq('id', child_id);

        // Update room player count
        await supabase
          .from('game_rooms')
          .update({ current_players: room.current_players + 1 })
          .eq('id', room.id);

        return new Response(
          JSON.stringify({ success: true, data: room }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'leave_room':
        // Remove player from room
        const { error: leaveError } = await supabase
          .from('room_participants')
          .delete()
          .eq('room_id', room_id)
          .eq('child_id', child_id);

        if (leaveError) throw leaveError;

        // Set player as not in room
        await supabase
          .from('children_profiles')
          .update({ room_id: null } as any)
          .eq('id', child_id);

        // Get updated room info
        const { data: updatedRoom } = await supabase
          .from('game_rooms')
          .select('*')
          .eq('id', room_id)
          .single();

        if (updatedRoom) {
          const newPlayerCount = updatedRoom.current_players - 1;
          
          if (newPlayerCount <= 0 || updatedRoom.host_child_id === child_id) {
            // Delete room if empty or host left
            await supabase
              .from('game_rooms')
              .delete()
              .eq('id', room_id);
            
            // Set all remaining participants as not in room
            const { data: remainingParticipants } = await supabase
              .from('room_participants')
              .select('child_id')
              .eq('room_id', room_id)
              .not('child_id', 'is', null);

            if (remainingParticipants && remainingParticipants.length > 0) {
              const participantIds = remainingParticipants.map((p: any) => p.child_id);
              await supabase
                .from('children_profiles')
                .update({ room_id: null } as any)
                .in('id', participantIds);
            }
          } else {
            // Update player count
            await supabase
              .from('game_rooms')
              .update({ current_players: newPlayerCount })
              .eq('id', room_id);
          }
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'invite_friends':
        // Get room info first to get the room_id
        const { data: roomInfo } = await supabase
          .from('game_rooms')
          .select('id, room_code, game_id, difficulty')
          .eq('id', room_id)
          .single();

        if (!roomInfo) {
          return new Response(
            JSON.stringify({ success: false, error: 'Room not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get friend profiles for their names and avatars
        const { data: friendProfiles } = await supabase
          .from('children_profiles')
          .select('id, name, avatar')
          .in('id', friend_ids);

        if (!friendProfiles || friendProfiles.length === 0) {
          return new Response(
            JSON.stringify({ success: false, error: 'No valid friends found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create join requests for each friend with proper room_id
        const invitationsToCreate = friendProfiles.map((friend: any) => ({
          room_id: roomInfo.id,
          room_code: roomInfo.room_code,
          child_id: friend.id,
          player_name: friend.name || 'Player',
          player_avatar: friend.avatar || '👤',
          status: 'pending'
        }));

        const { data: createdInvitations, error: inviteError } = await supabase
          .from('join_requests')
          .insert(invitationsToCreate)
          .select();

        if (inviteError) {
          console.error('Error creating invitations:', inviteError);
          throw inviteError;
        }

        console.log(`Successfully created ${createdInvitations?.length || 0} invitations for room ${roomInfo.room_code}`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            invitations_sent: createdInvitations?.length || 0,
            data: createdInvitations
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'get_room_participants':
        const { data: participants, error: participantsError } = await supabase
          .from('room_participants')
          .select('*')
          .eq('room_id', room_id);

        if (participantsError) throw participantsError;

        return new Response(
          JSON.stringify({ success: true, data: participants || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'request_to_join':
        // Check if room exists and is active
        const { data: targetRoom, error: targetRoomError } = await supabase
          .from('game_rooms')
          .select('*')
          .eq('room_code', room_code)
          .single();

        if (targetRoomError || !targetRoom) {
          return new Response(
            JSON.stringify({ success: false, error: 'Room not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get requester info
        const { data: requesterProfile } = await supabase
          .from('children_profiles')
          .select('name, avatar')
          .eq('id', child_id)
          .single();

        // Create join request
        const { data: newRequest, error: requestError } = await supabase
          .from('join_requests')
          .insert({
            room_code,
            child_id,
            player_name: requesterProfile?.name || 'Player',
            player_avatar: requesterProfile?.avatar || '👤',
            status: 'pending'
          })
          .select()
          .single();

        if (requestError) throw requestError;

        return new Response(
          JSON.stringify({ success: true, data: newRequest }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'handle_join_request':
        // Use already parsed request_id and approve from top-level destructuring
        
        // Get the join request
        const { data: joinRequest } = await supabase
          .from('join_requests')
          .select('*')
          .eq('id', request_id)
          .single();

        if (!joinRequest) {
          return new Response(
            JSON.stringify({ success: false, error: 'Request not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update request status
        await supabase
          .from('join_requests')
          .update({ status: approve ? 'approved' : 'denied' })
          .eq('id', request_id);

        if (approve) {
          // Get room info
          const { data: roomForJoin } = await supabase
            .from('game_rooms')
            .select('*')
            .eq('room_code', joinRequest.room_code)
            .single();

          if (roomForJoin && roomForJoin.current_players < roomForJoin.max_players) {
            // Get the accepting player's profile information (not the host's info from join request)
            const { data: acceptingPlayerProfile } = await supabase
              .from('children_profiles')
              .select('name, avatar')
              .eq('id', joinRequest.child_id)
              .single();

            // Add player to room with their actual profile info
            const { data: newParticipant } = await supabase
              .from('room_participants')
              .insert({
                room_id: roomForJoin.id,
                child_id: joinRequest.child_id,
                player_name: acceptingPlayerProfile?.name || 'Player',
                player_avatar: acceptingPlayerProfile?.avatar || '👤',
                is_ai: false
              })
              .select()
              .single();

            // Set player as in room
            await supabase
              .from('children_profiles')
              .update({ room_id: roomForJoin.id } as any)
              .eq('id', joinRequest.child_id);

            // Update room player count
            await supabase
              .from('game_rooms')
              .update({ current_players: roomForJoin.current_players + 1 })
              .eq('id', roomForJoin.id);

            return new Response(
              JSON.stringify({ 
                success: true, 
                player: newParticipant,
                room: roomForJoin,
                room_id: roomForJoin.id
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'get_current_room':
        // Get child's current room_id
        const { data: childProfile } = await supabase
          .from('children_profiles')
          .select('room_id')
          .eq('id', child_id)
          .single();

        if (!childProfile?.room_id) {
          return new Response(
            JSON.stringify({ success: true, data: null }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get room details
        const { data: currentRoomData, error: roomFetchError } = await supabase
          .from('game_rooms')
          .select('*')
          .eq('id', childProfile.room_id)
          .single();

        if (roomFetchError || !currentRoomData) {
          // Room no longer exists, clear the room_id
          await supabase
            .from('children_profiles')
            .update({ room_id: null } as any)
            .eq('id', child_id);

          return new Response(
            JSON.stringify({ success: true, data: null }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get participants
        const { data: roomParticipants } = await supabase
          .from('room_participants')
          .select('*')
          .eq('room_id', currentRoomData.id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            data: { 
              ...currentRoomData, 
              participants: roomParticipants || [] 
            } 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'mark_player_finished':
        // Mark a player as finished in the room's player_progress JSON and
        // if all participants have finished (based on multiplayer_game_scores.total_questions)
        // then set the room status to 'finished' so realtime notifies all clients.

        {
          if (!room_id) {
            return new Response(JSON.stringify({ success: false, error: 'room_id required' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }

          // Load current room
          const { data: room } = await supabaseServiceRole
            .from('game_rooms')
            .select('id, player_progress')
            .eq('id', room_id)
            .single();

          const now = new Date().toISOString();

          // Build new player_progress
          let currentProgress = room?.player_progress || {};
          try {
            // Ensure it's an object
            if (typeof currentProgress === 'string') {
              currentProgress = JSON.parse(currentProgress);
            }
          } catch (e) {
            currentProgress = {};
          }

          const key = child_id || 'unknown';
          currentProgress[key] = { finished_at: now, total_questions };

          // Persist player_progress
          await supabaseServiceRole
            .from('game_rooms')
            .update({ player_progress: currentProgress })
            .eq('id', room_id);

          // Check if all participants have finished by consulting multiplayer_game_scores
          const { data: scoreRows } = await supabaseServiceRole
            .from('multiplayer_game_scores')
            .select('id, total_questions')
            .eq('room_id', room_id);

          // Get participant count
          const { data: participants } = await supabaseServiceRole
            .from('room_participants')
            .select('id')
            .eq('room_id', room_id);

          const required = Number(total_questions) || 10;
          const finishedCount = (scoreRows || []).filter((r: any) => (r.total_questions ?? 0) >= required).length;
          const participantCount = (participants || []).length;

          let allFinished = false;
          if (participantCount > 0 && finishedCount >= participantCount) {
            // mark room finished
            await supabaseServiceRole
              .from('game_rooms')
              .update({ status: 'finished', updated_at: now })
              .eq('id', room_id);
            allFinished = true;
          }

          return new Response(JSON.stringify({ success: true, all_finished: allFinished }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

      case 'close_room':
        // When host closes the room, set all participants' room_id to null
        const { data: allRoomParticipants } = await supabase
          .from('room_participants')
          .select('child_id')
          .eq('room_id', room_id);
        
        if (allRoomParticipants && allRoomParticipants.length > 0) {
          const participantIds = allRoomParticipants.map((p: any) => p.child_id).filter(Boolean);
          if (participantIds.length > 0) {
            await supabase
              .from('children_profiles')
              .update({ room_id: null } as any)
              .in('id', participantIds);
          }
        }
        
        // Delete the room
        await supabase.from('game_rooms').delete().eq('id', room_id);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'get_pending_invitations':
        try {
          console.log(`Getting pending invitations for child: ${child_id}`);
          
          // Query join_requests with room information using the room_id foreign key
          const { data: pendingInvitations, error: invitationsError } = await supabase
            .from('join_requests')
            .select(`
              id,
              room_id,
              room_code,
              player_name,
              player_avatar,
              status,
              created_at,
              game_rooms (
                id,
                room_code,
                game_id,
                difficulty,
                host_child_id,
                max_players,
                current_players,
                status
              )
            `)
            .eq('child_id', child_id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

          if (invitationsError) {
            console.error('Error fetching invitations:', invitationsError);
            throw invitationsError;
          }

          console.log(`Found ${pendingInvitations?.length || 0} pending invitations for child ${child_id}`);

          return new Response(
            JSON.stringify({ 
              success: true, 
              data: pendingInvitations || []
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (inviteError) {
          console.error('Error in get_pending_invitations:', inviteError);
          return new Response(
            JSON.stringify({ 
              success: false,
              error: `Failed to fetch invitations: ${(inviteError as Error).message}`,
              data: []
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

      case 'accept_invitation':
        // Get the invitation
        const { data: invitation, error: invitationError } = await supabase
          .from('join_requests')
          .select('*, game_rooms (*)')
          .eq('id', invitation_id)
          .eq('child_id', child_id)
          .single();

        if (invitationError || !invitation) {
          return new Response(
            JSON.stringify({ success: false, error: 'Invitation not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update invitation status
        await supabase
          .from('join_requests')
          .update({ status: 'approved' })
          .eq('id', invitation_id);

        // Join the room using the existing join_room logic
        const roomToJoin = invitation.game_rooms;
        
        if (!roomToJoin || roomToJoin.current_players >= roomToJoin.max_players) {
          return new Response(
            JSON.stringify({ success: false, error: 'Room is full or unavailable' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get player info
        const { data: acceptingPlayerProfile } = await supabase
          .from('children_profiles')
          .select('name, avatar')
          .eq('id', child_id)
          .single();

        // Add player to room
        await supabase
          .from('room_participants')
          .insert({
            room_id: roomToJoin.id,
            child_id: child_id,
            player_name: acceptingPlayerProfile?.name || 'Player',
            player_avatar: acceptingPlayerProfile?.avatar || '👤',
            is_ai: false
          });

        // Set player as in room
        await supabase
          .from('children_profiles')
          .update({ room_id: roomToJoin.id } as any)
          .eq('id', child_id);

        // Update room player count
        await supabase
          .from('game_rooms')
          .update({ current_players: roomToJoin.current_players + 1 })
          .eq('id', roomToJoin.id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            room: roomToJoin,
            room_id: roomToJoin.id
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'decline_invitation':
        // Update invitation status to denied
        const { error: declineError } = await supabase
          .from('join_requests')
          .update({ status: 'denied' })
          .eq('id', invitation_id)
          .eq('child_id', child_id);

        if (declineError) {
          return new Response(
            JSON.stringify({ success: false, error: 'Failed to decline invitation' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'reload_schema_cache':
        // Reload PostgREST schema cache
        try {
          console.log('Attempting to reload PostgREST schema cache...');
          const { data, error } = await supabase.rpc('notify_reload_schema');
          
          if (error) {
            console.error('Error calling notify_reload_schema:', error);
            return new Response(
              JSON.stringify({ 
                success: false, 
                message: 'Failed to reload schema cache', 
                error: error.message
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          console.log('Schema cache reload notification sent successfully');
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Schema cache reload notification sent successfully',
              data: data
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );

        } catch (reloadError) {
          console.error('Exception during schema reload:', reloadError);
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: 'Exception during schema reload attempt', 
              error: (reloadError as Error).message 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

      default:
        throw new Error('Invalid action');
    }
  } catch (error) {
    console.error('Error in manage-game-rooms function:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});