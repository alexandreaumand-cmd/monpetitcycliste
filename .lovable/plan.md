
# Plan : Ajouter les notifications push pour la validation des startlists

## Problème identifié

La validation de startlist par un admin déclenche un **trigger PostgreSQL** qui crée des notifications in-app, mais **ne déclenche aucune notification push**. Le système push existe et fonctionne (comme prouvé par les logs `results_added`), mais il n'est simplement pas appelé pour ce type d'événement.

## Cause racine

Le trigger SQL `notify_startlist_validated` ne peut pas appeler une Edge Function directement. Les enchères fonctionnent car elles passent par une Edge Function (`ouvrir-nouveau-round`) qui appelle `notifyLeagueMembers()` incluant l'envoi push.

## Solution proposée

### Option A : Appeler l'Edge Function depuis le frontend (rapide à implémenter)

Modifier `StartlistDetailView.tsx` pour appeler l'Edge Function `send-push-notification` après la validation réussie.

### Option B : Utiliser un webhook PostgreSQL (plus robuste)

Créer un trigger qui utilise `pg_net` pour appeler l'Edge Function. Plus complexe mais garantit l'envoi même si la validation vient d'ailleurs.

**Recommandation** : Option A - plus simple et suffisante puisque la validation se fait uniquement depuis l'UI admin.

## Fichier à modifier

**`src/components/admin/StartlistDetailView.tsx`**

### Changement : Ajouter l'envoi push après validation

Après la mise à jour réussie de `pcs_validated = true`, appeler l'Edge Function pour notifier tous les utilisateurs qui ont activé les notifications startlist.

```typescript
const handlePcsValidation = async () => {
  if (!startlistId || !currentUser) return;
  
  const currentStatus = startlistViewData?.pcs_validated || false;
  const newStatus = !currentStatus;
  
  try {
    const { error } = await supabase
      .from('startlist_imports')
      .update({ 
        pcs_validated: newStatus,
        pcs_validated_at: newStatus ? new Date().toISOString() : null,
        pcs_validated_by_manager_id: newStatus ? currentUser.id : null
      })
      .eq('id', startlistId);

    if (error) throw error;

    // === NOUVEAU : Envoyer les notifications push ===
    if (newStatus) {
      // Récupérer tous les user_ids qui ont une subscription push
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('user_id');
      
      if (subscriptions && subscriptions.length > 0) {
        const userIds = [...new Set(subscriptions.map(s => s.user_id))];
        const raceName = startlistViewData?.race_name || 'la course';
        
        // Appeler l'Edge Function
        await supabase.functions.invoke('send-push-notification', {
          body: {
            user_ids: userIds,
            title: '📋 Startlist validée',
            message: `La startlist de ${raceName} a été validée`,
            type: 'startlist_validated',
            metadata: {
              race_id: startlistViewData?.race_id,
              startlist_id: startlistId,
              race_name: raceName
            }
          }
        });
      }
    }

    toast.success(newStatus ? "SL validée ✓" : "Validation retirée");
    queryClient.invalidateQueries({ queryKey: ['startlist-view'] });
    queryClient.invalidateQueries({ queryKey: ['startlist-imports'] });
  } catch (error: any) {
    toast.error("Erreur : " + error.message);
  }
};
```

## Comportement attendu

1. Admin valide une startlist
2. Le trigger SQL crée les notifications in-app (existant)
3. Le code frontend appelle `send-push-notification` avec tous les `user_ids` abonnés
4. L'Edge Function filtre par préférences (`startlists: true`) et envoie les push
5. Les utilisateurs reçoivent la notification sur leur téléphone

## Validation

Après implémentation :
1. Aller dans l'admin startlist
2. Valider une startlist
3. Les utilisateurs avec les notifications push activées (et préférence "startlists" active) recevront un push
