/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  leagueName?: string
  ownerName?: string
  gameMode?: string
  maxPlayers?: number
  firstAuctionStartsAt?: string
  leagueUrl?: string
}

const SITE_URL = 'https://labordure.app'

const formatDate = (iso?: string) => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      dateStyle: 'long',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

const modeLabel = (m?: string) =>
  m === 'five_phases' ? '5 phases' : m === 'per_course' ? 'À la course' : m || ''

export const PublicLeagueCreatedEmail = ({
  leagueName = 'Nouvelle ligue',
  ownerName = 'Un manager',
  gameMode,
  maxPlayers,
  firstAuctionStartsAt,
  leagueUrl = `${SITE_URL}/dashboard`,
}: Props) => (
  <Html>
    <Head />
    <Preview>Une nouvelle ligue publique vient d'être créée sur Labordure</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Nouvelle ligue publique</Heading>
        <Text style={text}>
          {ownerName} vient de créer une ligue publique : <strong>{leagueName}</strong>.
          Rejoignez-la avant que toutes les places soient prises.
        </Text>
        <Section style={infoBox}>
          {gameMode && (
            <Text style={infoLine}>
              <strong>Mode :</strong> {modeLabel(gameMode)}
            </Text>
          )}
          {maxPlayers && (
            <Text style={infoLine}>
              <strong>Places :</strong> {maxPlayers} managers max
            </Text>
          )}
          {firstAuctionStartsAt && (
            <Text style={infoLine}>
              <strong>Première enchère :</strong> {formatDate(firstAuctionStartsAt)}
            </Text>
          )}
        </Section>
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button style={button} href={leagueUrl}>
            Rejoindre la ligue
          </Button>
        </Section>
        <Hr style={hr} />
        <Text style={footer}>
          Vous recevez ce message car vous êtes inscrit sur Labordure.
          Pour ne plus recevoir ces notifications, utilisez le lien de
          désabonnement en bas de l'email.
        </Text>
      </Container>
    </Body>
  </Html>
)

const main = {
  backgroundColor: '#0b0b0f',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
}
const container = {
  margin: '0 auto',
  padding: '32px 24px',
  maxWidth: '560px',
  backgroundColor: '#15151c',
  borderRadius: '12px',
}
const h1 = { color: '#ffffff', fontSize: '24px', fontWeight: 700, margin: '0 0 16px' }
const text = { color: '#d4d4d8', fontSize: '16px', lineHeight: '24px', margin: '0 0 16px' }
const infoBox = {
  backgroundColor: '#1f1f29',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '16px 0',
}
const infoLine = { color: '#e4e4e7', fontSize: '14px', margin: '4px 0' }
const button = {
  backgroundColor: '#facc15',
  color: '#0b0b0f',
  padding: '12px 24px',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: 600,
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#2a2a36', margin: '32px 0 16px' }
const footer = { color: '#71717a', fontSize: '12px', lineHeight: '18px' }

export const template = {
  component: PublicLeagueCreatedEmail,
  displayName: 'Ligue publique créée',
  subject: (d: Record<string, any>) =>
    `Nouvelle ligue publique : ${d?.leagueName || 'à découvrir'}`,
  previewData: {
    leagueName: 'Les Grimpeurs du Dimanche',
    ownerName: 'Marc D.',
    gameMode: 'five_phases',
    maxPlayers: 12,
    firstAuctionStartsAt: new Date(Date.now() + 86400000).toISOString(),
    leagueUrl: 'https://labordure.app/dashboard',
  },
} satisfies TemplateEntry
