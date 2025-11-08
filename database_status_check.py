#!/usr/bin/env python3
"""
Database Status Check
Checks what data exists in the database and tests with real data
"""

import requests
import json
import uuid
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

def test_friends_function_for_existing_data():
    """Test friends function to see what children exist"""
    
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    friends_url = f"{supabase_url}/functions/v1/manage-friends"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer mock_auth_token_for_testing'
    }
    
    # Test list_all_children to see what exists
    test_data = {
        'action': 'list_all_children',
        'child_id': str(uuid.uuid4())  # Dummy ID
    }
    
    print("=== Testing list_all_children to find existing data ===")
    response = requests.post(friends_url, json=test_data, headers=headers)
    print(f"Response status: {response.status_code}")
    print(f"Response body: {response.text}")
    
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            children = data.get('data', [])
            print(f"✅ Found {len(children)} children in database")
            for child in children[:3]:  # Show first 3
                print(f"  - {child.get('name')} (ID: {child.get('id')})")
            return children
        else:
            print(f"❌ Function failed: {data.get('error')}")
            return []
    else:
        print(f"❌ HTTP error: {response.status_code}")
        return []

def test_room_creation_with_real_child(child_id):
    """Test room creation with a real child ID"""
    
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    rooms_url = f"{supabase_url}/functions/v1/manage-game-rooms"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer mock_auth_token_for_testing'
    }
    
    test_data = {
        'action': 'create_room',
        'child_id': child_id,
        'game_id': 'word-wonder',
        'difficulty': 'medium',
        'room_name': 'Real Child Test Room',
        'friend_ids': []
    }
    
    print(f"\n=== Testing create_room with real child ID: {child_id} ===")
    response = requests.post(rooms_url, json=test_data, headers=headers)
    print(f"Response status: {response.status_code}")
    print(f"Response body: {response.text}")
    
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            print("✅ Room creation with real child ID is working!")
            room_data = data.get('data', {})
            return room_data.get('id'), room_data.get('room_code')
        else:
            print(f"❌ Room creation failed: {data.get('error')}")
            return None, None
    else:
        print(f"❌ HTTP error: {response.status_code}")
        return None, None

def test_foreign_key_relationship_after_room_creation(child_id):
    """Test the foreign key relationship after creating a room"""
    
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    rooms_url = f"{supabase_url}/functions/v1/manage-game-rooms"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer mock_auth_token_for_testing'
    }
    
    test_data = {
        'action': 'get_pending_invitations',
        'child_id': child_id
    }
    
    print(f"\n=== Testing get_pending_invitations with real child ID: {child_id} ===")
    response = requests.post(rooms_url, json=test_data, headers=headers)
    print(f"Response status: {response.status_code}")
    print(f"Response body: {response.text}")
    
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            print("✅ Foreign key relationship is working!")
            return True
        else:
            print(f"❌ Function failed: {data.get('error')}")
            return False
    else:
        print(f"❌ HTTP error: {response.status_code}")
        if "Could not find a relationship" in response.text:
            print("🔍 DIAGNOSIS: Foreign key constraint is missing in database")
        return False

def main():
    """Run database status check"""
    print("🔍 Starting Database Status Check")
    print("=" * 60)
    
    # Step 1: Find existing children
    children = test_friends_function_for_existing_data()
    
    if not children:
        print("\n❌ No children found in database - cannot test with real data")
        return 1
    
    # Step 2: Test room creation with first available child
    first_child = children[0]
    child_id = first_child.get('id')
    child_name = first_child.get('name')
    
    print(f"\n🧪 Testing with child: {child_name} (ID: {child_id})")
    
    room_id, room_code = test_room_creation_with_real_child(child_id)
    
    # Step 3: Test foreign key relationship
    fk_working = test_foreign_key_relationship_after_room_creation(child_id)
    
    print("\n📊 DATABASE STATUS SUMMARY")
    print("=" * 60)
    print(f"Children in database: {len(children)}")
    print(f"Room creation: {'✅ WORKING' if room_id else '❌ BROKEN'}")
    print(f"Foreign key relationship: {'✅ WORKING' if fk_working else '❌ BROKEN'}")
    
    if not fk_working:
        print("\n🚨 CRITICAL ISSUE: Foreign key relationship between join_requests and game_rooms is missing")
        print("   This prevents the invitation system from working properly")
        print("   The migration file exists but hasn't been applied to the live database")
        return 1
    else:
        print("\n✅ Database schema is working correctly!")
        return 0

if __name__ == "__main__":
    exit(main())