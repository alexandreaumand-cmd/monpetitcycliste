/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

import type { TemplateEntry } from './registry.ts'

interface AuctionOpenedProps {
  leagueName?: string
  roundNumber?: number
  deadlineAt?: string
  leagueId?: string
  lang?: string
}

const logoUrl = 'https://khahpetvqjoyrwambaqn.supabase.co/storage/v1/object/public/email-assets/logo-bordure.png'
const APP_URL = 'https://labordure.app'

const i18n = {
  fr: {
    preview: (league: string, round: number) => `Tour ${round} ouvert — ${league}`,
    heading: 'Les enchères sont ouvertes !',
    intro: (league: string, round: number) =>
      `Le tour ${round} d'enchères vient d'ouvrir dans votre ligue "${league}".`,
    deadline: (d: string) => `Vous avez jusqu'au ${d} pour placer vos mises.`,
    button: 'Placer mes mises',
    footer: 'Bonne chance dans le peloton ! 🚴',
    noReply: 'Cet email est envoyé automatiquement. Ne pas répondre.',
  },
  en: {
    preview: (league: string, round: number) => `Round ${round} open — ${league}`,
    heading: 'Bidding is open!',
    intro: (league: string, round: number) =>
      `Round ${round} has just opened in your league "${league}".`,
    deadline: (d: string) => `You have until ${d} to place your bids.`,
    button: 'Place my bids',
    footer: 'Good luck in the peloton! 🚴',
    noReply: 'This email is sent automatically. Do not reply.',
  },
}

function formatDeadline(dateStr: string, lang: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris',
    })
  } catch {
    return dateStr
  }
}

export const AuctionOpenedEmail = ({
  leagueName = 'Ma Ligue',
  roundNumber = 1,
  deadlineAt = '',
  leagueId = '',
  lang = 'fr',
}: AuctionOpenedProps) => {
  const t = lang === 'en' ? i18n.en : i18n.fr
  const formattedDeadline = deadlineAt ? formatDeadline(deadlineAt, lang) : ''
  const ctaUrl = `${APP_URL}/dashboard/encheres?leagueId=${leagueId}`

  return (
    <Html lang={lang} dir="ltr">
      <Head />
      <Preview>{t.preview(leagueName, roundNumber)}</Preview>
      <Body style={main}>
        <Container style={container}>
          <div style={header}>
            <Img src={logoUrl} alt="La Bordure" width="120" height="auto" style={logo} />
          </div>
          <Heading style={h1}>{t.heading}</Heading>
          <Text style={text}>{t.intro(leagueName, roundNumber)}</Text>
          {formattedDeadline && (
            <Text style={deadlineStyle}>⏰ {t.deadline(formattedDeadline)}</Text>
          )}
          <Button style={button} href={ctaUrl}>
            {t.button}
          </Button>
          <Text style={footerText}>{t.footer}</Text>
          <Text style={noReplyText}>{t.noReply}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export default AuctionOpenedEmail

// Styles — matching auth email templates exactly
const main = { backgroundColor: '#F6F3ED', fontFamily: "'Georgia', 'Times New Roman', serif" }
const container = { backgroundColor: '#ffffff', padding: '0', borderRadius: '12px', maxWidth: '480px', margin: '40px auto', overflow: 'hidden' as const }
const header = { backgroundColor: '#1B5E3B', padding: '24px', textAlign: 'center' as const }
const logo = { margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1B5E3B', margin: '0 0 16px', padding: '24px 24px 0' }
const text = { fontSize: '15px', color: '#2D3D32', lineHeight: '1.6', margin: '0 0 16px', padding: '0 24px' }
const deadlineStyle = { fontSize: '15px', color: '#1B5E3B', lineHeight: '1.6', margin: '0 0 24px', padding: '0 24px', fontWeight: 'bold' as const }
const button = { backgroundColor: '#C8963A', color: '#ffffff', fontSize: '15px', fontWeight: 'bold' as const, borderRadius: '12px', padding: '14px 28px', textDecoration: 'none', display: 'block' as const, textAlign: 'center' as const, margin: '0 24px 24px' }
const footerText = { fontSize: '13px', color: '#6B7B6F', margin: '0', padding: '0 24px 8px', lineHeight: '1.5', textAlign: 'center' as const }
const noReplyText = { fontSize: '11px', color: '#8B8B8B', margin: '0', padding: '0 24px 24px', lineHeight: '1.5', textAlign: 'center' as const }

// Template entry for registry
export const template = {
  component: AuctionOpenedEmail,
  subject: (data: AuctionOpenedProps) =>
    `Tour ${data.roundNumber || '?'} ouvert — ${data.leagueName || 'La Bordure'}`,
  displayName: 'Auction Opened',
  previewData: {
    leagueName: 'SuceurDeRoux',
    roundNumber: 3,
    deadlineAt: '2026-04-15T20:00:00Z',
    leagueId: 'test-league-id',
    lang: 'fr',
  } as AuctionOpenedProps,
} satisfies TemplateEntry
