import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { normalize, tokenSig, extractLastName, similarity, canonizeName, matchByTokens } from '../_shared/normalization.ts';

// Supprimé: Le matching se fait maintenant prioritairement par nom de course

interface ParsedLine {
  coureur: string;
  nom_course: string;
  fam_categorie: string;
  monument_sprint: string;
  classement: string;
  classement2: string;
  type_class: string;
  date: string;
}

interface ImportError {
  line: number;
  type: 'rider_not_found' | 'course_not_found' | 'season_not_found' | 'invalid_format' | 'unknown_type';
  riderName?: string;
  courseName?: string;
  courseCode?: string;
  raw: string;
  details?: string;
}

interface ImportWarning {
  line: number;
  type: 'fuzzy_match_course' | 'fuzzy_match_rider' | 'cancelled_race';
  message: string;
  inputValue: string;
  matchedValue: string;
  score?: number;
  method?: 'tokens' | 'levenshtein' | 'lastname';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Vérifier que l'utilisateur est super admin
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Non authentifié');

    const { data: isSuperAdmin } = await supabaseClient.rpc('is_superadmin');
    if (!isSuperAdmin) throw new Error('Accès refusé: réservé aux super administrateurs');

    const { csv_content } = await req.json();
    if (!csv_content) throw new Error('Contenu CSV manquant');

    const lines = csv_content.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    if (lines.length < 2) throw new Error('CSV vide ou invalide');

    const header = lines[0].split(',');
    console.log('Header detected:', header);

    // Pré-charger les saisons
    const { data: saisons } = await supabaseClient
      .from('saisons')
      .select('id, annee')
      .order('annee', { ascending: false });
    
    const saisonMap = new Map<string, string>();
    saisons?.forEach(s => {
      saisonMap.set(s.annee.toString(), s.id);
    });
    console.log('Loaded seasons:', saisonMap.size);

    // Pré-charger TOUTES les courses avec pagination (sans limite 1000)
    let courses: any[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabaseClient
        .from('courses')
        .select('id, nom')
        .range(from, from + pageSize - 1);
      
      if (error) throw error;
      if (!data || data.length === 0) break;
      
      courses = courses.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    
    // Indexation optimisée pour recherches O(1)
    const courseByName = new Map<string, { id: string, nom: string, norm: string }>();
    const courseByNorm = new Map<string, { id: string, nom: string }>();
    const courseByTokens = new Map<string, { id: string, nom: string }>();
    
    courses.forEach(c => {
      const normName = normalize(c.nom);
      const tokens = tokenSig(c.nom);
      courseByName.set(c.id, { id: c.id, nom: c.nom, norm: normName });
      courseByNorm.set(normName, { id: c.id, nom: c.nom });
      courseByTokens.set(tokens, { id: c.id, nom: c.nom });
    });
    console.log('Loaded courses:', courseByName.size);

    // Pré-charger TOUS les coureurs avec pagination (sans limite 1000)
    let coureurs: any[] = [];
    let fromRiders = 0;
    const pageSizeRiders = 1000;

    while (true) {
      const { data, error } = await supabaseClient
        .from('coureurs')
        .select('id, nom')
        .range(fromRiders, fromRiders + pageSizeRiders - 1);
      
      if (error) throw error;
      if (!data || data.length === 0) break;
      
      coureurs = coureurs.concat(data);
      if (data.length < pageSizeRiders) break;
      fromRiders += pageSizeRiders;
    }
    
    // Indexation optimisée pour recherches O(1)
    const coureurByNorm = new Map<string, { id: string, nom: string, norm: string, tokens: string, lastName: string }>();
    const coureurByTokens = new Map<string, { id: string, nom: string }>();
    const coureursByLastName = new Map<string, { id: string, nom: string, norm: string }[]>();
    
    coureurs.forEach(c => {
      const canonical = canonizeName(c.nom);
      const norm = normalize(canonical);
      const tokens = tokenSig(canonical);
      const lastName = extractLastName(canonical);
      
      coureurByNorm.set(norm, { id: c.id, nom: c.nom, norm, tokens, lastName });
      coureurByTokens.set(tokens, { id: c.id, nom: c.nom });
      
      // Index par nom de famille pour recherche rapide
      if (!coureursByLastName.has(lastName)) {
        coureursByLastName.set(lastName, []);
      }
      coureursByLastName.get(lastName)!.push({ id: c.id, nom: c.nom, norm });
    });
    console.log('Loaded riders:', coureurByNorm.size);

    // Parser et transformer les lignes
    const validResults: any[] = [];
    const errors: ImportError[] = [];
    const warnings: ImportWarning[] = [];
    const courseIdsSet = new Set<string>();
    
    // Cache de matching pour éviter les recalculs
    const riderMatchCache = new Map<string, string | null>();
    const courseMatchCache = new Map<string, { id: string | null, score: number, method: string, matchedName?: string }>();

    for (let i = 1; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];
      
      // Ignorer les lignes de course annulée
      if (line.includes('course annulée')) {
        warnings.push({
          line: lineNum,
          type: 'cancelled_race',
          message: 'Course annulée, ignorée',
          inputValue: line,
          matchedValue: 'N/A'
        });
        continue;
      }

      const parts = line.split(',');
      if (parts.length < 8) {
        errors.push({ 
          line: lineNum, 
          type: 'invalid_format', 
          raw: line,
          details: 'Moins de 8 colonnes'
        });
        continue;
      }

      const parsed: ParsedLine = {
        coureur: parts[0].trim(),
        nom_course: parts[1].trim(),
        fam_categorie: parts[2].trim(),
        monument_sprint: parts[3].trim(),
        classement: parts[4].trim(),
        classement2: parts[5].trim(),
        type_class: parts[6].trim(),
        date: parts[7].trim(),
      };

      // Mapper le coureur (avec cache)
      let coureurId: string | null = null;
      const canonical = canonizeName(parsed.coureur);
      const normCoureur = normalize(canonical);
      
      // Vérifier le cache
      if (riderMatchCache.has(normCoureur)) {
        coureurId = riderMatchCache.get(normCoureur)!;
      } else {
        // 1. Match exact normalisé O(1)
        if (coureurByNorm.has(normCoureur)) {
          coureurId = coureurByNorm.get(normCoureur)!.id;
        } else {
          // 2. Match par tokens O(1)
          const inputTokens = tokenSig(canonical);
          if (coureurByTokens.has(inputTokens)) {
            coureurId = coureurByTokens.get(inputTokens)!.id;
          } else {
            // 3. Match par nom de famille (recherche filtrée au lieu de parcourir tous)
            const inputLastName = extractLastName(canonical);
            const candidates = coureursByLastName.get(inputLastName) || [];
            
            let bestMatch: { id: string; score: number } | null = null;
            for (const coureur of candidates) {
              const score = similarity(normCoureur, coureur.norm);
              if (score >= 0.8 && (!bestMatch || score > bestMatch.score)) {
                bestMatch = { id: coureur.id, score };
              }
            }
            
            if (bestMatch) {
              coureurId = bestMatch.id;
            }
          }
        }
        
        // Mettre en cache
        riderMatchCache.set(normCoureur, coureurId);
      }

      if (!coureurId) {
        errors.push({ 
          line: lineNum, 
          type: 'rider_not_found', 
          riderName: parsed.coureur,
          courseName: parsed.nom_course,
          raw: line
        });
        continue;
      }

      // Mapper la course (avec cache et optimisation)
      let courseId: string | null = null;
      let matchScore = 0;
      let matchMethod = '';
      let matchedCourseName = '';
      
      const normCourseName = normalize(parsed.nom_course);
      
      // Vérifier le cache
      if (courseMatchCache.has(normCourseName)) {
        const cached = courseMatchCache.get(normCourseName)!;
        courseId = cached.id;
        matchScore = cached.score;
        matchMethod = cached.method;
        matchedCourseName = cached.matchedName || '';
      } else {
        // 1. Match exact normalisé O(1)
        if (courseByNorm.has(normCourseName)) {
          const matched = courseByNorm.get(normCourseName)!;
          courseId = matched.id;
          matchScore = 1.0;
          matchMethod = 'exact';
          matchedCourseName = matched.nom;
        } else {
          // 2. Match par tokens O(1)
          const inputTokens = tokenSig(parsed.nom_course);
          if (courseByTokens.has(inputTokens)) {
            const matched = courseByTokens.get(inputTokens)!;
            courseId = matched.id;
            matchScore = 1.0;
            matchMethod = 'tokens_exact';
            matchedCourseName = matched.nom;
          } else {
            // 3. Filtrer candidats avant fuzzy matching (réduction drastique)
            const inputTokensList = normCourseName.split(/\s+/).filter(t => t.length > 2);
            const candidates: Array<{ id: string, nom: string, norm: string }> = [];
            
            for (const [id, courseData] of courseByName) {
              // Pré-filtre: au moins un token de 3+ chars en commun
              const courseTokens = courseData.norm.split(/\s+/).filter(t => t.length > 2);
              const hasCommonToken = inputTokensList.some(it => 
                courseTokens.some(ct => ct.startsWith(it.substring(0, 3)) || it.startsWith(ct.substring(0, 3)))
              );
              
              if (hasCommonToken) {
                candidates.push({ id, nom: courseData.nom, norm: courseData.norm });
              }
            }
            
            // 4. Fuzzy matching UNIQUEMENT sur les candidats filtrés
            if (candidates.length > 0 && candidates.length < 100) {
              let bestMatch: { id: string; nom: string; score: number; method: string } | null = null;
              
              // D'abord essayer tokens Jaccard sur candidats
              for (const candidate of candidates) {
                const tokenScore = matchByTokens(parsed.nom_course, candidate.nom);
                if (tokenScore >= 0.7 && (!bestMatch || tokenScore > bestMatch.score)) {
                  bestMatch = { id: candidate.id, nom: candidate.nom, score: tokenScore, method: 'tokens' };
                }
              }
              
              // Si pas assez bon, essayer Levenshtein sur candidats
              if (!bestMatch || bestMatch.score < 0.8) {
                for (const candidate of candidates) {
                  const levScore = similarity(normCourseName, candidate.norm);
                  if (levScore >= 0.6 && (!bestMatch || levScore > bestMatch.score)) {
                    bestMatch = { id: candidate.id, nom: candidate.nom, score: levScore, method: 'levenshtein' };
                  }
                }
              }
              
              if (bestMatch) {
                courseId = bestMatch.id;
                matchScore = bestMatch.score;
                matchMethod = bestMatch.method;
                matchedCourseName = bestMatch.nom;
              }
            }
          }
        }
        
        // Mettre en cache
        courseMatchCache.set(normCourseName, { 
          id: courseId, 
          score: matchScore, 
          method: matchMethod,
          matchedName: matchedCourseName 
        });
      }
      
      // Ajouter warning si fuzzy match approximatif
      if (courseId && matchScore < 0.8 && matchScore > 0) {
        warnings.push({
          line: lineNum,
          type: 'fuzzy_match_course',
          message: `Match ${matchMethod} pour course "${parsed.nom_course}" → "${matchedCourseName}" (score: ${(matchScore * 100).toFixed(0)}%)`,
          inputValue: parsed.nom_course,
          matchedValue: matchedCourseName,
          score: matchScore,
          method: matchMethod as 'tokens' | 'levenshtein' | 'lastname'
        });
      }

      if (!courseId) {
        errors.push({ 
          line: lineNum, 
          type: 'course_not_found',
          courseName: parsed.nom_course,
          courseCode: parsed.code_course,
          riderName: parsed.coureur,
          raw: line 
        });
        continue;
      }

      // Mapper la saison
      const year = parsed.date.split('/')[2];
      const saisonId = saisonMap.get(year);
      if (!saisonId) {
        errors.push({ 
          line: lineNum, 
          type: 'season_not_found',
          raw: line,
          details: `Année: ${year}`
        });
        continue;
      }

      // Position et statut
      const position = parseInt(parsed.classement2, 10);
      const isJersey = position === 0;
      
      // Transformer type_classement
      let typeClassement: string;
      let etapeNumero: number | null = null;
      
      const typeClassNorm = parsed.type_class.toLowerCase().trim().replace(/[- ]/g, '');
      
      if (typeClassNorm === 'gc') {
        typeClassement = 'General';
        etapeNumero = null;
      } 
      else if (typeClassNorm.startsWith('etape')) {
        // Extraire le numéro d'étape : etape01 → 1, etape02 → 2
        const match = typeClassNorm.match(/etape(\d+)/);
        if (!match) {
          errors.push({
            line: lineNum,
            type: 'invalid_format',
            raw: line,
            details: `Format d'étape invalide : ${parsed.type_class}`,
          });
          continue;
        }
        etapeNumero = parseInt(match[1], 10);
        
        // Si position = 0 → c'est un maillot après cette étape
        if (isJersey) {
          const classementLower = parsed.classement.toLowerCase();
          
          if (classementLower.includes('leader') || classementLower.includes('général') || classementLower.includes('general')) {
            typeClassement = 'Porteur Général';
          } else if (classementLower.includes('vert') || classementLower.includes('points')) {
            typeClassement = 'Porteur Vert';
          } else if (classementLower.includes('pois') || classementLower.includes('grimpeur') || classementLower.includes('montagne')) {
            typeClassement = 'Porteur Montagne';
          } else if (classementLower.includes('jeune') || classementLower.includes('blanc')) {
            typeClassement = 'Porteur Jeune';
          } else {
            errors.push({
              line: lineNum,
              type: 'unknown_type',
              raw: line,
              details: `Type de maillot non reconnu : ${parsed.classement}`,
            });
            continue;
          }
        } else {
          // Position > 0 → résultat d'étape normal
          typeClassement = 'Etape';
        }
      }
      else if (typeClassNorm === 'maillot') {
        // Maillots finaux (Type_Class = "maillot")
        const classementLower = parsed.classement.toLowerCase();
        
        if (classementLower.includes('vert') || classementLower.includes('points')) {
          typeClassement = 'Points';
        } else if (classementLower.includes('pois') || classementLower.includes('grimpeur') || classementLower.includes('montagne')) {
          typeClassement = 'Montagne';
        } else if (classementLower.includes('jeune') || classementLower.includes('blanc')) {
          typeClassement = 'Jeune';
        } else {
          errors.push({
            line: lineNum,
            type: 'unknown_type',
            raw: line,
            details: `Type de maillot final non reconnu : ${parsed.classement}`,
          });
          continue;
        }
        etapeNumero = null;
      }
      else {
        errors.push({ 
          line: lineNum, 
          type: 'unknown_type',
          raw: line,
          details: `Type_Class non reconnu : ${parsed.type_class}`
        });
        continue;
      }
      
      const statut = 'finished';

      // Parser la date (format: JJ/M/AAAA ou JJ/MM/AAAA -> AAAA-MM-JJ)
      const dateParts = parsed.date.split('/');
      if (dateParts.length !== 3) {
        errors.push({
          line: lineNum,
          type: 'invalid_format',
          raw: line,
          details: `Format de date invalide : ${parsed.date}`,
        });
        continue;
      }
      
      let [day, month, yearStr] = dateParts;
      
      // Normaliser année 2 chiffres → 4 chiffres
      if (yearStr.length === 2) {
        yearStr = '20' + yearStr;
      }
      
      // Normaliser mois/jour sur 2 chiffres
      day = day.padStart(2, '0');
      month = month.padStart(2, '0');
      
      const dateClassement = `${yearStr}-${month}-${day}`;

      // Créer le résultat
      const result = {
        course_id: courseId,
        coureur_id: coureurId,
        type_classement: typeClassement,
        etape_numero: etapeNumero,
        position: position > 0 ? position : null,
        position_decimal: null,
        statut,
        date_classement: dateClassement,
        saison_id: saisonId,
      };

      validResults.push(result);
      courseIdsSet.add(courseId);
    }

    console.log(`Processed ${lines.length - 1} lines: ${validResults.length} valid, ${errors.length} errors`);

    if (validResults.length === 0) {
      // Construire le même rapport que pour un import réussi
      const errorsByType = {
        rider_not_found: errors.filter(e => e.type === 'rider_not_found'),
        course_not_found: errors.filter(e => e.type === 'course_not_found'),
        season_not_found: errors.filter(e => e.type === 'season_not_found'),
        invalid_format: errors.filter(e => e.type === 'invalid_format'),
        unknown_type: errors.filter(e => e.type === 'unknown_type'),
      };

      const uniqueRidersNotFound = new Set(errors.filter(e => e.type === 'rider_not_found').map(e => e.riderName));
      const uniqueCoursesNotFound = new Set(errors.filter(e => e.type === 'course_not_found').map(e => e.courseName));

      return new Response(
        JSON.stringify({ 
          success: false, 
          imported: 0,
          errors,
          warnings,
          errorsByType: {
            riders_not_found: Array.from(uniqueRidersNotFound),
            courses_not_found: Array.from(uniqueCoursesNotFound),
            total_by_type: {
              rider_errors: errorsByType.rider_not_found.length,
              course_errors: errorsByType.course_not_found.length,
              season_errors: errorsByType.season_not_found.length,
              format_errors: errorsByType.invalid_format.length,
              unknown_type_errors: errorsByType.unknown_type.length,
            }
          },
          courses_affected: [],
          recompute_results: [],
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Insertion en batch simple (sans upsert pour éviter les conflits de contraintes partielles)
    const { error: insertError } = await supabaseClient
      .from('race_results')
      .insert(validResults);

    if (insertError) throw insertError;

    // Recalculer les points pour chaque course affectée
    const courseIds = Array.from(courseIdsSet);
    const recomputeResults: any[] = [];
    
    for (const courseId of courseIds) {
      try {
        const { data: recompData } = await supabaseClient.rpc('admin_compute_points_for_course', {
          p_course_id: courseId
        });
        recomputeResults.push({
          course_id: courseId,
          success: true,
          data: recompData
        });
      } catch (err) {
        recomputeResults.push({
          course_id: courseId,
          success: false,
          error: err.message
        });
      }
    }

    // Statistiques par type d'erreur
    const errorsByType = {
      rider_not_found: errors.filter(e => e.type === 'rider_not_found'),
      course_not_found: errors.filter(e => e.type === 'course_not_found'),
      season_not_found: errors.filter(e => e.type === 'season_not_found'),
      invalid_format: errors.filter(e => e.type === 'invalid_format'),
      unknown_type: errors.filter(e => e.type === 'unknown_type'),
    };

    const uniqueRidersNotFound = new Set(errors.filter(e => e.type === 'rider_not_found').map(e => e.riderName));
    const uniqueCoursesNotFound = new Set(errors.filter(e => e.type === 'course_not_found').map(e => e.courseName));

    return new Response(
      JSON.stringify({
        success: true,
        imported: validResults.length,
        errors,
        warnings,
        errorsByType: {
          riders_not_found: Array.from(uniqueRidersNotFound),
          courses_not_found: Array.from(uniqueCoursesNotFound),
          total_by_type: {
            rider_errors: errorsByType.rider_not_found.length,
            course_errors: errorsByType.course_not_found.length,
            season_errors: errorsByType.season_not_found.length,
            format_errors: errorsByType.invalid_format.length,
            unknown_type_errors: errorsByType.unknown_type.length,
          }
        },
        courses_affected: courseIds,
        recompute_results: recomputeResults,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error importing Matt L results:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Erreur inconnue'
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
