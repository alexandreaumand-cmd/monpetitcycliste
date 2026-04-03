// Template registry for transactional emails
// Each template must export a `template` object satisfying TemplateEntry.

export interface TemplateEntry {
  component: any
  subject: string | ((data: any) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

// Import templates
import { template as auctionOpened } from './auction-opened.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'auction-opened': auctionOpened,
}
