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
      annonces: {
        Row: {
          auction_id: string
          coureur_id: string
          created_at: string | null
          id: string
          losers_json: Json | null
          published: boolean | null
          published_at: string | null
          round_number: number
          type: string
          winning_amount: number | null
          winning_manager_id: string | null
        }
        Insert: {
          auction_id: string
          coureur_id: string
          created_at?: string | null
          id?: string
          losers_json?: Json | null
          published?: boolean | null
          published_at?: string | null
          round_number: number
          type: string
          winning_amount?: number | null
          winning_manager_id?: string | null
        }
        Update: {
          auction_id?: string
          coureur_id?: string
          created_at?: string | null
          id?: string
          losers_json?: Json | null
          published?: boolean | null
          published_at?: string | null
          round_number?: number
          type?: string
          winning_amount?: number | null
          winning_manager_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "annonces_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annonces_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "coureurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annonces_winning_manager_id_fkey"
            columns: ["winning_manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
        ]
      }
      auctions: {
        Row: {
          closed_at: string | null
          created_at: string | null
          deadline_at: string
          id: string
          phase_id: string | null
          round_number: number
          statut: Database["public"]["Enums"]["auction_statut"] | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string | null
          deadline_at: string
          id?: string
          phase_id?: string | null
          round_number: number
          statut?: Database["public"]["Enums"]["auction_statut"] | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string | null
          deadline_at?: string
          id?: string
          phase_id?: string | null
          round_number?: number
          statut?: Database["public"]["Enums"]["auction_statut"] | null
        }
        Relationships: [
          {
            foreignKeyName: "auctions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
        ]
      }
      audits: {
        Row: {
          action: string
          actor_manager_id: string | null
          created_at: string | null
          id: string
          payload_json: string | null
        }
        Insert: {
          action: string
          actor_manager_id?: string | null
          created_at?: string | null
          id?: string
          payload_json?: string | null
        }
        Update: {
          action?: string
          actor_manager_id?: string | null
          created_at?: string | null
          id?: string
          payload_json?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audits_actor_manager_id_fkey"
            columns: ["actor_manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
        ]
      }
      bids: {
        Row: {
          auction_id: string | null
          coureur_id: string | null
          created_at: string | null
          id: string
          manager_id: string | null
          montant: number
          round_number: number
          statut: Database["public"]["Enums"]["bid_statut"] | null
        }
        Insert: {
          auction_id?: string | null
          coureur_id?: string | null
          created_at?: string | null
          id?: string
          manager_id?: string | null
          montant: number
          round_number: number
          statut?: Database["public"]["Enums"]["bid_statut"] | null
        }
        Update: {
          auction_id?: string | null
          coureur_id?: string | null
          created_at?: string | null
          id?: string
          manager_id?: string | null
          montant?: number
          round_number?: number
          statut?: Database["public"]["Enums"]["bid_statut"] | null
        }
        Relationships: [
          {
            foreignKeyName: "bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "coureurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
        ]
      }
      coureurs: {
        Row: {
          equipe: string | null
          id: string
          nom: string
          prix_initial: number
          uci_id: string | null
        }
        Insert: {
          equipe?: string | null
          id: string
          nom: string
          prix_initial: number
          uci_id?: string | null
        }
        Update: {
          equipe?: string | null
          id?: string
          nom?: string
          prix_initial?: number
          uci_id?: string | null
        }
        Relationships: []
      }
      courses: {
        Row: {
          categorie: string
          date_debut: string | null
          date_fin: string | null
          id: string
          nom: string
          phase_id: string | null
          statut: Database["public"]["Enums"]["race_statut"] | null
          type_course: string | null
          uci_code: string | null
        }
        Insert: {
          categorie: string
          date_debut?: string | null
          date_fin?: string | null
          id: string
          nom: string
          phase_id?: string | null
          statut?: Database["public"]["Enums"]["race_statut"] | null
          type_course?: string | null
          uci_code?: string | null
        }
        Update: {
          categorie?: string
          date_debut?: string | null
          date_fin?: string | null
          id?: string
          nom?: string
          phase_id?: string | null
          statut?: Database["public"]["Enums"]["race_statut"] | null
          type_course?: string | null
          uci_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
        ]
      }
      managers: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          nom: string
          sponsor: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          nom: string
          sponsor?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          nom?: string
          sponsor?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      phases: {
        Row: {
          budget: number | null
          date_debut: string
          date_fin: string
          id: string
          index_dans_saison: number
          max_coureurs: number | null
          saison_id: string | null
          statut: Database["public"]["Enums"]["phase_statut"] | null
        }
        Insert: {
          budget?: number | null
          date_debut: string
          date_fin: string
          id?: string
          index_dans_saison: number
          max_coureurs?: number | null
          saison_id?: string | null
          statut?: Database["public"]["Enums"]["phase_statut"] | null
        }
        Update: {
          budget?: number | null
          date_debut?: string
          date_fin?: string
          id?: string
          index_dans_saison?: number
          max_coureurs?: number | null
          saison_id?: string | null
          statut?: Database["public"]["Enums"]["phase_statut"] | null
        }
        Relationships: [
          {
            foreignKeyName: "phases_saison_id_fkey"
            columns: ["saison_id"]
            isOneToOne: false
            referencedRelation: "saisons"
            referencedColumns: ["id"]
          },
        ]
      }
      points_ledger: {
        Row: {
          coureur_id: string | null
          course_id: string | null
          created_at: string | null
          etape_numero: number | null
          id: string
          manager_id: string | null
          phase_id: string | null
          points: number
          type_classement: Database["public"]["Enums"]["type_classement"]
        }
        Insert: {
          coureur_id?: string | null
          course_id?: string | null
          created_at?: string | null
          etape_numero?: number | null
          id?: string
          manager_id?: string | null
          phase_id?: string | null
          points: number
          type_classement: Database["public"]["Enums"]["type_classement"]
        }
        Update: {
          coureur_id?: string | null
          course_id?: string | null
          created_at?: string | null
          etape_numero?: number | null
          id?: string
          manager_id?: string | null
          phase_id?: string | null
          points?: number
          type_classement?: Database["public"]["Enums"]["type_classement"]
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "coureurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
        ]
      }
      race_results: {
        Row: {
          coureur_id: string | null
          course_id: string | null
          date_classement: string
          etape_numero: number | null
          id: string
          position: number | null
          statut: Database["public"]["Enums"]["result_statut"] | null
          type_classement: Database["public"]["Enums"]["type_classement"]
        }
        Insert: {
          coureur_id?: string | null
          course_id?: string | null
          date_classement: string
          etape_numero?: number | null
          id?: string
          position?: number | null
          statut?: Database["public"]["Enums"]["result_statut"] | null
          type_classement: Database["public"]["Enums"]["type_classement"]
        }
        Update: {
          coureur_id?: string | null
          course_id?: string | null
          date_classement?: string
          etape_numero?: number | null
          id?: string
          position?: number | null
          statut?: Database["public"]["Enums"]["result_statut"] | null
          type_classement?: Database["public"]["Enums"]["type_classement"]
        }
        Relationships: [
          {
            foreignKeyName: "race_results_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "coureurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_results_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      rosters: {
        Row: {
          coureur_id: string | null
          id: string
          manager_id: string | null
          phase_id: string | null
          prix_signature: number
        }
        Insert: {
          coureur_id?: string | null
          id?: string
          manager_id?: string | null
          phase_id?: string | null
          prix_signature: number
        }
        Update: {
          coureur_id?: string | null
          id?: string
          manager_id?: string | null
          phase_id?: string | null
          prix_signature?: number
        }
        Relationships: [
          {
            foreignKeyName: "rosters_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "coureurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rosters_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rosters_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
        ]
      }
      saisons: {
        Row: {
          annee: number
          created_at: string | null
          id: string
        }
        Insert: {
          annee: number
          created_at?: string | null
          id?: string
        }
        Update: {
          annee?: number
          created_at?: string | null
          id?: string
        }
        Relationships: []
      }
      scoring_rules: {
        Row: {
          categorie: string
          id: string
          place: number
          points: number
          type: string | null
          type_classement: Database["public"]["Enums"]["type_classement"]
        }
        Insert: {
          categorie: string
          id: string
          place: number
          points: number
          type?: string | null
          type_classement: Database["public"]["Enums"]["type_classement"]
        }
        Update: {
          categorie?: string
          id?: string
          place?: number
          points?: number
          type?: string | null
          type_classement?: Database["public"]["Enums"]["type_classement"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      get_my_roles: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      app_role: "manager" | "admin"
      auction_statut: "open" | "closed"
      bid_statut:
        | "pending"
        | "won"
        | "lost"
        | "invalid"
        | "carried_over"
        | "draft"
      phase_statut:
        | "draft"
        | "auction_open"
        | "auction_closed"
        | "active"
        | "completed"
      race_statut: "scheduled" | "completed"
      result_statut: "finished" | "dnf" | "dns" | "dsq"
      type_classement: "Etape" | "General" | "Points" | "Montagne" | "Jeune"
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
      app_role: ["manager", "admin"],
      auction_statut: ["open", "closed"],
      bid_statut: [
        "pending",
        "won",
        "lost",
        "invalid",
        "carried_over",
        "draft",
      ],
      phase_statut: [
        "draft",
        "auction_open",
        "auction_closed",
        "active",
        "completed",
      ],
      race_statut: ["scheduled", "completed"],
      result_statut: ["finished", "dnf", "dns", "dsq"],
      type_classement: ["Etape", "General", "Points", "Montagne", "Jeune"],
    },
  },
} as const
