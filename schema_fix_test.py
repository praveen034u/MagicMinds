#!/usr/bin/env python3
"""
Test the schema fix function to resolve the missing foreign key relationship
"""

import requests
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

def test_schema_fix():
    """Test the schema fix function"""
    
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    auth_token = "mock_auth_token_for_testing"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {auth_token}'
    }
    
    fix_schema_url = f"{supabase_url}/functions/v1/fix-schema"
    
    print("🔧 TESTING SCHEMA FIX FUNCTION")
    print("=" * 60)
    
    # Call the schema fix function
    fix_data = {
        'action': 'fix_schema'
    }
    
    response = requests.post(fix_schema_url, json=fix_data, headers=headers)
    print(f"Schema fix response: {response.status_code}")
    print(f"Response body: {response.text}")
    
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            print("✅ Schema fix executed successfully")
            return True
        else:
            print(f"❌ Schema fix failed: {data.get('error')}")
            return False
    else:
        print(f"❌ Schema fix HTTP error: {response.status_code}")
        return False

def test_after_schema_fix():
    """Test get_pending_invitations after schema fix"""
    
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    auth_token = "mock_auth_token_for_testing"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {auth_token}'
    }
    
    rooms_url = f"{supabase_url}/functions/v1/manage-game-rooms"
    
    print("\n🧪 TESTING AFTER SCHEMA FIX")
    print("=" * 60)
    
    # Test get_pending_invitations
    get_invitations_data = {
        'action': 'get_pending_invitations',
        'child_id': "a6770634-3be5-4469-94b2-5f9b72f79a47"  # bhavya
    }
    
    response = requests.post(rooms_url, json=get_invitations_data, headers=headers)
    print(f"Get invitations response: {response.status_code}")
    print(f"Response body: {response.text}")
    
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            print("✅ get_pending_invitations: WORKING AFTER SCHEMA FIX")
            return True
        else:
            print(f"❌ get_pending_invitations failed: {data.get('error')}")
            return False
    else:
        print(f"❌ get_pending_invitations HTTP error: {response.status_code}")
        if "relationship" in response.text.lower():
            print("🚨 CRITICAL: Schema fix did not resolve the relationship error")
        return False

def main():
    """Main test execution"""
    print("🔧 SCHEMA FIX AND MANUAL JOIN TEST")
    print("=" * 60)
    
    # Step 1: Try to fix the schema
    schema_fixed = test_schema_fix()
    
    # Step 2: Test after schema fix
    if schema_fixed:
        working_after_fix = test_after_schema_fix()
        
        if working_after_fix:
            print("\n🎉 SUCCESS: Schema fix resolved the issue!")
            return 0
        else:
            print("\n🚨 ISSUE: Schema fix didn't resolve the relationship error")
            return 1
    else:
        print("\n🚨 CRITICAL: Schema fix function failed")
        return 1

if __name__ == "__main__":
    exit(main())