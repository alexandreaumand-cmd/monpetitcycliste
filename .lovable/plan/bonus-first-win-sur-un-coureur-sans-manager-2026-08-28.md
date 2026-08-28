# Bonus First Win sur un coureur sans manager

## Confirmation

Oui, c'est confirmé (vérifié dans le code et en base) :

- Dans l'écran d'attribution des bonus coureur, pour les types « First Win » et « ITT », le code cherche les rosters du coureur pour la phase. Si aucun roster n'est trouvé, il affiche « Ce coureur n'est possédé par aucun manager » et **s'arrête sans rien enregistrer**.
- Rien ne l'empêche côté base : dans la table des bonus, le manager et la ligue sont facultatifs. Le blocage est uniquement dans l'écran d'admin.

## Comportement souhaité

Permettre l'enregistrement du bonus même sans propriétaire, en gardant la trace historique du bonus pour le coureur.

- Coureur possédé : comportement actuel inchangé (une ligne par couple manager/ligue).
- Coureur non possédé : une seule ligne enregistrée, sans manager ni ligue, avec un message de confirmation explicite du type « Bonus enregistré pour le coureur (aucun manager propriétaire sur cette phase) ».
- Avant l'enregistrement, un avertissement discret dans le formulaire signale que le coureur n'est possédé par personne sur la phase sélectionnée, pour éviter les saisies par erreur.
- Le bonus « Coureur bonusé » reste bloqué sans manager (il est par nature attaché à un manager).
- Dans la liste des bonus, ces lignes s'affichent avec « — » (ou « Aucun manager ») à la place du nom de manager, sans casser l'affichage.

## Impact sur les points

Une ligne sans manager n'attribue de points à personne : c'est une saisie d'archive/historique. Les classements ne changent pas. Si plus tard le coureur est acquis, le bonus ne se rattache pas automatiquement — il faudra le ressaisir ou l'éditer.

## Détails techniques

- `src/components/admin/bonus/RiderBonusTab.tsx` : dans `handleSubmit`, remplacer le retour en erreur quand `rostersData` est vide par l'insertion d'une seule ligne avec `manager_id: null` et `league_id: null` ; adapter les messages de succès. Vérifier l'affichage du manager dans le tableau (`BonusListTable.tsx` / colonnes de `RiderBonusTab`) pour gérer le cas nul.
- Avertissement pré-saisie : réutiliser la requête `rosters` (phase + coureur) pour afficher un texte d'alerte sous le sélecteur de coureur.
- Migration base (garde-fou anti-doublon) : l'index unique actuel ne couvre que les lignes avec manager renseigné. Ajout d'un index unique partiel équivalent pour les lignes sans manager (phase, type de bonus, coureur, course, étape, classement) afin d'éviter les doublons de bonus « sans propriétaire ».
- Aucun changement sur le calcul des points ni sur les bonus manager.
