\pset footer off
\pset format unaligned
\pset fieldsep ','
\pset tuples_only on
\o C:/LaBordure-data/target_rowcounts.csv
SELECT 'auth.identities' AS t, count(*) AS n FROM auth.identities
UNION ALL SELECT 'auth.users' AS t, count(*) AS n FROM auth.users
UNION ALL SELECT 'drizzle.__drizzle_migrations' AS t, count(*) AS n FROM drizzle.__drizzle_migrations
UNION ALL SELECT 'public.annonces' AS t, count(*) AS n FROM public.annonces
UNION ALL SELECT 'public.announcement_banner' AS t, count(*) AS n FROM public.announcement_banner
UNION ALL SELECT 'public.app_feature_flags' AS t, count(*) AS n FROM public.app_feature_flags
UNION ALL SELECT 'public.app_migrations' AS t, count(*) AS n FROM public.app_migrations
UNION ALL SELECT 'public.arena_channels' AS t, count(*) AS n FROM public.arena_channels
UNION ALL SELECT 'public.arena_live_courses' AS t, count(*) AS n FROM public.arena_live_courses
UNION ALL SELECT 'public.arena_messages' AS t, count(*) AS n FROM public.arena_messages
UNION ALL SELECT 'public.arena_poll_options' AS t, count(*) AS n FROM public.arena_poll_options
UNION ALL SELECT 'public.arena_poll_votes' AS t, count(*) AS n FROM public.arena_poll_votes
UNION ALL SELECT 'public.arena_polls' AS t, count(*) AS n FROM public.arena_polls
UNION ALL SELECT 'public.arena_prestige_points' AS t, count(*) AS n FROM public.arena_prestige_points
UNION ALL SELECT 'public.arena_pronostic_deadlines' AS t, count(*) AS n FROM public.arena_pronostic_deadlines
UNION ALL SELECT 'public.arena_pronostics' AS t, count(*) AS n FROM public.arena_pronostics
UNION ALL SELECT 'public.arena_reactions' AS t, count(*) AS n FROM public.arena_reactions
UNION ALL SELECT 'public.arena_recap_runs' AS t, count(*) AS n FROM public.arena_recap_runs
UNION ALL SELECT 'public.auctions' AS t, count(*) AS n FROM public.auctions
UNION ALL SELECT 'public.audits' AS t, count(*) AS n FROM public.audits
UNION ALL SELECT 'public.bids' AS t, count(*) AS n FROM public.bids
UNION ALL SELECT 'public.bonus_points' AS t, count(*) AS n FROM public.bonus_points
UNION ALL SELECT 'public.bonus_rider_selections' AS t, count(*) AS n FROM public.bonus_rider_selections
UNION ALL SELECT 'public.category_aliases' AS t, count(*) AS n FROM public.category_aliases
UNION ALL SELECT 'public.communication_batches' AS t, count(*) AS n FROM public.communication_batches
UNION ALL SELECT 'public.communication_templates' AS t, count(*) AS n FROM public.communication_templates
UNION ALL SELECT 'public.contact_messages' AS t, count(*) AS n FROM public.contact_messages
UNION ALL SELECT 'public.coureurs' AS t, count(*) AS n FROM public.coureurs
UNION ALL SELECT 'public.coureurs_saisons' AS t, count(*) AS n FROM public.coureurs_saisons
UNION ALL SELECT 'public.course_route_images' AS t, count(*) AS n FROM public.course_route_images
UNION ALL SELECT 'public.course_stage_config' AS t, count(*) AS n FROM public.course_stage_config
UNION ALL SELECT 'public.courses' AS t, count(*) AS n FROM public.courses
UNION ALL SELECT 'public.email_preferences' AS t, count(*) AS n FROM public.email_preferences
UNION ALL SELECT 'public.email_send_log' AS t, count(*) AS n FROM public.email_send_log
UNION ALL SELECT 'public.email_send_state' AS t, count(*) AS n FROM public.email_send_state
UNION ALL SELECT 'public.email_unsubscribe_tokens' AS t, count(*) AS n FROM public.email_unsubscribe_tokens
UNION ALL SELECT 'public.equipes' AS t, count(*) AS n FROM public.equipes
UNION ALL SELECT 'public.equipes_saisons' AS t, count(*) AS n FROM public.equipes_saisons
UNION ALL SELECT 'public.league_invite_uses' AS t, count(*) AS n FROM public.league_invite_uses
UNION ALL SELECT 'public.league_invites' AS t, count(*) AS n FROM public.league_invites
UNION ALL SELECT 'public.league_members' AS t, count(*) AS n FROM public.league_members
UNION ALL SELECT 'public.league_scopes' AS t, count(*) AS n FROM public.league_scopes
UNION ALL SELECT 'public.league_size_changes' AS t, count(*) AS n FROM public.league_size_changes
UNION ALL SELECT 'public.league_startlist_notes' AS t, count(*) AS n FROM public.league_startlist_notes
UNION ALL SELECT 'public.league_templates' AS t, count(*) AS n FROM public.league_templates
UNION ALL SELECT 'public.leagues' AS t, count(*) AS n FROM public.leagues
UNION ALL SELECT 'public.live_stage_plans' AS t, count(*) AS n FROM public.live_stage_plans
UNION ALL SELECT 'public.manager_bonus_points' AS t, count(*) AS n FROM public.manager_bonus_points
UNION ALL SELECT 'public.manager_fun_awards' AS t, count(*) AS n FROM public.manager_fun_awards
UNION ALL SELECT 'public.manager_sponsors' AS t, count(*) AS n FROM public.manager_sponsors
UNION ALL SELECT 'public.managers' AS t, count(*) AS n FROM public.managers
UNION ALL SELECT 'public.name_aliases' AS t, count(*) AS n FROM public.name_aliases
UNION ALL SELECT 'public.notifications' AS t, count(*) AS n FROM public.notifications
UNION ALL SELECT 'public.onboarding_progress' AS t, count(*) AS n FROM public.onboarding_progress
UNION ALL SELECT 'public.phase_auction_schedule' AS t, count(*) AS n FROM public.phase_auction_schedule
UNION ALL SELECT 'public.phases' AS t, count(*) AS n FROM public.phases
UNION ALL SELECT 'public.points_ledger' AS t, count(*) AS n FROM public.points_ledger
UNION ALL SELECT 'public.push_subscriptions' AS t, count(*) AS n FROM public.push_subscriptions
UNION ALL SELECT 'public.race_result_sets' AS t, count(*) AS n FROM public.race_result_sets
UNION ALL SELECT 'public.race_results' AS t, count(*) AS n FROM public.race_results
UNION ALL SELECT 'public.race_results_history' AS t, count(*) AS n FROM public.race_results_history
UNION ALL SELECT 'public.rider_favorites' AS t, count(*) AS n FROM public.rider_favorites
UNION ALL SELECT 'public.rider_injuries' AS t, count(*) AS n FROM public.rider_injuries
UNION ALL SELECT 'public.rider_transfers' AS t, count(*) AS n FROM public.rider_transfers
UNION ALL SELECT 'public.rosters' AS t, count(*) AS n FROM public.rosters
UNION ALL SELECT 'public.saisons' AS t, count(*) AS n FROM public.saisons
UNION ALL SELECT 'public.scoring_rules' AS t, count(*) AS n FROM public.scoring_rules
UNION ALL SELECT 'public.scoring_rules_saisons' AS t, count(*) AS n FROM public.scoring_rules_saisons
UNION ALL SELECT 'public.startlist_entries' AS t, count(*) AS n FROM public.startlist_entries
UNION ALL SELECT 'public.startlist_imports' AS t, count(*) AS n FROM public.startlist_imports
UNION ALL SELECT 'public.startlist_manager_ratings' AS t, count(*) AS n FROM public.startlist_manager_ratings
UNION ALL SELECT 'public.startlist_tracker_changes' AS t, count(*) AS n FROM public.startlist_tracker_changes
UNION ALL SELECT 'public.startlist_tracker_runs' AS t, count(*) AS n FROM public.startlist_tracker_runs
UNION ALL SELECT 'public.suppressed_emails' AS t, count(*) AS n FROM public.suppressed_emails
UNION ALL SELECT 'public.transactional_email_overrides' AS t, count(*) AS n FROM public.transactional_email_overrides
UNION ALL SELECT 'public.tweet_posts' AS t, count(*) AS n FROM public.tweet_posts
UNION ALL SELECT 'public.user_activity_logs' AS t, count(*) AS n FROM public.user_activity_logs
UNION ALL SELECT 'public.user_roles' AS t, count(*) AS n FROM public.user_roles
UNION ALL SELECT 'storage.buckets' AS t, count(*) AS n FROM storage.buckets
UNION ALL SELECT 'supabase_migrations.schema_migrations' AS t, count(*) AS n FROM supabase_migrations.schema_migrations;
\o

