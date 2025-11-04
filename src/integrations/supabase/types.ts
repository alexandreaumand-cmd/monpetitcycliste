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
            referencedColumns: ["id"]
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
            referencedRelation: "v_coureurs_saisons_admin"
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
        ]
      }
      announcement_banner: {
        Row: {
          id: string
          is_active: boolean
          message: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          is_active?: boolean
          message?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          is_active?: boolean
          message?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_banner_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "announcement_banner_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "announcement_banner_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_banner_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
        ]
      }
      app_feature_flags: {
        Row: {
          description: string | null
          flag_name: string
          is_enabled: boolean
          updated_at: string | null
        }
        Insert: {
          description?: string | null
          flag_name: string
          is_enabled?: boolean
          updated_at?: string | null
        }
        Update: {
          description?: string | null
          flag_name?: string
          is_enabled?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      app_migrations: {
        Row: {
          executed_at: string
          name: string
        }
        Insert: {
          executed_at?: string
          name: string
        }
        Update: {
          executed_at?: string
          name?: string
        }
        Relationships: []
      }
      auctions: {
        Row: {
          closed_at: string | null
          created_at: string | null
          deadline_at: string
          id: string
          league_id: string
          opens_at: string | null
          phase_id: string
          round_number: number
          statut: Database["public"]["Enums"]["auction_statut"] | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string | null
          deadline_at: string
          id?: string
          league_id: string
          opens_at?: string | null
          phase_id: string
          round_number: number
          statut?: Database["public"]["Enums"]["auction_statut"] | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string | null
          deadline_at?: string
          id?: string
          league_id?: string
          opens_at?: string | null
          phase_id?: string
          round_number?: number
          statut?: Database["public"]["Enums"]["auction_statut"] | null
        }
        Relationships: [
          {
            foreignKeyName: "auctions_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
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
        ]
      }
      bids: {
        Row: {
          auction_id: string | null
          coureur_id: string | null
          created_at: string | null
          id: string
          league_id: string
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
          league_id: string
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
          league_id?: string
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
            referencedColumns: ["id"]
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
            referencedRelation: "v_coureurs_saisons_admin"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "bids_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
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
            foreignKeyName: "fk_bids_auction_league"
            columns: ["auction_id", "league_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id", "league_id"]
          },
        ]
      }
      bonus_points: {
        Row: {
          bonus_type: string
          commentaire: string | null
          coureur_id: string | null
          created_at: string
          created_by: string
          id: string
          league_id: string
          manager_id: string | null
          phase_id: string
          points: number
          target_manager_id: string | null
          updated_at: string
        }
        Insert: {
          bonus_type: string
          commentaire?: string | null
          coureur_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          league_id: string
          manager_id?: string | null
          phase_id: string
          points: number
          target_manager_id?: string | null
          updated_at?: string
        }
        Update: {
          bonus_type?: string
          commentaire?: string | null
          coureur_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          league_id?: string
          manager_id?: string | null
          phase_id?: string
          points?: number
          target_manager_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_points_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "coureurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_points_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_points_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "bonus_points_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "my_last_round_bids"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "bonus_points_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_coureurs_saisons_admin"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "bonus_points_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bonus_points_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bonus_points_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_points_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bonus_points_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bonus_points_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bonus_points_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_points_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bonus_points_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "bonus_points_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "bonus_points_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "bonus_points_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_points_target_manager_id_fkey"
            columns: ["target_manager_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bonus_points_target_manager_id_fkey"
            columns: ["target_manager_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bonus_points_target_manager_id_fkey"
            columns: ["target_manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_points_target_manager_id_fkey"
            columns: ["target_manager_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
        ]
      }
      bonus_rider_selections: {
        Row: {
          coureur_id: string
          id: string
          league_id: string
          manager_id: string
          phase_id: string
          selected_at: string | null
        }
        Insert: {
          coureur_id: string
          id?: string
          league_id: string
          manager_id: string
          phase_id: string
          selected_at?: string | null
        }
        Update: {
          coureur_id?: string
          id?: string
          league_id?: string
          manager_id?: string
          phase_id?: string
          selected_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bonus_rider_selections_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "coureurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_rider_selections_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_rider_selections_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "bonus_rider_selections_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "my_last_round_bids"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "bonus_rider_selections_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_coureurs_saisons_admin"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "bonus_rider_selections_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bonus_rider_selections_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bonus_rider_selections_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_rider_selections_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "bonus_rider_selections_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "bonus_rider_selections_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "bonus_rider_selections_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "bonus_rider_selections_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bonus_rider_selections_league"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
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
      coureurs_saisons: {
        Row: {
          actif: boolean
          coureur_id: string
          created_at: string | null
          equipe_id: string
          id: string
          prix_initial: number | null
          saison_id: string
          updated_at: string | null
        }
        Insert: {
          actif?: boolean
          coureur_id: string
          created_at?: string | null
          equipe_id: string
          id?: string
          prix_initial?: number | null
          saison_id: string
          updated_at?: string | null
        }
        Update: {
          actif?: boolean
          coureur_id?: string
          created_at?: string | null
          equipe_id?: string
          id?: string
          prix_initial?: number | null
          saison_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coureurs_saisons_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "coureurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coureurs_saisons_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coureurs_saisons_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "coureurs_saisons_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "my_last_round_bids"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "coureurs_saisons_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_coureurs_saisons_admin"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "coureurs_saisons_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coureurs_saisons_saison_id_fkey"
            columns: ["saison_id"]
            isOneToOne: false
            referencedRelation: "saisons"
            referencedColumns: ["id"]
          },
        ]
      }
      course_stage_config: {
        Row: {
          course_id: string
          created_at: string | null
          etape_numero: number
          id: string
          ttt_riders_per_team: number | null
          updated_at: string | null
        }
        Insert: {
          course_id: string
          created_at?: string | null
          etape_numero: number
          id?: string
          ttt_riders_per_team?: number | null
          updated_at?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string | null
          etape_numero?: number
          id?: string
          ttt_riders_per_team?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_stage_config_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_stage_config_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses_for_points_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_stage_config_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_course_points_theoriques"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "course_stage_config_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_home_recent_results"
            referencedColumns: ["course_id"]
          },
        ]
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
      equipes: {
        Row: {
          code_court: string
          created_at: string | null
          id: string
          logo_url: string | null
          nom_complet: string
          pays: string | null
          updated_at: string | null
        }
        Insert: {
          code_court: string
          created_at?: string | null
          id?: string
          logo_url?: string | null
          nom_complet: string
          pays?: string | null
          updated_at?: string | null
        }
        Update: {
          code_court?: string
          created_at?: string | null
          id?: string
          logo_url?: string | null
          nom_complet?: string
          pays?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      equipes_saisons: {
        Row: {
          actif: boolean | null
          categorie: string | null
          created_at: string | null
          equipe_id: string
          id: string
          nom_affiche: string
          saison_id: string
          updated_at: string | null
        }
        Insert: {
          actif?: boolean | null
          categorie?: string | null
          created_at?: string | null
          equipe_id: string
          id?: string
          nom_affiche: string
          saison_id: string
          updated_at?: string | null
        }
        Update: {
          actif?: boolean | null
          categorie?: string | null
          created_at?: string | null
          equipe_id?: string
          id?: string
          nom_affiche?: string
          saison_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipes_saisons_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipes_saisons_saison_id_fkey"
            columns: ["saison_id"]
            isOneToOne: false
            referencedRelation: "saisons"
            referencedColumns: ["id"]
          },
        ]
      }
      league_invite_uses: {
        Row: {
          id: number
          league_id: string
          token: string
          used_at: string
          user_id: string
        }
        Insert: {
          id?: number
          league_id: string
          token: string
          used_at?: string
          user_id: string
        }
        Update: {
          id?: number
          league_id?: string
          token?: string
          used_at?: string
          user_id?: string
        }
        Relationships: []
      }
      league_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_revoked: boolean
          league_id: string
          max_uses: number | null
          note: string | null
          token: string
          uses_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_revoked?: boolean
          league_id: string
          max_uses?: number | null
          note?: string | null
          token: string
          uses_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_revoked?: boolean
          league_id?: string
          max_uses?: number | null
          note?: string | null
          token?: string
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "league_invites_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_members: {
        Row: {
          id: string
          joined_at: string
          league_id: string
          role_in_league: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          league_id: string
          role_in_league?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          league_id?: string
          role_in_league?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_scopes: {
        Row: {
          by_phase: boolean
          competitions: string[] | null
          course_filters: Json | null
          gt_only: boolean
          id: string
          league_id: string
          phases: string[] | null
          season_id: string
          wt_only: boolean
        }
        Insert: {
          by_phase?: boolean
          competitions?: string[] | null
          course_filters?: Json | null
          gt_only?: boolean
          id?: string
          league_id: string
          phases?: string[] | null
          season_id: string
          wt_only?: boolean
        }
        Update: {
          by_phase?: boolean
          competitions?: string[] | null
          course_filters?: Json | null
          gt_only?: boolean
          id?: string
          league_id?: string
          phases?: string[] | null
          season_id?: string
          wt_only?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fk_league_scopes_season"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "saisons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_scopes_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: true
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_scopes_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "saisons"
            referencedColumns: ["id"]
          },
        ]
      }
      league_templates: {
        Row: {
          auction_phase_groups: number[] | null
          auction_strategy: string
          base_budget: number
          base_max_riders: number
          budget_multiplier_per_player: number
          by_phase: boolean
          competitions: string[] | null
          course_filters: Json | null
          created_at: string
          description: string
          gt_only: boolean
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          phase_indexes: number[]
          player_counts: number[]
          riders_multiplier_per_player: number
          updated_at: string
          wt_only: boolean
        }
        Insert: {
          auction_phase_groups?: number[] | null
          auction_strategy?: string
          base_budget: number
          base_max_riders: number
          budget_multiplier_per_player?: number
          by_phase?: boolean
          competitions?: string[] | null
          course_filters?: Json | null
          created_at?: string
          description: string
          gt_only?: boolean
          id: string
          is_active?: boolean
          is_system?: boolean
          name: string
          phase_indexes?: number[]
          player_counts?: number[]
          riders_multiplier_per_player?: number
          updated_at?: string
          wt_only?: boolean
        }
        Update: {
          auction_phase_groups?: number[] | null
          auction_strategy?: string
          base_budget?: number
          base_max_riders?: number
          budget_multiplier_per_player?: number
          by_phase?: boolean
          competitions?: string[] | null
          course_filters?: Json | null
          created_at?: string
          description?: string
          gt_only?: boolean
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          phase_indexes?: number[]
          player_counts?: number[]
          riders_multiplier_per_player?: number
          updated_at?: string
          wt_only?: boolean
        }
        Relationships: []
      }
      leagues: {
        Row: {
          archived_at: string | null
          bonuses_enabled: boolean
          created_at: string
          current_player_count: number
          first_auction_starts_at: string | null
          game_mode: string
          id: string
          max_players: number
          name: string
          owner_manager_id: string
          settings: Json
          started_at: string | null
          status: string
          visibility: string
        }
        Insert: {
          archived_at?: string | null
          bonuses_enabled?: boolean
          created_at?: string
          current_player_count?: number
          first_auction_starts_at?: string | null
          game_mode?: string
          id?: string
          max_players?: number
          name: string
          owner_manager_id: string
          settings?: Json
          started_at?: string | null
          status?: string
          visibility?: string
        }
        Update: {
          archived_at?: string | null
          bonuses_enabled?: boolean
          created_at?: string
          current_player_count?: number
          first_auction_starts_at?: string | null
          game_mode?: string
          id?: string
          max_players?: number
          name?: string
          owner_manager_id?: string
          settings?: Json
          started_at?: string | null
          status?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "leagues_owner_manager_id_fkey"
            columns: ["owner_manager_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "leagues_owner_manager_id_fkey"
            columns: ["owner_manager_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "leagues_owner_manager_id_fkey"
            columns: ["owner_manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leagues_owner_manager_id_fkey"
            columns: ["owner_manager_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
        ]
      }
      manager_bonus_points: {
        Row: {
          bonus_coureurs: number
          bonus_first_win: number
          bonus_itt: number
          bonus_scoreurs: number
          bonus_ttt: number
          commentaire: string | null
          created_at: string
          created_by: string
          id: string
          league_id: string
          manager_id: string
          phase_id: string
          updated_at: string
        }
        Insert: {
          bonus_coureurs?: number
          bonus_first_win?: number
          bonus_itt?: number
          bonus_scoreurs?: number
          bonus_ttt?: number
          commentaire?: string | null
          created_at?: string
          created_by: string
          id?: string
          league_id: string
          manager_id: string
          phase_id: string
          updated_at?: string
        }
        Update: {
          bonus_coureurs?: number
          bonus_first_win?: number
          bonus_itt?: number
          bonus_scoreurs?: number
          bonus_ttt?: number
          commentaire?: string | null
          created_at?: string
          created_by?: string
          id?: string
          league_id?: string
          manager_id?: string
          phase_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_bonus_points_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "manager_bonus_points_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "manager_bonus_points_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_bonus_points_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "manager_bonus_points_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "manager_bonus_points_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "manager_bonus_points_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_bonus_points_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "manager_bonus_points_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "manager_bonus_points_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "manager_bonus_points_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "manager_bonus_points_phase_id_fkey"
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
          league_id: string | null
          manager_id: string
          phase_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_by?: string | null
          award_type: Database["public"]["Enums"]["fun_award_type"]
          created_at?: string | null
          id?: string
          league_id?: string | null
          manager_id: string
          phase_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_by?: string | null
          award_type?: Database["public"]["Enums"]["fun_award_type"]
          created_at?: string | null
          id?: string
          league_id?: string | null
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
            foreignKeyName: "manager_fun_awards_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
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
      manager_sponsors: {
        Row: {
          created_at: string | null
          id: string
          jersey_image_url: string | null
          manager_id: string
          saison_id: string
          sponsor: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          jersey_image_url?: string | null
          manager_id: string
          saison_id: string
          sponsor: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          jersey_image_url?: string | null
          manager_id?: string
          saison_id?: string
          sponsor?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manager_sponsors_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "manager_sponsors_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "manager_sponsors_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_sponsors_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "manager_sponsors_saison_id_fkey"
            columns: ["saison_id"]
            isOneToOne: false
            referencedRelation: "saisons"
            referencedColumns: ["id"]
          },
        ]
      }
      managers: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          id: string
          nom: string
          sponsor: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nom: string
          sponsor?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
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
            referencedColumns: ["id"]
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
            referencedRelation: "v_coureurs_saisons_admin"
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
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          manager_id: string
          message: string
          metadata: Json | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          manager_id: string
          message: string
          metadata?: Json | null
          title: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          manager_id?: string
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "notifications_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "notifications_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
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
            referencedColumns: ["id"]
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
            referencedRelation: "v_coureurs_saisons_admin"
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
          is_ttt: boolean | null
          saison_id: string
          ttt_riders_count: number | null
          type_classement: Database["public"]["Enums"]["type_classement"]
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by: string
          etape_numero?: number | null
          id?: string
          is_cancelled?: boolean
          is_ttt?: boolean | null
          saison_id: string
          ttt_riders_count?: number | null
          type_classement: Database["public"]["Enums"]["type_classement"]
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string
          etape_numero?: number | null
          id?: string
          is_cancelled?: boolean
          is_ttt?: boolean | null
          saison_id?: string
          ttt_riders_count?: number | null
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
        ]
      }
      race_results: {
        Row: {
          coureur_id: string | null
          course_id: string | null
          date_classement: string
          equipe_id: string | null
          etape_numero: number | null
          id: string
          manager_id: string | null
          points: number
          position: number | null
          position_decimal: number | null
          result_set_id: string | null
          saison_id: string
          statut: Database["public"]["Enums"]["result_statut"] | null
          type_classement: Database["public"]["Enums"]["type_classement"]
          updated_at: string | null
          updated_by_manager_id: string | null
        }
        Insert: {
          coureur_id?: string | null
          course_id?: string | null
          date_classement: string
          equipe_id?: string | null
          etape_numero?: number | null
          id?: string
          manager_id?: string | null
          points?: number
          position?: number | null
          position_decimal?: number | null
          result_set_id?: string | null
          saison_id: string
          statut?: Database["public"]["Enums"]["result_statut"] | null
          type_classement: Database["public"]["Enums"]["type_classement"]
          updated_at?: string | null
          updated_by_manager_id?: string | null
        }
        Update: {
          coureur_id?: string | null
          course_id?: string | null
          date_classement?: string
          equipe_id?: string | null
          etape_numero?: number | null
          id?: string
          manager_id?: string | null
          points?: number
          position?: number | null
          position_decimal?: number | null
          result_set_id?: string | null
          saison_id?: string
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
            referencedColumns: ["id"]
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
            referencedRelation: "v_coureurs_saisons_admin"
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
            foreignKeyName: "race_results_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes_saisons"
            referencedColumns: ["id"]
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
            referencedColumns: ["id"]
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
            referencedRelation: "v_coureurs_saisons_admin"
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
          league_id: string
          manager_id: string | null
          phase_id: string | null
          prix_signature: number
        }
        Insert: {
          coureur_id?: string | null
          id?: string
          league_id: string
          manager_id?: string | null
          phase_id?: string | null
          prix_signature: number
        }
        Update: {
          coureur_id?: string | null
          id?: string
          league_id?: string
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
            referencedColumns: ["id"]
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
            referencedRelation: "v_coureurs_saisons_admin"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "rosters_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
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
      scoring_rules_saisons: {
        Row: {
          categorie: string
          created_at: string | null
          id: string
          place: number
          points: number
          saison_id: string
          type: string | null
          type_classement: Database["public"]["Enums"]["type_classement"]
        }
        Insert: {
          categorie: string
          created_at?: string | null
          id?: string
          place: number
          points?: number
          saison_id: string
          type?: string | null
          type_classement: Database["public"]["Enums"]["type_classement"]
        }
        Update: {
          categorie?: string
          created_at?: string | null
          id?: string
          place?: number
          points?: number
          saison_id?: string
          type?: string | null
          type_classement?: Database["public"]["Enums"]["type_classement"]
        }
        Relationships: [
          {
            foreignKeyName: "scoring_rules_saisons_saison_id_fkey"
            columns: ["saison_id"]
            isOneToOne: false
            referencedRelation: "saisons"
            referencedColumns: ["id"]
          },
        ]
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
            referencedColumns: ["id"]
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
            referencedRelation: "v_coureurs_saisons_admin"
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
          admin_rating_author_id: string | null
          admin_rating_note: string | null
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
          startlisteur_note: string | null
        }
        Insert: {
          admin_rating_author_id?: string | null
          admin_rating_note?: string | null
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
          startlisteur_note?: string | null
        }
        Update: {
          admin_rating_author_id?: string | null
          admin_rating_note?: string | null
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
          startlisteur_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "startlist_imports_admin_rating_author_id_fkey"
            columns: ["admin_rating_author_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "startlist_imports_admin_rating_author_id_fkey"
            columns: ["admin_rating_author_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "startlist_imports_admin_rating_author_id_fkey"
            columns: ["admin_rating_author_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startlist_imports_admin_rating_author_id_fkey"
            columns: ["admin_rating_author_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["manager_id"]
          },
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
          league_id: string | null
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
            referencedColumns: ["id"]
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
            referencedRelation: "v_coureurs_saisons_admin"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "bids_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
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
        ]
      }
      coureurs_disponibilite: {
        Row: {
          equipe: string | null
          id: string | null
          is_taken: boolean | null
          nom: string | null
          phase_id: string | null
          phase_statut: Database["public"]["Enums"]["phase_statut"] | null
          prix_initial: number | null
          saison_id: string | null
          taken_by_manager_nom: string | null
          uci_id: string | null
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
          league_id: string | null
          manager_id: string | null
          manager_nom: string | null
          max_coureurs: number | null
          pending_count: number | null
          pending_sum: number | null
          phase_id: string | null
          roster_count: number | null
          slots_restants: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rosters_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
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
      v_coureurs_saisons_admin: {
        Row: {
          actif: boolean | null
          coureur_id: string | null
          coureur_nom: string | null
          created_at: string | null
          equipe_code: string | null
          equipe_id: string | null
          equipe_nom: string | null
          id: string | null
          prix_initial: number | null
          saison_annee: number | null
          saison_id: string | null
          uci_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coureurs_saisons_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coureurs_saisons_saison_id_fkey"
            columns: ["saison_id"]
            isOneToOne: false
            referencedRelation: "saisons"
            referencedColumns: ["id"]
          },
        ]
      }
      v_coureurs_with_teams: {
        Row: {
          coureur_id: string | null
          coureur_nom: string | null
          equipe_id: string | null
          equipe_nom: string | null
          prix_initial: number | null
          saison_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coureurs_saisons_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "coureurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coureurs_saisons_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coureurs_saisons_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "last_round_winners"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "coureurs_saisons_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "my_last_round_bids"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "coureurs_saisons_coureur_id_fkey"
            columns: ["coureur_id"]
            isOneToOne: false
            referencedRelation: "v_coureurs_saisons_admin"
            referencedColumns: ["coureur_id"]
          },
          {
            foreignKeyName: "coureurs_saisons_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coureurs_saisons_saison_id_fkey"
            columns: ["saison_id"]
            isOneToOne: false
            referencedRelation: "saisons"
            referencedColumns: ["id"]
          },
        ]
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
      v_manager_bonus_aggregated: {
        Row: {
          bonus_coureurs: number | null
          bonus_first_win: number | null
          bonus_itt: number | null
          bonus_scoreurs: number | null
          bonus_ttt: number | null
          commentaire: string | null
          created_at: string | null
          manager_id: string | null
          phase_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bonus_points_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "coureurs_disponibilite"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "bonus_points_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "manager_phase_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "bonus_points_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "managers_rosters_status"
            referencedColumns: ["phase_id"]
          },
          {
            foreignKeyName: "bonus_points_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
        ]
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
          league_id: string | null
          manager_id: string | null
          manager_nom: string | null
          phase_id: string | null
          points: number | null
          type_classement: Database["public"]["Enums"]["type_classement"] | null
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
            referencedColumns: ["id"]
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
            referencedRelation: "v_coureurs_saisons_admin"
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
          {
            foreignKeyName: "rosters_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
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
        ]
      }
      v_manager_standings_by_phase_v2: {
        Row: {
          league_id: string | null
          manager_bonus: number | null
          manager_id: string | null
          manager_nom: string | null
          nb_scoreurs: number | null
          nb_victoires: number | null
          phase_id: string | null
          rider_bonus: number | null
          total_points: number | null
          total_race_pts: number | null
        }
        Relationships: []
      }
      v_manager_standings_by_season_v2: {
        Row: {
          league_id: string | null
          manager_bonus: number | null
          manager_id: string | null
          manager_nom: string | null
          nb_scoreurs: number | null
          nb_victoires: number | null
          rider_bonus: number | null
          saison_id: string | null
          total_points: number | null
          total_race_pts: number | null
        }
        Relationships: []
      }
      v_manager_standings_total: {
        Row: {
          league_id: string | null
          manager_bonus: number | null
          manager_id: string | null
          manager_nom: string | null
          nb_scoreurs: number | null
          nb_victoires: number | null
          rider_bonus: number | null
          total_points: number | null
          total_race_pts: number | null
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
            referencedColumns: ["id"]
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
            referencedRelation: "v_coureurs_saisons_admin"
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
        ]
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
            referencedColumns: ["id"]
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
            referencedRelation: "v_coureurs_saisons_admin"
            referencedColumns: ["coureur_id"]
          },
        ]
      }
      v_top_riders_by_season: {
        Row: {
          coureur_equipe: string | null
          coureur_id: string | null
          coureur_nom: string | null
          courses_count: number | null
          saison_id: string | null
          total_points: number | null
        }
        Relationships: [
          {
            foreignKeyName: "phases_saison_id_fkey"
            columns: ["saison_id"]
            isOneToOne: false
            referencedRelation: "saisons"
            referencedColumns: ["id"]
          },
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
            referencedColumns: ["id"]
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
            referencedRelation: "v_coureurs_saisons_admin"
            referencedColumns: ["coureur_id"]
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
            referencedColumns: ["id"]
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
            referencedRelation: "v_coureurs_saisons_admin"
            referencedColumns: ["coureur_id"]
          },
        ]
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
      admin_result_status: { Args: { p_course_id: string }; Returns: Json }
      admin_results_reset_all: {
        Args: { p_confirm_phrase: string }
        Returns: Json
      }
      admin_results_reset_preview: { Args: never; Returns: Json }
      auto_close_ghost_auctions: { Args: never; Returns: undefined }
      auto_open_scheduled_auctions: { Args: never; Returns: undefined }
      course_points_summary: {
        Args: { p_course_id: string; p_manager_id?: string }
        Returns: Json
      }
      find_courses_missing_porteur_points: {
        Args: never
        Returns: {
          course_id: string
          course_nom: string
          missing_count: number
        }[]
      }
      generate_team_code: { Args: { team_name: string }; Returns: string }
      generate_team_code_unique: {
        Args: { team_name: string }
        Returns: string
      }
      get_league_course_ids: {
        Args: { p_league_id: string }
        Returns: {
          course_id: string
        }[]
      }
      get_league_courses_with_points: {
        Args: { p_league_id: string; p_season_id?: string }
        Returns: {
          categorie: string
          categorie_for_points: string
          course_id: string
          date_debut: string
          date_fin: string
          is_uwt: boolean
          nb_etapes_estimees: number
          nb_jours: number
          nom: string
          phase_id: string
          phase_index: number
          points_etapes: number
          points_etapes_unitaire: number
          points_gc: number
          points_jeune: number
          points_mont: number
          points_pts: number
          points_total: number
          type_course: string
          wt_tier: Database["public"]["Enums"]["wt_tier_type"]
        }[]
      }
      get_my_roles: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      get_previous_standings:
        | {
            Args: { p_reference_phase_id?: string; p_saison_id?: string }
            Returns: {
              manager_id: string
              previous_rank: number
            }[]
          }
        | {
            Args: {
              p_league_id?: string
              p_reference_phase_id?: string
              p_saison_id?: string
            }
            Returns: {
              manager_id: string
              manager_nom: string
              rank: number
              total_points: number
            }[]
          }
      get_riders_with_teams: {
        Args: { p_rider_ids: string[]; p_saison_id: string }
        Returns: {
          equipe: string
          id: string
          nom: string
        }[]
      }
      get_team_options_for_phase: {
        Args: { p_phase_id: string }
        Returns: {
          equipe_id: string
          nom_affiche: string
        }[]
      }
      get_top_riders_optimized: {
        Args: {
          p_league_id?: string
          p_limit?: number
          p_phase_id?: string
          p_saison_id?: string
        }
        Returns: {
          coureur_equipe: string
          coureur_id: string
          coureur_nom: string
          courses_count: number
          owner_manager_id: string
          owner_manager_nom: string
          prix_initial: number
          total_points: number
        }[]
      }
      get_unique_teams_for_phase: {
        Args: { p_phase_id: string }
        Returns: {
          team_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_league_admin: { Args: { l_id: string }; Returns: boolean }
      is_league_member: { Args: { l_id: string }; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
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
        Args: {
          p_league_id?: string
          p_manager_id: string
          p_phase_id?: string
        }
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
      migrate_tour_down_under_to_2025: { Args: never; Returns: Json }
      normalize_text: { Args: { txt: string }; Returns: string }
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
          coureur_equipe: string
          coureur_id: string
          coureur_nom: string
          points: number
          position: number
          position_decimal: number
        }[]
      }
      results_course_table:
        | {
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
        | {
            Args: {
              p_course_id: string
              p_etape_numero?: number
              p_league_id?: string
              p_manager_id?: string
              p_type_classement: Database["public"]["Enums"]["type_classement"]
            }
            Returns: {
              coureur_id: string
              coureur_nom: string
              equipe: string
              equipe_id_uci: string
              equipe_nom_uci: string
              is_my_rider: boolean
              manager_id: string
              manager_nom: string
              points_officiels: number
              points_theoriques: number
              position_decimal: number
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
          p_type_classement: Database["public"]["Enums"]["type_classement"]
        }
        Returns: {
          coureur_equipe: string
          coureur_id: string
          coureur_nom: string
          has_official_points: boolean
          points: number
          position: number
          statut: Database["public"]["Enums"]["result_statut"]
        }[]
      }
      results_courses_with_entries:
        | {
            Args: {
              p_limit?: number
              p_offset?: number
              p_phase_id?: string
              p_saison_id?: string
              p_search?: string
            }
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
        | {
            Args: { p_limit?: number; p_offset?: number; p_search?: string }
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
        | {
            Args: {
              p_limit?: number
              p_offset?: number
              p_phase_id?: string
              p_search?: string
            }
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
      results_recent_races:
        | {
            Args: {
              p_league_id?: string
              p_limit?: number
              p_phase_id?: string
              p_saison_id?: string
            }
            Returns: {
              course_id: string
              course_nom: string
              date_fin: string
              top10: Json
              total_points: number
            }[]
          }
        | {
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
        | {
            Args: {
              p_league_id?: string
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
      rider_roi_phase: {
        Args: { p_phase_id: string }
        Returns: {
          rider_id: string
          roi: number
          total_points: number
          total_purchase_price: number
        }[]
      }
      rider_roi_season: {
        Args: { p_saison_id: string }
        Returns: {
          rider_id: string
          roi: number
          total_points: number
          total_purchase_price: number
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
      unaccent: { Args: { "": string }; Returns: string }
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
      app_role: "manager" | "admin" | "superadmin"
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
        | "Combatif"
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
      app_role: ["manager", "admin", "superadmin"],
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
        "Combatif",
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
