#!/usr/bin/env python3
"""
Apply database schema fixes directly to Supabase via HTTP API
Since the migration file isn't automatically applied, we'll run the SQL directly
"""

import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

def apply_schema_fixes():
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    supabase_key = os.getenv('VITE_SUPABASE_PUBLISHABLE_KEY')
    
    # Use service role key if available for admin operations
    # For now, we'll use the anon key and see if it works
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {supabase_key}',
        'apikey': supabase_key
    }
    
    # SQL to add the foreign key constraint
    sql_commands = [
        # First, add the room_id column if it doesn't exist
        """
        ALTER TABLE public.join_requests 
        ADD COLUMN IF NOT EXISTS room_id UUID;
        """,
        
        # Add the foreign key constraint
        """
        ALTER TABLE public.join_requests
        ADD CONSTRAINT IF NOT EXISTS join_requests_room_id_fkey 
        FOREIGN KEY (room_id) REFERENCES public.game_rooms(id) ON DELETE CASCADE;
        """,
        
        # Create index for performance
        """
        CREATE INDEX IF NOT EXISTS idx_join_requests_room_id 
        ON public.join_requests(room_id);
        """,
        
        # Update existing records to populate room_id
        """
        UPDATE public.join_requests 
        SET room_id = (
          SELECT gr.id 
          FROM public.game_rooms gr 
          WHERE gr.room_code = join_requests.room_code
        )
        WHERE room_id IS NULL;
        """
    ]
    
    for i, sql in enumerate(sql_commands, 1):
        print(f"\n🔧 Applying SQL Command {i}:")
        print(sql.strip())
        
        # Try to execute SQL via Supabase REST API
        response = requests.post(
            f"{supabase_url}/rest/v1/rpc/exec_sql",
            json={'sql': sql.strip()},
            headers=headers
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code not in [200, 201, 204]:
            print(f"❌ Failed to apply SQL command {i}")
            print("🔍 Trying alternative approach...")
            
            # Alternative: Try using the SQL editor endpoint
            alt_response = requests.post(
                f"{supabase_url}/rest/v1/query",
                json={'query': sql.strip()},
                headers=headers
            )
            
            print(f"Alternative response status: {alt_response.status_code}")
            print(f"Alternative response: {alt_response.text}")
        else:
            print(f"✅ Successfully applied SQL command {i}")

if __name__ == "__main__":
    print("🚀 Applying Supabase Database Schema Fixes...")
    apply_schema_fixes()
    print("\n✅ Schema fix attempt completed!")