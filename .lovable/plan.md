

## Diagnostic : Pas d'email de confirmation à l'inscription

### Cause

L'auto-confirmation des emails est activée dans les paramètres d'authentification. Cela signifie que les utilisateurs sont confirmés instantanément à l'inscription, **sans qu'aucun email de confirmation ne soit envoyé**. Le hook `auth-email-hook` n'est jamais déclenché pour le type `signup`.

Preuve : la table `email_send_log` ne contient que des emails de type `recovery` (qui fonctionnent parfaitement) — zéro entrée `signup`.

### Correction

**Désactiver l'auto-confirmation email** dans les paramètres d'authentification Cloud. Cela forcera l'envoi d'un email de confirmation à chaque nouvelle inscription.

Un seul changement de configuration, aucun fichier de code à modifier.

### Impact

- Les nouveaux utilisateurs recevront un email de confirmation avec le template `signup` (déjà configuré et branded "La Bordure")
- Ils devront cliquer sur le lien de confirmation avant de pouvoir se connecter
- Les utilisateurs existants ne sont pas affectés

