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

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
  lang?: string
}

const logoUrl = 'https://khahpetvqjoyrwambaqn.supabase.co/storage/v1/object/public/email-assets/logo-bordure.png'

const i18n = {
  fr: {
    preview: "Confirmez votre changement d'email — La Bordure",
    heading: "Changement d'adresse email",
    body1: "Vous avez demandé à changer votre adresse email sur La Bordure de",
    body1mid: 'vers',
    body2: 'Cliquez sur le bouton ci-dessous pour confirmer ce changement :',
    button: 'Confirmer le changement',
    footer: "Si vous n'êtes pas à l'origine de cette demande, sécurisez votre compte immédiatement.",
  },
  en: {
    preview: 'Confirm your email change — La Bordure',
    heading: 'Email address change',
    body1: 'You requested to change your email address on La Bordure from',
    body1mid: 'to',
    body2: 'Click the button below to confirm this change:',
    button: 'Confirm change',
    footer: "If you didn't make this request, secure your account immediately.",
  },
}

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
  lang = 'fr',
}: EmailChangeEmailProps) => {
  const t = lang === 'en' ? i18n.en : i18n.fr
  return (
    <Html lang={lang} dir="ltr">
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <div style={header}>
            <Img src={logoUrl} alt="La Bordure" width="120" height="auto" style={logo} />
          </div>
          <Heading style={h1}>{t.heading}</Heading>
          <Text style={text}>
            {t.body1}{' '}
            <Link href={`mailto:${email}`} style={linkStyle}>{email}</Link> {t.body1mid}{' '}
            <Link href={`mailto:${newEmail}`} style={linkStyle}>{newEmail}</Link>.
          </Text>
          <Text style={text}>{t.body2}</Text>
          <Button style={button} href={confirmationUrl}>
            {t.button}
          </Button>
          <Text style={footer}>{t.footer}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export default EmailChangeEmail

const main = { backgroundColor: '#F6F3ED', fontFamily: "'Georgia', 'Times New Roman', serif" }
const container = { backgroundColor: '#ffffff', padding: '0', borderRadius: '12px', maxWidth: '480px', margin: '40px auto', overflow: 'hidden' as const }
const header = { backgroundColor: '#1B5E3B', padding: '24px', textAlign: 'center' as const }
const logo = { margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1B5E3B', margin: '0 0 16px', padding: '24px 24px 0' }
const text = { fontSize: '15px', color: '#2D3D32', lineHeight: '1.6', margin: '0 0 24px', padding: '0 24px' }
const linkStyle = { color: '#1B5E3B', textDecoration: 'underline' }
const button = { backgroundColor: '#C8963A', color: '#ffffff', fontSize: '15px', fontWeight: 'bold' as const, borderRadius: '12px', padding: '14px 28px', textDecoration: 'none', display: 'block' as const, textAlign: 'center' as const, margin: '0 24px 24px' }
const footer = { fontSize: '12px', color: '#8B8B8B', margin: '0', padding: '0 24px 24px', lineHeight: '1.5' }
