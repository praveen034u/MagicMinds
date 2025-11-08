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
    const { action, auth0_user_id, child_id, audio_data, file_name } = await req.json();

    if (!auth0_user_id) {
      throw new Error("Auth0 user ID is required");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Set the Auth0 user ID for RLS policies
    await supabaseClient.rpc('set_config', {
      setting: 'app.current_auth0_user_id',
      value: auth0_user_id
    });

    if (action === 'create_voice_clone') {
      if (!child_id || !audio_data) {
        throw new Error("Child ID and audio data are required");
      }

      // Check if user has active subscription
      const { data: parentData } = await supabaseClient
        .from('parent_profiles')
        .select('id')
        .eq('auth0_user_id', auth0_user_id)
        .single();

      if (!parentData) {
        throw new Error("Parent profile not found");
      }

      const { data: subscription } = await supabaseClient
        .from('voice_subscriptions')
        .select('status')
        .eq('parent_id', parentData.id)
        .eq('status', 'active')
        .single();

      if (!subscription) {
        return new Response(JSON.stringify({ 
          error: 'Active subscription required for voice cloning' 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Convert base64 audio to binary
      const audioBuffer = Uint8Array.from(atob(audio_data), c => c.charCodeAt(0));

      // Create voice clone with ElevenLabs
      const elevenlabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
      if (!elevenlabsApiKey) {
        throw new Error('ElevenLabs API key not configured');
      }

      // First, create a new voice in ElevenLabs
      const formData = new FormData();
      const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
      formData.append('files', audioBlob, file_name || 'voice_sample.wav');
      formData.append('name', `Child_${child_id}_Voice`);
      formData.append('description', 'AI cloned voice for storytelling');

      const voiceResponse = await fetch('https://api.elevenlabs.io/v1/voices/add', {
        method: 'POST',
        headers: {
          'xi-api-key': elevenlabsApiKey,
        },
        body: formData,
      });

      if (!voiceResponse.ok) {
        const errorText = await voiceResponse.text();
        throw new Error(`ElevenLabs API error: ${errorText}`);
      }

      const voiceData = await voiceResponse.json();

      // Update child profile with voice clone info
      const { data, error } = await supabaseClient
        .from('children_profiles')
        .update({
          voice_clone_enabled: true,
          voice_clone_url: voiceData.voice_id
        })
        .eq('id', child_id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ 
        success: true, 
        voice_id: voiceData.voice_id,
        data 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'generate_story_audio') {
      const { story_text, voice_id } = await req.json();

      if (!story_text || !voice_id) {
        throw new Error("Story text and voice ID are required");
      }

      const elevenlabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
      if (!elevenlabsApiKey) {
        throw new Error('ElevenLabs API key not configured');
      }

      // Generate audio using ElevenLabs TTS
      const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
        method: 'POST',
        headers: {
          'xi-api-key': elevenlabsApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: story_text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
          },
        }),
      });

      if (!ttsResponse.ok) {
        const errorText = await ttsResponse.text();
        throw new Error(`ElevenLabs TTS error: ${errorText}`);
      }

      // Convert audio response to base64
      const audioArrayBuffer = await ttsResponse.arrayBuffer();
      const base64Audio = btoa(
        String.fromCharCode(...new Uint8Array(audioArrayBuffer))
      );

      return new Response(JSON.stringify({ 
        success: true, 
        audio_content: base64Audio 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in voice-clone function:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});