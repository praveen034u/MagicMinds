#!/usr/bin/env python3
"""
Test the clean game rooms function without join_requests references
"""

import requests
import json
import os
from dotenv import load_dotenv

load_dotenv('/app/frontend/.env')

def test_clean_function():
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    auth_token = "mock_auth_token_for_testing"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {auth_token}'
    }
    
    # Use the clean function
    clean_url = f"{supabase_url}/functions/v1/manage-game-rooms-clean"
    
    print("🧪 Testing clean game rooms function...")
    
    # Test get_pending_invitations
    test_data = {
        'action': 'get_pending_invitations',
        'child_id': 'd771b6d0-1c90-431b-af96-dd6bf7a429f5'
    }
    
    response = requests.post(clean_url, json=test_data, headers=headers)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            print("✅ Clean function working! No schema cache issues")
        else:
            print(f"❌ Clean function error: {data.get('error')}")
    else:
        print(f"❌ HTTP error: {response.status_code}")

if __name__ == "__main__":
    test_clean_function()