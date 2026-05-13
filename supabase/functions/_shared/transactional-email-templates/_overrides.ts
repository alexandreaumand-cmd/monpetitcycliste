// Catalog of editable transactional templates + variable substitution helper.
// Used by both the email sender and the admin UI to expose which variables
// are available for {{var}} substitution inside the editable HTML/subject.

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

export const EDITABLE_TEMPLATES: Record<string, EditableTemplate> = {
  'public-league-created': {
    key: 'public-league-created',
    displayName: 'Ligue publique créée',
    description:
      "Envoyé à tous les utilisateurs (opt-in marketing) lorsqu'une ligue publique est créée.",
    variables: [
      { key: 'leagueName', label: 'Nom de la ligue', example: 'Les Grimpeurs du Dimanche' },
      { key: 'ownerName', label: 'Nom du créateur', example: 'Pierre' },
      { key: 'gameMode', label: 'Mode (5 phases / À la course)', example: '5 phases' },
      { key: 'maxPlayers', label: 'Places max', example: '12' },
      { key: 'firstAuctionStartsAt', label: 'Date de la 1ère enchère', example: '15 mai 2026 à 20:00' },
      { key: 'leagueUrl', label: 'Lien vers la ligue', example: 'https://labordure.app/...' },
    ],
    defaults: {
      subject: 'Nouvelle ligue publique : {{leagueName}}',
      intro_html:
        "<p><strong>{{ownerName}}</strong> vient de créer une ligue publique : <strong>{{leagueName}}</strong>. Rejoignez-la avant que toutes les places soient prises.</p>",
      cta_label: 'Rejoindre la ligue',
    },
  },
  'auction-round-opened': {
    key: 'auction-round-opened',
    displayName: "Round d'enchères ouvert",
    description:
      "Envoyé aux membres d'une ligue (opt-in « Ouverture d'un round ») quand un round d'enchères s'ouvre.",
    variables: [
      { key: 'leagueName', label: 'Nom de la ligue', example: 'Les Grimpeurs du Dimanche' },
      { key: 'roundNumber', label: 'Numéro de round', example: '2' },
      { key: 'deadlineAt', label: 'Date limite', example: '15 mai 2026 à 20:00' },
      { key: 'leagueUrl', label: 'Lien vers la ligue', example: 'https://labordure.app/...' },
    ],
    defaults: {
      subject: '🎯 Round {{roundNumber}} ouvert — {{leagueName}}',
      intro_html:
        "<p>Le round d'enchères <strong>n°{{roundNumber}}</strong> de <strong>{{leagueName}}</strong> vient d'être ouvert. À vous de jouer !</p>",
      cta_label: 'Placer mes enchères',
    },
  },
  'auction-round-closed': {
    key: 'auction-round-closed',
    displayName: "Round d'enchères clôturé",
    description:
      "Envoyé aux membres d'une ligue (opt-in « Clôture d'un round ») quand un round d'enchères se clôt.",
    variables: [
      { key: 'leagueName', label: 'Nom de la ligue', example: 'Les Grimpeurs du Dimanche' },
      { key: 'roundNumber', label: 'Numéro de round', example: '2' },
      { key: 'annoncesCount', label: "Nombre d'annonces", example: '7' },
      { key: 'leagueUrl', label: 'Lien vers la ligue', example: 'https://labordure.app/...' },
    ],
    defaults: {
      subject: '⏰ Round {{roundNumber}} clôturé — {{leagueName}}',
      intro_html:
        "<p>Le round d'enchères <strong>n°{{roundNumber}}</strong> de <strong>{{leagueName}}</strong> est terminé. Les résultats sont disponibles dans l'application.</p>",
      cta_label: 'Voir les résultats',
    },
  },
}

const formatValue = (val: unknown): string => {
  if (val === null || val === undefined) return ''
  if (val instanceof Date) return val.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
  if (typeof val === 'string') {
    // ISO date heuristic
    if (/^\d{4}-\d{2}-\d{2}T/.test(val)) {
      try {
        return new Date(val).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
      } catch {
        /* noop */
      }
    }
    return val
  }
  return String(val)
}

export function renderTemplateString(tpl: string | null | undefined, data: Record<string, unknown>): string {
  if (!tpl) return ''
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => formatValue(data[key]))
}
