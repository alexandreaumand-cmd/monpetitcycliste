

## Sauvegarde automatique du montant au blur (perte de focus)

### Problème
Actuellement, quand on clique sur le montant pour l'éditer, il faut appuyer sur Entrée ou cliquer sur le bouton ✓ pour valider. L'utilisateur veut qu'un simple clic ailleurs suffise.

### Solution
Ajouter un handler `onBlur` sur l'`Input` d'édition qui appelle `handleSaveEdit`. Cela permet de sauvegarder automatiquement dès que l'utilisateur clique ailleurs (sur +, -, un autre coureur, etc.).

### Fichier impacté
| Fichier | Action |
|---------|--------|
| `src/components/auction/v2/MyBidsList.tsx` | Ajouter `onBlur={() => handleSaveEdit(bid)}` sur l'Input (ligne 135-147) |

