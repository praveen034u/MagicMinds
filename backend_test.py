#!/usr/bin/env python3
"""
Backend Testing Suite for Supabase Functions
Tests friends management and game rooms management functions
"""

import requests
import json
import time
import uuid
from typing import Dict, Any, List
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

class SupabaseTestSuite:
    def __init__(self):
        self.base_url = os.getenv('REACT_APP_BACKEND_URL', 'https://hub-supabase.preview.emergentagent.com')
        self.supabase_url = os.getenv('VITE_SUPABASE_URL')
        self.supabase_key = os.getenv('VITE_SUPABASE_PUBLISHABLE_KEY')
        
        # Use real child IDs that exist in the database
        self.test_child_1 = "a6770634-3be5-4469-94b2-5f9b72f79a47"  # bhavya
        self.test_child_2 = "cb8bf3d1-57a4-4d12-9427-869a4eb3770d"  # Shivam
        self.test_child_3 = "3fedd400-7d90-4c33-86e5-350b5827ff71"  # Jjj
        
        # Mock auth token (in real scenario this would be from Supabase auth)
        self.auth_token = "mock_auth_token_for_testing"
        
        self.headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.auth_token}'
        }
        
        print(f"Testing Supabase functions at: {self.supabase_url}")
        print(f"Backend URL: {self.base_url}")
        print("⚠️  NOTE: Tests may fail due to missing test data in database")
        print("⚠️  Foreign key constraints require existing children_profiles records")

    def test_function_connectivity(self) -> Dict[str, Any]:
        """Test basic connectivity to Supabase functions"""
        results = {
            'friends_function_accessible': False,
            'rooms_function_accessible': False,
            'errors': []
        }
        
        friends_url = f"{self.supabase_url}/functions/v1/manage-friends"
        rooms_url = f"{self.supabase_url}/functions/v1/manage-game-rooms"
        
        try:
            # Test friends function with a simple list operation
            print("\n=== Testing Friends Function Connectivity ===")
            list_data = {
                'action': 'list_friends',
                'child_id': str(uuid.uuid4())  # Use proper UUID format
            }
            
            response = requests.post(friends_url, json=list_data, headers=self.headers)
            print(f"Friends function response: {response.status_code}")
            print(f"Response body: {response.text}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') is not None:  # Function responded properly
                    results['friends_function_accessible'] = True
                    print("✅ Friends function: ACCESSIBLE")
                else:
                    results['errors'].append("Friends function returned malformed response")
                    print("❌ Friends function returned malformed response")
            else:
                results['errors'].append(f"Friends function HTTP error: {response.status_code}")
                print(f"❌ Friends function HTTP error: {response.status_code}")

            # Test rooms function with a simple get operation
            print("\n=== Testing Rooms Function Connectivity ===")
            get_data = {
                'action': 'get_pending_invitations',
                'child_id': str(uuid.uuid4())  # Use proper UUID format
            }
            
            response = requests.post(rooms_url, json=get_data, headers=self.headers)
            print(f"Rooms function response: {response.status_code}")
            print(f"Response body: {response.text}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') is not None:  # Function responded properly
                    results['rooms_function_accessible'] = True
                    print("✅ Rooms function: ACCESSIBLE")
                else:
                    results['errors'].append("Rooms function returned malformed response")
                    print("❌ Rooms function returned malformed response")
            else:
                results['errors'].append(f"Rooms function HTTP error: {response.status_code}")
                print(f"❌ Rooms function HTTP error: {response.status_code}")

        except Exception as e:
            results['errors'].append(f"Connectivity test exception: {str(e)}")
            print(f"❌ Connectivity test exception: {str(e)}")
        
        return results

    def test_friends_management(self) -> Dict[str, Any]:
        """Test all friends management functions"""
        results = {
            'send_friend_request': False,
            'accept_friend_request': False,
            'decline_friend_request': False,
            'list_friends': False,
            'get_friend_requests': False,
            'search_children': False,
            'errors': []
        }
        
        friends_url = f"{self.supabase_url}/functions/v1/manage-friends"
        
        try:
            # Test 1: Send friend request
            print("\n=== Testing send_friend_request ===")
            send_request_data = {
                'action': 'send_friend_request',
                'child_id': self.test_child_1,
                'friend_child_id': self.test_child_2
            }
            
            response = requests.post(friends_url, json=send_request_data, headers=self.headers)
            print(f"Send friend request response: {response.status_code}")
            print(f"Response body: {response.text}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    results['send_friend_request'] = True
                    print("✅ Send friend request: SUCCESS")
                else:
                    results['errors'].append(f"Send friend request failed: {data.get('error')}")
                    print(f"❌ Send friend request failed: {data.get('error')}")
            else:
                results['errors'].append(f"Send friend request HTTP error: {response.status_code}")
                print(f"❌ Send friend request HTTP error: {response.status_code}")

            # Test 2: Get friend requests
            print("\n=== Testing get_friend_requests ===")
            get_requests_data = {
                'action': 'get_friend_requests',
                'child_id': self.test_child_2
            }
            
            response = requests.post(friends_url, json=get_requests_data, headers=self.headers)
            print(f"Get friend requests response: {response.status_code}")
            print(f"Response body: {response.text}")
            
            friend_request_id = None
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    results['get_friend_requests'] = True
                    print("✅ Get friend requests: SUCCESS")
                    # Get the friend request ID for acceptance test
                    if data.get('data') and len(data['data']) > 0:
                        friend_request_id = data['data'][0].get('id')
                        print(f"Found friend request ID: {friend_request_id}")
                else:
                    results['errors'].append(f"Get friend requests failed: {data.get('error')}")
                    print(f"❌ Get friend requests failed: {data.get('error')}")
            else:
                results['errors'].append(f"Get friend requests HTTP error: {response.status_code}")
                print(f"❌ Get friend requests HTTP error: {response.status_code}")

            # Test 3: Accept friend request (if we have a request ID)
            if friend_request_id:
                print("\n=== Testing accept_friend_request ===")
                accept_request_data = {
                    'action': 'accept_friend_request',
                    'friend_request_id': friend_request_id
                }
                
                response = requests.post(friends_url, json=accept_request_data, headers=self.headers)
                print(f"Accept friend request response: {response.status_code}")
                print(f"Response body: {response.text}")
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('success'):
                        results['accept_friend_request'] = True
                        print("✅ Accept friend request: SUCCESS")
                    else:
                        results['errors'].append(f"Accept friend request failed: {data.get('error')}")
                        print(f"❌ Accept friend request failed: {data.get('error')}")
                else:
                    results['errors'].append(f"Accept friend request HTTP error: {response.status_code}")
                    print(f"❌ Accept friend request HTTP error: {response.status_code}")

            # Test 4: List friends
            print("\n=== Testing list_friends ===")
            list_friends_data = {
                'action': 'list_friends',
                'child_id': self.test_child_1
            }
            
            response = requests.post(friends_url, json=list_friends_data, headers=self.headers)
            print(f"List friends response: {response.status_code}")
            print(f"Response body: {response.text}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    results['list_friends'] = True
                    print("✅ List friends: SUCCESS")
                    print(f"Friends found: {len(data.get('data', []))}")
                else:
                    results['errors'].append(f"List friends failed: {data.get('error')}")
                    print(f"❌ List friends failed: {data.get('error')}")
            else:
                results['errors'].append(f"List friends HTTP error: {response.status_code}")
                print(f"❌ List friends HTTP error: {response.status_code}")

            # Test 5: Search children
            print("\n=== Testing search_children ===")
            search_data = {
                'action': 'search_children',
                'child_id': self.test_child_1,
                'search_query': 'test'
            }
            
            response = requests.post(friends_url, json=search_data, headers=self.headers)
            print(f"Search children response: {response.status_code}")
            print(f"Response body: {response.text}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    results['search_children'] = True
                    print("✅ Search children: SUCCESS")
                    print(f"Children found: {len(data.get('data', []))}")
                else:
                    results['errors'].append(f"Search children failed: {data.get('error')}")
                    print(f"❌ Search children failed: {data.get('error')}")
            else:
                results['errors'].append(f"Search children HTTP error: {response.status_code}")
                print(f"❌ Search children HTTP error: {response.status_code}")

            # Test 6: Test decline friend request (send another request first)
            print("\n=== Testing decline_friend_request ===")
            # Send another friend request
            decline_request_data = {
                'action': 'send_friend_request',
                'child_id': self.test_child_3,
                'friend_child_id': self.test_child_1
            }
            
            response = requests.post(friends_url, json=decline_request_data, headers=self.headers)
            if response.status_code == 200:
                # Get the new request
                get_requests_data = {
                    'action': 'get_friend_requests',
                    'child_id': self.test_child_1
                }
                
                response = requests.post(friends_url, json=get_requests_data, headers=self.headers)
                if response.status_code == 200:
                    data = response.json()
                    if data.get('success') and data.get('data'):
                        new_request_id = data['data'][0].get('id')
                        
                        # Now decline it
                        decline_data = {
                            'action': 'decline_friend_request',
                            'friend_request_id': new_request_id
                        }
                        
                        response = requests.post(friends_url, json=decline_data, headers=self.headers)
                        if response.status_code == 200:
                            data = response.json()
                            if data.get('success'):
                                results['decline_friend_request'] = True
                                print("✅ Decline friend request: SUCCESS")
                            else:
                                results['errors'].append(f"Decline friend request failed: {data.get('error')}")
                                print(f"❌ Decline friend request failed: {data.get('error')}")

        except Exception as e:
            results['errors'].append(f"Friends management test exception: {str(e)}")
            print(f"❌ Friends management test exception: {str(e)}")
        
        return results

    def test_game_rooms_management(self) -> Dict[str, Any]:
        """Test all game rooms management functions"""
        results = {
            'create_room': False,
            'join_room': False,
            'invite_friends': False,
            'handle_join_request': False,
            'accept_invitation': False,
            'get_pending_invitations': False,
            'errors': []
        }
        
        rooms_url = f"{self.supabase_url}/functions/v1/manage-game-rooms"
        
        try:
            # Test 1: Create room
            print("\n=== Testing create_room ===")
            create_room_data = {
                'action': 'create_room',
                'child_id': self.test_child_1,
                'game_id': 'word-wonder',
                'difficulty': 'medium',
                'room_name': 'Test Room',
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
                    results['create_room'] = True
                    room_code = data.get('data', {}).get('room_code')
                    room_id = data.get('data', {}).get('id')
                    print(f"✅ Create room: SUCCESS - Room code: {room_code}")
                else:
                    results['errors'].append(f"Create room failed: {data.get('error')}")
                    print(f"❌ Create room failed: {data.get('error')}")
            else:
                results['errors'].append(f"Create room HTTP error: {response.status_code}")
                print(f"❌ Create room HTTP error: {response.status_code}")

            # Test 2: Join room (if we have a room code)
            if room_code:
                print("\n=== Testing join_room ===")
                join_room_data = {
                    'action': 'join_room',
                    'child_id': self.test_child_2,
                    'room_code': room_code
                }
                
                response = requests.post(rooms_url, json=join_room_data, headers=self.headers)
                print(f"Join room response: {response.status_code}")
                print(f"Response body: {response.text}")
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('success'):
                        results['join_room'] = True
                        print("✅ Join room: SUCCESS")
                    else:
                        results['errors'].append(f"Join room failed: {data.get('error')}")
                        print(f"❌ Join room failed: {data.get('error')}")
                else:
                    results['errors'].append(f"Join room HTTP error: {response.status_code}")
                    print(f"❌ Join room HTTP error: {response.status_code}")

            # Test 3: Invite friends (if we have a room)
            if room_id:
                print("\n=== Testing invite_friends ===")
                invite_data = {
                    'action': 'invite_friends',
                    'child_id': self.test_child_1,
                    'room_id': room_id,
                    'friend_ids': [self.test_child_3]
                }
                
                response = requests.post(rooms_url, json=invite_data, headers=self.headers)
                print(f"Invite friends response: {response.status_code}")
                print(f"Response body: {response.text}")
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('success'):
                        results['invite_friends'] = True
                        print(f"✅ Invite friends: SUCCESS - Invitations sent: {data.get('invitations_sent', 0)}")
                    else:
                        results['errors'].append(f"Invite friends failed: {data.get('error')}")
                        print(f"❌ Invite friends failed: {data.get('error')}")
                else:
                    results['errors'].append(f"Invite friends HTTP error: {response.status_code}")
                    print(f"❌ Invite friends HTTP error: {response.status_code}")

            # Test 4: Get pending invitations
            print("\n=== Testing get_pending_invitations ===")
            get_invitations_data = {
                'action': 'get_pending_invitations',
                'child_id': self.test_child_3
            }
            
            response = requests.post(rooms_url, json=get_invitations_data, headers=self.headers)
            print(f"Get pending invitations response: {response.status_code}")
            print(f"Response body: {response.text}")
            
            invitation_id = None
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    results['get_pending_invitations'] = True
                    print("✅ Get pending invitations: SUCCESS")
                    if data.get('data') and len(data['data']) > 0:
                        invitation_id = data['data'][0].get('id')
                        print(f"Found invitation ID: {invitation_id}")
                else:
                    results['errors'].append(f"Get pending invitations failed: {data.get('error')}")
                    print(f"❌ Get pending invitations failed: {data.get('error')}")
            else:
                results['errors'].append(f"Get pending invitations HTTP error: {response.status_code}")
                print(f"❌ Get pending invitations HTTP error: {response.status_code}")

            # Test 5: Accept invitation (if we have an invitation)
            if invitation_id:
                print("\n=== Testing accept_invitation ===")
                accept_invitation_data = {
                    'action': 'accept_invitation',
                    'child_id': self.test_child_3,
                    'invitation_id': invitation_id
                }
                
                response = requests.post(rooms_url, json=accept_invitation_data, headers=self.headers)
                print(f"Accept invitation response: {response.status_code}")
                print(f"Response body: {response.text}")
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('success'):
                        results['accept_invitation'] = True
                        print("✅ Accept invitation: SUCCESS")
                    else:
                        results['errors'].append(f"Accept invitation failed: {data.get('error')}")
                        print(f"❌ Accept invitation failed: {data.get('error')}")
                else:
                    results['errors'].append(f"Accept invitation HTTP error: {response.status_code}")
                    print(f"❌ Accept invitation HTTP error: {response.status_code}")

            # Test 6: Request to join (test the manual join request flow)
            print("\n=== Testing request_to_join ===")
            if room_code:
                request_join_data = {
                    'action': 'request_to_join',
                    'child_id': str(uuid.uuid4()),  # New test user
                    'room_code': room_code
                }
                
                response = requests.post(rooms_url, json=request_join_data, headers=self.headers)
                print(f"Request to join response: {response.status_code}")
                print(f"Response body: {response.text}")
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('success'):
                        print("✅ Request to join: SUCCESS")
                        request_id = data.get('data', {}).get('id')
                        
                        # Test handle_join_request
                        if request_id:
                            print("\n=== Testing handle_join_request ===")
                            handle_request_data = {
                                'action': 'handle_join_request',
                                'child_id': self.test_child_1,  # Host
                                'request_id': request_id,
                                'approve': True
                            }
                            
                            response = requests.post(rooms_url, json=handle_request_data, headers=self.headers)
                            print(f"Handle join request response: {response.status_code}")
                            print(f"Response body: {response.text}")
                            
                            if response.status_code == 200:
                                data = response.json()
                                if data.get('success'):
                                    results['handle_join_request'] = True
                                    print("✅ Handle join request: SUCCESS")
                                else:
                                    results['errors'].append(f"Handle join request failed: {data.get('error')}")
                                    print(f"❌ Handle join request failed: {data.get('error')}")
                            else:
                                results['errors'].append(f"Handle join request HTTP error: {response.status_code}")
                                print(f"❌ Handle join request HTTP error: {response.status_code}")

        except Exception as e:
            results['errors'].append(f"Game rooms management test exception: {str(e)}")
            print(f"❌ Game rooms management test exception: {str(e)}")
        
        return results

    def run_all_tests(self) -> Dict[str, Any]:
        """Run all tests and return comprehensive results"""
        print("🚀 Starting Supabase Functions Test Suite")
        print("=" * 60)
        
        # Test basic connectivity first
        print("\n🔗 TESTING FUNCTION CONNECTIVITY")
        print("=" * 60)
        connectivity_results = self.test_function_connectivity()
        
        # Test friends management
        print("\n📱 TESTING FRIENDS MANAGEMENT FUNCTIONS")
        print("=" * 60)
        friends_results = self.test_friends_management()
        
        # Test game rooms management  
        print("\n🎮 TESTING GAME ROOMS MANAGEMENT FUNCTIONS")
        print("=" * 60)
        rooms_results = self.test_game_rooms_management()
        
        # Compile overall results
        overall_results = {
            'connectivity': connectivity_results,
            'friends_management': friends_results,
            'game_rooms_management': rooms_results,
            'summary': {
                'total_tests': 0,
                'passed_tests': 0,
                'failed_tests': 0,
                'all_errors': []
            }
        }
        
        # Calculate summary
        for category in [connectivity_results, friends_results, rooms_results]:
            for test_name, result in category.items():
                if test_name != 'errors':
                    overall_results['summary']['total_tests'] += 1
                    if result:
                        overall_results['summary']['passed_tests'] += 1
                    else:
                        overall_results['summary']['failed_tests'] += 1
            
            overall_results['summary']['all_errors'].extend(category.get('errors', []))
        
        # Print summary
        print("\n📊 TEST SUMMARY")
        print("=" * 60)
        summary = overall_results['summary']
        print(f"Total Tests: {summary['total_tests']}")
        print(f"Passed: {summary['passed_tests']}")
        print(f"Failed: {summary['failed_tests']}")
        print(f"Success Rate: {(summary['passed_tests']/summary['total_tests']*100):.1f}%")
        
        if summary['all_errors']:
            print(f"\n❌ ERRORS FOUND ({len(summary['all_errors'])}):")
            for i, error in enumerate(summary['all_errors'], 1):
                print(f"{i}. {error}")
        
        return overall_results

def main():
    """Main test execution"""
    test_suite = SupabaseTestSuite()
    results = test_suite.run_all_tests()
    
    # Return exit code based on results
    if results['summary']['failed_tests'] > 0:
        print(f"\n❌ Tests completed with {results['summary']['failed_tests']} failures")
        return 1
    else:
        print(f"\n✅ All {results['summary']['passed_tests']} tests passed!")
        return 0

if __name__ == "__main__":
    exit(main())