
## Emails de réinitialisation brandés "La Bordure" en français

### Contexte
- Le domaine `notify.labordure.app` est configuré mais DNS en attente de vérification
- Aucun template d'email personnalisé n'existe encore — les emails par défaut (en anglais, non brandés) sont envoyés
- Le DNS n'a pas besoin d'être vérifié pour créer les templates

### Plan

1. **Scaffolder les templates d'emails d'authentification** via l'outil dédié — cela crée la edge function `auth-email-hook` et 6 templates (signup, recovery, magic-link, invite, email-change, reauthentication)

2. **Appliquer l'identité visuelle La Bordure** sur chaque template :
   - Fond crème `#F6F3ED`
   - Boutons en or `#C8963A` avec texte blanc
   - Titres en vert forêt `#1B5E3B`
   - Texte en vert texte `#2D3D32`
   - Accents rose `#E8A0B4` si pertinent
   - Coins arrondis `0.75rem`
   - Logo La Bordure en haut de chaque email (upload dans un bucket storage)
   - Fond du body email en blanc `#FFFFFF` (standard email)

3. **Traduire tout le contenu en français** :
   - "Réinitialiser votre mot de passe" au lieu de "Reset your password"
   - "Vous avez demandé une réinitialisation..." au lieu du texte anglais
   - Bouton "Réinitialiser le mot de passe"
   - Adapter le ton à l'identité La Bordure (chaleureux, sport)

4. **Déployer la edge function** `auth-email-hook`

### Fichiers créés/modifiés
- `supabase/functions/auth-email-hook/index.ts` — nouveau
- `supabase/functions/auth-email-hook/deno.json` — nouveau
- `supabase/functions/_shared/email-templates/*.tsx` — 6 templates brandés FR

### Note
Les emails personnalisés s'activeront automatiquement une fois le DNS vérifié. En attendant, les emails par défaut continuent d'être envoyés. Le statut est visible dans Cloud → Emails.
