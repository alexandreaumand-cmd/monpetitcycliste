import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ImportRequest {
  table: 'coureurs' | 'scoring_rules' | 'courses' | 'managers' | 'course_dates'
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

    // Parse CSV - detect separator (comma or semicolon)
    const lines = csvData.trim().split('\n')
    const firstLine = lines[0]
    const separator = firstLine.includes(';') ? ';' : ','
    const headers = firstLine.split(separator).map(h => h.trim())
    
    let imported = 0
    let errors = 0
    let updatedById = 0
    let updatedByName = 0
    let unknown = 0

    // Special handling for course_dates
    if (table === 'course_dates') {
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i], separator)
        
        try {
          const obj: any = {}
          for (let j = 0; j < headers.length; j++) {
            obj[headers[j].trim()] = values[j]?.trim() || null
          }

          const courseId = obj['id']
          const courseName = obj['Course']
          const dateDebut = obj['date_debut'] || null
          const dateFin = obj['date_fin'] || null

          // Try to match by ID first
          const { data: byIdData, error: byIdError } = await supabaseClient
            .from('courses')
            .update({ date_debut: dateDebut, date_fin: dateFin })
            .eq('id', courseId)
            .select()

          if (byIdError) {
            console.error(`Error updating by ID row ${i}:`, byIdError)
            errors++
            continue
          }

          if (byIdData && byIdData.length > 0) {
            updatedById++
            imported++
          } else if (courseName) {
            // Try to match by normalized name
            const normalized = normalizeName(courseName)
            
            // Get all courses and match client-side (since normalize function isn't in DB)
            const { data: allCourses, error: fetchError } = await supabaseClient
              .from('courses')
              .select('id, nom')

            if (fetchError) {
              console.error(`Error fetching courses for name match:`, fetchError)
              errors++
              continue
            }

            const matchedCourse = allCourses?.find(c => 
              normalizeName(c.nom) === normalized
            )

            if (matchedCourse) {
              const { error: updateError } = await supabaseClient
                .from('courses')
                .update({ date_debut: dateDebut, date_fin: dateFin })
                .eq('id', matchedCourse.id)

              if (updateError) {
                console.error(`Error updating by name row ${i}:`, updateError)
                errors++
              } else {
                updatedByName++
                imported++
              }
            } else {
              console.log(`No match found for: ${courseName} (id: ${courseId})`)
              unknown++
            }
          } else {
            unknown++
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
          updatedById,
          updatedByName,
          unknown,
          message: `Updated ${imported} courses (${updatedById} by ID, ${updatedByName} by name). ${unknown} not matched, ${errors} errors.` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i], separator)
      
      try {
        const record = mapToTableFormat(table, headers, values)
        
        if (record) {
          // For scoring_rules, upsert based on unique constraint (categorie, type_classement, place)
          const { error } = table === 'scoring_rules'
            ? await supabaseClient
                .from(table)
                .upsert(record, { 
                  onConflict: 'categorie,type_classement,place',
                  ignoreDuplicates: false 
                })
            : await supabaseClient
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

function parseCSVLine(line: string, separator: string = ','): string[] {
  const result = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === separator && !inQuotes) {
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
      const typeClassement = normalizeTypeClassement(obj['Type classement']);
      if (!typeClassement) return null; // Skip invalid rows
      
      return {
        id: obj['id'] || `${obj['Catégorie']}_${typeClassement}_${obj['Place']}`.toLowerCase().replace(/\s+/g, '_'),
        categorie: obj['Catégorie'],
        type_classement: typeClassement,
        place: parseInt(obj['Place']) || 0,
        points: Math.floor(parseFloat(obj['Points']) || 0),
        type: obj['Type'] || null
      }
    
    case 'courses':
      // Support both old format (Course, Race Type, Race Category) and new format (all fields)
      const hasNewFormat = headers.includes('nom') || headers.includes('date_debut')
      
      if (hasNewFormat) {
        // New format: id;nom;categorie;type_course;date_debut;date_fin;phase_id;statut;uci_code;wt_tier
        return {
          id: obj['id'] || null,
          nom: obj['nom']?.trim(),
          categorie: obj['categorie']?.trim() || null,
          type_course: obj['type_course']?.trim() || null,
          date_debut: obj['date_debut']?.trim() || null,
          date_fin: obj['date_fin']?.trim() || null,
          phase_id: obj['phase_id']?.trim() || null,
          statut: obj['statut']?.trim() || 'scheduled',
          uci_code: obj['uci_code']?.trim() || null,
          wt_tier: obj['wt_tier']?.trim() || null
        }
      } else {
        // Old format: id, Course, Race Type, Race Category
        return {
          id: obj['id'],
          nom: obj['Course']?.trim(),
          type_course: obj['Race Type'],
          categorie: obj['Race Category'],
          statut: 'scheduled',
          date_debut: null,
          date_fin: null,
          phase_id: null,
          uci_code: null,
          wt_tier: null
        }
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

function normalizeTypeClassement(type: string): string | null {
  if (!type) return null; // Handle undefined/null values
  const lowerType = type.toLowerCase();
  
  // Map to allowed enum values: General, Etape, Points, Montagne, Jeune
  if (lowerType.includes('général') || lowerType.includes('general')) return 'General';
  if (lowerType.includes('étape') || lowerType.includes('etape') || lowerType.includes('stage')) return 'Etape';
  if (lowerType.includes('vert') || lowerType.includes('points')) return 'Points';
  if (lowerType.includes('montagne') || lowerType.includes('kom')) return 'Montagne';
  if (lowerType.includes('jeune') || lowerType.includes('youth')) return 'Jeune';
  if (lowerType.includes('combatif') || lowerType.includes('combativity')) return null; // Ignore combativity
  
  return null; // Unknown type, skip
}

function normalizeName(name: string): string {
  if (!name) return '';
  
  // Remove accents
  const withoutAccents = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  // Convert to lowercase, trim, and collapse multiple spaces
  return withoutAccents
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
