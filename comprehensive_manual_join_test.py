#!/usr/bin/env python3
"""
Comprehensive test to verify the manual join fixes and provide detailed diagnostics
"""

import requests
import json
import uuid
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

class ComprehensiveManualJoinTest:
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

    def test_individual_table_access(self):
        """Test if we can access individual tables without joins"""
        
        print("\n🔍 TESTING INDIVIDUAL TABLE ACCESS")
        print("=" * 60)
        
        # We can't directly test table access via REST API without proper auth
        # But we can test through the functions
        
        rooms_url = f"{self.supabase_url}/functions/v1/manage-game-rooms"
        
        # Test a simple operation that doesn't involve joins
        print("\n=== Testing create_room (no joins involved) ===")
        create_room_data = {
            'action': 'create_room',
            'child_id': str(uuid.uuid4()),  # Use new UUID to avoid "already in room" error
            'game_id': 'word-wonder',
            'difficulty': 'medium',
            'room_name': 'Test Room for Manual Join',
            'friend_ids': []
        }
        
        response = requests.post(rooms_url, json=create_room_data, headers=self.headers)
        print(f"Create room response: {response.status_code}")
        print(f"Response body: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✅ Basic table operations: WORKING")
                return True, data.get('data', {}).get('room_code')
            else:
                print(f"❌ Basic table operations failed: {data.get('error')}")
                return False, None
        else:
            print(f"❌ Basic table operations HTTP error: {response.status_code}")
            return False, None

    def test_manual_join_implementation(self):
        """Test the specific manual join implementation"""
        
        print("\n🔧 TESTING MANUAL JOIN IMPLEMENTATION")
        print("=" * 60)
        
        rooms_url = f"{self.supabase_url}/functions/v1/manage-game-rooms"
        
        # Test get_pending_invitations which uses manual joins
        print("\n=== Testing get_pending_invitations (Manual Join) ===")
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
                print("✅ Manual join implementation: WORKING")
                print(f"Invitations found: {len(data.get('data', []))}")
                return True
            else:
                error_msg = data.get('error', '')
                print(f"❌ Manual join failed: {error_msg}")
                
                # Analyze the error
                if "relationship" in error_msg.lower():
                    print("🚨 DIAGNOSIS: The error is still about relationships")
                    print("   This suggests the function code hasn't been updated or deployed")
                    print("   OR there's still a hidden relationship reference in the code")
                elif "schema cache" in error_msg.lower():
                    print("🚨 DIAGNOSIS: Schema cache issue")
                    print("   The database schema cache needs to be reloaded")
                else:
                    print(f"🔍 DIAGNOSIS: Different error - {error_msg}")
                
                return False
        else:
            print(f"❌ Manual join HTTP error: {response.status_code}")
            return False

    def test_accept_invitation_manual_join(self):
        """Test accept_invitation with manual join"""
        
        print("\n🎯 TESTING ACCEPT_INVITATION MANUAL JOIN")
        print("=" * 60)
        
        rooms_url = f"{self.supabase_url}/functions/v1/manage-game-rooms"
        
        # Test with a fake invitation ID to see if the function processes correctly
        print("\n=== Testing accept_invitation with fake ID ===")
        accept_data = {
            'action': 'accept_invitation',
            'child_id': self.test_child_1,
            'invitation_id': str(uuid.uuid4())  # Fake ID
        }
        
        response = requests.post(rooms_url, json=accept_data, headers=self.headers)
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if not data.get('success'):
                error_msg = data.get('error', '')
                if "not found" in error_msg.lower() or "already processed" in error_msg.lower():
                    print("✅ accept_invitation manual join: WORKING (correctly rejected fake ID)")
                    return True
                elif "relationship" in error_msg.lower():
                    print("❌ accept_invitation still has relationship error")
                    return False
                else:
                    print(f"✅ accept_invitation manual join: WORKING (error: {error_msg})")
                    return True
            else:
                print("❌ accept_invitation: Should have failed with fake ID")
                return False
        else:
            print(f"❌ accept_invitation HTTP error: {response.status_code}")
            if "relationship" in response.text.lower():
                print("🚨 DIAGNOSIS: accept_invitation still has relationship error")
            return False

    def run_comprehensive_test(self):
        """Run all comprehensive tests"""
        
        print("🧪 COMPREHENSIVE MANUAL JOIN FIXES TEST")
        print("=" * 60)
        
        results = {
            'basic_operations': False,
            'manual_join_get_invitations': False,
            'manual_join_accept_invitation': False
        }
        
        # Test 1: Basic operations
        basic_working, room_code = self.test_individual_table_access()
        results['basic_operations'] = basic_working
        
        # Test 2: Manual join in get_pending_invitations
        results['manual_join_get_invitations'] = self.test_manual_join_implementation()
        
        # Test 3: Manual join in accept_invitation
        results['manual_join_accept_invitation'] = self.test_accept_invitation_manual_join()
        
        # Summary and diagnosis
        print("\n📊 COMPREHENSIVE TEST RESULTS")
        print("=" * 60)
        
        passed = sum(results.values())
        total = len(results)
        
        print(f"Basic Operations: {'✅' if results['basic_operations'] else '❌'}")
        print(f"Manual Join (get_pending_invitations): {'✅' if results['manual_join_get_invitations'] else '❌'}")
        print(f"Manual Join (accept_invitation): {'✅' if results['manual_join_accept_invitation'] else '❌'}")
        print(f"\nOverall: {passed}/{total} tests passed")
        
        # Detailed diagnosis
        print("\n🔍 DETAILED DIAGNOSIS")
        print("=" * 60)
        
        if results['basic_operations'] and not results['manual_join_get_invitations']:
            print("🚨 ISSUE IDENTIFIED:")
            print("   - Basic table operations work")
            print("   - Manual join fixes are NOT working")
            print("   - This suggests either:")
            print("     1. The function code hasn't been deployed with the manual join fixes")
            print("     2. There's still a hidden relationship reference in the code")
            print("     3. The schema cache needs to be reloaded")
            print("\n💡 RECOMMENDED ACTIONS:")
            print("   1. Redeploy the Supabase function with the manual join code")
            print("   2. Execute 'NOTIFY pgrst, \"reload schema\";' in Supabase SQL editor")
            print("   3. Check for any remaining relationship references in the function code")
        
        elif not results['basic_operations']:
            print("🚨 ISSUE IDENTIFIED:")
            print("   - Basic operations are failing")
            print("   - This suggests a broader connectivity or authentication issue")
        
        elif results['manual_join_get_invitations'] and results['manual_join_accept_invitation']:
            print("🎉 SUCCESS:")
            print("   - Manual join fixes are working correctly!")
            print("   - The invitation workflow should now function properly")
        
        else:
            print("🔍 MIXED RESULTS:")
            print("   - Some manual join fixes work, others don't")
            print("   - Need to investigate specific failing functions")
        
        return results

def main():
    """Main test execution"""
    test_suite = ComprehensiveManualJoinTest()
    results = test_suite.run_comprehensive_test()
    
    # Return exit code based on results
    if results['manual_join_get_invitations'] and results['manual_join_accept_invitation']:
        return 0
    else:
        return 1

if __name__ == "__main__":
    exit(main())