

# Ajouter l'envoi de push notifications à la saisie manuelle des résultats

## Objectif

Permettre la réception des notifications push sur la PWA lors de la saisie manuelle des résultats, en répliquant le comportement de l'import CSV.

---

## Analyse

| Méthode | In-app notification | Push notification |
|---------|---------------------|-------------------|
| Import CSV (`admin-import-race-results-csv`) | Via trigger DB | Via appel Edge Function |
| Saisie manuelle (`admin-result-save-lot`) | Via trigger DB | **Manquant** |

---

## Solution

### Fichier : `supabase/functions/admin-result-save-lot/index.ts`

Après l'appel réussi à `admin_result_save_lot` (ligne 60), ajouter la logique d'envoi de push notification :

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ... (authentification existante - lignes 14-41)

    const { p_course_id, p_type_classement, p_etape_numero, p_rows } = await req.json();

    if (!p_course_id || !p_type_classement || !p_rows) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call the database function
    const { data, error } = await supabase.rpc('admin_result_save_lot', {
      p_course_id,
      p_type_classement,
      p_etape_numero,
      p_rows,
    });

    if (error) throw error;

    // ========== NOUVEAU : Envoi de push notification ==========
    // Ne déclencher que pour les types pertinents (Etape ou General)
    if (p_type_classement === 'Etape' || p_type_classement === 'General') {
      try {
        // Récupérer le nom de la course
        const { data: courseData } = await supabase
          .from('courses')
          .select('nom')
          .eq('id', p_course_id)
          .single();
        
        const courseName = courseData?.nom || p_course_id;
        const typeLabel = p_type_classement === 'Etape' 
          ? (p_etape_numero ? `Étape ${p_etape_numero}` : 'Étape')
          : 'Classement Général';

        console.log(`[admin-result-save-lot] Sending push notification for ${courseName} - ${typeLabel}`);

        const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({
            broadcast: true,
            title: '🏁 Nouveaux résultats',
            message: `${typeLabel} - ${courseName}`,
            type: 'results_added',
            metadata: {
              course_id: p_course_id,
              course_name: courseName,
              type_classement: p_type_classement,
              etape_numero: p_etape_numero
            }
          })
        });

        if (!pushResponse.ok) {
          console.error(`[admin-result-save-lot] Push notification failed:`, await pushResponse.text());
        } else {
          const pushResult = await pushResponse.json();
          console.log(`[admin-result-save-lot] Push notification sent:`, pushResult);
        }
      } catch (pushError) {
        console.error(`[admin-result-save-lot] Error sending push notification:`, pushError);
        // Ne pas faire échouer la sauvegarde si la push échoue
      }
    }
    // ========== FIN NOUVEAU ==========

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
```

---

## Comportement

| Action | Résultat |
|--------|----------|
| Saisie Étape 1 | Push : "🏁 Nouveaux résultats - Étape 1 - Tour de France" |
| Saisie Classement Général | Push : "🏁 Nouveaux résultats - Classement Général - Tour de France" |
| Saisie Maillots (Porteur) | Pas de push (type != Etape/General) |

---

## Récapitulatif technique

- **Fichier modifié** : `supabase/functions/admin-result-save-lot/index.ts`
- **Ajouts** :
  1. Récupération du nom de la course depuis la table `courses`
  2. Appel à `send-push-notification` avec `broadcast: true`
  3. Gestion d'erreur non-bloquante (try/catch)
- **Filtre** : Uniquement pour `p_type_classement` = `'Etape'` ou `'General'`

