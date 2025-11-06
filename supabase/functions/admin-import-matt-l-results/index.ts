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


// Helper pour créer le rapport par course
function createCourseReport(
  lines: string[], 
  validResults: any[], 
  errors: ImportError[]
): Array<{
  courseName: string;
  courseId: string | null;
  imported: number;
  failed: number;
  errors: Array<{ riderName: string; reason: string; position?: number }>;
}> {
  const courseReport = new Map<string, {
    courseName: string;
    courseId: string | null;
    imported: number;
    failed: number;
    errors: Array<{ riderName: string; reason: string; position?: number }>;
  }>();

  // Analyser toutes les lignes pour créer le rapport
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.includes('course annulée')) continue;
    
    const parts = line.split(',');
    if (parts.length < 8) continue;
    
    const courseName = parts[1]?.trim() || 'Inconnu';
    
    if (!courseReport.has(courseName)) {
      courseReport.set(courseName, {
        courseName,
        courseId: null,
        imported: 0,
        failed: 0,
        errors: []
      });
    }
    
    const report = courseReport.get(courseName)!;
    
    // Vérifier si cette ligne a été importée avec succès
    const wasImported = validResults.some(r => r.raw_line === line);
    
    if (wasImported) {
      report.imported++;
      // Récupérer le courseId depuis validResults
      const result = validResults.find(r => r.raw_line === line);
      if (result && !report.courseId) {
        report.courseId = result.course_id;
      }
    } else {
      // Chercher l'erreur correspondante
      const error = errors.find(e => e.raw === line);
      if (error) {
        report.failed++;
        
        // Extraire position si disponible
        let position: number | undefined = undefined;
        if (parts.length >= 6) {
          const pos = parseInt(parts[5]?.trim(), 10);
          if (!isNaN(pos)) position = pos;
        }
        
        report.errors.push({
          riderName: error.riderName || parts[0]?.trim() || 'Inconnu',
          reason: error.type,
          position
        });
      }
    }
  }

  // Convertir en array triée par nombre total de lignes
  return Array.from(courseReport.values())
    .sort((a, b) => (b.imported + b.failed) - (a.imported + a.failed));
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
        .select('id, nom, date_debut, date_fin')
        .range(from, from + pageSize - 1);
      
      if (error) throw error;
      if (!data || data.length === 0) break;
      
      courses = courses.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    
    // Indexation optimisée pour recherches O(1) avec dates
    const courseByName = new Map<string, { id: string, nom: string, norm: string, date_debut: string | null, date_fin: string | null }>();
    const courseByNorm = new Map<string, { id: string, nom: string, date_debut: string | null, date_fin: string | null }>();
    const courseByTokens = new Map<string, { id: string, nom: string, date_debut: string | null, date_fin: string | null }>();
    const coursesByYear = new Map<string, Array<{ id: string, nom: string, norm: string, tokens: string, date_debut: string | null, date_fin: string | null }>>();
    
    courses.forEach(c => {
      const normName = normalize(c.nom);
      const tokens = tokenSig(c.nom);
      const courseData = { id: c.id, nom: c.nom, norm: normName, date_debut: c.date_debut, date_fin: c.date_fin };
      
      courseByName.set(c.id, courseData);
      courseByNorm.set(normName, { id: c.id, nom: c.nom, date_debut: c.date_debut, date_fin: c.date_fin });
      courseByTokens.set(tokens, { id: c.id, nom: c.nom, date_debut: c.date_debut, date_fin: c.date_fin });
      
      // Index par année pour filtrage rapide
      if (c.date_debut) {
        const year = c.date_debut.substring(0, 4);
        if (!coursesByYear.has(year)) {
          coursesByYear.set(year, []);
        }
        coursesByYear.get(year)!.push({ id: c.id, nom: c.nom, norm: normName, tokens, date_debut: c.date_debut, date_fin: c.date_fin });
      }
    });
    console.log('Loaded courses:', courseByName.size, 'with year index:', coursesByYear.size, 'years');

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
      // IMPORTANT: Extraire l'année de la date CSV pour filtrer les courses
      let raceYear = '';
      const datePartsForYear = parsed.date.split('/');
      if (datePartsForYear.length === 3) {
        let yearStr = datePartsForYear[2];
        if (yearStr.length === 2) {
          yearStr = '20' + yearStr;
        }
        raceYear = yearStr;
      }
      
      let courseId: string | null = null;
      let matchScore = 0;
      let matchMethod = '';
      let matchedCourseName = '';
      
      const normCourseName = normalize(parsed.nom_course);
      const cacheKey = `${normCourseName}_${raceYear}`;
      
      // Vérifier le cache
      if (courseMatchCache.has(cacheKey)) {
        const cached = courseMatchCache.get(cacheKey)!;
        courseId = cached.id;
        matchScore = cached.score;
        matchMethod = cached.method;
        matchedCourseName = cached.matchedName || '';
      } else {
        // Filtrer les courses par année AVANT le matching
        const yearCandidates = coursesByYear.get(raceYear) || [];
        
        // 1. Match exact normalisé sur les courses de l'année
        const exactMatch = yearCandidates.find(c => c.norm === normCourseName);
        if (exactMatch) {
          courseId = exactMatch.id;
          matchScore = 1.0;
          matchMethod = 'exact';
          matchedCourseName = exactMatch.nom;
        } else {
          // 2. Match par tokens sur les courses de l'année
          const inputTokens = tokenSig(parsed.nom_course);
          const tokenMatch = yearCandidates.find(c => c.tokens === inputTokens);
          if (tokenMatch) {
            courseId = tokenMatch.id;
            matchScore = 1.0;
            matchMethod = 'tokens_exact';
            matchedCourseName = tokenMatch.nom;
          } else {
            // 3. Fuzzy matching uniquement sur les courses de l'année
            if (yearCandidates.length > 0 && yearCandidates.length < 100) {
              let bestMatch: { id: string; nom: string; score: number; method: string } | null = null;
              
              // D'abord essayer tokens Jaccard
              for (const candidate of yearCandidates) {
                const tokenScore = matchByTokens(parsed.nom_course, candidate.nom);
                if (tokenScore >= 0.7 && (!bestMatch || tokenScore > bestMatch.score)) {
                  bestMatch = { id: candidate.id, nom: candidate.nom, score: tokenScore, method: 'tokens' };
                }
              }
              
              // Si pas assez bon, essayer Levenshtein
              if (!bestMatch || bestMatch.score < 0.8) {
                for (const candidate of yearCandidates) {
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
        
        // Mettre en cache avec la clé incluant l'année
        courseMatchCache.set(cacheKey, { 
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
          riderName: parsed.coureur,
          raw: line 
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
      
      // Pour les classements généraux (non-étapes), utiliser date_fin de la course (jour précédent)
      // Pour les étapes, utiliser la date fournie
      let dateClassement: string;
      
      if (etapeNumero === null && typeClassement !== 'Etape') {
        // Classement général: soustraire un jour (publié J+1, mais appartient à J)
        const dateObj = new Date(`${yearStr}-${month}-${day}`);
        dateObj.setDate(dateObj.getDate() - 1);
        const adjustedYear = dateObj.getFullYear();
        const adjustedMonth = String(dateObj.getMonth() + 1).padStart(2, '0');
        const adjustedDay = String(dateObj.getDate()).padStart(2, '0');
        dateClassement = `${adjustedYear}-${adjustedMonth}-${adjustedDay}`;
      } else {
        // Étape: utiliser la date fournie
        dateClassement = `${yearStr}-${month}-${day}`;
      }
      
      // Mapper la date vers la saison
      const seasonYear = parseInt(yearStr, 10);
      const saisonId = saisonMap.get(seasonYear.toString());

      if (!saisonId) {
        errors.push({
          line: lineNum,
          type: 'season_not_found',
          raw: line,
          details: `Aucune saison trouvée pour l'année ${seasonYear} (date: ${dateClassement})`,
        });
        continue;
      }

      console.log(`✅ Ligne ${lineNum}: Date ${dateClassement} → Saison ${seasonYear}`);

      // Créer le résultat
      // Les Porteurs et classements finaux doivent avoir position = 1 pour le calcul des points
      const isPorteur = typeClassement.startsWith('Porteur');
      const isFinalClassement = ['Points', 'Montagne', 'Jeune'].includes(typeClassement);
      
      const result = {
        course_id: courseId,
        coureur_id: coureurId,
        type_classement: typeClassement,
        etape_numero: etapeNumero,
        position: (isPorteur || isFinalClassement) ? 1 : (position > 0 ? position : null),
        position_decimal: null,
        statut,
        date_classement: dateClassement,
        saison_id: saisonId,
      };

      validResults.push(result);
      courseIdsSet.add(courseId);
    }

    console.log(`Processed ${lines.length - 1} lines: ${validResults.length} valid, ${errors.length} errors`);
    
    // Log des saisons utilisées
    const saisonCounts = new Map<string, number>();
    for (const result of validResults) {
      const count = saisonCounts.get(result.saison_id) || 0;
      saisonCounts.set(result.saison_id, count + 1);
    }

    console.log('📊 Résultats par saison:');
    for (const [sid, count] of saisonCounts) {
      const annee = Array.from(saisonMap.entries()).find(([_, id]) => id === sid)?.[0];
      console.log(`  - Saison ${annee}: ${count} résultats`);
    }


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

      const courseReportArray = createCourseReport(lines, validResults, errors);

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
          course_report: courseReportArray,
          recompute_results: [],
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Déduplication intra-batch pour respecter l'unicité (course_id, type_classement, COALESCE(position_decimal, position))
    const sanitizedResults = (() => {
      const seen = new Set<string>();
      const arr: any[] = [];
      for (const r of validResults) {
        const inUniqueIndexScope =
          r.etape_numero === null &&
          r.statut === 'finished' &&
          (r.position !== null || r.position_decimal !== null);
        if (!inUniqueIndexScope) {
          arr.push(r);
          continue;
        }
        const posKey = r.position_decimal ?? r.position;
        const key = `${r.course_id}|${r.type_classement}|${posKey}`;
        if (seen.has(key)) {
          continue; // skip duplicate within this batch
        }
        seen.add(key);
        arr.push(r);
      }
      return arr;
    })();
    console.log(`🧹 Déduplication: ${validResults.length - sanitizedResults.length} doublon(s) supprimé(s)`);
    
    // Stratégie DELETE + INSERT (car la contrainte unique utilise une expression COALESCE)
    const uniqueCourseIds = Array.from(courseIdsSet);
    if (uniqueCourseIds.length > 0) {
      console.log(`🗑️ Suppression des résultats existants pour ${uniqueCourseIds.length} course(s)...`);
      
      const { error: deleteError } = await supabaseClient
        .from('race_results')
        .delete()
        .in('course_id', uniqueCourseIds)
        .eq('type_classement', 'General')
        .is('etape_numero', null)
        .eq('statut', 'finished');

      if (deleteError) {
        console.error('❌ Erreur lors de la suppression:', deleteError);
        throw deleteError;
      }
    }

    // Insertion des nouveaux résultats
    console.log(`📝 Insertion de ${sanitizedResults.length} nouveau(x) résultat(s)...`);
    const { error: insertError } = await supabaseClient
      .from('race_results')
      .insert(sanitizedResults);

    if (insertError) throw insertError;
    
    console.log(`✅ ${sanitizedResults.length} résultats insérés avec succès`);

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

    const courseReportArray = createCourseReport(lines, validResults, errors);


    return new Response(
      JSON.stringify({
        success: true,
        imported: sanitizedResults.length,
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
        course_report: courseReportArray, // ⭐ NOUVEAU: Rapport détaillé par course
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
