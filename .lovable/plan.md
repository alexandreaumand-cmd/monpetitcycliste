## Plan : sécuriser explicitement la lecture de `contact_messages`

### Contexte
La table `contact_messages` a RLS activé et une policy INSERT publique (formulaire de contact). Aucune policy SELECT n'existe — donc actuellement personne ne peut lire via l'API, ce qui est sûr. Le finding est préventif : rendre l'intention explicite pour éviter qu'une future policy SELECT trop permissive expose emails/messages.

### Action proposée
Ajouter une policy SELECT explicite réservée aux superadmins, via une migration.

```sql
CREATE POLICY "Superadmins can view contact messages"
ON public.contact_messages
FOR SELECT
TO authenticated
USING (is_superadmin());
```

### Pourquoi c'est suffisant
- `is_superadmin()` est déjà la fonction utilisée partout pour ce rôle.
- Aucune policy UPDATE/DELETE n'est ajoutée (conforme à l'usage actuel : messages immuables).
- La policy INSERT publique reste inchangée — le formulaire de contact continue de fonctionner.
- Aucun changement de code applicatif requis (`ContactPage` et `send-contact-email` ne lisent pas la table).

### Étapes
1. Créer la migration SQL ci-dessus (s'applique sur Test).
2. Sur publication, elle s'applique automatiquement sur Live.
3. Marquer le finding comme résolu.
