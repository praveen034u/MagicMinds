#!/usr/bin/env python3
"""
Simple check to see what data exists in join_requests table
"""

import requests
import json
import os
from dotenv import load_dotenv

load_dotenv('/app/frontend/.env')

def simple_check():
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    supabase_key = os.getenv('VITE_SUPABASE_PUBLISHABLE_KEY')
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {supabase_key}',
        'apikey': supabase_key
    }
    
    # Direct REST API call to check join_requests table
    print("🔍 Checking join_requests table structure...")
    
    response = requests.get(
        f"{supabase_url}/rest/v1/join_requests?limit=1",
        headers=headers
    )
    
    print(f"Response status: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 200:
        data = response.json()
        if len(data) > 0:
            print("\n📋 Sample join_request record:")
            print(json.dumps(data[0], indent=2))
            
            # Check if room_id column exists
            if 'room_id' in data[0]:
                print("✅ room_id column EXISTS in join_requests table")
            else:
                print("❌ room_id column MISSING from join_requests table")
        else:
            print("📝 No records in join_requests table")
    
    # Also check game_rooms table
    print("\n🔍 Checking game_rooms table structure...")
    
    response = requests.get(
        f"{supabase_url}/rest/v1/game_rooms?limit=1",
        headers=headers
    )
    
    print(f"Response status: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 200:
        data = response.json()
        if len(data) > 0:
            print("\n📋 Sample game_room record:")
            print(json.dumps(data[0], indent=2))

if __name__ == "__main__":
    simple_check()