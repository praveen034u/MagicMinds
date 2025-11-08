#!/usr/bin/env python3
"""
Focused Backend Testing for Supabase Game Rooms Fixes
Tests the specific fixes mentioned in the review request:
1. Database Schema Fix for get_pending_invitations
2. Parsing Fix for handle_join_request 
3. Updated invitation workflow with room_id population
"""

import requests
import json
import uuid
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

class FocusedGameRoomsTest:
    def __init__(self):
        self.supabase_url = os.getenv('VITE_SUPABASE_URL')
        self.supabase_key = os.getenv('VITE_SUPABASE_PUBLISHABLE_KEY')
        
        # Use real child IDs that exist in the database
        self.test_child_1 = "a6770634-3be5-4469-94b2-5f9b72f79a47"  # bhavya
        self.test_child_2 = "cb8bf3d1-57a4-4d12-9427-869a4eb3770d"  # Shivam
        self.test_child_3 = "3fedd400-7d90-4c33-86e5-350b5827ff71"  # Jjj
        
        # Mock auth token
        self.auth_token = "mock_auth_token_for_testing"
        
        self.headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.auth_token}'
        }
        
        self.rooms_url = f"{self.supabase_url}/functions/v1/manage-game-rooms"
        
        print(f"🎯 FOCUSED TESTING: Supabase Game Rooms Fixes")
        print(f"Testing at: {self.supabase_url}")
        print("=" * 60)

    def test_database_schema_fix(self):
        """Test Fix #1: Database Schema Fix for get_pending_invitations"""
        print("\n🔧 TESTING FIX #1: Database Schema Fix")
        print("Testing get_pending_invitations function...")
        
        # Test get_pending_invitations with a valid child_id
        get_invitations_data = {
            'action': 'get_pending_invitations',
            'child_id': self.test_child_1
        }
        
        response = requests.post(self.rooms_url, json=get_invitations_data, headers=self.headers)
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✅ SCHEMA FIX SUCCESS: get_pending_invitations works without schema errors")
                return True
            else:
                print(f"❌ SCHEMA FIX FAILED: {data.get('error')}")
                return False
        else:
            print(f"❌ SCHEMA FIX FAILED: HTTP {response.status_code}")
            if "Could not find a relationship" in response.text:
                print("🚨 CRITICAL: Database schema relationship still missing!")
            return False

    def test_parsing_fix(self):
        """Test Fix #2: Parsing Fix for handle_join_request"""
        print("\n🔧 TESTING FIX #2: Parsing Fix for handle_join_request")
        print("Testing handle_join_request function...")
        
        # First, create a room to test with
        create_room_data = {
            'action': 'create_room',
            'child_id': self.test_child_1,
            'game_id': 'word-wonder',
            'difficulty': 'medium',
            'room_name': 'Test Room for Parsing Fix',
            'friend_ids': []
        }
        
        response = requests.post(self.rooms_url, json=create_room_data, headers=self.headers)
        if response.status_code != 200:
            print(f"❌ Could not create test room: {response.text}")
            return False
            
        room_data = response.json()
        if not room_data.get('success'):
            print(f"❌ Could not create test room: {room_data.get('error')}")
            return False
            
        room_code = room_data.get('data', {}).get('room_code')
        print(f"Created test room with code: {room_code}")
        
        # Create a join request
        request_join_data = {
            'action': 'request_to_join',
            'child_id': self.test_child_2,
            'room_code': room_code
        }
        
        response = requests.post(self.rooms_url, json=request_join_data, headers=self.headers)
        if response.status_code != 200:
            print(f"❌ Could not create join request: {response.text}")
            return False
            
        request_data = response.json()
        if not request_data.get('success'):
            print(f"❌ Could not create join request: {request_data.get('error')}")
            return False
            
        request_id = request_data.get('data', {}).get('id')
        print(f"Created join request with ID: {request_id}")
        
        # Now test handle_join_request (this should not have "Body already consumed" errors)
        handle_request_data = {
            'action': 'handle_join_request',
            'child_id': self.test_child_1,  # Host
            'request_id': request_id,
            'approve': True
        }
        
        response = requests.post(self.rooms_url, json=handle_request_data, headers=self.headers)
        print(f"Handle join request response status: {response.status_code}")
        print(f"Handle join request response body: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✅ PARSING FIX SUCCESS: handle_join_request works without parsing errors")
                return True
            else:
                error_msg = data.get('error', '')
                if "Body already consumed" in error_msg:
                    print("❌ PARSING FIX FAILED: Still getting 'Body already consumed' error")
                else:
                    print(f"❌ PARSING FIX FAILED: {error_msg}")
                return False
        else:
            print(f"❌ PARSING FIX FAILED: HTTP {response.status_code}")
            return False

    def test_invitation_workflow_with_room_id(self):
        """Test Fix #3: Updated invitation workflow with room_id population"""
        print("\n🔧 TESTING FIX #3: Invitation Workflow with room_id Population")
        print("Testing complete invitation workflow...")
        
        # Create a room
        create_room_data = {
            'action': 'create_room',
            'child_id': self.test_child_1,
            'game_id': 'word-wonder',
            'difficulty': 'medium',
            'room_name': 'Test Room for Invitations',
            'friend_ids': []
        }
        
        response = requests.post(self.rooms_url, json=create_room_data, headers=self.headers)
        if response.status_code != 200:
            print(f"❌ Could not create test room: {response.text}")
            return False
            
        room_data = response.json()
        if not room_data.get('success'):
            print(f"❌ Could not create test room: {room_data.get('error')}")
            return False
            
        room_id = room_data.get('data', {}).get('id')
        room_code = room_data.get('data', {}).get('room_code')
        print(f"Created test room - ID: {room_id}, Code: {room_code}")
        
        # Invite friends to room (should populate room_id)
        invite_data = {
            'action': 'invite_friends',
            'child_id': self.test_child_1,
            'room_id': room_id,
            'friend_ids': [self.test_child_3]
        }
        
        response = requests.post(self.rooms_url, json=invite_data, headers=self.headers)
        print(f"Invite friends response status: {response.status_code}")
        print(f"Invite friends response body: {response.text}")
        
        if response.status_code != 200:
            print(f"❌ INVITATION WORKFLOW FAILED: HTTP {response.status_code}")
            return False
            
        invite_response = response.json()
        if not invite_response.get('success'):
            print(f"❌ INVITATION WORKFLOW FAILED: {invite_response.get('error')}")
            return False
            
        print(f"✅ Invitations sent: {invite_response.get('invitations_sent', 0)}")
        
        # Test get_pending_invitations for the invited friend
        get_invitations_data = {
            'action': 'get_pending_invitations',
            'child_id': self.test_child_3
        }
        
        response = requests.post(self.rooms_url, json=get_invitations_data, headers=self.headers)
        print(f"Get pending invitations response status: {response.status_code}")
        print(f"Get pending invitations response body: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                invitations = data.get('data', [])
                if len(invitations) > 0:
                    invitation = invitations[0]
                    if invitation.get('room_id') == room_id:
                        print("✅ INVITATION WORKFLOW SUCCESS: room_id properly populated in invitations")
                        return True
                    else:
                        print(f"❌ INVITATION WORKFLOW FAILED: room_id not populated correctly. Expected: {room_id}, Got: {invitation.get('room_id')}")
                        return False
                else:
                    print("❌ INVITATION WORKFLOW FAILED: No pending invitations found")
                    return False
            else:
                print(f"❌ INVITATION WORKFLOW FAILED: {data.get('error')}")
                return False
        else:
            print(f"❌ INVITATION WORKFLOW FAILED: HTTP {response.status_code}")
            return False

    def run_focused_tests(self):
        """Run all focused tests for the specific fixes"""
        print("🚀 Starting Focused Game Rooms Fix Testing")
        print("=" * 60)
        
        results = {
            'database_schema_fix': False,
            'parsing_fix': False,
            'invitation_workflow_fix': False
        }
        
        # Test 1: Database Schema Fix
        results['database_schema_fix'] = self.test_database_schema_fix()
        
        # Test 2: Parsing Fix (only if schema fix works)
        if results['database_schema_fix']:
            results['parsing_fix'] = self.test_parsing_fix()
        else:
            print("\n⚠️  Skipping parsing fix test due to schema issues")
        
        # Test 3: Invitation Workflow Fix (only if schema fix works)
        if results['database_schema_fix']:
            results['invitation_workflow_fix'] = self.test_invitation_workflow_with_room_id()
        else:
            print("\n⚠️  Skipping invitation workflow test due to schema issues")
        
        # Summary
        print("\n📊 FOCUSED TEST RESULTS")
        print("=" * 60)
        
        total_tests = len(results)
        passed_tests = sum(1 for result in results.values() if result)
        
        print(f"Database Schema Fix: {'✅ PASSED' if results['database_schema_fix'] else '❌ FAILED'}")
        print(f"Parsing Fix: {'✅ PASSED' if results['parsing_fix'] else '❌ FAILED'}")
        print(f"Invitation Workflow Fix: {'✅ PASSED' if results['invitation_workflow_fix'] else '❌ FAILED'}")
        
        print(f"\nOverall: {passed_tests}/{total_tests} fixes working")
        
        if not results['database_schema_fix']:
            print("\n🚨 CRITICAL ISSUE: Database schema relationship between join_requests and game_rooms is still missing!")
            print("   This prevents the invitation system from working properly.")
            print("   The foreign key constraint 'join_requests_room_id_fkey' needs to be created.")
        
        return results

def main():
    """Main test execution"""
    test_suite = FocusedGameRoomsTest()
    results = test_suite.run_focused_tests()
    
    # Return exit code based on results
    if not any(results.values()):
        return 1
    else:
        return 0

if __name__ == "__main__":
    exit(main())