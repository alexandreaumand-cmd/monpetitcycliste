# Réparer l'envoi des emails de communication

## Diagnostic

Le dernier envoi (batch `e47e57dc…` du 20 mai 16:26) a produit 2 entrées `email_send_log` qui sont passées de `pending` → `dlq` en quelques secondes, avec l'erreur :

> **Emails disabled for this project**

C'est le worker `process-email-queue` de Lovable Cloud qui refuse d'expédier. Le domaine `labordure.app` est bien `Verified` côté workspace, mais le **toggle d'envoi d'emails au niveau du projet** est sur OFF. Ce toggle est indépendant de la vérification DNS : tant qu'il n'est pas activé, tous les jobs partent en DLQ immédiatement, sans même tenter d'appeler le fournisseur SMTP.

Les anciennes erreurs « TTL exceeded (60 minutes) » du 13 mai sont un autre symptôme du même blocage : les messages ont stagné en queue puis ont été purgés.

## Correctif

1. **Activer l'envoi d'emails du projet** via le toggle Lovable Cloud (outil `toggle_project_emails`, équivalent à Cloud → Emails → Enable sending).
2. **Vérifier la santé de la file** : confirmer qu'il ne reste pas de job bloqué et que `process-email-queue` tourne.
3. **Re-tester** en relançant le batch existant via le bouton « Renvoyer » de l'historique, puis contrôler que les lignes passent à `sent` au lieu de `dlq`.
4. **Purger / requalifier les DLQ** des 2 messages du 20 mai pour qu'ils n'apparaissent plus comme « en attente » dans l'UI (statut UI = pending tant qu'ils ne sont pas `sent`/`failed` propres).

## Détails techniques

- Table observée : `email_send_log`, colonne `error_message = 'Emails disabled for this project'`, `status = 'dlq'`.
- Le toggle est porté par l'outil interne `email_domain--toggle_project_emails` (côté Lovable). Aucun changement de code applicatif n'est requis.
- Aucun fichier du repo n'est modifié dans ce plan.

## Fichiers modifiés

Aucun — l'action est purement une bascule de configuration côté Lovable Cloud, suivie d'un re-test depuis l'UI.
