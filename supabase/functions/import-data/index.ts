import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ImportRequest {
  table: 'coureurs' | 'scoring_rules' | 'courses' | 'managers'
  data: string // CSV content
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify admin role
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseClient.auth.getUser(token)

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single()

    if (!roles) {
      throw new Error('Admin access required')
    }

    const { table, data: csvData }: ImportRequest = await req.json()

    console.log(`Importing data to table: ${table}`)

    // Parse CSV
    const lines = csvData.trim().split('\n')
    const headers = lines[0].split(',')
    
    let imported = 0
    let errors = 0

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      
      try {
        const record = mapToTableFormat(table, headers, values)
        
        if (record) {
          const { error } = await supabaseClient
            .from(table)
            .upsert(record, { onConflict: 'id' })

          if (error) {
            console.error(`Error importing row ${i}:`, error)
            errors++
          } else {
            imported++
          }
        }
      } catch (err) {
        console.error(`Error processing row ${i}:`, err)
        errors++
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported, 
        errors,
        message: `Imported ${imported} records with ${errors} errors` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Import error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

function parseCSVLine(line: string): string[] {
  const result = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current.trim())
  return result
}

function mapToTableFormat(
  table: string,
  headers: string[],
  values: string[]
): any {
  const obj: any = {}
  
  for (let i = 0; i < headers.length; i++) {
    obj[headers[i].trim()] = values[i]?.trim() || null
  }

  switch (table) {
    case 'coureurs':
      return {
        id: sanitizeId(obj['Coureur']),
        nom: obj['Coureur'],
        equipe: obj['Equipe'],
        prix_initial: parseFloat(obj['Prix initial']) || 10,
        uci_id: obj['id'] || null
      }
    
    case 'scoring_rules':
      return {
        id: obj['id'],
        categorie: obj['Catégorie'],
        type_classement: mapClassementType(obj['Type classement']),
        place: parseInt(obj['Place']) || 0,
        points: parseInt(obj['Points']) || 0,
        type: obj['Type']
      }
    
    case 'courses':
      return {
        id: obj['id'],
        nom: obj['Course']?.trim(),
        type_course: obj['Race Type'],
        categorie: obj['Race Category'],
        statut: 'scheduled',
        date_debut: null,
        date_fin: null,
        phase_id: null,
        uci_code: null
      }
    
    case 'managers':
      return {
        nom: obj['Nom manager'],
        sponsor: obj['Sponsor'],
        email: null,
        user_id: null
      }
    
    default:
      return null
  }
}

function sanitizeId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function mapClassementType(type: string): string {
  const mapping: Record<string, string> = {
    'Classement Général': 'general',
    'Classement Etape': 'stage',
    'Classement Vert': 'points',
    'Classement Montagne': 'mountain',
    'Classement Jeune': 'youth',
    'Super Combatif': 'combativity'
  }
  return mapping[type] || type
}
