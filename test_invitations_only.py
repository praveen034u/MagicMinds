#!/usr/bin/env python3
"""
Test just the get_pending_invitations function to see if schema cache is refreshed
"""

import requests
import json
import os
from dotenv import load_dotenv

load_dotenv('/app/frontend/.env')

def test_invitations_only():
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    auth_token = "mock_auth_token_for_testing"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {auth_token}'
    }
    
    rooms_url = f"{supabase_url}/functions/v1/manage-game-rooms"
    
    # Test get_pending_invitations directly
    print("🔍 Testing get_pending_invitations function...")
    
    invitations_data = {
        'action': 'get_pending_invitations',
        'child_id': "d771b6d0-1c90-431b-af96-dd6bf7a429f5"  # llll
    }
    
    response = requests.post(rooms_url, json=invitations_data, headers=headers)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            print("✅ get_pending_invitations is working!")
            invitations = data.get('data', [])
            print(f"Found {len(invitations)} pending invitations")
            for inv in invitations:
                print(f"  - {inv}")
        else:
            print(f"❌ Function error: {data.get('error')}")
    else:
        print(f"❌ HTTP error: {response.status_code}")
        if "schema cache" in response.text:
            print("🚨 Still having schema cache issues")
        elif "Body already consumed" in response.text:
            print("🚨 Still having parsing issues")

if __name__ == "__main__":
    test_invitations_only()