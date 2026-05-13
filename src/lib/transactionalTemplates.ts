// Mirror of supabase/functions/_shared/transactional-email-templates/_overrides.ts
// Kept in sync manually — used by the super-admin UI to know which variables
// each editable transactional template exposes.

export type TemplateVariable = {
  key: string
  label: string
  example: string
}

export type EditableTemplate = {
  key: string
  displayName: string
  description: string
  variables: TemplateVariable[]
  defaults: {
    subject: string
    intro_html: string
    cta_label: string
  }
}

export const EDITABLE_TRANSACTIONAL_TEMPLATES: EditableTemplate[] = [
  {
    key: "public-league-created",
    displayName: "Ligue publique créée",
    description:
      "Envoyé à tous les utilisateurs (opt-in marketing) lorsqu'une ligue publique est créée.",
    variables: [
      { key: "leagueName", label: "Nom de la ligue", example: "Les Grimpeurs du Dimanche" },
      { key: "ownerName", label: "Nom du créateur", example: "Pierre" },
      { key: "gameMode", label: "Mode (5 phases / À la course)", example: "5 phases" },
      { key: "maxPlayers", label: "Places max", example: "12" },
      { key: "firstAuctionStartsAt", label: "Date de la 1ère enchère", example: "15 mai 2026 à 20:00" },
      { key: "leagueUrl", label: "Lien vers la ligue", example: "https://labordure.app/..." },
    ],
    defaults: {
      subject: "Nouvelle ligue publique : {{leagueName}}",
      intro_html:
        "<p><strong>{{ownerName}}</strong> vient de créer une ligue publique : <strong>{{leagueName}}</strong>. Rejoignez-la avant que toutes les places soient prises.</p>",
      cta_label: "Rejoindre la ligue",
    },
  },
  {
    key: "auction-round-opened",
    displayName: "Round d'enchères ouvert",
    description:
      "Envoyé aux membres d'une ligue (opt-in « Ouverture d'un round ») quand un round d'enchères s'ouvre.",
    variables: [
      { key: "leagueName", label: "Nom de la ligue", example: "Les Grimpeurs du Dimanche" },
      { key: "roundNumber", label: "Numéro de round", example: "2" },
      { key: "deadlineAt", label: "Date limite", example: "15 mai 2026 à 20:00" },
      { key: "leagueUrl", label: "Lien vers la ligue", example: "https://labordure.app/..." },
    ],
    defaults: {
      subject: "🎯 Round {{roundNumber}} ouvert — {{leagueName}}",
      intro_html:
        "<p>Le round d'enchères <strong>n°{{roundNumber}}</strong> de <strong>{{leagueName}}</strong> vient d'être ouvert. À vous de jouer !</p>",
      cta_label: "Placer mes enchères",
    },
  },
  {
    key: "auction-round-closed",
    displayName: "Round d'enchères clôturé",
    description:
      "Envoyé aux membres d'une ligue (opt-in « Clôture d'un round ») quand un round d'enchères se clôt.",
    variables: [
      { key: "leagueName", label: "Nom de la ligue", example: "Les Grimpeurs du Dimanche" },
      { key: "roundNumber", label: "Numéro de round", example: "2" },
      { key: "annoncesCount", label: "Nombre d'annonces", example: "7" },
      { key: "leagueUrl", label: "Lien vers la ligue", example: "https://labordure.app/..." },
    ],
    defaults: {
      subject: "⏰ Round {{roundNumber}} clôturé — {{leagueName}}",
      intro_html:
        "<p>Le round d'enchères <strong>n°{{roundNumber}}</strong> de <strong>{{leagueName}}</strong> est terminé. Les résultats sont disponibles dans l'application.</p>",
      cta_label: "Voir les résultats",
    },
  },
]
