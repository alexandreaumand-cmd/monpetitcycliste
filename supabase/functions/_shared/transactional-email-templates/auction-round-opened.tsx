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
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  leagueName?: string
  roundNumber?: number
  deadlineAt?: string
  phaseIndex?: number | null
  gameMode?: string | null
  leagueUrl?: string
  autoLaunched?: boolean
  __override?: { intro_html?: string | null; cta_label?: string | null } | null
}

const SITE_URL = 'https://labordure.app'
const LOGO_URL = `${SITE_URL}/logo-bordure-light.png`

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

export const AuctionRoundOpenedEmail = ({
  leagueName = 'Votre ligue',
  roundNumber = 1,
  deadlineAt,
  phaseIndex,
  gameMode,
  leagueUrl = `${SITE_URL}/dashboard`,
  autoLaunched = false,
  __override,
}: Props) => (
  <Html>
    <Head />
    <Preview>
      Round {roundNumber} ouvert sur {leagueName} — placez vos enchères !
    </Preview>
    <Body style={main}>
      <Container style={outer}>
        <Section style={header}>
          <Img src={LOGO_URL} alt="La Bordure" width="140" style={logo} />
        </Section>

        <Container style={card}>
          <Heading style={h1}>
            {autoLaunched ? '🤖 ' : '🎯 '}Round {roundNumber} ouvert
          </Heading>
          {__override?.intro_html ? (
            <div style={ledeWrap} dangerouslySetInnerHTML={{ __html: __override.intro_html }} />
          ) : (
            <Text style={lede}>
              Le round d'enchères <strong style={accent}>n°{roundNumber}</strong>{' '}
              de <strong>{leagueName}</strong> vient d'être{' '}
              {autoLaunched ? 'lancé automatiquement' : 'ouvert'}. À vous de jouer !
            </Text>
          )}

          <Section style={infoBox}>
            <Text style={infoLine}>
              <span style={infoLabel}>Ligue</span>
              <span style={infoValue}>{leagueName}</span>
            </Text>
            <Text style={infoLine}>
              <span style={infoLabel}>Round</span>
              <span style={infoValue}>n°{roundNumber}</span>
            </Text>
            {gameMode === 'five_phases' && typeof phaseIndex === 'number' && (
              <Text style={infoLine}>
                <span style={infoLabel}>Phase</span>
                <span style={infoValue}>Phase {phaseIndex + 1}</span>
              </Text>
            )}
            {deadlineAt && (
              <Text style={infoLine}>
                <span style={infoLabel}>Deadline</span>
                <span style={infoValue}>{formatDate(deadlineAt)}</span>
              </Text>
            )}
          </Section>

          <Section style={{ textAlign: 'center', margin: '32px 0 8px' }}>
            <Button style={button} href={leagueUrl}>
              {__override?.cta_label || 'Placer mes enchères'}
            </Button>
          </Section>

          <Text style={smallMuted}>
            Ou copiez ce lien :{' '}
            <Link href={leagueUrl} style={linkStyle}>{leagueUrl}</Link>
          </Text>
        </Container>

        <Section style={footerWrap}>
          <Hr style={hr} />
          <Text style={footer}>
            La Bordure · Fantasy Cycling — vous recevez ce message car vous
            participez à cette ligue. Vous pouvez désactiver ce type de
            notification depuis votre compte.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

const COLORS = {
  cream: '#F6F3ED',
  green: '#1B5E3B',
  greenDark: '#143F28',
  gold: '#C8963A',
  goldLight: '#E0B65A',
  text: '#2D3D32',
  muted: '#8A9188',
  border: '#EAE6DE',
}

const main = {
  backgroundColor: COLORS.cream,
  fontFamily: 'Inter, "Helvetica Neue", Arial, sans-serif',
  color: COLORS.text,
  margin: 0,
  padding: 0,
}
const outer = { margin: '0 auto', padding: '24px 16px 32px', maxWidth: '600px' }
const header = {
  background: `linear-gradient(135deg, ${COLORS.greenDark} 0%, ${COLORS.green} 50%, ${COLORS.gold} 140%)`,
  backgroundColor: COLORS.green,
  borderRadius: '12px 12px 0 0',
  padding: '28px 24px',
  textAlign: 'center' as const,
}
const logo = { margin: '0 auto', display: 'block' }
const card = {
  backgroundColor: '#FFFFFF',
  border: `1px solid ${COLORS.border}`,
  borderTop: 'none',
  borderRadius: '0 0 12px 12px',
  padding: '32px 28px',
  boxShadow: '0 4px 12px rgba(200, 150, 58, 0.08)',
}
const h1 = {
  fontFamily: 'Montserrat, Inter, sans-serif',
  color: COLORS.green,
  fontSize: '24px',
  fontWeight: 700,
  margin: '0 0 16px',
  letterSpacing: '-0.01em',
}
const lede = { color: COLORS.text, fontSize: '16px', lineHeight: '24px', margin: '0 0 20px' }
const ledeWrap = { color: COLORS.text, fontSize: '16px', lineHeight: '24px', margin: '0 0 20px' }
const accent = { color: COLORS.gold }
const infoBox = {
  backgroundColor: COLORS.cream,
  border: `1px solid ${COLORS.border}`,
  borderLeft: `3px solid ${COLORS.gold}`,
  borderRadius: '8px',
  padding: '12px 16px',
  margin: '16px 0',
}
const infoLine = {
  display: 'flex',
  justifyContent: 'space-between',
  color: COLORS.text,
  fontSize: '14px',
  margin: '6px 0',
}
const infoLabel = { color: COLORS.muted, fontWeight: 500, marginRight: '12px' }
const infoValue = { color: COLORS.green, fontWeight: 600 }
const button = {
  backgroundColor: COLORS.gold,
  backgroundImage: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.goldLight})`,
  color: '#FFFFFF',
  padding: '14px 28px',
  borderRadius: '12px',
  fontSize: '15px',
  fontWeight: 600,
  fontFamily: 'Montserrat, Inter, sans-serif',
  textDecoration: 'none',
  display: 'inline-block',
  letterSpacing: '0.02em',
  boxShadow: '0 4px 12px rgba(200, 150, 58, 0.35)',
}
const smallMuted = {
  color: COLORS.muted,
  fontSize: '12px',
  textAlign: 'center' as const,
  margin: '12px 0 0',
  wordBreak: 'break-all' as const,
}
const linkStyle = { color: COLORS.gold, textDecoration: 'underline' }
const footerWrap = { padding: '0 8px' }
const hr = { borderColor: COLORS.border, margin: '24px 0 12px' }
const footer = {
  color: COLORS.muted,
  fontSize: '12px',
  lineHeight: '18px',
  textAlign: 'center' as const,
}

export const template = {
  component: AuctionRoundOpenedEmail,
  displayName: "Round d'enchères ouvert",
  subject: (d: Record<string, any>) =>
    `🎯 Round ${d?.roundNumber ?? ''} ouvert — ${d?.leagueName ?? 'Votre ligue'}`,
  previewData: {
    leagueName: 'Les Grimpeurs du Dimanche',
    roundNumber: 2,
    deadlineAt: new Date(Date.now() + 86400000).toISOString(),
    phaseIndex: 1,
    gameMode: 'five_phases',
    leagueUrl: 'https://labordure.app/dashboard',
    autoLaunched: false,
  },
} satisfies TemplateEntry
