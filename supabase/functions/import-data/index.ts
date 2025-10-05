import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ImportRequest {
  table: 'coureurs' | 'scoring_rules' | 'courses' | 'managers' | 'course_dates' | 'rosters'
  data: string // CSV content
}

/**
 * Fetch all rows from a table with pagination to bypass the 1000 row limit
 */
async function fetchAllRows(
  client: any,
  table: string,
  columns: string,
  pageSize: number = 1000
): Promise<any[]> {
  const allRows: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);

    if (error) {
      console.error(`Error fetching ${table} (range ${from}-${from + pageSize - 1}):`, error);
      throw error;
    }

    if (data && data.length > 0) {
      allRows.push(...data);
      console.log(`  📦 Fetched ${data.length} rows from ${table} (total: ${allRows.length})`);
    }

    // If we got fewer rows than pageSize, we've reached the end
    hasMore = data && data.length === pageSize;
    from += pageSize;
  }

  return allRows;
}

function unwrapGlobalQuotes(line: string): string {
  // Remove leading/trailing whitespace
  const trimmed = line.trim()
  
  // Check if the entire line is wrapped in quotes and contains separators inside
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length > 2) {
    const inner = trimmed.slice(1, -1)
    // Only unwrap if the inner content has comma or semicolon (looks like CSV data)
    if (inner.includes(',') || inner.includes(';')) {
      return inner
    }
  }
  
  return trimmed
}

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
        // New format: supports pays column and phase name mapping
        // Generate ID from nom if id is empty or null
        const courseNom = obj['nom']?.trim()
        const rawId = obj['id']?.trim()
        const courseId = (rawId && rawId.length > 0) ? rawId : (courseNom ? sanitizeId(courseNom) : null)
        
        return {
          id: courseId,
          nom: courseNom,
          categorie: obj['categorie']?.trim() || null,
          type_course: obj['type_course']?.trim() || null,
          date_debut: obj['date_debut']?.trim() || null,
          date_fin: obj['date_fin']?.trim() || null,
          phase_id: obj['phase_id']?.trim() || null, // Will be mapped later
          statut: obj['statut']?.trim() || 'scheduled',
          uci_code: obj['uci_code']?.trim() || null,
          wt_tier: obj['wt_tier']?.trim() || null,
          pays: obj['pays']?.trim() || null
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
          wt_tier: null,
          pays: null
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
  
  // Manual accent removal map (plus robuste que NFD)
  const accentMap: Record<string, string> = {
    'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a',
    'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
    'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
    'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
    'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
    'ý': 'y', 'ÿ': 'y',
    'ñ': 'n', 'ç': 'c',
    'À': 'A', 'Á': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A', 'Å': 'A',
    'È': 'E', 'É': 'E', 'Ê': 'E', 'Ë': 'E',
    'Ì': 'I', 'Í': 'I', 'Î': 'I', 'Ï': 'I',
    'Ò': 'O', 'Ó': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'O',
    'Ù': 'U', 'Ú': 'U', 'Û': 'U', 'Ü': 'U',
    'Ý': 'Y', 'Ÿ': 'Y',
    'Ñ': 'N', 'Ç': 'C'
  };
  
  // Replace all accented characters
  let result = name;
  for (const [accented, plain] of Object.entries(accentMap)) {
    result = result.replaceAll(accented, plain);
  }
  
  // Also try NFD normalization as fallback
  result = result
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  // Replace all types of spaces with single space
  result = result
    .replace(/[\s\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g, ' ');
  
  // Remove control characters
  result = result.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  
  // Convert to lowercase, trim, and collapse multiple spaces
  return result
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function parseFlexibleDate(dateStr: string | null): string | null {
  if (!dateStr || dateStr.trim().length === 0) return null
  
  const cleaned = dateStr.trim()
  
  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned
  }
  
  // Try DD/MM/YYYY
  const ddmmyyyyMatch = cleaned.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/)
  if (ddmmyyyyMatch) {
    const day = ddmmyyyyMatch[1].padStart(2, '0')
    const month = ddmmyyyyMatch[2].padStart(2, '0')
    const year = ddmmyyyyMatch[3]
    // Assume DD/MM/YYYY (European format)
    return `${year}-${month}-${day}`
  }
  
  // Try MM/DD/YYYY (American format) - less common in cycling
  const mmddyyyyMatch = cleaned.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/)
  if (mmddyyyyMatch) {
    const first = mmddyyyyMatch[1].padStart(2, '0')
    const second = mmddyyyyMatch[2].padStart(2, '0')
    const year = mmddyyyyMatch[3]
    // If first number > 12, must be DD/MM
    if (parseInt(first) > 12) {
      return `${year}-${second}-${first}`
    }
    // Otherwise assume MM/DD
    return `${year}-${first}-${second}`
  }
  
  // Try YYYY/MM/DD
  const yyyymmddMatch = cleaned.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/)
  if (yyyymmddMatch) {
    const year = yyyymmddMatch[1]
    const month = yyyymmddMatch[2].padStart(2, '0')
    const day = yyyymmddMatch[3].padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  console.warn(`Unable to parse date: ${dateStr}`)
  return null
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

    // Detect and clean CSV data
    let cleanedData = csvData
    
    // Remove BOM if present
    if (cleanedData.charCodeAt(0) === 0xFEFF) {
      cleanedData = cleanedData.slice(1)
    }
    
    // Normalize line endings
    cleanedData = cleanedData.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    
    // Parse CSV - detect separator (comma or semicolon)
    let lines = cleanedData.trim().split('\n')
    
    // Unwrap globally quoted lines (Excel export issue)
    lines = lines.map(line => unwrapGlobalQuotes(line))
    
    const firstLine = lines[0]
    
    // Detect separator after unwrapping
    const commaCount = (firstLine.match(/,/g) || []).length
    const semicolonCount = (firstLine.match(/;/g) || []).length
    const separator = semicolonCount > commaCount ? ';' : ','
    
    // Parse and normalize headers
    const rawHeaders = parseCSVLine(firstLine, separator)
    const headers = rawHeaders.map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
    
    let imported = 0
    let errors = 0
    let updatedById = 0
    let updatedByName = 0
    let unknown = 0

    // Special handling for rosters
    if (table === 'rosters') {
      console.log('🔧 Processing rosters with PAGINATION (version 2025-01-05)...');
      
      // Fetch ALL data with pagination
      const [allCoureurs, allManagers, allPhases] = await Promise.all([
        fetchAllRows(supabaseClient, 'coureurs', 'id, nom'),
        fetchAllRows(supabaseClient, 'managers', 'id, nom'),
        fetchAllRows(supabaseClient, 'phases', 'id, index_dans_saison')
      ]);

      if (!allCoureurs || allCoureurs.length === 0) {
        throw new Error('Failed to load coureurs or no coureurs found');
      }
      if (!allManagers || allManagers.length === 0) {
        throw new Error('Failed to load managers or no managers found');
      }
      if (!allPhases || allPhases.length === 0) {
        throw new Error('Failed to load phases or no phases found');
      }

      // Build lookup maps from complete datasets
      const coureursByName = new Map(
        allCoureurs.map(c => [normalizeName(c.nom), c.id])
      );
      const managersByName = new Map(
        allManagers.map(m => [normalizeName(m.nom), m.id])
      );
      const phasesByIndex = new Map(
        allPhases.map(p => [p.index_dans_saison, p.id])
      );

      // 📊 Logs de diagnostic - Stats de référence
      console.log('📊 Stats de référence:');
      console.log(`- Coureurs chargés: ${allCoureurs.length}`);
      console.log(`- Managers chargés: ${allManagers.length}`);
      console.log(`- Phases chargées: ${allPhases.length}`);
      console.log('- Premiers 5 coureurs:', Array.from(coureursByName.entries()).slice(0, 5));

      const rostersToInsert: any[] = [];
      const errorDetails: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i], separator);
        
        const obj: any = {};
        for (let j = 0; j < headers.length; j++) {
          obj[headers[j].trim()] = values[j]?.trim() || null;
        }

        const coureurName = obj['coureur'];
        const proprietaire = obj['propriétaire'];
        const phaseStr = obj['phase'];
        const prixStr = obj['prix'];

        // 📝 Logs détaillés pour les 15 premières lignes (incluant Jan HIRT)
        if (i <= 15) {
          console.log(`\n📝 Row ${i}:`);
          console.log(`  Raw coureur: "${coureurName}" (length: ${coureurName?.length})`);
          console.log(`  Normalized: "${normalizeName(coureurName)}"`);
          console.log(`  Found in map: ${coureursByName.has(normalizeName(coureurName))}`);
          
          // Afficher les codes ASCII des caractères pour détecter les invisibles
          if (coureurName) {
            const chars = coureurName.split('').map((c: string, idx: number) => 
              `${idx}:'${c}'(${c.charCodeAt(0)})`
            ).join(' ');
            console.log(`  Chars: ${chars}`);
          }
        }

        if (!coureurName || !proprietaire || !phaseStr || !prixStr) {
          errorDetails.push(`Row ${i}: Missing data`);
          errors++;
          continue;
        }

        // Match coureur
        const coureurId = coureursByName.get(normalizeName(coureurName));
        if (!coureurId) {
          // Logs détaillés pour les erreurs de matching
          const normalized = normalizeName(coureurName);
          const similar = Array.from(coureursByName.keys())
            .filter(k => k.includes(normalized.split(' ')[0]) || normalized.includes(k.split(' ')[0]))
            .slice(0, 3);
          
          errorDetails.push(
            `Row ${i}: Coureur not found: "${coureurName}" (normalized: "${normalized}") - Similar: ${similar.join(', ')}`
          );
          errors++;
          continue;
        }

        // Match manager (normalize name)
        const managerId = managersByName.get(normalizeName(proprietaire));
        if (!managerId) {
          errorDetails.push(`Row ${i}: Manager not found: ${proprietaire}`);
          errors++;
          continue;
        }

        // Match phase
        const phaseIndex = parseInt(phaseStr, 10);
        const phaseId = phasesByIndex.get(phaseIndex);
        if (!phaseId) {
          errorDetails.push(`Row ${i}: Phase not found: ${phaseStr}`);
          errors++;
          continue;
        }

        // Parse prix
        const prix = parseFloat(prixStr.replace(',', '.'));
        if (isNaN(prix)) {
          errorDetails.push(`Row ${i}: Invalid prix: ${prixStr}`);
          errors++;
          continue;
        }

        rostersToInsert.push({
          coureur_id: coureurId,
          manager_id: managerId,
          phase_id: phaseId,
          prix_signature: prix,
        });
      }

      // Batch upsert
      if (rostersToInsert.length > 0) {
        const { error: insertError } = await supabaseClient
          .from('rosters')
          .upsert(rostersToInsert, {
            onConflict: 'coureur_id,phase_id',
            ignoreDuplicates: false,
          });

        if (insertError) {
          console.error('Batch insert error:', insertError);
          throw new Error(`Failed to insert rosters: ${insertError.message}`);
        }

        imported = rostersToInsert.length;
      }

      console.log(`✅ Imported ${imported} rosters, ${errors} errors`);
      
      return new Response(
        JSON.stringify({
          success: true,
          imported,
          errors,
          errorDetails: errorDetails.slice(0, 10), // First 10 errors
          message: `Imported ${imported} rosters with ${errors} errors`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Special handling for courses - robust import with phase mapping
    if (table === 'courses') {
      console.log('🔧 Processing courses with robust import...')
      
      // Fetch all phases for mapping
      const { data: phases, error: phasesError } = await supabaseClient
        .from('phases')
        .select('id, index_dans_saison, date_debut, date_fin')
        .order('index_dans_saison')
      
      if (phasesError || !phases) {
        throw new Error('Failed to fetch phases for mapping')
      }
      
      // Build phase mapping
      const phasesByIndex = new Map(phases.map(p => [p.index_dans_saison, p]))
      
      console.log(`Available phases: ${phases.map(p => `Phase ${p.index_dans_saison}`).join(', ')}`)
      
      // Build column index map with synonym support
      const getColumnIndex = (aliases: string[]): number => {
        for (const alias of aliases) {
          const idx = headers.findIndex(h => h.trim().toLowerCase().replace(/\s+/g, '_') === alias.toLowerCase())
          if (idx >= 0) return idx
        }
        return -1
      }
      
      const idxId = getColumnIndex(['id'])
      const idxNom = getColumnIndex(['nom', 'course', 'event', 'race', 'intitule', 'name'])
      const idxCategorie = getColumnIndex(['categorie', 'category', 'uci_cat', 'class'])
      const idxTypeCourse = getColumnIndex(['type_course', 'type', 'race_type', 'discipline'])
      const idxDateDebut = getColumnIndex(['date_debut', 'date', 'start', 'start_date', 'from'])
      const idxDateFin = getColumnIndex(['date_fin', 'end', 'end_date', 'to'])
      const idxPhaseId = getColumnIndex(['phase_id', 'phase', 'phaseuuid', 'id_phase'])
      const idxPays = getColumnIndex(['pays', 'country'])
      const idxStatut = getColumnIndex(['statut', 'status'])
      const idxWtTier = getColumnIndex(['wt_tier', 'tier'])
      const idxUciCode = getColumnIndex(['uci_code', 'code'])
      
      console.log(`Column indices - nom:${idxNom}, date_debut:${idxDateDebut}, phase_id:${idxPhaseId}`)
      
      const coursesToInsert: any[] = []
      const errorDetails: string[] = []
      const seenKeys = new Map<string, number>() // Track (nom, date_debut) -> line number for better error messages
      const unmappedPhases = new Set<string>()
      const mappedPhaseIds: string[] = []
      
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i], separator)
        
        // Skip empty lines
        if (values.length === 0 || values.every(v => !v || v.trim().length === 0)) {
          continue
        }
        
        // Extract values using column indices
        const nom = idxNom >= 0 ? values[idxNom]?.trim() : null
        const categorie = idxCategorie >= 0 ? values[idxCategorie]?.trim() || null : null
        const type_course = idxTypeCourse >= 0 ? values[idxTypeCourse]?.trim() || null : null
        let date_debut = idxDateDebut >= 0 ? values[idxDateDebut]?.trim() || null : null
        let date_fin = idxDateFin >= 0 ? values[idxDateFin]?.trim() || null : null
        const phase_input = idxPhaseId >= 0 ? values[idxPhaseId]?.trim() || null : null
        const pays = idxPays >= 0 ? values[idxPays]?.trim() || null : null
        const statut = idxStatut >= 0 ? values[idxStatut]?.trim() || 'scheduled' : 'scheduled'
        const wt_tier = idxWtTier >= 0 ? values[idxWtTier]?.trim() || null : null
        const uci_code = idxUciCode >= 0 ? values[idxUciCode]?.trim() || null : null
        let rawId = idxId >= 0 ? values[idxId]?.trim() : null
        
        // Skip empty rows (no nom)
        if (!nom || nom.length === 0) {
          continue
        }
        
        // Parse dates flexibly
        date_debut = parseFlexibleDate(date_debut)
        date_fin = parseFlexibleDate(date_fin)
        
        // Validate date_debut is present
        if (!date_debut) {
          errorDetails.push(`Row ${i + 1}: Missing or invalid date_debut for "${nom}"`)
          errors++
          continue
        }
        
        // Ensure date_fin >= date_debut
        if (!date_fin) {
          date_fin = date_debut
        } else if (date_fin < date_debut) {
          date_fin = date_debut
        }
        
        // Deduplicate by (nom, date_debut) - keep first occurrence
        const dedupeKey = `${nom.toLowerCase()}|${date_debut}`
        if (seenKeys.has(dedupeKey)) {
          const firstOccurrence = seenKeys.get(dedupeKey)
          errorDetails.push(`Row ${i + 1}: Duplicate course "${nom}" on ${date_debut} (first seen at row ${firstOccurrence})`)
          errors++
          continue
        }
        seenKeys.set(dedupeKey, i + 1)
        
        // Map phase_id
        let phase_id = null
        if (phase_input) {
          // Check if already a UUID
          if (phase_input.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            phase_id = phase_input
            mappedPhaseIds.push(phase_id)
          } else {
            // Try to extract phase number
            const phaseMatch = phase_input.match(/^(?:Phase\s*)?(\d+)$/i)
            if (phaseMatch) {
              const phaseNum = parseInt(phaseMatch[1], 10)
              const phase = phasesByIndex.get(phaseNum)
              if (phase) {
                phase_id = phase.id
                mappedPhaseIds.push(phase_id)
              } else {
                unmappedPhases.add(phase_input)
                errorDetails.push(`Row ${i + 1}: Phase "${phase_input}" not found`)
              }
            } else {
              unmappedPhases.add(phase_input)
              errorDetails.push(`Row ${i + 1}: Phase "${phase_input}" not recognized`)
            }
          }
        }
        
        // Generate ID from nom if empty
        if (!rawId || rawId.length === 0) {
          rawId = sanitizeId(nom)
        }
        
        coursesToInsert.push({
          id: rawId,
          nom,
          categorie,
          type_course,
          date_debut,
          date_fin,
          phase_id,
          pays,
          statut,
          wt_tier,
          uci_code
        })
      }
      
      // Batch upsert
      if (coursesToInsert.length > 0) {
        const { error: insertError } = await supabaseClient
          .from('courses')
          .upsert(coursesToInsert, {
            onConflict: 'id',
            ignoreDuplicates: false
          })
        
        if (insertError) {
          console.error('Batch insert error:', insertError)
          throw new Error(`Failed to insert courses: ${insertError.message}`)
        }
        
        imported = coursesToInsert.length
      }
      
      console.log(`✅ Imported ${imported} courses, ${errors} errors`)
      if (unmappedPhases.size > 0) {
        console.log(`⚠️  Unmapped phases: ${Array.from(unmappedPhases).join(', ')}`)
      }
      
      // Get first 3 distinct mapped phase IDs for diagnostics
      const distinctPhaseIds = [...new Set(mappedPhaseIds)].slice(0, 3)
      console.log(`📊 Sample mapped phase_ids: ${distinctPhaseIds.join(', ')}`)
      
      return new Response(
        JSON.stringify({
          success: true,
          imported,
          errors,
          errorDetails: errorDetails.slice(0, 10),
          unmappedPhases: Array.from(unmappedPhases),
          sampleMappedPhaseIds: distinctPhaseIds,
          message: `Imported ${imported} courses with ${errors} errors. ${unmappedPhases.size > 0 ? `Unmapped phases: ${Array.from(unmappedPhases).join(', ')}` : ''}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // For other tables (coureurs, scoring_rules, managers)
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i], separator)
      
      try {
        let record = mapToTableFormat(table, headers, values)
        
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
