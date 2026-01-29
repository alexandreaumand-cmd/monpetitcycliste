
# Corriger les push notifications pour la saisie manuelle de résultats

## Probleme identifie
L'interface admin (`ResultsEntryStudio.desktop.tsx`) appelle directement la fonction PostgreSQL `admin_result_save_lot` via `supabase.rpc()`, au lieu de l'edge function `admin-result-save-lot` qui contient la logique d'envoi des push notifications.

**Resultat** : Les notifications in-app fonctionnent (trigger PostgreSQL), mais les push notifications ne sont jamais envoyees.

---

## Solution proposee

### Option A : Appeler l'edge function au lieu du RPC (Recommande)
Modifier `ResultsEntryStudio.desktop.tsx` pour utiliser l'edge function existante.

**Avantages** :
- L'edge function existe deja et fonctionne
- Centralise la logique d'envoi de push
- Pas de duplication de code

**Fichier a modifier** : `src/components/admin/ResultsEntryStudio.desktop.tsx`

### Changements a effectuer

1. Creer une fonction helper pour appeler l'edge function :

```typescript
const callAdminResultSaveLot = async (
  courseId: string,
  typeClassement: string,
  etapeNumero: number | null,
  rows: Array<{ coureur_id: string; position: number; statut: string }>
) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Non authentifié');
  
  const response = await supabase.functions.invoke('admin-result-save-lot', {
    body: {
      p_course_id: courseId,
      p_type_classement: typeClassement,
      p_etape_numero: etapeNumero,
      p_rows: rows
    }
  });
  
  if (response.error) throw response.error;
  return response.data;
};
```

2. Remplacer les 3 appels `supabase.rpc("admin_result_save_lot", ...)` par `callAdminResultSaveLot(...)` :
   - Ligne 789 : Sauvegarde des resultats principaux
   - Ligne 822 : Sauvegarde des porteurs de maillots (boucle)
   - Ligne 884 : Sauvegarde du Combatif

3. Filtrer les push pour eviter le spam :
   - L'edge function n'envoie des push que pour `Etape` ou `General`
   - Les maillots et Combatif n'en envoient pas (comportement actuel correct)

---

## Verification du comportement attendu

| Action admin | Notification in-app | Push notification |
|--------------|---------------------|-------------------|
| Saisie Etape 3 | Oui (trigger) | Oui (edge function) |
| Saisie General | Oui (trigger) | Oui (edge function) |
| Saisie Porteurs | Non | Non |
| Saisie Combatif | Non | Non |

---

## Fichiers a modifier

| Fichier | Modification |
|---------|--------------|
| `src/components/admin/ResultsEntryStudio.desktop.tsx` | Remplacer `supabase.rpc()` par `supabase.functions.invoke()` |

---

## Gestion des erreurs
Si l'edge function echoue :
- Les resultats ne seront pas sauvegardes (comportement atomique)
- Message d'erreur affiche a l'admin
- Pas de notification partielle (coherent)

---

## Tests a effectuer apres implementation
1. Saisir les resultats d'une etape
2. Verifier que les notifications in-app apparaissent
3. Verifier que les push notifications sont recues sur les appareils inscrits
4. Confirmer que les porteurs de maillots ne declenchent pas de push
