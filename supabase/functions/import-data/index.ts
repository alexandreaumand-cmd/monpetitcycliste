import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ImportRequest {
  table: 'coureurs' | 'scoring_rules' | 'courses' | 'managers' | 'course_dates' | 'rosters' | 'resultats' | 'equipes'
  data: string // CSV content
  saison_id?: string // Required for coureurs, scoring_rules, resultats, and equipes
  phase_id?: string // Required for courses and rosters
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

// Helper to get value from object with multiple possible key variants
function getVal(obj: Record<string, string>, ...aliases: string[]): string | undefined {
  for (const alias of aliases) {
    // Try exact match first
    if (obj[alias] !== undefined && obj[alias] !== '') return obj[alias];
    
    // Try normalized version (lowercase, underscores)
    const normalized = alias.toLowerCase().trim().replace(/\s+/g, '_');
    if (obj[normalized] !== undefined && obj[normalized] !== '') return obj[normalized];
    
    // Try without accents
    const noAccents = alias.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, '_');
    if (obj[noAccents] !== undefined && obj[noAccents] !== '') return obj[noAccents];
  }
  return undefined;
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
    case 'coureurs': {
      // Use getVal for flexible column lookup (handles various formats and case)
      const coureurNom = getVal(obj, 'coureur', 'nom', 'name', 'Coureur') || '';
      const equipe = getVal(obj, 'equipe', 'team', 'équipe', 'Equipe');
      const prixInitial = getVal(obj, 'prix_initial', 'prix', 'price', 'cote', 'Prix initial') || '10';
      const uciId = getVal(obj, 'id', 'uci_id', 'rider_id');
      
      return {
        id: sanitizeId(coureurNom),        // ✅ Use 'id' directly (not coureur_id)
        nom: coureurNom,
        equipe: equipe,
        prix_initial: parseFloat(prixInitial) || 10,
        uci_id: uciId || null
      }
    }
    
    case 'scoring_rules': {
      const rawTypeClassement = getVal(obj, 'type_classement', 'Type classement', 'type classement');
      const typeClassement = normalizeTypeClassement(rawTypeClassement || '');
      if (!typeClassement) {
        console.log(`⚠️ Skipping row - invalid type_classement: "${rawTypeClassement}"`);
        return null;
      }
      
      const categorie = getVal(obj, 'catégorie', 'Catégorie', 'categorie', 'category') || '';
      const placeStr = getVal(obj, 'place', 'Place', 'rang');
      const pointsStr = getVal(obj, 'points', 'Points', 'pts');
      const typeCourse = getVal(obj, 'type', 'Type');
      const idStr = getVal(obj, 'id', 'Id', 'ID');
      
      const place = parseInt(placeStr || '0') || 0;
      const points = Math.floor(parseFloat(pointsStr || '0') || 0);
      
      return {
        id: idStr || `${categorie}_${typeClassement}_${place}`.toLowerCase().replace(/\s+/g, '_'),
        categorie: categorie,
        type_classement: typeClassement,
        place: place,
        points: points,
        type: typeCourse || null
      }
    }
    
    case 'courses': {
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
    }
    
    case 'managers': {
      return {
        nom: obj['Nom manager'],
        sponsor: obj['Sponsor'],
        email: null,
        user_id: null
      }
    }
    
    case 'equipes': {
      const codeCourt = getVal(obj, 'code_court', 'code', 'Code court') || '';
      const nomComplet = getVal(obj, 'nom_complet', 'nom', 'Nom complet') || '';
      const nomAffiche = getVal(obj, 'nom_affiche', 'nom_affiche', 'Nom affiché', 'display_name') || nomComplet;
      const categorie = getVal(obj, 'categorie', 'category', 'Catégorie');
      const pays = getVal(obj, 'pays', 'country', 'Pays');
      const logoUrl = getVal(obj, 'logo_url', 'logo', 'Logo URL');
      
      return {
        code_court: codeCourt,
        nom_complet: nomComplet,
        nom_affiche: nomAffiche,
        categorie: categorie?.toUpperCase() || null,
        pays: pays || null,
        logo_url: logoUrl || null
      }
    }
    
    default: {
      return null
    }
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
  if (!type) return null;
  const lowerType = type.toLowerCase();
  
  console.log(`🔍 Normalizing type_classement: "${type}" → "${lowerType}"`);
  
  // Map to allowed enum values: General, Etape, Points, Montagne, Jeune
  if (lowerType.includes('général') || lowerType.includes('general')) return 'General';
  if (lowerType.includes('étape') || lowerType.includes('etape') || lowerType.includes('stage')) return 'Etape';
  if (lowerType.includes('vert') || lowerType.includes('points')) return 'Points';
  if (lowerType.includes('montagne') || lowerType.includes('kom')) return 'Montagne';
  if (lowerType.includes('jeune') || lowerType.includes('youth')) return 'Jeune';
  if (lowerType.includes('combatif') || lowerType.includes('combativity')) return null;
  
  console.warn(`⚠️ Type non reconnu: "${type}"`);
  return null;
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

    const { table, data: csvData, saison_id, phase_id }: ImportRequest = await req.json()

    // Validation pour coureurs et scoring_rules
    if ((table === 'coureurs' || table === 'scoring_rules') && !saison_id) {
      return new Response(
        JSON.stringify({ 
          error: `saison_id requis pour import ${table}`,
          message: 'Veuillez sélectionner une saison cible' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validation pour courses - mode manuel si saison_id et phase_id fournis
    if (table === 'courses' && saison_id && phase_id) {
      console.log('✅ Mode manuel: saison et phase explicites fournis')
    }

    console.log(`Importing data to table: ${table}${saison_id ? ` (saison: ${saison_id})` : ''}`)

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

    // Special handling for courses - with auto-detection or explicit saison/phase
    if (table === 'courses') {
      let detectedSaisonId: string | null = saison_id || null
      let detectedPhaseId: string | null = phase_id || null
      let targetPhase: any = null
      let targetSaison: any = null
      let allPhases: any[] = []
      const phaseMapping = new Map<string, string>()
      
      // Build column index map first to check if we have dates
      const getColumnIndex = (aliases: string[]): number => {
        for (const alias of aliases) {
          const idx = headers.findIndex(h => h.trim().toLowerCase().replace(/\s+/g, '_') === alias.toLowerCase())
          if (idx >= 0) return idx
        }
        return -1
      }
      
      const idxDateDebut = getColumnIndex(['date_debut', 'date', 'start', 'start_date', 'from'])
      const idxPhaseId = getColumnIndex(['phase_id', 'phase', 'phaseuuid', 'id_phase'])
      
      // MODE AUTOMATIQUE: Si saison_id n'est pas fourni, le détecter depuis les dates
      if (!detectedSaisonId && idxDateDebut >= 0) {
        console.log('🔍 Mode automatique: détection de la saison depuis les dates du CSV')
        
        // Extraire toutes les années des dates
        const years = new Set<number>()
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i], separator)
          const dateStr = idxDateDebut >= 0 ? values[idxDateDebut]?.trim() : null
          const date = parseFlexibleDate(dateStr)
          if (date) {
            years.add(new Date(date).getFullYear())
          }
        }
        
        if (years.size === 0) {
          throw new Error('Aucune date valide trouvée dans le CSV pour détecter la saison')
        }
        
        if (years.size > 1) {
          console.warn(`⚠️ Plusieurs années détectées: ${Array.from(years).join(', ')} - utilisation de la première`)
        }
        
        // Utiliser l'année la plus fréquente (ou la première trouvée)
        const targetYear = Array.from(years)[0]
        
        // Récupérer la saison correspondante
        const { data: saisonData, error: saisonError } = await supabaseClient
          .from('saisons')
          .select('id, annee')
          .eq('annee', targetYear)
          .single()
          
        if (saisonError || !saisonData) {
          throw new Error(`Aucune saison trouvée pour l'année ${targetYear}`)
        }
        
        detectedSaisonId = saisonData.id
        console.log(`🔍 Saison détectée automatiquement: ${targetYear} (${detectedSaisonId})`)
      }
      
      // MODE MANUEL: Si phase_id explicite fourni, valider qu'elle appartient à la saison
      if (detectedPhaseId && detectedSaisonId) {
        console.log(`🔧 Mode manuel: validation de la phase ${detectedPhaseId}`)
        
        const { data: manualPhase, error: phaseError } = await supabaseClient
          .from('phases')
          .select('id, index_dans_saison, saison_id, date_debut, date_fin')
          .eq('id', detectedPhaseId)
          .single()
        
        if (phaseError || !manualPhase) {
          throw new Error('Phase introuvable')
        }
        
        if (manualPhase.saison_id !== detectedSaisonId) {
          throw new Error(`La phase sélectionnée n'appartient pas à la saison détectée`)
        }
        
        targetPhase = manualPhase
      }
      
      // Récupérer toutes les phases de la saison pour le mapping automatique
      if (detectedSaisonId) {
        const { data: phasesData, error: phasesError } = await supabaseClient
          .from('phases')
          .select('id, index_dans_saison, date_debut, date_fin, saison_id')
          .eq('saison_id', detectedSaisonId)
          .order('index_dans_saison')
        
        if (phasesError) {
          throw new Error(`Erreur lors de la récupération des phases: ${phasesError.message}`)
        }
        
        if (!phasesData || phasesData.length === 0) {
          throw new Error('Aucune phase trouvée pour cette saison')
        }
        
        allPhases = phasesData
        
        // Construire le mapping "Phase 1" → UUID, "phase 1" → UUID, "1" → UUID
        allPhases.forEach(p => {
          phaseMapping.set(`Phase ${p.index_dans_saison}`, p.id)
          phaseMapping.set(`phase ${p.index_dans_saison}`, p.id)
          phaseMapping.set(`${p.index_dans_saison}`, p.id)
        })
        
        console.log(`📋 Phases disponibles pour mapping: ${Array.from(phaseMapping.keys()).join(', ')}`)
      }
      
      // Fetch saison info for logging
      if (detectedSaisonId) {
        const { data: saisonData } = await supabaseClient
          .from('saisons')
          .select('annee')
          .eq('id', detectedSaisonId)
          .single()
        
        targetSaison = saisonData
      }
      
      if (targetPhase) {
        console.log(`✅ Using Saison ${targetSaison?.annee}, Phase ${targetPhase.index_dans_saison}`)
        console.log(`   Phase dates: ${targetPhase.date_debut} → ${targetPhase.date_fin}`)
      } else {
        console.log(`✅ Using Saison ${targetSaison?.annee} (phases seront mappées automatiquement)`)
      }
      
      const idxId = getColumnIndex(['id'])
      const idxNom = getColumnIndex(['nom', 'course', 'event', 'race', 'intitule', 'name'])
      const idxCategorie = getColumnIndex(['categorie', 'category', 'uci_cat', 'class'])
      const idxTypeCourse = getColumnIndex(['type_course', 'type', 'race_type', 'discipline'])
      // idxDateDebut already defined above for auto-detection
      const idxDateFin = getColumnIndex(['date_fin', 'end', 'end_date', 'to'])
      // idxPhaseId already defined above for auto-detection
      const idxPays = getColumnIndex(['pays', 'country'])
      const idxStatut = getColumnIndex(['statut', 'status'])
      const idxWtTier = getColumnIndex(['wt_tier', 'tier'])
      const idxUciCode = getColumnIndex(['uci_code', 'code'])
      
      console.log(`Column indices - nom:${idxNom}, date_debut:${idxDateDebut}, phase_id:${idxPhaseId}`)
      
      const coursesToInsert: any[] = []
      const errorDetails: string[] = []
      const seenKeys = new Map<string, number>() // Track (nom, date_debut) -> line number
      const dateWarnings: string[] = []
      
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
        
        // Déterminer le phase_id pour cette course
        let coursePhaseid: string | null = null
        
        // 1. Si phase_id manuel fourni (mode manuel), l'utiliser
        if (detectedPhaseId) {
          coursePhaseid = detectedPhaseId
        } else {
          // 2. Sinon, chercher dans le CSV
          const csvPhaseText = idxPhaseId >= 0 ? values[idxPhaseId]?.trim() : null
          
          if (csvPhaseText && phaseMapping.has(csvPhaseText)) {
            coursePhaseid = phaseMapping.get(csvPhaseText) || null
          } else if (csvPhaseText) {
            // Phase non mappée - ajouter à la liste des erreurs
            errorDetails.push(`Row ${i + 1}: Phase "${csvPhaseText}" non reconnue pour "${nom}"`)
            errors++
            continue
          }
          
          // 3. Si toujours pas de phase, tenter de déduire depuis la date
          if (!coursePhaseid && date_debut) {
            const courseDate = new Date(date_debut)
            for (const p of allPhases) {
              const phaseStart = new Date(p.date_debut)
              const phaseEnd = new Date(p.date_fin)
              if (courseDate >= phaseStart && courseDate <= phaseEnd) {
                coursePhaseid = p.id
                break
              }
            }
          }
          
          // 4. Fallback: utiliser la première phase
          if (!coursePhaseid && allPhases.length > 0) {
            console.warn(`⚠️ Aucune phase trouvée pour "${nom}" (${date_debut}), utilisation de Phase ${allPhases[0].index_dans_saison}`)
            coursePhaseid = allPhases[0].id
          }
        }
        
        if (!coursePhaseid) {
          errorDetails.push(`Row ${i + 1}: Impossible de déterminer la phase pour "${nom}"`)
          errors++
          continue
        }
        
        // Vérifier si la date est dans les limites de la phase (warning seulement)
        if (targetPhase && (date_debut < targetPhase.date_debut || date_debut > targetPhase.date_fin)) {
          dateWarnings.push(
            `Row ${i + 1}: "${nom}" (${date_debut}) est hors des dates de la Phase ${targetPhase.index_dans_saison} (${targetPhase.date_debut} → ${targetPhase.date_fin})`
          )
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
          phase_id: coursePhaseid,
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
      if (dateWarnings.length > 0) {
        console.log(`⚠️  ${dateWarnings.length} date warnings`)
        dateWarnings.slice(0, 5).forEach(w => console.log(`   ${w}`))
      }
      
      const modeMessage = detectedPhaseId && targetPhase
        ? `Saison ${targetSaison?.annee}, Phase ${targetPhase.index_dans_saison}`
        : `Saison ${targetSaison?.annee} (phases mappées automatiquement)`
      
      return new Response(
        JSON.stringify({
          success: true,
          imported,
          errors,
          errorDetails: errorDetails.slice(0, 10),
          dateWarnings: dateWarnings.slice(0, 5),
          message: `Importé ${imported} courses dans ${modeMessage}. ${errors > 0 ? `${errors} erreurs. ` : ''}${dateWarnings.length > 0 ? `${dateWarnings.length} avertissements de dates.` : ''}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // For other tables (coureurs, scoring_rules, managers)
    if (table === 'coureurs') {
      // Import coureurs with season historization
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i], separator)
        
        try {
          let record = mapToTableFormat(table, headers, values)
          
          // Debug: log first 3 rows
          if (i <= 3) {
            console.log(`\n🔍 Debug row ${i}:`);
            console.log(`  Headers:`, headers);
            console.log(`  Values:`, values);
            console.log(`  Mapped object:`, record);
          }
          
          if (record) {
            // ✅ Strict validation before upsert
            if (!record.id || !record.nom) {
              console.error(`Row ${i}: Missing id or nom - Record:`, record);
              errors++;
              continue;
            }
            
            console.log(`📝 Row ${i}: Processing ${record.nom} (id: ${record.id})`);
            
            // 1. Upsert dans coureurs (table principale - fallback)
            const { error: coureurError } = await supabaseClient
              .from('coureurs')
              .upsert({
                id: record.id,
                nom: record.nom,
                equipe: record.equipe,
                prix_initial: record.prix_initial,
                uci_id: record.uci_id
              }, { onConflict: 'id' })
            
            if (coureurError) {
              console.error(`Error upserting coureur ${record.nom}:`, coureurError)
              errors++
              continue
            }
            
            // 2. Upsert dans coureurs_saisons (historisation)
            const { error: saisonError } = await supabaseClient
              .from('coureurs_saisons')
              .upsert({
                coureur_id: record.id,
                saison_id: saison_id,
                equipe: record.equipe,
                prix_initial: record.prix_initial
              }, { onConflict: 'coureur_id,saison_id' })
            
            if (saisonError) {
              console.error(`Error upserting coureur_saison for ${record.nom}:`, saisonError)
              errors++
              continue
            }
            
            imported++
          }
        } catch (err) {
          console.error(`Error processing row ${i}:`, err)
          errors++
        }
      }
    } else if (table === 'scoring_rules') {
      // Import scoring_rules with season historization
      console.log(`📋 Processing ${lines.length - 1} scoring_rules rows...`);
      
      // Debug: log first 2 mapped rows
      const testRows: any[] = [];
      for (let i = 1; i <= Math.min(3, lines.length - 1); i++) {
        const values = parseCSVLine(lines[i], separator);
        const testRecord = mapToTableFormat(table, headers, values);
        testRows.push({ line: i, record: testRecord });
      }
      console.log('📋 First rows mapped:', JSON.stringify(testRows, null, 2));
      
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i], separator)
        
        try {
          let record = mapToTableFormat(table, headers, values)
          
          if (record) {
            // 1. Upsert dans scoring_rules (table principale - fallback)
            const { error: ruleError } = await supabaseClient
              .from('scoring_rules')
              .upsert({
                id: record.id,
                categorie: record.categorie,
                type_classement: record.type_classement,
                place: record.place,
                points: record.points,
                type: record.type
              }, { onConflict: 'categorie,type_classement,place' })
            
            if (ruleError) {
              console.error(`Error upserting scoring_rule:`, ruleError)
              errors++
              continue
            }
            
            // 2. Upsert dans scoring_rules_saisons (historisation)
            const { error: saisonError } = await supabaseClient
              .from('scoring_rules_saisons')
              .upsert({
                saison_id: saison_id,
                categorie: record.categorie,
                type_classement: record.type_classement,
                place: record.place,
                points: record.points,
                type: record.type
              }, { onConflict: 'saison_id,categorie,type_classement,place' })
            
            if (saisonError) {
              console.error(`Error upserting scoring_rule_saison:`, saisonError)
              errors++
              continue
            }
            
            imported++
          }
        } catch (err) {
          console.error(`Error processing row ${i}:`, err)
          errors++
        }
      }
      
      console.log(`✅ Imported ${imported} scoring_rules, ${errors} errors`);
    } else if (table === 'equipes') {
      if (!saison_id) {
        return new Response(
          JSON.stringify({ 
            error: 'saison_id is required for equipes import',
            details: 'Veuillez sélectionner une saison avant d\'importer les équipes'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      console.log('🏢 Processing equipes import for saison:', saison_id);
      
      // 1. Charger toutes les équipes existantes pour déduplication
      const existingEquipes = await fetchAllRows(supabaseClient, 'equipes', 'id, code_court');
      const equipesByCode = new Map(existingEquipes.map((e: any) => [e.code_court.toLowerCase(), e.id]));
      
      console.log(`📦 Found ${existingEquipes.length} existing equipes`);

      let importedCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      const equipesToUpsert: any[] = [];
      const equipesSaisonsToUpsert: any[] = [];

      // 2. Parser les lignes et préparer les upserts
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = parseCSVLine(lines[i], separator);
          if (values.length === 0 || !values.some(v => v.trim())) continue;

          const mapped = mapToTableFormat(table, headers, values);
          
          // Validation des champs requis
          if (!mapped.code_court || !mapped.nom_complet) {
            errors.push(`Ligne ${i + 1}: Code court et Nom complet sont obligatoires`);
            errorCount++;
            continue;
          }

          const codeCourtLower = mapped.code_court.toLowerCase();
          let equipeId = equipesByCode.get(codeCourtLower);

          // Si l'équipe n'existe pas, préparer l'insertion
          if (!equipeId) {
            equipeId = crypto.randomUUID();
            equipesToUpsert.push({
              id: equipeId,
              code_court: mapped.code_court,
              nom_complet: mapped.nom_complet,
              pays: mapped.pays || null,
              logo_url: mapped.logo_url || null
            });
            equipesByCode.set(codeCourtLower, equipeId);
          }

          // Préparer l'association équipe-saison
          equipesSaisonsToUpsert.push({
            equipe_id: equipeId,
            saison_id: saison_id,
            nom_affiche: mapped.nom_affiche,
            categorie: mapped.categorie || null,
            actif: true
          });

          importedCount++;
        } catch (err: any) {
          console.error(`Error processing equipe row ${i + 1}:`, err);
          errors.push(`Ligne ${i + 1}: ${err.message}`);
          errorCount++;
        }
      }

      // 3. Upsert des équipes (table de base)
      if (equipesToUpsert.length > 0) {
        console.log(`📝 Upserting ${equipesToUpsert.length} new equipes...`);
        const { error: equipeError } = await supabaseClient
          .from('equipes')
          .upsert(equipesToUpsert, { 
            onConflict: 'code_court',
            ignoreDuplicates: false 
          });

        if (equipeError) {
          console.error('Error upserting equipes:', equipeError);
          throw equipeError;
        }
      }

      // 4. Upsert des associations équipe-saison
      if (equipesSaisonsToUpsert.length > 0) {
        console.log(`📝 Upserting ${equipesSaisonsToUpsert.length} equipes_saisons entries...`);
        const { error: saisonError } = await supabaseClient
          .from('equipes_saisons')
          .upsert(equipesSaisonsToUpsert, {
            onConflict: 'equipe_id,saison_id',
            ignoreDuplicates: false
          });

        if (saisonError) {
          console.error('Error upserting equipes_saisons:', saisonError);
          throw saisonError;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          imported: importedCount,
          details: {
            imported_count: importedCount,
            error_count: errorCount,
            total_rows: lines.length - 1,
            new_equipes: equipesToUpsert.length,
            errors: errors.slice(0, 10) // Limiter à 10 premières erreurs
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // For other tables (managers)
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i], separator)
        
        try {
          let record = mapToTableFormat(table, headers, values)
          
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
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported, 
        errors,
        details: {
          total_rows: lines.length - 1,
          imported_count: imported,
          error_count: errors,
          table: table,
          saison_id: saison_id || null
        },
        message: `✅ ${imported} ${table} importés, ${errors} erreurs` 
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
