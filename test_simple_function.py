#!/usr/bin/env python3
"""
Test the simple function to see if service role access works
"""

import requests
import json
import os
from dotenv import load_dotenv

load_dotenv('/app/frontend/.env')

def test_simple_function():
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    auth_token = "mock_auth_token_for_testing"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {auth_token}'
    }
    
    simple_url = f"{supabase_url}/functions/v1/test-simple"
    
    print("🧪 Testing simple function with service role access...")
    
    test_data = {
        'action': 'test_direct_query',
        'child_id': 'test'
    }
    
    response = requests.post(simple_url, json=test_data, headers=headers)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            print("✅ Service role access working!")
            print(f"Found data: {len(data.get('data', []))} records")
        else:
            print(f"❌ Service role query failed: {data.get('error')}")
    else:
        print(f"❌ HTTP error: {response.status_code}")

if __name__ == "__main__":
    test_simple_function()