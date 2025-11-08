export interface Friend {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline' | 'in-game';
  child_id: string;
}

export interface GameRoom {
  id: string;
  room_code: string;
  host_child_id: string;
  game_id: string;
  difficulty: string;
  max_players: number;
  current_players: number;
  status: 'waiting' | 'playing' | 'finished';
  has_ai_player: boolean;
  ai_player_name?: string;
  ai_player_avatar?: string;
  created_at: string;
  updated_at: string;
  host?: {
    name: string;
  };
}

export interface RoomParticipant {
  id: string;
  room_id: string;
  child_id?: string;
  player_name: string;
  player_avatar: string;
  is_ai: boolean;
  joined_at: string;
}

export interface MultiplayerGameSession {
  id: string;
  room_id: string;
  game_data?: any;
  current_turn_player_id?: string;
  game_state: 'active' | 'paused' | 'finished';
  created_at: string;
  updated_at: string;
}

export interface AIFriend {
  name: string;
  avatar: string;
  personality: string;
}