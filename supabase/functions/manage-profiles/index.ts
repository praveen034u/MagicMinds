import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const { method, url } = req;
    const { action, auth0_user_id, profile_data, child_id } = await req.json();

    // Set the Auth0 user ID for RLS policies
    await supabaseClient.rpc('set_config', {
      setting: 'app.current_auth0_user_id',
      value: auth0_user_id
    });

    // Create parent profile (server-side, avoids RLS issues from client)
    if (action === 'create_parent') {
      const { email, name } = profile_data;

      if (!email) {
        throw new Error('Email is required to create parent profile');
      }

      // First check if profile already exists
      const { data: existingProfile, error: fetchError } = await supabaseClient
        .from('parent_profiles')
        .select('*')
        .eq('auth0_user_id', auth0_user_id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (existingProfile) {
        // Profile already exists, return it
        return new Response(JSON.stringify({ success: true, data: existingProfile }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create new profile if it doesn't exist
      const { data, error } = await supabaseClient
        .from('parent_profiles')
        .insert({
          auth0_user_id,
          email,
          name: name || email
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'create_child') {
      const { parent_id, name, age_group, avatar } = profile_data;
      
      const { data, error } = await supabaseClient
        .from('children_profiles')
        .insert({
          parent_id,
          name,
          age_group,
          avatar
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'update_child') {
      const { child_id, ...updateData } = profile_data;
      
      const { data, error } = await supabaseClient
        .from('children_profiles')
        .update(updateData)
        .eq('id', child_id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete_child') {
      const { child_id } = profile_data;
      
      const { error } = await supabaseClient
        .from('children_profiles')
        .delete()
        .eq('id', child_id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_parent') {
      const { data, error } = await supabaseClient
        .from('parent_profiles')
        .select('*')
        .eq('auth0_user_id', auth0_user_id)
        .maybeSingle();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_children') {
      const { parent_id } = profile_data;
      
      const { data, error } = await supabaseClient
        .from('children_profiles')
        .select('*')
        .eq('parent_id', parent_id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'set_child_online_status') {
      // Update child's online status
      const { data: statusUpdate, error: statusError } = await supabaseClient
        .from('children_profiles')
        .update({ 
          is_online: profile_data.is_online,
          last_seen_at: new Date().toISOString()
        })
        .eq('id', child_id)
        .select()
        .single();

      if (statusError) throw statusError;

      return new Response(
        JSON.stringify({ success: true, data: statusUpdate }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update_in_room_status') {
      // Update child's in_room status
      const { data, error } = await supabaseClient
        .from('children_profiles')
        .update({ in_room: profile_data.in_room })
        .eq('id', child_id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in manage-profiles function:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});