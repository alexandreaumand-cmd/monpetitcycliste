/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
  lang?: string
}

const logoUrl = 'https://khahpetvqjoyrwambaqn.supabase.co/storage/v1/object/public/email-assets/logo-bordure.png'

const i18n = {
  fr: {
    preview: 'Votre code de vérification — La Bordure',
    heading: 'Code de vérification',
    body: 'Utilisez le code ci-dessous pour confirmer votre identité :',
    footer: "Ce code expire dans quelques minutes. Si vous n'avez pas fait cette demande, vous pouvez ignorer cet email.",
  },
  en: {
    preview: 'Your verification code — La Bordure',
    heading: 'Verification code',
    body: 'Use the code below to confirm your identity:',
    footer: "This code expires in a few minutes. If you didn't make this request, you can safely ignore this email.",
  },
}

export const ReauthenticationEmail = ({ token, lang = 'fr' }: ReauthenticationEmailProps) => {
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
          <Text style={codeStyle}>{token}</Text>
          <Text style={footer}>{t.footer}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export default ReauthenticationEmail

const main = { backgroundColor: '#F6F3ED', fontFamily: "'Georgia', 'Times New Roman', serif" }
const container = { backgroundColor: '#ffffff', padding: '0', borderRadius: '12px', maxWidth: '480px', margin: '40px auto', overflow: 'hidden' as const }
const header = { backgroundColor: '#1B5E3B', padding: '24px', textAlign: 'center' as const }
const logo = { margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1B5E3B', margin: '0 0 16px', padding: '24px 24px 0' }
const text = { fontSize: '15px', color: '#2D3D32', lineHeight: '1.6', margin: '0 0 24px', padding: '0 24px' }
const codeStyle = { fontFamily: 'Courier, monospace', fontSize: '28px', fontWeight: 'bold' as const, color: '#C8963A', margin: '0 0 24px', padding: '0 24px', textAlign: 'center' as const, letterSpacing: '4px' }
const footer = { fontSize: '12px', color: '#8B8B8B', margin: '0', padding: '0 24px 24px', lineHeight: '1.5' }
