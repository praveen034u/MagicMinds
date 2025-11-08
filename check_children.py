#!/usr/bin/env python3
"""
Check available children and their room status
"""

import requests
import json
import os
from dotenv import load_dotenv

load_dotenv('/app/frontend/.env')

def check_children():
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    auth_token = "mock_auth_token_for_testing"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {auth_token}'
    }
    
    friends_url = f"{supabase_url}/functions/v1/manage-friends"
    
    # Get all children
    print("👥 Checking available children...")
    list_data = {
        'action': 'list_all_children',
        'child_id': "a6770634-3be5-4469-94b2-5f9b72f79a47"  # Any ID for this query
    }
    
    response = requests.post(friends_url, json=list_data, headers=headers)
    print(f"Response status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            children = data.get('data', [])
            print(f"\n📋 Found {len(children)} children:")
            
            available_children = []
            for child in children:
                room_status = "No Room" if not child.get('room_id') else f"Room: {child.get('room_id')}"
                status = child.get('status', 'offline')
                print(f"  - {child.get('name')} (ID: {child.get('id')})")
                print(f"    Status: {status}, {room_status}")
                
                if not child.get('room_id'):  # Available (not in a room)
                    available_children.append(child)
            
            print(f"\n✅ Available children (not in rooms): {len(available_children)}")
            for child in available_children[:3]:  # Show first 3
                print(f"  - {child.get('name')}: {child.get('id')}")
            
            return available_children
        else:
            print(f"❌ Error: {data.get('error')}")
    else:
        print(f"❌ HTTP Error: {response.status_code}")
        print(f"Response: {response.text}")
    
    return []

if __name__ == "__main__":
    check_children()