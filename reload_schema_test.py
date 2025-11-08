#!/usr/bin/env python3
"""
Test reloading the Supabase schema cache to fix the relationship error
"""

import requests
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

def reload_schema_cache():
    """Try to reload the schema cache using SQL"""
    
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    supabase_key = os.getenv('VITE_SUPABASE_PUBLISHABLE_KEY')
    auth_token = "mock_auth_token_for_testing"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {auth_token}',
        'apikey': supabase_key
    }
    
    # Try to execute SQL to reload schema cache
    sql_url = f"{supabase_url}/rest/v1/rpc/exec_sql"
    
    print("🔄 ATTEMPTING TO RELOAD SCHEMA CACHE")
    print("=" * 60)
    
    # Try different methods to reload schema cache
    reload_commands = [
        "NOTIFY pgrst, 'reload schema';",
        "NOTIFY ddl_command_end;",
        "SELECT pg_notify('pgrst', 'reload schema');"
    ]
    
    for i, command in enumerate(reload_commands, 1):
        print(f"\n=== Method {i}: {command} ===")
        
        reload_data = {
            'sql': command
        }
        
        response = requests.post(sql_url, json=reload_data, headers=headers)
        print(f"Response: {response.status_code}")
        print(f"Response body: {response.text}")
        
        if response.status_code == 200:
            print(f"✅ Method {i}: Schema cache reload command executed")
        else:
            print(f"❌ Method {i}: Failed to execute reload command")

def test_after_cache_reload():
    """Test get_pending_invitations after cache reload"""
    
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    auth_token = "mock_auth_token_for_testing"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {auth_token}'
    }
    
    rooms_url = f"{supabase_url}/functions/v1/manage-game-rooms"
    
    print("\n🧪 TESTING AFTER CACHE RELOAD")
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
            print("✅ get_pending_invitations: WORKING AFTER CACHE RELOAD")
            return True
        else:
            print(f"❌ get_pending_invitations failed: {data.get('error')}")
            return False
    else:
        print(f"❌ get_pending_invitations HTTP error: {response.status_code}")
        if "relationship" in response.text.lower():
            print("🚨 CRITICAL: Cache reload did not resolve the relationship error")
        return False

def main():
    """Main test execution"""
    print("🔄 SCHEMA CACHE RELOAD TEST")
    print("=" * 60)
    
    # Step 1: Try to reload schema cache
    reload_schema_cache()
    
    # Step 2: Test after cache reload
    working_after_reload = test_after_cache_reload()
    
    if working_after_reload:
        print("\n🎉 SUCCESS: Schema cache reload resolved the issue!")
        return 0
    else:
        print("\n🚨 ISSUE: Schema cache reload didn't resolve the relationship error")
        print("The manual join code should work, but there might be another issue.")
        return 1

if __name__ == "__main__":
    exit(main())