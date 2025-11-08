#!/usr/bin/env python3
"""
Test the core game room functionality that should work
"""

import requests
import json
import uuid
import os
from dotenv import load_dotenv

load_dotenv('/app/frontend/.env')

def test_core_functionality():
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    auth_token = "mock_auth_token_for_testing"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {auth_token}'
    }
    
    rooms_url = f"{supabase_url}/functions/v1/manage-game-rooms"
    
    # Use offline children to avoid "already in room" issues
    host_child_id = "2ee6aa7e-7429-43e9-8ea7-000dc8b2f94b"  # kkk
    friend_child_id = "15c85505-5c3e-4aac-a831-7bd4c1c28332"  # kk
    
    print("🎮 Testing core game room functionality...")
    print("=" * 60)
    
    # Test 1: Create room (should work)
    print("\n1️⃣ Creating game room...")
    create_data = {
        'action': 'create_room',
        'child_id': host_child_id,
        'game_id': 'word-wonder',
        'difficulty': 'medium',
        'room_name': 'Core Test Room',
        'friend_ids': []
    }
    
    response = requests.post(rooms_url, json=create_data, headers=headers)
    print(f"Create room status: {response.status_code}")
    print(f"Create room response: {response.text}")
    
    if response.status_code == 200:
        room_data = response.json()
        if room_data.get('success'):
            room_id = room_data['data']['id']
            room_code = room_data['data']['room_code']
            print(f"✅ Room created - ID: {room_id}, Code: {room_code}")
            
            # Test 2: Get room participants (should work)
            print(f"\n2️⃣ Getting room participants...")
            participants_data = {
                'action': 'get_room_participants',
                'room_id': room_id
            }
            
            response = requests.post(rooms_url, json=participants_data, headers=headers)
            print(f"Get participants status: {response.status_code}")
            print(f"Get participants response: {response.text}")
            
            if response.status_code == 200:
                participants_result = response.json()
                if participants_result.get('success'):
                    participants = participants_result.get('data', [])
                    print(f"✅ Found {len(participants)} participants")
                    for p in participants:
                        print(f"   - {p.get('player_name')} ({'AI' if p.get('is_ai') else 'Human'})")
                else:
                    print(f"❌ Get participants failed: {participants_result.get('error')}")
            
            # Test 3: Invite friends (should work with new implementation)
            print(f"\n3️⃣ Inviting friends...")
            invite_data = {
                'action': 'invite_friends',
                'child_id': host_child_id,
                'room_id': room_id,
                'friend_ids': [friend_child_id]
            }
            
            response = requests.post(rooms_url, json=invite_data, headers=headers)
            print(f"Invite friends status: {response.status_code}")
            print(f"Invite friends response: {response.text}")
            
            if response.status_code == 200:
                invite_result = response.json()
                if invite_result.get('success'):
                    print(f"✅ Invitations sent: {invite_result.get('invitations_sent', 0)}")
                else:
                    print(f"❌ Invite friends failed: {invite_result.get('error')}")
            
            # Test 4: Get pending invitations (should work with new implementation)
            print(f"\n4️⃣ Getting pending invitations...")
            invitations_data = {
                'action': 'get_pending_invitations',
                'child_id': friend_child_id
            }
            
            response = requests.post(rooms_url, json=invitations_data, headers=headers)
            print(f"Get invitations status: {response.status_code}")
            print(f"Get invitations response: {response.text}")
            
            # Test 5: Manual room join (should work)
            print(f"\n5️⃣ Manual join via room code...")
            manual_join_data = {
                'action': 'join_room',
                'child_id': friend_child_id,
                'room_code': room_code
            }
            
            response = requests.post(rooms_url, json=manual_join_data, headers=headers)
            print(f"Manual join status: {response.status_code}")
            print(f"Manual join response: {response.text}")
            
            if response.status_code == 200:
                join_result = response.json()
                if join_result.get('success'):
                    print(f"✅ Successfully joined room manually")
                    
                    # Check participants again
                    response = requests.post(rooms_url, json=participants_data, headers=headers)
                    if response.status_code == 200:
                        participants_result = response.json()
                        if participants_result.get('success'):
                            participants = participants_result.get('data', [])
                            print(f"✅ Now {len(participants)} participants in room")
                else:
                    print(f"❌ Manual join failed: {join_result.get('error')}")
        else:
            print(f"❌ Room creation failed: {room_data.get('error')}")
    else:
        print(f"❌ Create room HTTP error: {response.status_code}")
    
    print("\n" + "=" * 60)
    print("🏁 Core functionality test completed")

if __name__ == "__main__":
    test_core_functionality()