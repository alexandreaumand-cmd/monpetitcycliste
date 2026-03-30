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
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
  lang?: string
}

const logoUrl = 'https://khahpetvqjoyrwambaqn.supabase.co/storage/v1/object/public/email-assets/logo-bordure.png'

const i18n = {
  fr: {
    preview: 'Réinitialisez votre mot de passe — La Bordure',
    heading: 'Réinitialiser votre mot de passe',
    body: 'Vous avez demandé à réinitialiser votre mot de passe sur La Bordure. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.',
    button: 'Réinitialiser le mot de passe',
    footer: "Si vous n'avez pas fait cette demande, ignorez simplement cet email. Votre mot de passe ne sera pas modifié.",
  },
  en: {
    preview: 'Reset your password — La Bordure',
    heading: 'Reset your password',
    body: 'You requested a password reset on La Bordure. Click the button below to choose a new password.',
    button: 'Reset password',
    footer: "If you didn't make this request, simply ignore this email. Your password will not be changed.",
  },
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
  lang = 'fr',
}: RecoveryEmailProps) => {
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
          <Text style={text}>{t.body}</Text>
          <Button style={button} href={confirmationUrl}>
            {t.button}
          </Button>
          <Text style={footer}>{t.footer}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export default RecoveryEmail

const main = { backgroundColor: '#F6F3ED', fontFamily: "'Georgia', 'Times New Roman', serif" }
const container = { backgroundColor: '#ffffff', padding: '0', borderRadius: '12px', maxWidth: '480px', margin: '40px auto', overflow: 'hidden' as const }
const header = { backgroundColor: '#1B5E3B', padding: '24px', textAlign: 'center' as const }
const logo = { margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1B5E3B', margin: '0 0 16px', padding: '24px 24px 0' }
const text = { fontSize: '15px', color: '#2D3D32', lineHeight: '1.6', margin: '0 0 24px', padding: '0 24px' }
const button = { backgroundColor: '#C8963A', color: '#ffffff', fontSize: '15px', fontWeight: 'bold' as const, borderRadius: '12px', padding: '14px 28px', textDecoration: 'none', display: 'block' as const, textAlign: 'center' as const, margin: '0 24px 24px' }
const footer = { fontSize: '12px', color: '#8B8B8B', margin: '0', padding: '0 24px 24px', lineHeight: '1.5' }
