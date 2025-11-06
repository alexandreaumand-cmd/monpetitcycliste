import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { normalize, tokenSig, extractLastName, similarity, canonizeName, matchByTokens } from '../_shared/normalization.ts';

// Supprimé: Le matching se fait maintenant prioritairement par nom de course

interface ParsedLine {
  coureur: string;
  nom_course: string;
  code_course: string;
  phase: string;
  classement2: string;
  type_class: string;
  date: string;
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
    
    const courseByName = new Map<string, { id: string, nom: string, norm: string }>();
    
    courses.forEach(c => {
      const normName = normalize(c.nom);
      courseByName.set(c.id, { id: c.id, nom: c.nom, norm: normName });
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
    
    const coureurByNorm = new Map<string, { id: string, nom: string, norm: string, tokens: string, lastName: string }>();
    coureurs.forEach(c => {
      const canonical = canonizeName(c.nom);
      const norm = normalize(canonical);
      const tokens = tokenSig(canonical);
      const lastName = extractLastName(canonical);
      coureurByNorm.set(norm, { id: c.id, nom: c.nom, norm, tokens, lastName });
    });
    console.log('Loaded riders:', coureurByNorm.size);

    // Parser et transformer les lignes
    const validResults: any[] = [];
    const errors: { line: number; error: string; raw?: string }[] = [];
    const warnings: string[] = [];
    const courseIdsSet = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];
      
      // Ignorer les lignes de course annulée
      if (line.includes('course annulée')) {
        warnings.push(`Ligne ${lineNum}: Course annulée, ignorée`);
        continue;
      }

      const parts = line.split(',');
      if (parts.length < 7) {
        errors.push({ line: lineNum, error: 'Format invalide', raw: line });
        continue;
      }

      const parsed: ParsedLine = {
        coureur: parts[0].trim(),
        nom_course: parts[1].trim(),
        code_course: parts[2].trim(),
        phase: parts[3].trim(),
        classement2: parts[4].trim(),
        type_class: parts[5].trim(),
        date: parts[6].trim(),
      };

      // Ignorer les entrées "maillot" avec position 0
      if (parsed.type_class === 'maillot' && parsed.classement2 === '0') {
        continue;
      }

      // Mapper le coureur
      let coureurId: string | null = null;
      const canonical = canonizeName(parsed.coureur);
      const normCoureur = normalize(canonical);
      
      // 1. Match exact normalisé
      if (coureurByNorm.has(normCoureur)) {
        coureurId = coureurByNorm.get(normCoureur)!.id;
      } else {
        // 2. Match par tokens
        const inputTokens = tokenSig(canonical);
        for (const [_, coureur] of coureurByNorm) {
          if (coureur.tokens === inputTokens) {
            coureurId = coureur.id;
            break;
          }
        }
        
        // 3. Match par nom de famille + similarité
        if (!coureurId) {
          const inputLastName = extractLastName(canonical);
          let bestMatch: { id: string; score: number } | null = null;
          
          for (const [_, coureur] of coureurByNorm) {
            if (coureur.lastName === inputLastName) {
              const score = similarity(normCoureur, coureur.norm);
              if (score >= 0.8 && (!bestMatch || score > bestMatch.score)) {
                bestMatch = { id: coureur.id, score };
              }
            }
          }
          
          if (bestMatch) {
            coureurId = bestMatch.id;
          }
        }
      }

      if (!coureurId) {
        errors.push({ line: lineNum, error: `Coureur non trouvé: ${parsed.coureur}`, raw: line });
        continue;
      }

      // Mapper la course (matching multi-stratégies)
      let courseId: string | null = null;
      let matchScore = 0;
      let matchMethod = '';
      
      const normCourseName = normalize(parsed.nom_course);
      
      // 1. Essayer match exact normalisé
      for (const [id, courseData] of courseByName) {
        if (courseData.norm === normCourseName) {
          courseId = id;
          matchScore = 1.0;
          matchMethod = 'exact';
          break;
        }
      }
      
      // 2. Essayer matching par tokens (Jaccard)
      if (!courseId) {
        let bestTokenMatch: { id: string; nom: string; score: number } | null = null;
        
        for (const [id, courseData] of courseByName) {
          const tokenScore = matchByTokens(parsed.nom_course, courseData.nom);
          if (tokenScore >= 0.8 && (!bestTokenMatch || tokenScore > bestTokenMatch.score)) {
            bestTokenMatch = { id, nom: courseData.nom, score: tokenScore };
          }
        }
        
        if (bestTokenMatch) {
          courseId = bestTokenMatch.id;
          matchScore = bestTokenMatch.score;
          matchMethod = 'tokens';
          
          if (matchScore < 0.95) {
            warnings.push(`Ligne ${lineNum}: Match par tokens pour course "${parsed.nom_course}" → "${bestTokenMatch.nom}" (score: ${(matchScore * 100).toFixed(0)}%)`);
          }
        }
      }
      
      // 3. Fallback : Levenshtein
      if (!courseId) {
        let bestLevMatch: { id: string; nom: string; score: number } | null = null;
        
        for (const [id, courseData] of courseByName) {
          const levScore = similarity(normCourseName, courseData.norm);
          if (levScore >= 0.7 && (!bestLevMatch || levScore > bestLevMatch.score)) {
            bestLevMatch = { id, nom: courseData.nom, score: levScore };
          }
        }
        
        if (bestLevMatch) {
          courseId = bestLevMatch.id;
          matchScore = bestLevMatch.score;
          matchMethod = 'levenshtein';
          
          warnings.push(`Ligne ${lineNum}: Match Levenshtein pour course "${parsed.nom_course}" → "${bestLevMatch.nom}" (score: ${(matchScore * 100).toFixed(0)}%)`);
        }
      }

      if (!courseId) {
        errors.push({ 
          line: lineNum, 
          error: `Course non trouvée: "${parsed.nom_course}" (code: ${parsed.code_course})`, 
          raw: line 
        });
        continue;
      }

      // Mapper la saison
      const year = parsed.date.split('/')[2];
      const saisonId = saisonMap.get(year);
      if (!saisonId) {
        errors.push({ line: lineNum, error: `Saison non trouvée pour l'année: ${year}`, raw: line });
        continue;
      }

      // Transformer type_classement
      let typeClassement: string;
      let etapeNumero: number | null = null;
      
      if (parsed.type_class === 'GC') {
        typeClassement = 'General';
      } else if (parsed.type_class.startsWith('etape')) {
        typeClassement = 'Etape';
        const match = parsed.type_class.match(/etape(\d+)/);
        if (match) {
          etapeNumero = parseInt(match[1], 10);
        }
      } else {
        errors.push({ line: lineNum, error: `Type de classement inconnu: ${parsed.type_class}`, raw: line });
        continue;
      }

      // Position et statut
      const position = parseInt(parsed.classement2, 10);
      const statut = position === 0 ? 'bonus' : 'finished';

      // Parser la date (format: 9/1/2025 -> 2025-01-09)
      const [day, month, yearStr] = parsed.date.split('/');
      const dateClassement = `${yearStr}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

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
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Aucun résultat valide trouvé',
          errors,
          warnings,
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Insertion en batch
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

    return new Response(
      JSON.stringify({
        success: true,
        imported: validResults.length,
        errors,
        warnings,
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
