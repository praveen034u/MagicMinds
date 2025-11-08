#!/usr/bin/env python3
"""
Focused test for manual join fixes in Supabase game rooms functions
Tests specifically the get_pending_invitations and accept_invitation fixes
"""

import requests
import json
import uuid
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

class ManualJoinTestSuite:
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
        
        print(f"Testing manual join fixes at: {self.supabase_url}")

    def test_manual_join_fixes(self):
        """Test the specific manual join fixes for get_pending_invitations and accept_invitation"""
        
        rooms_url = f"{self.supabase_url}/functions/v1/manage-game-rooms"
        
        print("\n🔧 TESTING MANUAL JOIN FIXES")
        print("=" * 60)
        
        # Test 1: Test get_pending_invitations with manual join
        print("\n=== Testing get_pending_invitations (Manual Join Fix) ===")
        get_invitations_data = {
            'action': 'get_pending_invitations',
            'child_id': self.test_child_1
        }
        
        response = requests.post(rooms_url, json=get_invitations_data, headers=self.headers)
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✅ get_pending_invitations: MANUAL JOIN FIX WORKING")
                print(f"Invitations found: {len(data.get('data', []))}")
                return True
            else:
                print(f"❌ get_pending_invitations failed: {data.get('error')}")
                return False
        else:
            print(f"❌ get_pending_invitations HTTP error: {response.status_code}")
            if "relationship" in response.text.lower():
                print("🚨 CRITICAL: Manual join fix is NOT working - still getting relationship error")
            return False

    def test_complete_invitation_workflow(self):
        """Test the complete invitation workflow with manual joins"""
        
        rooms_url = f"{self.supabase_url}/functions/v1/manage-game-rooms"
        
        print("\n🔄 TESTING COMPLETE INVITATION WORKFLOW")
        print("=" * 60)
        
        # Step 1: Create a room (if possible)
        print("\n=== Step 1: Create Room ===")
        create_room_data = {
            'action': 'create_room',
            'child_id': self.test_child_1,
            'game_id': 'word-wonder',
            'difficulty': 'medium',
            'room_name': 'Manual Join Test Room',
            'friend_ids': []
        }
        
        response = requests.post(rooms_url, json=create_room_data, headers=self.headers)
        print(f"Create room response: {response.status_code}")
        print(f"Response body: {response.text}")
        
        room_code = None
        room_id = None
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                room_code = data.get('data', {}).get('room_code')
                room_id = data.get('data', {}).get('id')
                print(f"✅ Room created successfully - Code: {room_code}")
            else:
                print(f"❌ Room creation failed: {data.get('error')}")
                # Try to continue with existing room if user is already in one
                if "already in another room" in data.get('error', ''):
                    print("ℹ️  User already in room, continuing with invitation tests...")
        
        # Step 2: Test get_pending_invitations regardless of room creation
        print("\n=== Step 2: Test get_pending_invitations ===")
        get_invitations_data = {
            'action': 'get_pending_invitations',
            'child_id': self.test_child_2
        }
        
        response = requests.post(rooms_url, json=get_invitations_data, headers=self.headers)
        print(f"Get invitations response: {response.status_code}")
        print(f"Response body: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✅ get_pending_invitations: WORKING WITH MANUAL JOIN")
                invitations = data.get('data', [])
                print(f"Found {len(invitations)} pending invitations")
                
                # Test accept_invitation if we have invitations
                if invitations:
                    invitation_id = invitations[0].get('id')
                    print(f"\n=== Step 3: Test accept_invitation (ID: {invitation_id}) ===")
                    
                    accept_data = {
                        'action': 'accept_invitation',
                        'child_id': self.test_child_2,
                        'invitation_id': invitation_id
                    }
                    
                    response = requests.post(rooms_url, json=accept_data, headers=self.headers)
                    print(f"Accept invitation response: {response.status_code}")
                    print(f"Response body: {response.text}")
                    
                    if response.status_code == 200:
                        data = response.json()
                        if data.get('success'):
                            print("✅ accept_invitation: WORKING WITH MANUAL JOIN")
                            return True
                        else:
                            print(f"❌ accept_invitation failed: {data.get('error')}")
                    else:
                        print(f"❌ accept_invitation HTTP error: {response.status_code}")
                else:
                    print("ℹ️  No pending invitations to test accept_invitation")
                    return True  # get_pending_invitations worked
            else:
                print(f"❌ get_pending_invitations failed: {data.get('error')}")
                return False
        else:
            print(f"❌ get_pending_invitations HTTP error: {response.status_code}")
            if "relationship" in response.text.lower():
                print("🚨 CRITICAL: Manual join fix is NOT working")
            return False

    def test_error_handling(self):
        """Test error handling with invalid IDs"""
        
        rooms_url = f"{self.supabase_url}/functions/v1/manage-game-rooms"
        
        print("\n🚫 TESTING ERROR HANDLING")
        print("=" * 60)
        
        # Test with invalid invitation ID
        print("\n=== Testing accept_invitation with invalid ID ===")
        invalid_accept_data = {
            'action': 'accept_invitation',
            'child_id': self.test_child_1,
            'invitation_id': str(uuid.uuid4())  # Random UUID that doesn't exist
        }
        
        response = requests.post(rooms_url, json=invalid_accept_data, headers=self.headers)
        print(f"Invalid accept response: {response.status_code}")
        print(f"Response body: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if not data.get('success'):
                print("✅ Error handling: Properly rejected invalid invitation ID")
                return True
            else:
                print("❌ Error handling: Should have rejected invalid invitation ID")
                return False
        else:
            print(f"❌ Error handling HTTP error: {response.status_code}")
            return False

    def run_manual_join_tests(self):
        """Run all manual join tests"""
        print("🧪 MANUAL JOIN FIXES TEST SUITE")
        print("=" * 60)
        
        results = {
            'manual_join_fix': False,
            'complete_workflow': False,
            'error_handling': False
        }
        
        # Test 1: Basic manual join fix
        results['manual_join_fix'] = self.test_manual_join_fixes()
        
        # Test 2: Complete workflow
        results['complete_workflow'] = self.test_complete_invitation_workflow()
        
        # Test 3: Error handling
        results['error_handling'] = self.test_error_handling()
        
        # Summary
        print("\n📊 MANUAL JOIN TESTS SUMMARY")
        print("=" * 60)
        passed = sum(results.values())
        total = len(results)
        
        print(f"Manual Join Fix: {'✅' if results['manual_join_fix'] else '❌'}")
        print(f"Complete Workflow: {'✅' if results['complete_workflow'] else '❌'}")
        print(f"Error Handling: {'✅' if results['error_handling'] else '❌'}")
        print(f"\nOverall: {passed}/{total} tests passed")
        
        if results['manual_join_fix']:
            print("\n🎉 MANUAL JOIN FIXES ARE WORKING!")
        else:
            print("\n🚨 MANUAL JOIN FIXES ARE NOT WORKING!")
            print("The relationship error is still occurring despite the code changes.")
        
        return results

def main():
    """Main test execution"""
    test_suite = ManualJoinTestSuite()
    results = test_suite.run_manual_join_tests()
    
    # Return exit code based on results
    if not results['manual_join_fix']:
        return 1
    else:
        return 0

if __name__ == "__main__":
    exit(main())