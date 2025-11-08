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

    const { action } = await req.json();

    if (action === 'fix_schema') {
      console.log('Attempting to fix database schema...');

      // Try to add room_id column to join_requests table
      try {
        const { error: alterError } = await supabase.rpc('exec_sql', {
          sql: `
            -- Add room_id column if it doesn't exist
            ALTER TABLE public.join_requests 
            ADD COLUMN IF NOT EXISTS room_id UUID;
            
            -- Add foreign key constraint
            ALTER TABLE public.join_requests
            ADD CONSTRAINT IF NOT EXISTS join_requests_room_id_fkey 
            FOREIGN KEY (room_id) REFERENCES public.game_rooms(id) ON DELETE CASCADE;
            
            -- Create index for performance
            CREATE INDEX IF NOT EXISTS idx_join_requests_room_id 
            ON public.join_requests(room_id);
          `
        });

        if (alterError) {
          console.error('Error executing schema fix:', alterError);
          return new Response(
            JSON.stringify({ success: false, error: `Schema fix failed: ${alterError.message}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update existing records to populate room_id
        const { error: updateError } = await supabase.rpc('exec_sql', {
          sql: `
            UPDATE public.join_requests 
            SET room_id = (
              SELECT gr.id 
              FROM public.game_rooms gr 
              WHERE gr.room_code = join_requests.room_code
            )
            WHERE room_id IS NULL;
          `
        });

        if (updateError) {
          console.error('Error updating existing records:', updateError);
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Database schema fixed successfully',
            update_error: updateError ? updateError.message : null
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (error) {
        console.error('Error in schema fix:', error);
        return new Response(
          JSON.stringify({ success: false, error: `Failed to fix schema: ${(error as Error).message}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fix-schema function:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});