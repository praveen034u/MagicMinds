#!/usr/bin/env python3
"""
Test to check what data exists in the database
"""

import requests
import json
import uuid
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

def test_existing_data():
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    auth_token = "mock_auth_token_for_testing"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {auth_token}'
    }
    
    friends_url = f"{supabase_url}/functions/v1/manage-friends"
    
    # Test list_all_children to see what data exists
    print("=== Testing list_all_children ===")
    list_data = {
        'action': 'list_all_children',
        'child_id': str(uuid.uuid4())  # Any UUID for this test
    }
    
    response = requests.post(friends_url, json=list_data, headers=headers)
    print(f"Response status: {response.status_code}")
    print(f"Response body: {response.text}")
    
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            children = data.get('data', [])
            print(f"Found {len(children)} children in database:")
            for child in children[:5]:  # Show first 5
                print(f"  - ID: {child.get('id')}, Name: {child.get('name')}")
            return children
        else:
            print(f"Error: {data.get('error')}")
    else:
        print(f"HTTP Error: {response.status_code}")
    
    return []

if __name__ == "__main__":
    test_existing_data()