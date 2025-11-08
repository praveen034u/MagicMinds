#!/usr/bin/env python3
"""
Test the manual join fixes directly without relying on foreign keys
"""

import requests
import json
import uuid
import os
from dotenv import load_dotenv

load_dotenv('/app/frontend/.env')

def test_manual_joins():
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    auth_token = "mock_auth_token_for_testing"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {auth_token}'
    }
    
    rooms_url = f"{supabase_url}/functions/v1/manage-game-rooms"
    
    # Use available children (not in rooms)
    host_child_id = "86479007-e843-4c1d-8e45-c02516d19524"  # Kkkk
    friend_child_id = "d771b6d0-1c90-431b-af96-dd6bf7a429f5"  # llll
    
    print("🎯 Testing manual joins in game rooms functions...")
    print("=" * 60)
    
    # Step 1: Create a room
    print("\n1️⃣ Creating game room...")
    create_data = {
        'action': 'create_room',
        'child_id': host_child_id,
        'game_id': 'word-wonder',
        'difficulty': 'medium',
        'room_name': 'Manual Join Test Room',
        'friend_ids': []
    }
    
    response = requests.post(rooms_url, json=create_data, headers=headers)
    print(f"Create room status: {response.status_code}")
    print(f"Create room response: {response.text}")
    
    if response.status_code != 200:
        print("❌ Failed to create room, stopping test")
        return
    
    room_data = response.json()
    if not room_data.get('success'):
        print(f"❌ Room creation failed: {room_data.get('error')}")
        return
    
    room_id = room_data['data']['id']
    room_code = room_data['data']['room_code']
    print(f"✅ Room created - ID: {room_id}, Code: {room_code}")
    
    # Step 2: Test request_to_join (this should work)
    print(f"\n2️⃣ Testing request_to_join with room code: {room_code}")
    join_request_data = {
        'action': 'request_to_join',
        'child_id': friend_child_id,
        'room_code': room_code
    }
    
    response = requests.post(rooms_url, json=join_request_data, headers=headers)
    print(f"Request to join status: {response.status_code}")
    print(f"Request to join response: {response.text}")
    
    if response.status_code == 200:
        join_data = response.json()
        if join_data.get('success'):
            request_id = join_data['data']['id']
            print(f"✅ Join request created - ID: {request_id}")
            
            # Step 3: Test get_pending_invitations (manual join fix)
            print(f"\n3️⃣ Testing get_pending_invitations (manual join)...")
            invitations_data = {
                'action': 'get_pending_invitations',
                'child_id': friend_child_id
            }
            
            response = requests.post(rooms_url, json=invitations_data, headers=headers)
            print(f"Get invitations status: {response.status_code}")
            print(f"Get invitations response: {response.text}")
            
            if response.status_code == 200:
                inv_data = response.json()
                if inv_data.get('success'):
                    invitations = inv_data.get('data', [])
                    print(f"✅ Got {len(invitations)} invitations")
                    for inv in invitations:
                        print(f"   - Invitation: {inv.get('id')} from {inv.get('player_name')}")
                        if 'game_rooms' in inv:
                            print(f"     Game: {inv['game_rooms'].get('game_id')}, Status: {inv['game_rooms'].get('status')}")
                else:
                    print(f"❌ Get invitations failed: {inv_data.get('error')}")
            else:
                print(f"❌ Get invitations HTTP error: {response.status_code}")
            
            # Step 4: Test handle_join_request (should work now)
            print(f"\n4️⃣ Testing handle_join_request (host approves)...")
            handle_data = {
                'action': 'handle_join_request',
                'child_id': host_child_id,
                'request_id': request_id,
                'approve': True
            }
            
            response = requests.post(rooms_url, json=handle_data, headers=headers)
            print(f"Handle request status: {response.status_code}")
            print(f"Handle request response: {response.text}")
            
            if response.status_code == 200:
                handle_result = response.json()
                if handle_result.get('success'):
                    print("✅ Join request handled successfully")
                else:
                    print(f"❌ Handle request failed: {handle_result.get('error')}")
            else:
                print(f"❌ Handle request HTTP error: {response.status_code}")
        else:
            print(f"❌ Join request failed: {join_data.get('error')}")
    else:
        print(f"❌ Request to join HTTP error: {response.status_code}")
    
    print("\n" + "=" * 60)
    print("🏁 Manual join test completed")

if __name__ == "__main__":
    test_manual_joins()