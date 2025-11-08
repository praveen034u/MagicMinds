#!/usr/bin/env python3
"""
Reload Supabase PostgREST schema cache by calling a function that executes NOTIFY
"""

import requests
import json
import os
from dotenv import load_dotenv

load_dotenv('/app/frontend/.env')

def reload_schema():
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    supabase_key = os.getenv('VITE_SUPABASE_PUBLISHABLE_KEY')
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {supabase_key}',
        'apikey': supabase_key
    }
    
    print("🔄 Attempting to reload Supabase schema cache...")
    
    # Try to call a simple RPC function that can execute NOTIFY
    # First let's check if we can create a simple function via manage-game-rooms
    
    rooms_url = f"{supabase_url}/functions/v1/manage-game-rooms"
    
    # Add a schema reload action to the manage-game-rooms function
    reload_data = {
        'action': 'reload_schema_cache'
    }
    
    response = requests.post(rooms_url, json=reload_data, headers=headers)
    print(f"Response status: {response.status_code}")
    print(f"Response: {response.text}")
    
    # Alternative: try direct SQL via RPC (if available)
    print("\n🔄 Trying direct RPC approach...")
    
    rpc_response = requests.post(
        f"{supabase_url}/rest/v1/rpc/notify_reload_schema",
        json={},
        headers=headers
    )
    
    print(f"RPC Response status: {rpc_response.status_code}")
    print(f"RPC Response: {rpc_response.text}")

if __name__ == "__main__":
    reload_schema()