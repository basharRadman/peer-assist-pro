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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      conversations: {
        Row: {
          created_at: string
          helper_id: string
          id: string
          learner_id: string
          request_id: string | null
        }
        Insert: {
          created_at?: string
          helper_id: string
          id?: string
          learner_id: string
          request_id?: string | null
        }
        Update: {
          created_at?: string
          helper_id?: string
          id?: string
          learner_id?: string
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          created_at: string
          details: string
          id: string
          order_id: string
          raised_by: string
          reason: string
          resolution_note: string
          status: Database["public"]["Enums"]["dispute_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string
          id?: string
          order_id: string
          raised_by: string
          reason: string
          resolution_note?: string
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string
          id?: string
          order_id?: string
          raised_by?: string
          reason?: string
          resolution_note?: string
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          file_name: string | null
          file_url: string | null
          id: string
          sender_id: string
        }
        Insert: {
          body?: string
          conversation_id: string
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          amount: number
          created_at: string
          helper_id: string
          id: string
          message: string
          request_id: string
          status: Database["public"]["Enums"]["offer_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          helper_id: string
          id?: string
          message?: string
          request_id: string
          status?: Database["public"]["Enums"]["offer_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          helper_id?: string
          id?: string
          message?: string
          request_id?: string
          status?: Database["public"]["Enums"]["offer_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number
          created_at: string
          delivery_note: string
          delivery_url: string | null
          helper_id: string
          id: string
          learner_id: string
          offer_id: string | null
          request_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          title: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          delivery_note?: string
          delivery_url?: string | null
          helper_id: string
          id?: string
          learner_id: string
          offer_id?: string | null
          request_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          title?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          delivery_note?: string
          delivery_url?: string | null
          helper_id?: string
          id?: string
          learner_id?: string
          offer_id?: string | null
          request_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          balance: number
          bio: string
          completed_count: number
          created_at: string
          earnings: number
          education: string
          escrow_held: number
          full_name: string
          headline: string
          hourly_rate: number
          id: string
          portfolio_url: string
          rating: number
          response_minutes: number
          reviews_count: number
          role: Database["public"]["Enums"]["user_role"]
          subjects: string[]
          updated_at: string
          verified: boolean
        }
        Insert: {
          avatar_url?: string | null
          balance?: number
          bio?: string
          completed_count?: number
          created_at?: string
          earnings?: number
          education?: string
          escrow_held?: number
          full_name?: string
          headline?: string
          hourly_rate?: number
          id: string
          portfolio_url?: string
          rating?: number
          response_minutes?: number
          reviews_count?: number
          role?: Database["public"]["Enums"]["user_role"]
          subjects?: string[]
          updated_at?: string
          verified?: boolean
        }
        Update: {
          avatar_url?: string | null
          balance?: number
          bio?: string
          completed_count?: number
          created_at?: string
          earnings?: number
          education?: string
          escrow_held?: number
          full_name?: string
          headline?: string
          hourly_rate?: number
          id?: string
          portfolio_url?: string
          rating?: number
          response_minutes?: number
          reviews_count?: number
          role?: Database["public"]["Enums"]["user_role"]
          subjects?: string[]
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      requests: {
        Row: {
          attachment_url: string | null
          budget: number
          created_at: string
          deadline: string | null
          description: string
          id: string
          learner_id: string
          status: Database["public"]["Enums"]["request_status"]
          subject: string
          title: string
          topic: string
          updated_at: string
          urgency: Database["public"]["Enums"]["urgency_level"]
        }
        Insert: {
          attachment_url?: string | null
          budget?: number
          created_at?: string
          deadline?: string | null
          description?: string
          id?: string
          learner_id: string
          status?: Database["public"]["Enums"]["request_status"]
          subject: string
          title: string
          topic?: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
        }
        Update: {
          attachment_url?: string | null
          budget?: number
          created_at?: string
          deadline?: string | null
          description?: string
          id?: string
          learner_id?: string
          status?: Database["public"]["Enums"]["request_status"]
          subject?: string
          title?: string
          topic?: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string
          created_at: string
          helper_id: string
          id: string
          order_id: string
          rating: number
          reviewer_id: string
        }
        Insert: {
          comment?: string
          created_at?: string
          helper_id: string
          id?: string
          order_id: string
          rating: number
          reviewer_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          helper_id?: string
          id?: string
          order_id?: string
          rating?: number
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          note: string
          order_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          note?: string
          order_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          note?: string
          order_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_offer: { Args: { _offer_id: string }; Returns: string }
      add_demo_funds: { Args: { _amount: number }; Returns: number }
      grant_admin_by_email: { Args: { _email: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      refund_escrow: {
        Args: { _note?: string; _order_id: string }
        Returns: undefined
      }
      release_escrow: { Args: { _order_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      dispute_status:
        | "open"
        | "resolved_released"
        | "resolved_refunded"
        | "rejected"
      offer_status: "pending" | "accepted" | "declined" | "withdrawn"
      order_status:
        | "in_escrow"
        | "under_review"
        | "completed"
        | "refunded"
        | "disputed"
        | "cancelled"
      request_status: "open" | "matched" | "completed"
      urgency_level: "low" | "normal" | "urgent"
      user_role: "learner" | "helper" | "both"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
      dispute_status: [
        "open",
        "resolved_released",
        "resolved_refunded",
        "rejected",
      ],
      offer_status: ["pending", "accepted", "declined", "withdrawn"],
      order_status: [
        "in_escrow",
        "under_review",
        "completed",
        "refunded",
        "disputed",
        "cancelled",
      ],
      request_status: ["open", "matched", "completed"],
      urgency_level: ["low", "normal", "urgent"],
      user_role: ["learner", "helper", "both"],
    },
  },
} as const
