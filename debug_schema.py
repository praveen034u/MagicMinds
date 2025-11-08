#!/usr/bin/env python3
"""
Debug the database schema to understand the current state
"""

import requests
import json
import os
from dotenv import load_dotenv

load_dotenv('/app/frontend/.env')

def debug_schema():
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    auth_token = "mock_auth_token_for_testing"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {auth_token}'
    }
    
    rooms_url = f"{supabase_url}/functions/v1/manage-game-rooms"
    
    # Call debug action
    debug_data = {
        'action': 'debug_schema'
    }
    
    response = requests.post(rooms_url, json=debug_data, headers=headers)
    print(f"Debug response status: {response.status_code}")
    print(f"Debug response: {response.text}")
    
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            debug_info = data.get('debug_info', {})
            print("\n=== DEBUG INFO ===")
            print(f"Table structure: {debug_info.get('table_structure')}")
            print(f"Table error: {debug_info.get('table_error')}")
            print(f"Basic query result: {debug_info.get('basic_query')}")
            print(f"Basic query error: {debug_info.get('basic_query_error')}")
        else:
            print(f"Debug failed: {data.get('error')}")

if __name__ == "__main__":
    debug_schema()