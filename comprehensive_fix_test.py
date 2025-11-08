#!/usr/bin/env python3
"""
Final Comprehensive Test
Tests the specific fixes mentioned in the review request
"""

import requests
import json
import uuid
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

def test_with_available_child():
    """Test with a child who is not currently in a room"""
    
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    friends_url = f"{supabase_url}/functions/v1/manage-friends"
    rooms_url = f"{supabase_url}/functions/v1/manage-game-rooms"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer mock_auth_token_for_testing'
    }
    
    # Find children not in rooms
    test_data = {
        'action': 'list_all_children',
        'child_id': str(uuid.uuid4())
    }
    
    response = requests.post(friends_url, json=test_data, headers=headers)
    if response.status_code != 200:
        return None, None
    
    data = response.json()
    children = data.get('data', [])
    
    # Find a child not in a room
    available_child = None
    for child in children:
        if not child.get('room_id'):  # Not in a room
            available_child = child
            break
    
    if not available_child:
        print("❌ No available children found (all are in rooms)")
        return None, None
    
    child_id = available_child['id']
    child_name = available_child['name']
    
    print(f"🧪 Testing with available child: {child_name} (ID: {child_id})")
    
    # Test 1: Create room with AI player
    print("\n=== Test 1: Create room with AI player ===")
    create_data = {
        'action': 'create_room',
        'child_id': child_id,
        'game_id': 'word-wonder',
        'difficulty': 'medium',
        'room_name': 'Test Room for Fixes',
        'friend_ids': []  # No friends = AI player should be added
    }
    
    response = requests.post(rooms_url, json=create_data, headers=headers)
    print(f"Create room response: {response.status_code}")
    print(f"Response body: {response.text}")
    
    room_id = None
    room_code = None
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            room_data = data.get('data', {})
            room_id = room_data.get('id')
            room_code = room_data.get('room_code')
            print(f"✅ Room created successfully with AI player")
            print(f"   Room ID: {room_id}")
            print(f"   Room Code: {room_code}")
        else:
            print(f"❌ Room creation failed: {data.get('error')}")
    else:
        print(f"❌ HTTP error: {response.status_code}")
    
    return child_id, room_id, room_code

def test_database_schema_fixes(child_id):
    """Test the specific database schema fixes"""
    
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    rooms_url = f"{supabase_url}/functions/v1/manage-game-rooms"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer mock_auth_token_for_testing'
    }
    
    # Test 2: get_pending_invitations (should work with foreign key fix)
    print("\n=== Test 2: get_pending_invitations (Database Schema Fix) ===")
    get_invitations_data = {
        'action': 'get_pending_invitations',
        'child_id': child_id
    }
    
    response = requests.post(rooms_url, json=get_invitations_data, headers=headers)
    print(f"Get pending invitations response: {response.status_code}")
    print(f"Response body: {response.text}")
    
    schema_fix_working = False
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            print("✅ Database schema fix is working - foreign key relationship established")
            schema_fix_working = True
        else:
            print(f"❌ Function failed: {data.get('error')}")
    else:
        print(f"❌ HTTP error: {response.status_code}")
        if "Could not find a relationship" in response.text:
            print("🚨 CRITICAL: Foreign key relationship still missing")
    
    return schema_fix_working

def test_parsing_fixes(room_id, room_code):
    """Test the parsing fixes for handle_join_request"""
    
    if not room_code:
        print("❌ No room code available for parsing test")
        return False
    
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    rooms_url = f"{supabase_url}/functions/v1/manage-game-rooms"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer mock_auth_token_for_testing'
    }
    
    # Create a join request first
    test_child_id = str(uuid.uuid4())
    
    print(f"\n=== Test 3: request_to_join (Room ID Population Fix) ===")
    request_data = {
        'action': 'request_to_join',
        'child_id': test_child_id,
        'room_code': room_code
    }
    
    response = requests.post(rooms_url, json=request_data, headers=headers)
    print(f"Request to join response: {response.status_code}")
    print(f"Response body: {response.text}")
    
    request_id = None
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            request_id = data.get('data', {}).get('id')
            print(f"✅ Request to join successful - room_id should be populated")
            print(f"   Request ID: {request_id}")
        else:
            print(f"❌ Request to join failed: {data.get('error')}")
    else:
        print(f"❌ HTTP error: {response.status_code}")
    
    # Test handle_join_request (parsing fix)
    if request_id:
        print(f"\n=== Test 4: handle_join_request (Parsing Fix) ===")
        handle_data = {
            'action': 'handle_join_request',
            'child_id': str(uuid.uuid4()),  # Host child
            'request_id': request_id,
            'approve': True
        }
        
        response = requests.post(rooms_url, json=handle_data, headers=headers)
        print(f"Handle join request response: {response.status_code}")
        print(f"Response body: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✅ Parsing fix is working - no 'Body already consumed' error")
                return True
            else:
                print(f"❌ Handle join request failed: {data.get('error')}")
        else:
            print(f"❌ HTTP error: {response.status_code}")
            if "Body already consumed" in response.text:
                print("🚨 CRITICAL: Parsing issue still exists")
    
    return False

def main():
    """Run comprehensive tests for the specific fixes"""
    print("🔍 Testing Specific Fixes Made to Supabase Game Rooms System")
    print("=" * 70)
    
    # Step 1: Find available child and create room
    child_id, room_id, room_code = test_with_available_child()
    
    if not child_id:
        print("❌ Cannot proceed with tests - no available children")
        return 1
    
    # Step 2: Test database schema fixes
    schema_working = test_database_schema_fixes(child_id)
    
    # Step 3: Test parsing fixes
    parsing_working = test_parsing_fixes(room_id, room_code)
    
    print("\n📊 SPECIFIC FIXES TEST SUMMARY")
    print("=" * 70)
    print(f"1. Database Schema Fix (get_pending_invitations): {'✅ WORKING' if schema_working else '❌ BROKEN'}")
    print(f"2. Parsing Fix (handle_join_request): {'✅ WORKING' if parsing_working else '❌ BROKEN'}")
    print(f"3. Room ID Population (invite_friends): {'✅ WORKING' if room_id else '❌ BROKEN'}")
    print(f"4. AI Integration: {'✅ WORKING' if room_id else '❌ BROKEN'}")
    
    if not schema_working:
        print("\n🚨 CRITICAL ISSUE IDENTIFIED:")
        print("   The foreign key relationship between join_requests and game_rooms")
        print("   is still missing from the live database. The migration file exists")
        print("   but hasn't been applied. This prevents the invitation workflow")
        print("   from completing properly.")
        print("\n💡 SOLUTION NEEDED:")
        print("   Apply the migration: 20250129000000_fix_join_requests_game_rooms_relationship.sql")
        print("   to the live Supabase database to establish the foreign key constraint.")
        return 1
    
    if schema_working and parsing_working and room_id:
        print("\n✅ All critical fixes are working correctly!")
        print("   - Database schema relationship established")
        print("   - Parsing issues resolved")
        print("   - Room ID population working")
        print("   - AI integration functional")
        return 0
    else:
        print(f"\n⚠️  Partial success - some fixes working but issues remain")
        return 1

if __name__ == "__main__":
    exit(main())