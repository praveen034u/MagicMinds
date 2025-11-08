export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      children_profiles: {
        Row: {
          age_group: string
          avatar: string | null
          created_at: string
          id: string
          is_online: boolean | null
          last_seen_at: string | null
          name: string
          parent_id: string
          room_id: string | null
          updated_at: string
          voice_clone_enabled: boolean | null
          voice_clone_url: string | null
        }
        Insert: {
          age_group: string
          avatar?: string | null
          created_at?: string
          id?: string
          is_online?: boolean | null
          last_seen_at?: string | null
          name: string
          parent_id: string
          room_id?: string | null
          updated_at?: string
          voice_clone_enabled?: boolean | null
          voice_clone_url?: string | null
        }
        Update: {
          age_group?: string
          avatar?: string | null
          created_at?: string
          id?: string
          is_online?: boolean | null
          last_seen_at?: string | null
          name?: string
          parent_id?: string
          room_id?: string | null
          updated_at?: string
          voice_clone_enabled?: boolean | null
          voice_clone_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "children_profiles_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parent_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_profiles_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      friends: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friends_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "children_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friends_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "children_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_rooms: {
        Row: {
          ai_player_avatar: string | null
          ai_player_name: string | null
          created_at: string
          current_players: number
          difficulty: string
          game_id: string
          has_ai_player: boolean
          host_child_id: string
          id: string
          max_players: number
          room_code: string
          status: string
          updated_at: string
        }
        Insert: {
          ai_player_avatar?: string | null
          ai_player_name?: string | null
          created_at?: string
          current_players?: number
          difficulty: string
          game_id: string
          has_ai_player?: boolean
          host_child_id: string
          id?: string
          max_players?: number
          room_code: string
          status?: string
          updated_at?: string
        }
        Update: {
          ai_player_avatar?: string | null
          ai_player_name?: string | null
          created_at?: string
          current_players?: number
          difficulty?: string
          game_id?: string
          has_ai_player?: boolean
          host_child_id?: string
          id?: string
          max_players?: number
          room_code?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_rooms_host_child_id_fkey"
            columns: ["host_child_id"]
            isOneToOne: false
            referencedRelation: "children_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_stories: {
        Row: {
          audio_url: string | null
          child_id: string
          content: string
          created_at: string
          id: string
          title: string
        }
        Insert: {
          audio_url?: string | null
          child_id: string
          content: string
          created_at?: string
          id?: string
          title: string
        }
        Update: {
          audio_url?: string | null
          child_id?: string
          content?: string
          created_at?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_stories_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      join_requests: {
        Row: {
          child_id: string
          created_at: string
          id: string
          player_avatar: string | null
          player_name: string
          room_code: string
          status: string
          updated_at: string
        }
        Insert: {
          child_id: string
          created_at?: string
          id?: string
          player_avatar?: string | null
          player_name: string
          room_code: string
          status?: string
          updated_at?: string
        }
        Update: {
          child_id?: string
          created_at?: string
          id?: string
          player_avatar?: string | null
          player_name?: string
          room_code?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      multiplayer_game_scores: {
        Row: {
          child_id: string | null
          created_at: string
          id: string
          is_ai: boolean
          player_avatar: string | null
          player_name: string
          room_id: string
          score: number
          total_questions: number
          updated_at: string
        }
        Insert: {
          child_id?: string | null
          created_at?: string
          id?: string
          is_ai?: boolean
          player_avatar?: string | null
          player_name: string
          room_id: string
          score?: number
          total_questions?: number
          updated_at?: string
        }
        Update: {
          child_id?: string | null
          created_at?: string
          id?: string
          is_ai?: boolean
          player_avatar?: string | null
          player_name?: string
          room_id?: string
          score?: number
          total_questions?: number
          updated_at?: string
        }
        Relationships: []
      }
      multiplayer_game_sessions: {
        Row: {
          created_at: string
          current_turn_player_id: string | null
          game_data: Json | null
          game_state: string
          id: string
          room_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_turn_player_id?: string | null
          game_data?: Json | null
          game_state?: string
          id?: string
          room_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_turn_player_id?: string | null
          game_data?: Json | null
          game_state?: string
          id?: string
          room_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "multiplayer_game_sessions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_profiles: {
        Row: {
          auth0_user_id: string
          created_at: string
          email: string
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          auth0_user_id: string
          created_at?: string
          email: string
          id?: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          auth0_user_id?: string
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      room_participants: {
        Row: {
          child_id: string | null
          id: string
          is_ai: boolean
          joined_at: string
          player_avatar: string | null
          player_name: string
          room_id: string
        }
        Insert: {
          child_id?: string | null
          id?: string
          is_ai?: boolean
          joined_at?: string
          player_avatar?: string | null
          player_name: string
          room_id: string
        }
        Update: {
          child_id?: string | null
          id?: string
          is_ai?: boolean
          joined_at?: string
          player_avatar?: string | null
          player_name?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_participants_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_subscriptions: {
        Row: {
          created_at: string
          id: string
          parent_id: string
          plan_type: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_id: string
          plan_type?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_id?: string
          plan_type?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_subscriptions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      set_config: {
        Args: { setting: string; value: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
