#!/usr/bin/env python3
"""
Schema Test for Supabase Database
Tests the foreign key relationship between join_requests and game_rooms
"""

import requests
import json
import uuid
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

def test_schema_relationship():
    """Test if the foreign key relationship exists and works"""
    
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    supabase_key = os.getenv('VITE_SUPABASE_PUBLISHABLE_KEY')
    
    print(f"Testing schema at: {supabase_url}")
    
    # Test the specific query that's failing
    rooms_url = f"{supabase_url}/functions/v1/manage-game-rooms"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer mock_auth_token_for_testing'
    }
    
    # Test get_pending_invitations which uses the foreign key relationship
    test_data = {
        'action': 'get_pending_invitations',
        'child_id': str(uuid.uuid4())
    }
    
    print("\n=== Testing get_pending_invitations (Foreign Key Query) ===")
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
        return False

def test_simple_room_creation():
    """Test basic room creation without foreign key dependencies"""
    
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    rooms_url = f"{supabase_url}/functions/v1/manage-game-rooms"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer mock_auth_token_for_testing'
    }
    
    # Use a fresh UUID to avoid "already in room" errors
    test_child_id = str(uuid.uuid4())
    
    test_data = {
        'action': 'create_room',
        'child_id': test_child_id,
        'game_id': 'word-wonder',
        'difficulty': 'medium',
        'room_name': 'Schema Test Room',
        'friend_ids': []
    }
    
    print("\n=== Testing create_room (Basic Function) ===")
    response = requests.post(rooms_url, json=test_data, headers=headers)
    print(f"Response status: {response.status_code}")
    print(f"Response body: {response.text}")
    
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            print("✅ Room creation is working!")
            room_data = data.get('data', {})
            return room_data.get('id'), room_data.get('room_code')
        else:
            print(f"❌ Room creation failed: {data.get('error')}")
            return None, None
    else:
        print(f"❌ HTTP error: {response.status_code}")
        return None, None

def test_invite_friends_with_room_id(room_id):
    """Test invite_friends function that should populate room_id"""
    
    if not room_id:
        print("❌ No room_id provided, skipping invite test")
        return False
        
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    rooms_url = f"{supabase_url}/functions/v1/manage-game-rooms"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer mock_auth_token_for_testing'
    }
    
    test_data = {
        'action': 'invite_friends',
        'child_id': str(uuid.uuid4()),
        'room_id': room_id,
        'friend_ids': [str(uuid.uuid4())]  # Fake friend ID
    }
    
    print(f"\n=== Testing invite_friends with room_id: {room_id} ===")
    response = requests.post(rooms_url, json=test_data, headers=headers)
    print(f"Response status: {response.status_code}")
    print(f"Response body: {response.text}")
    
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            print("✅ Invite friends with room_id is working!")
            return True
        else:
            print(f"❌ Invite friends failed: {data.get('error')}")
            return False
    else:
        print(f"❌ HTTP error: {response.status_code}")
        return False

def main():
    """Run all schema tests"""
    print("🔍 Starting Schema Relationship Tests")
    print("=" * 60)
    
    # Test 1: Check if foreign key relationship works
    fk_working = test_schema_relationship()
    
    # Test 2: Test basic room creation
    room_id, room_code = test_simple_room_creation()
    
    # Test 3: Test invite friends with room_id population
    invite_working = test_invite_friends_with_room_id(room_id)
    
    print("\n📊 SCHEMA TEST SUMMARY")
    print("=" * 60)
    print(f"Foreign Key Relationship: {'✅ WORKING' if fk_working else '❌ BROKEN'}")
    print(f"Room Creation: {'✅ WORKING' if room_id else '❌ BROKEN'}")
    print(f"Room ID Population: {'✅ WORKING' if invite_working else '❌ BROKEN'}")
    
    if fk_working and room_id and invite_working:
        print("\n✅ All schema fixes are working correctly!")
        return 0
    else:
        print("\n❌ Schema issues detected - foreign key relationship needs to be fixed")
        return 1

if __name__ == "__main__":
    exit(main())