import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    // Set the auth token for RLS
    supabase.auth.setSession({ access_token: authToken, refresh_token: '' });

    const { action, child_id, friend_child_id, friend_request_id, search_query, friend_ids, friendship_id } = await req.json();

    console.log('Received request:', { action, child_id, friend_child_id });

    switch (action) {
      case 'send_friend_request':
        // Send friend request
        const { data: existingRequest } = await supabase
          .from('friends')
          .select('id')
          .or(`and(requester_id.eq.${child_id},addressee_id.eq.${friend_child_id}),and(requester_id.eq.${friend_child_id},addressee_id.eq.${child_id})`)
          .single();

        if (existingRequest) {
          return new Response(
            JSON.stringify({ success: false, error: 'Friend request already exists' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: friendRequest, error: requestError } = await supabase
          .from('friends')
          .insert({
            requester_id: child_id,
            addressee_id: friend_child_id,
            status: 'pending'
          })
          .select()
          .single();

        if (requestError) throw requestError;

        return new Response(
          JSON.stringify({ success: true, data: friendRequest }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'accept_friend_request':
        const { error: acceptError } = await supabase
          .from('friends')
          .update({ status: 'accepted' })
          .eq('id', friend_request_id);

        if (acceptError) throw acceptError;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'decline_friend_request':
        const { error: declineError } = await supabase
          .from('friends')
          .delete()
          .eq('id', friend_request_id);

        if (declineError) throw declineError;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'list_friends':
        // List accepted friends for this child
        const { data: friendsList, error: friendsError } = await supabase
          .from('friends')
          .select(`
            id,
            status,
            requester_id,
            addressee_id,
            requester:children_profiles!friends_requester_id_fkey(id, name, avatar, room_id),
            addressee:children_profiles!friends_addressee_id_fkey(id, name, avatar, room_id)
          `)
          .or(`requester_id.eq.${child_id},addressee_id.eq.${child_id}`)
          .eq('status', 'accepted');

        if (friendsError) throw friendsError;

        // Transform to get the friend's data (not current child's data)
        const friends = friendsList?.map(f => {
          const friendData = f.requester_id === child_id ? f.addressee : f.requester;
          return {
            id: f.id,
            child_id: friendData?.id,
            name: friendData?.name,
            avatar: friendData?.avatar,
            status: friendData?.room_id ? 'in-game' : 'online',
            room_id: friendData?.room_id
          };
        }) || [];

        return new Response(
          JSON.stringify({ success: true, data: friends }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'get_friend_requests':
        // Get pending friend requests for this child
        const { data: requests, error: requestsError } = await supabase
          .from('friends')
          .select(`
            id,
            status,
            created_at,
            requester:children_profiles!friends_requester_id_fkey(id, name, avatar)
          `)
          .eq('addressee_id', child_id)
          .eq('status', 'pending');

        if (requestsError) throw requestsError;

        return new Response(
          JSON.stringify({ success: true, data: requests || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'search_children':
        // Search for children by name (excluding current child and existing friends)
        const { data: existingFriends } = await supabase
          .from('friends')
          .select('requester_id, addressee_id')
          .or(`requester_id.eq.${child_id},addressee_id.eq.${child_id}`)
          .in('status', ['pending', 'accepted']);

        const friendIds = existingFriends?.flatMap(f => 
          f.requester_id === child_id ? [f.addressee_id] : [f.requester_id]
        ) || [];

        let query = supabase
          .from('children_profiles')
          .select('id, name, avatar')
          .neq('id', child_id)
          .ilike('name', `%${search_query}%`);

        if (friendIds.length > 0) {
          query = query.not('id', 'in', `(${friendIds.join(',')})`);
        }

        const { data: children, error: searchError } = await query.limit(10);

        if (searchError) throw searchError;

        return new Response(
          JSON.stringify({ success: true, data: children || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'get_friends_by_ids':
        // Get specific friends by their IDs
        if (!friend_ids || !Array.isArray(friend_ids) || friend_ids.length === 0) {
          return new Response(
            JSON.stringify({ success: true, data: [] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: specificFriends, error: specificFriendsError } = await supabase
          .from('children_profiles')
          .select('id, name, avatar, room_id')
          .in('id', friend_ids);

        if (specificFriendsError) throw specificFriendsError;

        const friendsWithStatus = specificFriends?.map(friend => ({
          ...friend,
          child_id: friend.id,
          status: friend.room_id ? 'in-game' : 'online'
        })) || [];

        return new Response(
          JSON.stringify({ success: true, data: friendsWithStatus }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'list_all_children':
        // List all children across all parents (service role bypasses RLS)
        const { data: allChildren, error: listError } = await supabase
          .from('children_profiles')
          .select('id, name, avatar, updated_at, is_online, last_seen_at, room_id')
          .neq('id', child_id)
          .order('is_online', { ascending: false })
          .order('last_seen_at', { ascending: false });

        // Transform children data to include status based on room_id
        const childrenWithStatus = allChildren?.map(child => ({
          ...child,
          status: child.room_id ? 'in-game' : (child.is_online ? 'online' : 'offline')
        })) || [];

        return new Response(
          JSON.stringify({ success: true, data: childrenWithStatus }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'unfriend':
        // Remove friendship
        const { error: unfriendError } = await supabase
          .from('friends')
          .delete()
          .eq('id', friendship_id);

        if (unfriendError) throw unfriendError;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      default:
        throw new Error('Invalid action');
    }
  } catch (error) {
    console.error('Error in manage-friends function:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});