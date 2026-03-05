

## Problème

Actuellement, une seule image de parcours (`route_image_url` sur la table `courses`) est supportée. Pour les courses par étapes (Paris-Nice, Tour de France...), il faut pouvoir associer **plusieurs images** (une par étape + éventuellement une vue d'ensemble).

## Solution proposée : table `course_route_images`

### 1. Nouvelle table en base

```sql
CREATE TABLE course_route_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id text NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  etape_numero integer, -- NULL = vue d'ensemble
  image_url text NOT NULL,
  label text, -- ex: "Étape 1 - Contre-la-montre"
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uniq_course_route_image 
ON course_route_images (course_id, COALESCE(etape_numero, -1));
```

RLS : SELECT pour tous, INSERT/UPDATE/DELETE pour superadmins. Le champ `route_image_url` existant sur `courses` reste en place pour les courses d'un jour (rétrocompatibilité).

### 2. Edge Function `startlist-upload-route-image`

Adapter pour accepter un paramètre optionnel `etape_numero` et `label` :
- Si fournis → insérer/upsert dans `course_route_images`
- Sinon → comportement actuel (mise à jour de `courses.route_image_url`)

### 3. Admin — `RouteImageUploader` multi-étapes

Pour les courses de type "Stage race" :
- Afficher un sélecteur d'étape (1 à N + "Vue d'ensemble")
- Permettre d'uploader une image par étape
- Afficher les miniatures des images déjà uploadées avec possibilité de remplacer

### 4. Côté utilisateur (ligue) — Consultation

**Desktop (`StartlistDesktopExport.tsx`)** :
- Si une seule image → affichage actuel inchangé
- Si plusieurs images → afficher des **onglets/tabs** (Étape 1, Étape 2, ...) au-dessus de l'image, ou un **carousel** avec navigation gauche/droite
- Le clic ouvre le modal plein écran avec navigation entre étapes

**Mobile (`Startlist.mobile.tsx`)** :
- Carousel swipeable avec indicateurs de pagination (dots)
- Bottom sheet en plein écran avec navigation entre étapes

### 5. Edge Function `startlist-manager-view`

Enrichir la réponse avec les images multi-étapes :
- Requêter `course_route_images` triées par `sort_order`
- Les inclure dans le payload sous `route_images: [{etape_numero, image_url, label}]`
- Garder `route_image_url` pour la rétrocompatibilité (courses d'un jour)

### Fichiers impactés
- **Migration SQL** : création table + RLS
- **`supabase/functions/startlist-upload-route-image/index.ts`** : support multi-étapes
- **`supabase/functions/startlist-manager-view/index.ts`** : inclure les images
- **`src/components/startlist/RouteImageUploader.tsx`** : UI multi-upload pour stage races
- **`src/components/startlist/StartlistDesktopExport.tsx`** : tabs/carousel d'images
- **`src/pages/Startlist.desktop.tsx`** : modal avec navigation multi-images
- **`src/pages/Startlist.mobile.tsx`** : carousel + bottom sheet multi-images

