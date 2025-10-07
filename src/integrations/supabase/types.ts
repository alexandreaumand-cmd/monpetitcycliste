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
            foreignKeyName: "annonces_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "last_closed_auction"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annonces_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "next_auction_info"
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
            foreignKeyName: "annonces_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "annonces_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "annonces_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "my_last_round_bids"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "annonces_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_manager_breakdown"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "annonces_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_top_riders_by_phase"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "annonces_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_top_riders_global"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "annonces_winning_manager_id_fkey"
            columns: ["winning_manager_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "annonces_winning_manager_id_fkey"
            columns: ["winning_manager_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "annonces_winning_manager_id_fkey"
            columns: ["winning_manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annonces_winning_manager_id_fkey"
            columns: ["winning_manager_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "annonces_winning_manager_id_fkey"
            columns: ["winning_manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_by_phase"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "annonces_winning_manager_id_fkey"
            columns: ["winning_manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_total"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "annonces_winning_manager_id_fkey"
            columns: ["winning_manager_id"]
            isOneToOne: false
            referencedRelation: "v_recent_points"
            referencedColumns: ["manager_id"]
          },
        ]
      }
      auctions: {
        Row: {
          closed_at: string | null
          created_at: string | null
          deadline_at: string
          id: string
          opens_at: string | null
          phase_id: string | null
          round_number: number
          statut: Database["public"]["Enums"]["auction_statut"] | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string | null
          deadline_at: string
          id?: string
          opens_at?: string | null
          phase_id?: string | null
          round_number: number
          statut?: Database["public"]["Enums"]["auction_statut"] | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string | null
          deadline_at?: string
          id?: string
          opens_at?: string | null
          phase_id?: string | null
          round_number?: number
          statut?: Database["public"]["Enums"]["auction_statut"] | null
        }
        Relationships: [
          {
            foreignKeyName: "auctions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "auctions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "auctions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["phase_id"]
          },
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
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "audits_actor_manager_id_fkey"
            columns: ["actor_manager_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "audits_actor_manager_id_fkey"
            columns: ["actor_manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audits_actor_manager_id_fkey"
            columns: ["actor_manager_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "audits_actor_manager_id_fkey"
            columns: ["actor_manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_by_phase"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "audits_actor_manager_id_fkey"
            columns: ["actor_manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_total"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "audits_actor_manager_id_fkey"
            columns: ["actor_manager_id"]
            isOneToOne: false
            referencedRelation: "v_recent_points"
            referencedColumns: ["manager_id"]
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
            foreignKeyName: "bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "last_closed_auction"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "next_auction_info"
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
            foreignKeyName: "bids_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "bids_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "bids_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "my_last_round_bids"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "bids_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_manager_breakdown"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "bids_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_top_riders_by_phase"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "bids_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_top_riders_global"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_by_phase"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_total"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_recent_points"
            referencedColumns: ["manager_id"]
          },
        ]
      }
      category_aliases: {
        Row: {
          alias: string
          canon: string
        }
        Insert: {
          alias: string
          canon: string
        }
        Update: {
          alias?: string
          canon?: string
        }
        Relationships: []
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
          categorie: string | null
          date_debut: string | null
          date_fin: string | null
          id: string
          nom: string
          pays: string | null
          phase_id: string | null
          statut: Database["public"]["Enums"]["race_statut"] | null
          type_course: string | null
          uci_code: string | null
          wt_tier: Database["public"]["Enums"]["wt_tier_type"] | null
        }
        Insert: {
          categorie?: string | null
          date_debut?: string | null
          date_fin?: string | null
          id: string
          nom: string
          pays?: string | null
          phase_id?: string | null
          statut?: Database["public"]["Enums"]["race_statut"] | null
          type_course?: string | null
          uci_code?: string | null
          wt_tier?: Database["public"]["Enums"]["wt_tier_type"] | null
        }
        Update: {
          categorie?: string | null
          date_debut?: string | null
          date_fin?: string | null
          id?: string
          nom?: string
          pays?: string | null
          phase_id?: string | null
          statut?: Database["public"]["Enums"]["race_statut"] | null
          type_course?: string | null
          uci_code?: string | null
          wt_tier?: Database["public"]["Enums"]["wt_tier_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "courses_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "courses_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "courses_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_fun_awards: {
        Row: {
          assigned_by: string | null
          award_type: Database["public"]["Enums"]["fun_award_type"]
          created_at: string | null
          id: string
          manager_id: string
          phase_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_by?: string | null
          award_type: Database["public"]["Enums"]["fun_award_type"]
          created_at?: string | null
          id?: string
          manager_id: string
          phase_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_by?: string | null
          award_type?: Database["public"]["Enums"]["fun_award_type"]
          created_at?: string | null
          id?: string
          manager_id?: string
          phase_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manager_fun_awards_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "manager_fun_awards_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "manager_fun_awards_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_fun_awards_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "manager_fun_awards_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_by_phase"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "manager_fun_awards_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_total"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "manager_fun_awards_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "v_recent_points"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "manager_fun_awards_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "manager_fun_awards_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "manager_fun_awards_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_fun_awards_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "manager_fun_awards_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_by_phase"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "manager_fun_awards_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_total"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "manager_fun_awards_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_recent_points"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "manager_fun_awards_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "manager_fun_awards_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "manager_fun_awards_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "manager_fun_awards_phase_id_fkey"
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
      name_aliases: {
        Row: {
          alias_text: string
          coureur_id: string
          created_at: string | null
          created_by_manager_id: string | null
          id: string
          source_team: string | null
        }
        Insert: {
          alias_text: string
          coureur_id: string
          created_at?: string | null
          created_by_manager_id?: string | null
          id?: string
          source_team?: string | null
        }
        Update: {
          alias_text?: string
          coureur_id?: string
          created_at?: string | null
          created_by_manager_id?: string | null
          id?: string
          source_team?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "name_aliases_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "coureurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "name_aliases_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "name_aliases_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "name_aliases_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "my_last_round_bids"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "name_aliases_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_manager_breakdown"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "name_aliases_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_top_riders_by_phase"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "name_aliases_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_top_riders_global"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "name_aliases_created_by_manager_id_fkey"
            columns: ["created_by_manager_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "name_aliases_created_by_manager_id_fkey"
            columns: ["created_by_manager_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "name_aliases_created_by_manager_id_fkey"
            columns: ["created_by_manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "name_aliases_created_by_manager_id_fkey"
            columns: ["created_by_manager_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "name_aliases_created_by_manager_id_fkey"
            columns: ["created_by_manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_by_phase"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "name_aliases_created_by_manager_id_fkey"
            columns: ["created_by_manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_total"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "name_aliases_created_by_manager_id_fkey"
            columns: ["created_by_manager_id"]
            isOneToOne: false
            referencedRelation: "v_recent_points"
            referencedColumns: ["manager_id"]
          },
        ]
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
            foreignKeyName: "points_ledger_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "points_ledger_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "points_ledger_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "my_last_round_bids"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "points_ledger_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_manager_breakdown"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "points_ledger_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_top_riders_by_phase"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "points_ledger_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_top_riders_global"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "points_ledger_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses_for_points_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_bareme_missing_all"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_course_points_theoriques"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "points_ledger_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_home_recent_results"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "points_ledger_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_manager_breakdown"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "points_ledger_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "points_ledger_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "points_ledger_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "points_ledger_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_by_phase"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "points_ledger_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_total"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "points_ledger_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_recent_points"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "points_ledger_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "points_ledger_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "points_ledger_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["phase_id"]
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
      race_result_sets: {
        Row: {
          course_id: string
          created_at: string
          created_by: string
          etape_numero: number | null
          id: string
          is_cancelled: boolean
          type_classement: Database["public"]["Enums"]["type_classement"]
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by: string
          etape_numero?: number | null
          id?: string
          is_cancelled?: boolean
          type_classement: Database["public"]["Enums"]["type_classement"]
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string
          etape_numero?: number | null
          id?: string
          is_cancelled?: boolean
          type_classement?: Database["public"]["Enums"]["type_classement"]
        }
        Relationships: [
          {
            foreignKeyName: "race_result_sets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_result_sets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses_for_points_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_result_sets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_bareme_missing_all"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_result_sets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_course_points_theoriques"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "race_result_sets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_home_recent_results"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "race_result_sets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_manager_breakdown"
            referencedColumns: ["course_id"]
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
          manager_id: string | null
          points: number
          position: number | null
          result_set_id: string | null
          statut: Database["public"]["Enums"]["result_statut"] | null
          type_classement: Database["public"]["Enums"]["type_classement"]
          updated_at: string | null
          updated_by_manager_id: string | null
        }
        Insert: {
          coureur_id?: string | null
          course_id?: string | null
          date_classement: string
          etape_numero?: number | null
          id?: string
          manager_id?: string | null
          points?: number
          position?: number | null
          result_set_id?: string | null
          statut?: Database["public"]["Enums"]["result_statut"] | null
          type_classement: Database["public"]["Enums"]["type_classement"]
          updated_at?: string | null
          updated_by_manager_id?: string | null
        }
        Update: {
          coureur_id?: string | null
          course_id?: string | null
          date_classement?: string
          etape_numero?: number | null
          id?: string
          manager_id?: string | null
          points?: number
          position?: number | null
          result_set_id?: string | null
          statut?: Database["public"]["Enums"]["result_statut"] | null
          type_classement?: Database["public"]["Enums"]["type_classement"]
          updated_at?: string | null
          updated_by_manager_id?: string | null
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
            foreignKeyName: "race_results_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "race_results_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "race_results_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "my_last_round_bids"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "race_results_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_manager_breakdown"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "race_results_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_top_riders_by_phase"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "race_results_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_top_riders_global"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "race_results_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_results_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses_for_points_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_results_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_bareme_missing_all"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_results_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_course_points_theoriques"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "race_results_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_home_recent_results"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "race_results_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_manager_breakdown"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "race_results_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_results_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_by_phase"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_total"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_recent_points"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_result_set_id_fkey"
            columns: ["result_set_id"]
            isOneToOne: false
            referencedRelation: "race_result_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_results_updated_by_manager_id_fkey"
            columns: ["updated_by_manager_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_updated_by_manager_id_fkey"
            columns: ["updated_by_manager_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_updated_by_manager_id_fkey"
            columns: ["updated_by_manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_results_updated_by_manager_id_fkey"
            columns: ["updated_by_manager_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_updated_by_manager_id_fkey"
            columns: ["updated_by_manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_by_phase"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_updated_by_manager_id_fkey"
            columns: ["updated_by_manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_total"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_updated_by_manager_id_fkey"
            columns: ["updated_by_manager_id"]
            isOneToOne: false
            referencedRelation: "v_recent_points"
            referencedColumns: ["manager_id"]
          },
        ]
      }
      race_results_history: {
        Row: {
          action_type: string
          change_reason: string | null
          changed_at: string
          changed_by_manager_id: string
          coureur_id: string
          course_id: string
          etape_numero: number | null
          id: string
          new_position: number | null
          new_statut: Database["public"]["Enums"]["result_statut"] | null
          old_position: number | null
          old_statut: Database["public"]["Enums"]["result_statut"] | null
          race_result_id: string | null
          type_classement: Database["public"]["Enums"]["type_classement"]
        }
        Insert: {
          action_type: string
          change_reason?: string | null
          changed_at?: string
          changed_by_manager_id: string
          coureur_id: string
          course_id: string
          etape_numero?: number | null
          id?: string
          new_position?: number | null
          new_statut?: Database["public"]["Enums"]["result_statut"] | null
          old_position?: number | null
          old_statut?: Database["public"]["Enums"]["result_statut"] | null
          race_result_id?: string | null
          type_classement: Database["public"]["Enums"]["type_classement"]
        }
        Update: {
          action_type?: string
          change_reason?: string | null
          changed_at?: string
          changed_by_manager_id?: string
          coureur_id?: string
          course_id?: string
          etape_numero?: number | null
          id?: string
          new_position?: number | null
          new_statut?: Database["public"]["Enums"]["result_statut"] | null
          old_position?: number | null
          old_statut?: Database["public"]["Enums"]["result_statut"] | null
          race_result_id?: string | null
          type_classement?: Database["public"]["Enums"]["type_classement"]
        }
        Relationships: [
          {
            foreignKeyName: "fk_coureur"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "coureurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_coureur"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "fk_coureur"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "fk_coureur"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "my_last_round_bids"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "fk_coureur"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_manager_breakdown"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "fk_coureur"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_top_riders_by_phase"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "fk_coureur"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_top_riders_global"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "fk_course"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_course"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses_for_points_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_course"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_bareme_missing_all"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_course"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_course_points_theoriques"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "fk_course"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_home_recent_results"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "fk_course"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_manager_breakdown"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "race_results_history_changed_by_manager_id_fkey"
            columns: ["changed_by_manager_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_history_changed_by_manager_id_fkey"
            columns: ["changed_by_manager_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_history_changed_by_manager_id_fkey"
            columns: ["changed_by_manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_results_history_changed_by_manager_id_fkey"
            columns: ["changed_by_manager_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_history_changed_by_manager_id_fkey"
            columns: ["changed_by_manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_by_phase"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_history_changed_by_manager_id_fkey"
            columns: ["changed_by_manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_total"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_history_changed_by_manager_id_fkey"
            columns: ["changed_by_manager_id"]
            isOneToOne: false
            referencedRelation: "v_recent_points"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_history_race_result_id_fkey"
            columns: ["race_result_id"]
            isOneToOne: false
            referencedRelation: "race_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_results_history_race_result_id_fkey"
            columns: ["race_result_id"]
            isOneToOne: false
            referencedRelation: "v_race_results_editable"
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
            foreignKeyName: "rosters_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "rosters_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "rosters_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "my_last_round_bids"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "rosters_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_manager_breakdown"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "rosters_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_top_riders_by_phase"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "rosters_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_top_riders_global"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "rosters_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "rosters_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "rosters_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rosters_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "rosters_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_by_phase"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "rosters_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_total"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "rosters_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_recent_points"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "rosters_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "rosters_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "rosters_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["phase_id"]
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
      startlist_entries: {
        Row: {
          bib_no: string | null
          confidence: number | null
          coureur_id: string | null
          created_at: string | null
          id: string
          line_no: number
          source_name: string
          source_team: string | null
          startlist_id: string
          status: Database["public"]["Enums"]["startlist_entry_status"] | null
        }
        Insert: {
          bib_no?: string | null
          confidence?: number | null
          coureur_id?: string | null
          created_at?: string | null
          id?: string
          line_no: number
          source_name: string
          source_team?: string | null
          startlist_id: string
          status?: Database["public"]["Enums"]["startlist_entry_status"] | null
        }
        Update: {
          bib_no?: string | null
          confidence?: number | null
          coureur_id?: string | null
          created_at?: string | null
          id?: string
          line_no?: number
          source_name?: string
          source_team?: string | null
          startlist_id?: string
          status?: Database["public"]["Enums"]["startlist_entry_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "startlist_entries_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "coureurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startlist_entries_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "startlist_entries_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "startlist_entries_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "my_last_round_bids"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "startlist_entries_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_manager_breakdown"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "startlist_entries_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_top_riders_by_phase"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "startlist_entries_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_top_riders_global"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "startlist_entries_startlist_id_fkey"
            columns: ["startlist_id"]
            isOneToOne: false
            referencedRelation: "startlist_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      startlist_imports: {
        Row: {
          created_at: string | null
          created_by_manager_id: string | null
          file_url: string | null
          id: string
          parsed_at: string | null
          pcs_validated: boolean | null
          pcs_validated_at: string | null
          pcs_validated_by_manager_id: string | null
          race_id: string
          raw_text: string | null
          route_image_url: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_manager_id?: string | null
          file_url?: string | null
          id?: string
          parsed_at?: string | null
          pcs_validated?: boolean | null
          pcs_validated_at?: string | null
          pcs_validated_by_manager_id?: string | null
          race_id: string
          raw_text?: string | null
          route_image_url?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_manager_id?: string | null
          file_url?: string | null
          id?: string
          parsed_at?: string | null
          pcs_validated?: boolean | null
          pcs_validated_at?: string | null
          pcs_validated_by_manager_id?: string | null
          race_id?: string
          raw_text?: string | null
          route_image_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "startlist_imports_created_by_manager_id_fkey"
            columns: ["created_by_manager_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "startlist_imports_created_by_manager_id_fkey"
            columns: ["created_by_manager_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "startlist_imports_created_by_manager_id_fkey"
            columns: ["created_by_manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startlist_imports_created_by_manager_id_fkey"
            columns: ["created_by_manager_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "startlist_imports_created_by_manager_id_fkey"
            columns: ["created_by_manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_by_phase"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "startlist_imports_created_by_manager_id_fkey"
            columns: ["created_by_manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_total"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "startlist_imports_created_by_manager_id_fkey"
            columns: ["created_by_manager_id"]
            isOneToOne: false
            referencedRelation: "v_recent_points"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "startlist_imports_pcs_validated_by_manager_id_fkey"
            columns: ["pcs_validated_by_manager_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "startlist_imports_pcs_validated_by_manager_id_fkey"
            columns: ["pcs_validated_by_manager_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "startlist_imports_pcs_validated_by_manager_id_fkey"
            columns: ["pcs_validated_by_manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startlist_imports_pcs_validated_by_manager_id_fkey"
            columns: ["pcs_validated_by_manager_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "startlist_imports_pcs_validated_by_manager_id_fkey"
            columns: ["pcs_validated_by_manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_by_phase"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "startlist_imports_pcs_validated_by_manager_id_fkey"
            columns: ["pcs_validated_by_manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_total"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "startlist_imports_pcs_validated_by_manager_id_fkey"
            columns: ["pcs_validated_by_manager_id"]
            isOneToOne: false
            referencedRelation: "v_recent_points"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "startlist_imports_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startlist_imports_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "courses_for_points_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startlist_imports_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "v_bareme_missing_all"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startlist_imports_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "v_course_points_theoriques"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "startlist_imports_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "v_home_recent_results"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "startlist_imports_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "v_manager_breakdown"
            referencedColumns: ["course_id"]
          },
        ]
      }
      startlist_manager_ratings: {
        Row: {
          created_at: string
          id: string
          manager_id: string
          note: string | null
          rated_by: string
          stars: number
          startlist_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_id: string
          note?: string | null
          rated_by: string
          stars: number
          startlist_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_id?: string
          note?: string | null
          rated_by?: string
          stars?: number
          startlist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "startlist_manager_ratings_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "startlist_manager_ratings_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "startlist_manager_ratings_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startlist_manager_ratings_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "startlist_manager_ratings_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_by_phase"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "startlist_manager_ratings_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_total"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "startlist_manager_ratings_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_recent_points"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "startlist_manager_ratings_startlist_id_fkey"
            columns: ["startlist_id"]
            isOneToOne: false
            referencedRelation: "startlist_imports"
            referencedColumns: ["id"]
          },
        ]
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
      bids_outcomes: {
        Row: {
          bid_id: string | null
          coureur_equipe: string | null
          coureur_id: string | null
          coureur_nom: string | null
          manager_id: string | null
          my_bid: number | null
          outcome: Database["public"]["Enums"]["bid_statut"] | null
          phase_id: string | null
          round_number: number | null
          winning_amount: number | null
          winning_manager: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auctions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "auctions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "auctions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "auctions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
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
            foreignKeyName: "bids_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "bids_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "bids_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "my_last_round_bids"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "bids_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_manager_breakdown"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "bids_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_top_riders_by_phase"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "bids_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_top_riders_global"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_by_phase"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_total"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_recent_points"
            referencedColumns: ["manager_id"]
          },
        ]
      }
      coureurs_disponibilite: {
        Row: {
          coureur_equipe: string | null
          coureur_id: string | null
          coureur_nom: string | null
          is_taken: boolean | null
          phase_id: string | null
          prix_initial: number | null
          search_text: string | null
          taken_by_manager_nom: string | null
        }
        Relationships: []
      }
      courses_for_points_norm: {
        Row: {
          cat_canon: string | null
          cat_raw: string | null
          id: string | null
          nom: string | null
          phase_id: string | null
          type_course: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "courses_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "courses_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "courses_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
        ]
      }
      current_round_drafts: {
        Row: {
          auction_id: string | null
          draft_count: number | null
          draft_sum: number | null
          manager_id: string | null
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
            foreignKeyName: "bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "last_closed_auction"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "next_auction_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_by_phase"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_total"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_recent_points"
            referencedColumns: ["manager_id"]
          },
        ]
      }
      last_closed_auction: {
        Row: {
          closed_at: string | null
          id: string | null
          phase_id: string | null
          round_number: number | null
        }
        Relationships: [
          {
            foreignKeyName: "auctions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "auctions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "auctions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "auctions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
        ]
      }
      last_round_winners: {
        Row: {
          coureur_equipe: string | null
          coureur_id: string | null
          coureur_nom: string | null
          manager_gagnant: string | null
          manager_id: string | null
          montant_gagnant: number | null
          phase_id: string | null
          round_number: number | null
        }
        Relationships: [
          {
            foreignKeyName: "auctions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "auctions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "auctions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "auctions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_phase_status: {
        Row: {
          budget_depense: number | null
          budget_initial: number | null
          budget_restant: number | null
          manager_id: string | null
          max_coureurs: number | null
          phase_id: string | null
          roster_count: number | null
          slots_restants: number | null
        }
        Relationships: []
      }
      managers_rosters_status: {
        Row: {
          budget_depense: number | null
          budget_restant: number | null
          manager_id: string | null
          manager_nom: string | null
          max_coureurs: number | null
          pending_count: number | null
          pending_sum: number | null
          phase_id: string | null
          roster_count: number | null
          slots_restants: number | null
        }
        Relationships: []
      }
      my_last_round_bids: {
        Row: {
          bid_id: string | null
          coureur_equipe: string | null
          coureur_id: string | null
          coureur_nom: string | null
          manager_id: string | null
          my_bid: number | null
          outcome: Database["public"]["Enums"]["bid_outcome"] | null
          phase_id: string | null
          round_number: number | null
          winning_amount: number | null
          winning_manager: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auctions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "auctions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "auctions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "auctions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_by_phase"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_total"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_recent_points"
            referencedColumns: ["manager_id"]
          },
        ]
      }
      next_auction_info: {
        Row: {
          deadline_at: string | null
          id: string | null
          label: string | null
          opens_at: string | null
          phase_id: string | null
          round_number: number | null
          statut: Database["public"]["Enums"]["auction_statut"] | null
          target_time: string | null
        }
        Insert: {
          deadline_at?: string | null
          id?: string | null
          label?: never
          opens_at?: string | null
          phase_id?: string | null
          round_number?: number | null
          statut?: Database["public"]["Enums"]["auction_statut"] | null
          target_time?: never
        }
        Update: {
          deadline_at?: string | null
          id?: string | null
          label?: never
          opens_at?: string | null
          phase_id?: string | null
          round_number?: number | null
          statut?: Database["public"]["Enums"]["auction_statut"] | null
          target_time?: never
        }
        Relationships: [
          {
            foreignKeyName: "auctions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "auctions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "auctions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "auctions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_rules_norm: {
        Row: {
          cat_canon: string | null
          place: number | null
          points: number | null
          type_canon: string | null
        }
        Relationships: []
      }
      v_bareme_missing_all: {
        Row: {
          cat_canon: string | null
          categorie: string | null
          id: string | null
          nom: string | null
        }
        Relationships: []
      }
      v_course_points_theoriques: {
        Row: {
          categorie: string | null
          categorie_for_points: string | null
          course_id: string | null
          date_debut: string | null
          date_fin: string | null
          is_uwt: boolean | null
          nb_etapes_estimees: number | null
          nb_jours: number | null
          nom: string | null
          phase_id: string | null
          phase_index: number | null
          points_etapes: number | null
          points_etapes_unitaire: number | null
          points_gc: number | null
          points_jeune: number | null
          points_mont: number | null
          points_pts: number | null
          points_total: number | null
          type_course: string | null
          wt_tier: Database["public"]["Enums"]["wt_tier_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "courses_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "courses_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "courses_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
        ]
      }
      v_home_recent_results: {
        Row: {
          course_id: string | null
          course_nom: string | null
          date_fin: string | null
          top3: Json | null
          total_points: number | null
        }
        Relationships: []
      }
      v_manager_breakdown: {
        Row: {
          coureur_id: string | null
          coureur_nom: string | null
          course_id: string | null
          course_nom: string | null
          date_debut: string | null
          date_fin: string | null
          etape_numero: number | null
          manager_id: string | null
          manager_nom: string | null
          points: number | null
          type_classement: Database["public"]["Enums"]["type_classement"] | null
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "points_ledger_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "points_ledger_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "points_ledger_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_by_phase"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "points_ledger_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_total"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "points_ledger_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_recent_points"
            referencedColumns: ["manager_id"]
          },
        ]
      }
      v_manager_standings_by_phase: {
        Row: {
          courses_count: number | null
          manager_id: string | null
          manager_nom: string | null
          phase_id: string | null
          total_points: number | null
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "points_ledger_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "points_ledger_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["phase_id"]
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
      v_manager_standings_total: {
        Row: {
          courses_count: number | null
          manager_id: string | null
          manager_nom: string | null
          total_points: number | null
        }
        Relationships: []
      }
      v_race_results_editable: {
        Row: {
          coureur_equipe: string | null
          coureur_id: string | null
          coureur_nom: string | null
          course_id: string | null
          date_classement: string | null
          etape_numero: number | null
          id: string | null
          manager_id: string | null
          manager_nom: string | null
          points: number | null
          position: number | null
          statut: Database["public"]["Enums"]["result_statut"] | null
          type_classement: Database["public"]["Enums"]["type_classement"] | null
          updated_at: string | null
          updated_by_manager_id: string | null
          updated_by_nom: string | null
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
            foreignKeyName: "race_results_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "race_results_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "race_results_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "my_last_round_bids"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "race_results_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_manager_breakdown"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "race_results_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_top_riders_by_phase"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "race_results_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_top_riders_global"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "race_results_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_results_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses_for_points_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_results_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_bareme_missing_all"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_results_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_course_points_theoriques"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "race_results_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_home_recent_results"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "race_results_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_manager_breakdown"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "race_results_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_results_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_by_phase"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_total"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_recent_points"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_updated_by_manager_id_fkey"
            columns: ["updated_by_manager_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_updated_by_manager_id_fkey"
            columns: ["updated_by_manager_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_updated_by_manager_id_fkey"
            columns: ["updated_by_manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_results_updated_by_manager_id_fkey"
            columns: ["updated_by_manager_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_updated_by_manager_id_fkey"
            columns: ["updated_by_manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_by_phase"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_updated_by_manager_id_fkey"
            columns: ["updated_by_manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_standings_total"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "race_results_updated_by_manager_id_fkey"
            columns: ["updated_by_manager_id"]
            isOneToOne: false
            referencedRelation: "v_recent_points"
            referencedColumns: ["manager_id"]
          },
        ]
      }
      v_recent_points: {
        Row: {
          jour: string | null
          manager_id: string | null
          manager_nom: string | null
          points_jour: number | null
        }
        Relationships: []
      }
      v_scoring_totals_by_category: {
        Row: {
          categorie_norm: string | null
          categorie_original: string | null
          sum_etape: number | null
          sum_gc: number | null
          sum_jeune: number | null
          sum_montagne: number | null
          sum_points: number | null
        }
        Relationships: []
      }
      v_top_riders_by_phase: {
        Row: {
          coureur_equipe: string | null
          coureur_id: string | null
          coureur_nom: string | null
          courses_count: number | null
          phase_id: string | null
          total_points: number | null
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "points_ledger_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "points_ledger_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["phase_id"]
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
      v_top_riders_global: {
        Row: {
          coureur_equipe: string | null
          coureur_id: string | null
          coureur_nom: string | null
          courses_count: number | null
          total_points: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_clean_courses_phases: {
        Args: { p_confirm_phrase: string }
        Returns: Json
      }
      admin_compute_points_for_course: {
        Args: { p_course_id: string }
        Returns: Json
      }
      admin_recompute_points_for_phase: {
        Args: { p_phase_id: string }
        Returns: Json
      }
      admin_result_save_lot: {
        Args: {
          p_course_id: string
          p_etape_numero: number
          p_rows: Json
          p_type_classement: Database["public"]["Enums"]["type_classement"]
        }
        Returns: Json
      }
      admin_result_status: {
        Args: { p_course_id: string }
        Returns: Json
      }
      admin_results_reset_all: {
        Args: { p_confirm_phrase: string }
        Returns: Json
      }
      admin_results_reset_preview: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      course_points_summary: {
        Args: { p_course_id: string; p_manager_id?: string }
        Returns: Json
      }
      find_courses_missing_porteur_points: {
        Args: Record<PropertyKey, never>
        Returns: {
          course_id: string
          course_nom: string
          missing_count: number
        }[]
      }
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
      manager_coureur_points_detail: {
        Args: { p_coureur_id: string; p_phase_id?: string }
        Returns: {
          course_nom: string
          date_classement: string
          etape_numero: number
          points: number
          total_points: number
          type_classement: string
        }[]
      }
      manager_my_team: {
        Args: { p_phase_id?: string }
        Returns: {
          cote_initiale: number
          coureur_id: string
          equipe: string
          nom: string
          points_total: number
          prix_achat: number
          ratio_points_par_prix: number
        }[]
      }
      manager_team_by_id: {
        Args: { p_manager_id: string; p_phase_id?: string }
        Returns: {
          cote_initiale: number
          coureur_id: string
          equipe: string
          nom: string
          points_total: number
          prix_achat: number
          ratio_points_par_prix: number
        }[]
      }
      normalize_text: {
        Args: { txt: string }
        Returns: string
      }
      results_course_meta: {
        Args: { p_course_id: string }
        Returns: {
          categorie: string
          course_nom: string
          date_debut: string
          date_fin: string
          etapes_disponibles: number[]
          types_disponibles: Database["public"]["Enums"]["type_classement"][]
        }[]
      }
      results_course_meta_v2: {
        Args: { p_course_id: string }
        Returns: {
          categorie: string
          course_nom: string
          date_debut: string
          date_fin: string
          etapes_disponibles: number[]
          types_disponibles: string[]
        }[]
      }
      results_course_rows: {
        Args: {
          p_course_id: string
          p_etape_numero?: number
          p_type_classement: Database["public"]["Enums"]["type_classement"]
        }
        Returns: {
          coureur_id: string
          coureur_nom: string
          equipe: string
          manager_nom: string
          points_officiels: number
          points_theoriques: number
          row_position: number
          statut: Database["public"]["Enums"]["result_statut"]
        }[]
      }
      results_course_table: {
        Args: {
          p_course_id: string
          p_etape_numero?: number
          p_manager_id?: string
          p_type_classement: Database["public"]["Enums"]["type_classement"]
        }
        Returns: {
          coureur_id: string
          coureur_nom: string
          equipe: string
          is_my_rider: boolean
          manager_id: string
          manager_nom: string
          points_officiels: number
          points_theoriques: number
          race_result_id: string
          row_position: number
          statut: Database["public"]["Enums"]["result_statut"]
        }[]
      }
      results_course_top: {
        Args: {
          p_course_id: string
          p_etape_numero?: number
          p_limit?: number
          p_manager_id?: string
          p_type_classement: Database["public"]["Enums"]["type_classement"]
        }
        Returns: {
          coureur_id: string
          coureur_nom: string
          equipe: string
          has_official_points: boolean
          is_my_rider: boolean
          manager_id: string
          manager_nom: string
          points: number
          points_officiels: number
          points_theoriques: number
          row_position: number
          statut: Database["public"]["Enums"]["result_statut"]
        }[]
      }
      results_courses_with_entries: {
        Args:
          | {
              p_limit?: number
              p_offset?: number
              p_phase_id?: string
              p_search?: string
            }
          | { p_limit?: number; p_offset?: number; p_search?: string }
        Returns: {
          categorie: string
          course_id: string
          date_debut: string
          date_fin: string
          last_result_at: string
          nom: string
          types: string[]
        }[]
      }
      results_latest_feed: {
        Args: { p_limit?: number }
        Returns: {
          coureur_id: string
          coureur_nom: string
          course_categorie: string
          course_id: string
          course_nom: string
          equipe: string
          etape_numero: number
          is_official_points: boolean
          manager_id: string
          manager_nom: string
          points_affiches: number
          points_officiels: number
          result_date: string
          row_position: number
          statut: Database["public"]["Enums"]["result_statut"]
          type_classement: Database["public"]["Enums"]["type_classement"]
        }[]
      }
      results_recent_races: {
        Args: {
          p_limit?: number
          p_manager_id?: string
          p_phase_id?: string
          p_saison_id?: string
          p_search?: string
        }
        Returns: {
          categorie: string
          course_id: string
          date_debut: string
          date_fin: string
          has_points: boolean
          last_result_at: string
          my_points: number
          nom: string
          phase_id: string
          types: Database["public"]["Enums"]["type_classement"][]
        }[]
      }
      search_riders_for_results: {
        Args: { p_phase_id: string; p_query?: string }
        Returns: {
          coureur_id: string
          coureur_nom: string
          manager_nom: string
        }[]
      }
      search_riders_paginated: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_phase_id: string
          p_query?: string
        }
        Returns: {
          coureur_id: string
          coureur_nom: string
          manager_nom: string
          total_count: number
        }[]
      }
      unaccent: {
        Args: { "": string }
        Returns: string
      }
      unaccent_init: {
        Args: { "": unknown }
        Returns: unknown
      }
      verify_course_save: {
        Args: { p_course_id: string }
        Returns: {
          manager_attribs: number
          result_count: number
          result_scored: number
        }[]
      }
    }
    Enums: {
      app_role: "manager" | "admin"
      auction_statut: "open" | "closed" | "scheduled"
      bid_outcome: "won" | "lost" | "carried_over"
      bid_statut:
        | "pending"
        | "won"
        | "lost"
        | "invalid"
        | "carried_over"
        | "draft"
      fun_award_type: "funniest" | "grumpiest" | "luckiest"
      phase_statut:
        | "draft"
        | "auction_open"
        | "auction_closed"
        | "active"
        | "completed"
      race_statut: "scheduled" | "completed"
      result_statut: "finished" | "dnf" | "dns" | "dsq"
      startlist_entry_status: "parsed" | "unmatched" | "confirmed"
      type_classement:
        | "Etape"
        | "General"
        | "Points"
        | "Montagne"
        | "Jeune"
        | "Porteur Général"
        | "Porteur Vert"
        | "Porteur Montagne"
        | "Porteur Jeune"
        | "Porteur Combattif"
      wt_tier_type:
        | "GT"
        | "Monument"
        | "WT_Tours_1"
        | "WT_Tours_2"
        | "WT_Tours_3"
        | "WT_Classiques_1"
        | "WT_Classiques_2"
        | "WT_Classiques_3"
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
      auction_statut: ["open", "closed", "scheduled"],
      bid_outcome: ["won", "lost", "carried_over"],
      bid_statut: [
        "pending",
        "won",
        "lost",
        "invalid",
        "carried_over",
        "draft",
      ],
      fun_award_type: ["funniest", "grumpiest", "luckiest"],
      phase_statut: [
        "draft",
        "auction_open",
        "auction_closed",
        "active",
        "completed",
      ],
      race_statut: ["scheduled", "completed"],
      result_statut: ["finished", "dnf", "dns", "dsq"],
      startlist_entry_status: ["parsed", "unmatched", "confirmed"],
      type_classement: [
        "Etape",
        "General",
        "Points",
        "Montagne",
        "Jeune",
        "Porteur Général",
        "Porteur Vert",
        "Porteur Montagne",
        "Porteur Jeune",
        "Porteur Combattif",
      ],
      wt_tier_type: [
        "GT",
        "Monument",
        "WT_Tours_1",
        "WT_Tours_2",
        "WT_Tours_3",
        "WT_Classiques_1",
        "WT_Classiques_2",
        "WT_Classiques_3",
      ],
    },
  },
} as const
