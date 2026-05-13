/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export type TemplateEntry = {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

import { template as publicLeagueCreated } from './public-league-created.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'public-league-created': publicLeagueCreated,
}
