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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

const logoUrl = 'https://khahpetvqjoyrwambaqn.supabase.co/storage/v1/object/public/email-assets/logo-bordure.png'

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Vous êtes invité à rejoindre La Bordure !</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={header}>
          <Img src={logoUrl} alt="La Bordure" width="120" height="auto" style={logo} />
        </div>
        <Heading style={h1}>Rejoignez le peloton !</Heading>
        <Text style={text}>
          Vous avez été invité à rejoindre La Bordure, le jeu de fantasy cyclisme.
          Cliquez sur le bouton ci-dessous pour accepter l'invitation et créer votre compte.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Accepter l'invitation
        </Button>
        <Text style={footer}>
          Si vous ne vous attendiez pas à cette invitation, vous pouvez ignorer cet email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = { backgroundColor: '#F6F3ED', fontFamily: "'Georgia', 'Times New Roman', serif" }
const container = { backgroundColor: '#ffffff', padding: '0', borderRadius: '12px', maxWidth: '480px', margin: '40px auto', overflow: 'hidden' as const }
const header = { backgroundColor: '#1B5E3B', padding: '24px', textAlign: 'center' as const }
const logo = { margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1B5E3B', margin: '0 0 16px', padding: '24px 24px 0' }
const text = { fontSize: '15px', color: '#2D3D32', lineHeight: '1.6', margin: '0 0 24px', padding: '0 24px' }
const button = { backgroundColor: '#C8963A', color: '#ffffff', fontSize: '15px', fontWeight: 'bold' as const, borderRadius: '12px', padding: '14px 28px', textDecoration: 'none', display: 'block' as const, textAlign: 'center' as const, margin: '0 24px 24px' }
const footer = { fontSize: '12px', color: '#8B8B8B', margin: '0', padding: '0 24px 24px', lineHeight: '1.5' }
