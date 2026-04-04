import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface PointsByUserLeague {
  user_id: string;
  league_id: string;
  league_name: string;
  total_points: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create client with user context for permission checks
    const supabaseWithAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseWithAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check superadmin access using user context
    const { data: isSuperAdmin, error: adminError } = await supabaseWithAuth.rpc('is_superadmin');
    if (adminError || !isSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Access denied: superadmin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create service role client for data operations that bypass RLS
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    const { p_course_id, p_type_classement, p_etape_numero, p_rows } = await req.json();

    if (!p_course_id || !p_type_classement || !p_rows) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if results already exist (correction vs first entry) BEFORE saving
    let isCorrection = false;
    {
      let checkQuery = supabaseService
        .from('race_results')
        .select('id', { count: 'exact', head: true })
        .eq('course_id', p_course_id)
        .eq('type_classement', p_type_classement);

      if (p_etape_numero) {
        checkQuery = checkQuery.eq('etape_numero', p_etape_numero);
      } else {
        checkQuery = checkQuery.is('etape_numero', null);
      }

      const { count } = await checkQuery;
      isCorrection = (count || 0) > 0;
      console.log(`[admin-result-save-lot] isCorrection=${isCorrection} (existing count=${count}) for ${p_course_id}/${p_type_classement}/${p_etape_numero}`);
    }

    // Call the database function with user context (RPC checks auth.uid())
    const { data, error } = await supabaseWithAuth.rpc('admin_result_save_lot', {
      p_course_id,
      p_type_classement,
      p_etape_numero,
      p_rows,
    });

    if (error) throw error;

    // === AUTO-EVALUATE PRONOSTICS ===
    // When results are saved, automatically evaluate matching pronostics
    if (p_type_classement === 'Etape' || p_type_classement === 'General') {
      try {
        // Find the winner (position = 1)
        let winnerQuery = supabaseService
          .from('race_results')
          .select('coureur_id')
          .eq('course_id', p_course_id)
          .eq('type_classement', p_type_classement)
          .eq('position', 1);

        if (p_etape_numero) {
          winnerQuery = winnerQuery.eq('etape_numero', p_etape_numero);
        } else {
          winnerQuery = winnerQuery.is('etape_numero', null);
        }

        const { data: winnerResult } = await winnerQuery.limit(1).maybeSingle();
        const winnerId = winnerResult?.coureur_id;

        if (winnerId) {
          // Map type_classement to pronostic_types
          const pronosticTypes: string[] = [];
          if (p_type_classement === 'Etape') {
            pronosticTypes.push('stage_winner', 'one_day_winner');
          } else if (p_type_classement === 'General') {
            pronosticTypes.push('gc_winner', 'one_day_winner');
          }

          const evalNow = new Date().toISOString();

          for (const pronosticType of pronosticTypes) {
            // Build base filter for unevaluated pronostics
            const buildFilter = (query: any) => {
              let q = query
                .eq('course_id', p_course_id)
                .eq('pronostic_type', pronosticType)
                .is('is_correct', null);

              if (p_etape_numero) {
                q = q.eq('etape_numero', p_etape_numero);
              } else {
                q = q.is('etape_numero', null);
              }
              return q;
            };

            // Mark correct
            const { data: correctData, error: correctErr } = await buildFilter(
              supabaseService
                .from('arena_pronostics')
                .update({ is_correct: true, evaluated_at: evalNow })
            ).eq('coureur_id', winnerId).select('id');

            if (correctErr) console.error(`[auto-evaluate] Error marking correct for ${pronosticType}:`, correctErr);

            // Mark incorrect
            const { data: incorrectData, error: incorrectErr } = await buildFilter(
              supabaseService
                .from('arena_pronostics')
                .update({ is_correct: false, evaluated_at: evalNow })
            ).neq('coureur_id', winnerId).select('id');

            if (incorrectErr) console.error(`[auto-evaluate] Error marking incorrect for ${pronosticType}:`, incorrectErr);

            const correctCount = correctData?.length || 0;
            const incorrectCount = incorrectData?.length || 0;
            if (correctCount > 0 || incorrectCount > 0) {
              console.log(`[auto-evaluate] ${pronosticType}: ${correctCount} correct, ${incorrectCount} incorrect (winner: ${winnerId})`);
            }
          }
        } else {
          console.log(`[auto-evaluate] No winner found for ${p_course_id}/${p_type_classement}/${p_etape_numero}`);
        }
      } catch (evalError) {
        console.error(`[auto-evaluate] Error:`, evalError);
        // Don't fail the save if evaluation fails
      }
    }

    // Send personalized push notifications for Etape or General results
    // ONLY on first entry, not on corrections
    if (!isCorrection && (p_type_classement === 'Etape' || p_type_classement === 'General')) {
      try {
        // Get course name
        const { data: courseData } = await supabaseService
          .from('courses')
          .select('nom')
          .eq('id', p_course_id)
          .single();
        
        const courseName = courseData?.nom || p_course_id;
        const typeLabel = p_type_classement === 'Etape' 
          ? (p_etape_numero ? `Étape ${p_etape_numero}` : 'Étape')
          : 'Classement Général';

        console.log(`[admin-result-save-lot] Preparing personalized push notifications for ${courseName} - ${typeLabel}`);

        // 1. Get the winner (position = 1)
        let winnerName: string | null = null;
        
        let winnerQuery = supabaseService
          .from('race_results')
          .select('coureur_id, coureurs!inner(nom)')
          .eq('course_id', p_course_id)
          .eq('type_classement', p_type_classement)
          .eq('position', 1);

        if (p_etape_numero) {
          winnerQuery = winnerQuery.eq('etape_numero', p_etape_numero);
        } else {
          winnerQuery = winnerQuery.is('etape_numero', null);
        }

        const { data: winnerData } = await winnerQuery.maybeSingle();

        if (winnerData?.coureurs) {
          // coureurs is an array due to the join, take first element
          const coureurs = winnerData.coureurs as unknown as { nom: string } | { nom: string }[];
          if (Array.isArray(coureurs)) {
            winnerName = coureurs[0]?.nom || null;
          } else {
            winnerName = coureurs?.nom || null;
          }
        }

        console.log(`[admin-result-save-lot] Winner: ${winnerName || 'Unknown'}`);

        // 2. Get points per user/league for this result
        // Query: join points_ledger -> rosters -> managers -> leagues
        let pointsQuery = supabaseService
          .from('points_ledger')
          .select(`
            coureur_id,
            points,
            phase_id,
            rosters!inner(
              manager_id,
              league_id,
              managers!inner(user_id),
              leagues!inner(name)
            )
          `)
          .eq('course_id', p_course_id)
          .eq('type_classement', p_type_classement);

        if (p_etape_numero) {
          pointsQuery = pointsQuery.eq('etape_numero', p_etape_numero);
        } else {
          pointsQuery = pointsQuery.is('etape_numero', null);
        }

        const { data: pointsData, error: pointsError } = await pointsQuery;

        if (pointsError) {
          console.error('[admin-result-save-lot] Error fetching points:', pointsError);
        }

        // Aggregate points by user_id and league
        const pointsByUserLeague = new Map<string, PointsByUserLeague[]>();

        if (pointsData) {
          for (const row of pointsData) {
            // rosters comes as an array from the join
            const rostersArray = row.rosters as unknown as Array<{
              manager_id: string;
              league_id: string;
              managers: { user_id: string } | Array<{ user_id: string }>;
              leagues: { name: string } | Array<{ name: string }>;
            }>;
            
            if (!rostersArray || !Array.isArray(rostersArray)) continue;
            
            for (const roster of rostersArray) {
              // Handle managers which can be object or array
              const managers = roster.managers;
              const userId = Array.isArray(managers) ? managers[0]?.user_id : managers?.user_id;
              
              if (!userId) continue;
              
              const leagueId = roster.league_id;
              const leagues = roster.leagues;
              const leagueName = Array.isArray(leagues) ? leagues[0]?.name : leagues?.name || 'Ligue';
              const points = Number(row.points) || 0;

              if (!pointsByUserLeague.has(userId)) {
                pointsByUserLeague.set(userId, []);
              }

              const userLeagues = pointsByUserLeague.get(userId)!;
              const existingLeague = userLeagues.find(l => l.league_id === leagueId);

              if (existingLeague) {
                existingLeague.total_points += points;
              } else {
                userLeagues.push({
                  user_id: userId,
                  league_id: leagueId,
                  league_name: leagueName,
                  total_points: points,
                });
              }
            }
          }
        }

        console.log(`[admin-result-save-lot] Points aggregated for ${pointsByUserLeague.size} users`);

        // 3. Get push subscriptions with 'results' preference enabled
        const { data: subscriptions, error: subError } = await supabaseService
          .from('push_subscriptions')
          .select('id, user_id, endpoint, p256dh, auth, preferences');

        if (subError) {
          console.error('[admin-result-save-lot] Error fetching subscriptions:', subError);
        }

        // Filter subscriptions that have results preference enabled (or no preferences = all enabled)
        const activeSubscriptions = (subscriptions || []).filter(sub => {
          if (!sub.preferences) return true;
          const prefs = sub.preferences as { results?: boolean };
          return prefs.results !== false;
        });

        console.log(`[admin-result-save-lot] Found ${activeSubscriptions.length} active subscriptions`);

        // 4. Build and send personalized notifications per user
        // Group subscriptions by user_id to avoid duplicate messages
        const subscriptionsByUser = new Map<string, typeof activeSubscriptions>();
        for (const sub of activeSubscriptions) {
          if (!subscriptionsByUser.has(sub.user_id)) {
            subscriptionsByUser.set(sub.user_id, []);
          }
          subscriptionsByUser.get(sub.user_id)!.push(sub);
        }

        // Build title
        const title = `🏁 ${courseName}${p_etape_numero ? ` - Étape ${p_etape_numero}` : ''}`;

        let successCount = 0;
        let failCount = 0;

        for (const [userId, userSubs] of subscriptionsByUser) {
          // Build personalized message for this user
          const lines: string[] = [];
          
          if (winnerName) {
            lines.push(`Victoire de ${winnerName}`);
          }

          const userLeaguePoints = pointsByUserLeague.get(userId) || [];
          for (const { league_name, total_points } of userLeaguePoints) {
            lines.push(`Tu as marqué ${Math.round(total_points)} points dans ${league_name}`);
          }

          // If user has no points but winner exists, just show winner
          // If no winner and no points, show generic message
          const message = lines.length > 0 
            ? lines.join('\n')
            : typeLabel;

          // Send notification to all subscriptions for this user
          const userIds = userSubs.map(s => s.user_id);
          
          try {
            const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`
              },
              body: JSON.stringify({
                user_ids: [userId],
                title,
                message,
                type: 'results_added',
                metadata: {
                  course_id: p_course_id,
                  course_name: courseName,
                  type_classement: p_type_classement,
                  etape_numero: p_etape_numero,
                  winner_name: winnerName,
                  points_by_league: userLeaguePoints.map(l => ({
                    league_id: l.league_id,
                    league_name: l.league_name,
                    points: Math.round(l.total_points)
                  }))
                }
              })
            });

            if (pushResponse.ok) {
              successCount++;
            } else {
              failCount++;
              console.error(`[admin-result-save-lot] Push failed for user ${userId}:`, await pushResponse.text());
            }
          } catch (pushErr) {
            failCount++;
            console.error(`[admin-result-save-lot] Push error for user ${userId}:`, pushErr);
          }
        }

        console.log(`[admin-result-save-lot] Push notifications sent: ${successCount} success, ${failCount} failed`);

      } catch (pushError) {
        console.error(`[admin-result-save-lot] Error sending push notifications:`, pushError);
        // Don't fail the save if push notification fails
      }
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in admin-result-save-lot:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
