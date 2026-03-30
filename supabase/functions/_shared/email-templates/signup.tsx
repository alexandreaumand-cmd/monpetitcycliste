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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
  lang?: string
}

const logoUrl = 'https://khahpetvqjoyrwambaqn.supabase.co/storage/v1/object/public/email-assets/logo-bordure.png'

const i18n = {
  fr: {
    preview: 'Confirmez votre inscription — La Bordure',
    heading: 'Bienvenue dans le peloton !',
    thanks: 'Merci de vous être inscrit sur',
    confirm: 'Confirmez votre adresse email ({email}) en cliquant sur le bouton ci-dessous :',
    button: 'Confirmer mon email',
    footer: "Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.",
  },
  en: {
    preview: 'Confirm your signup — La Bordure',
    heading: 'Welcome to the peloton!',
    thanks: 'Thanks for signing up on',
    confirm: 'Confirm your email address ({email}) by clicking the button below:',
    button: 'Confirm my email',
    footer: "If you didn't create an account, you can safely ignore this email.",
  },
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
  lang = 'fr',
}: SignupEmailProps) => {
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
            {t.thanks}{' '}
            <Link href={siteUrl} style={link}><strong>La Bordure</strong></Link> !
          </Text>
          <Text style={text}>
            {t.confirm.replace('{email}', recipient)}
          </Text>
          <Button style={button} href={confirmationUrl}>
            {t.button}
          </Button>
          <Text style={footer}>
            {t.footer}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default SignupEmail

const main = { backgroundColor: '#F6F3ED', fontFamily: "'Georgia', 'Times New Roman', serif" }
const container = { backgroundColor: '#ffffff', padding: '0', borderRadius: '12px', maxWidth: '480px', margin: '40px auto', overflow: 'hidden' as const }
const header = { backgroundColor: '#1B5E3B', padding: '24px', textAlign: 'center' as const }
const logo = { margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1B5E3B', margin: '0 0 16px', padding: '24px 24px 0' }
const text = { fontSize: '15px', color: '#2D3D32', lineHeight: '1.6', margin: '0 0 24px', padding: '0 24px' }
const link = { color: '#1B5E3B', textDecoration: 'underline' }
const button = { backgroundColor: '#C8963A', color: '#ffffff', fontSize: '15px', fontWeight: 'bold' as const, borderRadius: '12px', padding: '14px 28px', textDecoration: 'none', display: 'block' as const, textAlign: 'center' as const, margin: '0 24px 24px' }
const footer = { fontSize: '12px', color: '#8B8B8B', margin: '0', padding: '0 24px 24px', lineHeight: '1.5' }
