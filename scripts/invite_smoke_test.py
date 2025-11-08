"""
Simple smoke test to create a room and invite friends via the manage-game-rooms edge function.

Usage (PowerShell):
  $env:VITE_SUPABASE_URL = 'https://your-project.supabase.co'
  $env:TEST_AUTH_TOKEN = 'eyJ...'
  $env:TEST_CHILD_ID = '<host_child_id>'
  $env:TEST_FRIEND_IDS = '<friend_id1>,<friend_id2>'
  python .\scripts\invite_smoke_test.py

Requires: requests (pip install requests)

This script is a minimal reproduction harness — it calls the functions endpoint the same way the frontend does
and prints the responses so you can inspect whether join_requests are created.
"""

import os
import sys
import json
import requests
import uuid

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
AUTH_TOKEN = os.getenv('TEST_AUTH_TOKEN')
HOST_CHILD_ID = os.getenv('TEST_CHILD_ID')
FRIEND_IDS_RAW = os.getenv('TEST_FRIEND_IDS', '')

if not SUPABASE_URL or not AUTH_TOKEN or not HOST_CHILD_ID:
    print('Please set VITE_SUPABASE_URL, TEST_AUTH_TOKEN and TEST_CHILD_ID environment variables')
    sys.exit(2)

FRIEND_IDS = [f.strip() for f in FRIEND_IDS_RAW.split(',') if f.strip()]

HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {AUTH_TOKEN}'
}

FUNCTION_URL = f"{SUPABASE_URL}/functions/v1/manage-game-rooms"

def post(body):
    resp = requests.post(FUNCTION_URL, headers=HEADERS, json=body)
    try:
        return resp.status_code, resp.json()
    except Exception:
        return resp.status_code, resp.text


def main():
    print('Creating room...')
    create_body = {
        'action': 'create_room',
        'child_id': HOST_CHILD_ID,
        'game_id': 'riddle',
        'difficulty': 'easy',
        'room_name': f'Test Room {uuid.uuid4().hex[:6]}',
        'friend_ids': FRIEND_IDS
    }

    status, data = post(create_body)
    print('create_room status:', status)
    print('create_room response:', json.dumps(data, indent=2) if isinstance(data, dict) else data)

    if status != 200 or not (isinstance(data, dict) and data.get('success')):
        print('Failed to create room. Aborting smoke test.')
        sys.exit(1)

    room = data.get('data')
    room_id = room.get('id') if isinstance(room, dict) else None

    if not room_id:
        print('No room_id returned; cannot invite. Aborting.')
        sys.exit(1)

    if not FRIEND_IDS:
        print('No FRIEND_IDS provided; skipping invite_friends step.')
        sys.exit(0)

    print('Inviting friends:', FRIEND_IDS)
    invite_body = {
        'action': 'invite_friends',
        'child_id': HOST_CHILD_ID,
        'room_id': room_id,
        'friend_ids': FRIEND_IDS
    }

    status, data = post(invite_body)
    print('invite_friends status:', status)
    print('invite_friends response:', json.dumps(data, indent=2) if isinstance(data, dict) else data)

    if status == 200 and isinstance(data, dict) and data.get('success'):
        print('Smoke test succeeded: invitations sent.')
        sys.exit(0)
    else:
        print('Smoke test failed: invite_friends did not return success.')
        sys.exit(1)

if __name__ == '__main__':
    main()
