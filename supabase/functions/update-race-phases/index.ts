import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin access
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') || ''
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all phases
    const { data: phases } = await supabase
      .from('phases')
      .select('id, index_dans_saison')
      .order('index_dans_saison');

    if (!phases || phases.length === 0) {
      return new Response(JSON.stringify({ error: 'No phases found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create phase mapping
    const phaseMap: Record<string, string> = {};
    phases.forEach(p => {
      phaseMap[`Phase ${p.index_dans_saison}`] = p.id;
    });

    console.log('Phase mapping:', phaseMap);

    // Race name to phase mapping from CSV
    const racePhaseMapping: Record<string, string> = {
      'Santos Tour Down Under': 'Phase 1',
      'Gran Premio Castellón - Ruta de la Cerámica': 'Phase 1',
      'Clàssica Comunitat Valenciana 1969 - Gran Premi València': 'Phase 1',
      'AlUla Tour': 'Phase 1',
      'Trofeo Calvià': 'Phase 1',
      'Trofeo Felanitx-Ses Salines': 'Phase 1',
      'Surf Coast Classic - Men': 'Phase 1',
      'Trofeo Serra Tramuntana': 'Phase 1',
      'Trofeo Andratx - Pollença': 'Phase 1',
      'Cadel Evans Great Ocean Road Race - Men': 'Phase 1',
      'Grand Prix Cycliste de Marseille La Marseillaise': 'Phase 1',
      'Trofeo Palma': 'Phase 1',
      'Etoile de Bessèges - Tour du Gard': 'Phase 1',
      'Volta a la Comunitat Valenciana': 'Phase 1',
      'Tour of Oman': 'Phase 1',
      'Muscat Classic': 'Phase 1',
      'Tour de la Provence': 'Phase 1',
      'Vuelta a la Región de Murcia "Costa Cálida"': 'Phase 1',
      'Clasica de Almeria ME': 'Phase 1',
      'Figueira Champions Classic': 'Phase 1',
      'UAE Tour': 'Phase 1',
      'Clásica Jaén': 'Phase 1',
      'Volta ao Algarve em Bicicleta': 'Phase 1',
      'Vuelta a Andalucia Ruta Ciclista Del Sol': 'Phase 1',
      'Classic Var': 'Phase 1',
      'Tour des Alpes-Maritimes': 'Phase 1',
      'Tour du Rwanda': 'Phase 1',
      'O Gran Camiño - The Historical Route': 'Phase 1',
      'Omloop Nieuwsblad': 'Phase 1',
      'Faun-Ardèche Classic': 'Phase 1',
      'Faun Drome Classic': 'Phase 1',
      'Kuurne - Brussel - Kuurne': 'Phase 1',
      'Ename Samyn Classic': 'Phase 1',
      'Trofeo Laigueglia': 'Phase 1',
      'Strade Bianche': 'Phase 1',
      'Grand Prix Criquielion': 'Phase 1',
      'Paris-Nice': 'Phase 1',
      'Grote prijs Jean - Pierre Monseré': 'Phase 1',
      'Tirreno-Adriatico': 'Phase 1',
      'Betcity Elfstedenrace': 'Phase 1',
      'Tour de Taiwan': 'Phase 1',
      'Danilith Nokere Koerse': 'Phase 1',
      'Milano - Torino': 'Phase 1',
      'Grand Prix de Denain - Porte du Hainaut': 'Phase 1',
      'Bredene Koksijde Classic': 'Phase 1',
      'Milano-Sanremo': 'Phase 1',
      'Classic Loire Atlantique': 'Phase 1',
      'Cholet Agglo Tour': 'Phase 1',
      'The Princess Maha Chakri Sirindhorn\'s Cup Tour of Thailand': 'Phase 2',
      'Volta Ciclista a Catalunya': 'Phase 2',
      'Settimana Internazionale Coppi e Bartali': 'Phase 2',
      'Classic Brugge-De Panne': 'Phase 2',
      'E3 Saxo Classic': 'Phase 2',
      'Gent-Wevelgem in Flanders Fields': 'Phase 2',
      'G.P. Emilia': 'Phase 2',
      'La Roue Tourangelle Centre Val de Loire - Groupama P.V.L.': 'Phase 2',
      'Dwars door Vlaanderen - A travers la Flandre': 'Phase 2',
      'ΔΕΗ Ιnternational Tour of Hellas': 'Phase 2',
      'Paris - Camembert': 'Phase 2',
      'La Route Adélie de Vitré': 'Phase 2',
      'Gran Premio Miguel Indurain': 'Phase 2',
      'Volta NXT Classic': 'Phase 2',
      'Ronde van Vlaanderen': 'Phase 2',
      'Itzulia Basque Country': 'Phase 2',
      'Tour of Hainan': 'Phase 2',
      'Région Pays de la Loire Tour': 'Phase 2',
      'Scheldeprijs': 'Phase 2',
      'Paris-Roubaix': 'Phase 2',
      'Il Giro d\'Abruzzo': 'Phase 2',
      'Ronde van Limburg': 'Phase 2',
      'De Brabantse Pijl - La Flèche Brabançonne': 'Phase 2',
      'Classic Grand Besançon Doubs': 'Phase 2',
      'Tour du Jura Cycliste': 'Phase 2',
      'Amstel Gold Race': 'Phase 2',
      'Tour du Doubs': 'Phase 2',
      'Tour of the Alps': 'Phase 2',
      'La Flèche Wallonne': 'Phase 2',
      'Vuelta Asturias Julio Alvarez Mendo': 'Phase 2',
      'Liège-Bastogne-Liège': 'Phase 2',
      'Presidential Cycling Tour of Turkiye': 'Phase 2',
      'Tour de Romandie': 'Phase 2',
      'Eschborn-Frankfurt': 'Phase 2',
      'Lotto Famenne Ardenne Classic': 'Phase 2',
      'Boucles de l\'Aulne - Châteaulin': 'Phase 2',
      'Giro d\'Italia': 'Phase 3',
      'Tour du Finistère Pays de Quimper': 'Phase 3',
      'Grand Prix du Morbihan': 'Phase 3',
      'Tro-Bro Léon': 'Phase 3',
      'Classique Dunkerque / Grand prix des Hauts de France': 'Phase 3',
      '4 Jours de Dunkerque / Grand Prix des Hauts de France': 'Phase 3',
      'Tour de Hongrie': 'Phase 3',
      'Rund um Köln': 'Phase 3',
      'Grande Prémio Internacional Beiras e Serra da Estrela': 'Phase 3',
      'Veenendaal - Veenendaal': 'Phase 3',
      'Veenendaal-Veenendaal': 'Phase 3',
      'Antwerp Port Epic Ladies': 'Phase 3',
      'Antwerp Port Epic / Sels Trophy': 'Phase 3',
      'Tour of Estonia': 'Phase 3',
      'Circuit de Wallonie': 'Phase 3',
      'Boucles de la Mayenne - Crédit Mutuel': 'Phase 3',
      'Tour of Norway': 'Phase 3',
      'Marcel Kint Classic': 'Phase 3',
      'Tour of Slovenia': 'Phase 3',
      'Mercan\'Tour Classic Alpes-Maritimes': 'Phase 3',
      'Heylen Vastgoed Heistse Pijl': 'Phase 3',
      'Critérium du Dauphiné': 'Phase 3',
      'Brussels Cycling Classic': 'Phase 3',
      'ZLM Tour': 'Phase 3',
      'Grosser Preis des Kantons Aargau': 'Phase 3',
      'Duracell Dwars door het Hageland': 'Phase 3',
      'Elfstedenronde Brugge': 'Phase 3',
      'SPAR Flanders Diamond Tour': 'Phase 3',
      'Tour de Suisse': 'Phase 3',
      'CIC - Mont Ventoux': 'Phase 3',
      'Baloise Belgium Tour': 'Phase 3',
      'La Route d\'Occitanie - CIC': 'Phase 3',
      'Copenhagen Sprint': 'Phase 3',
      'Andorra MoraBanc Clàssica': 'Phase 3',
      'Giro dell\'Appennino': 'Phase 3',
      'Les CN': 'Phase 3',
      'Sibiu Cycling Tour': 'Phase 3',
      'Tour de France': 'Phase 4',
      'Tour of Magnificent Qinghai': 'Phase 4',
      'Tour of Austria': 'Phase 4',
      'La Picto - Charentaise': 'Phase 4',
      'Clásica Terres de l´Ebre': 'Phase 4',
      'Prueba Villafranca - Ordiziako Klasika': 'Phase 4',
      'Ethias-Tour de Wallonie': 'Phase 4',
      'Vuelta a Castilla y Leon': 'Phase 4',
      'Donostia San Sebastian Klasikoa': 'Phase 4',
      'Circuito de Getxo - Memorial Hermanos Otxoa': 'Phase 4',
      'Tour de Pologne': 'Phase 4',
      'Vuelta a Burgos': 'Phase 4',
      'Tour de l\'Ain': 'Phase 4',
      'Arctic Race of Norway': 'Phase 4',
      'PostNord Tour of Denmark': 'Phase 4',
      'Czech Tour': 'Phase 4',
      'Circuit Franco-Belge': 'Phase 4',
      'Druivenkoers - Overijse': 'Phase 4',
      'ADAC Cyclassics': 'Phase 4',
      'La Polynormande': 'Phase 4',
      'Tour du Limousin-Périgord - Nouvelle Aquitaine': 'Phase 4',
      'Lidl Deutschland Tour': 'Phase 4',
      'Renewi Tour': 'Phase 4',
      'Trans-Himalaya Cycling Race': 'Phase 4',
      'GP Lucien Van Impe': 'Phase 4',
      'La Vuelta Ciclista a España': 'Phase 5',
      'Tour Poitou - Charentes en Nouvelle Aquitaine': 'Phase 5',
      'Muur Classic Geraardsbergen': 'Phase 5',
      'Bretagne Classic - Ouest-France': 'Phase 5',
      'Lloyds Bank Tour of Britain Men': 'Phase 5',
      'Tour of İstanbul': 'Phase 5',
      'Maryland Cycling Classic': 'Phase 5',
      'GP Industria & Artigianato': 'Phase 5',
      'Giro della Toscana - Memorial Alfredo Martini': 'Phase 5',
      'Gran Premio città di Peccioli - Coppa Sabatini': 'Phase 5',
      'Grand Prix Cycliste de Québec': 'Phase 5',
      'Memorial Marco Pantani': 'Phase 5',
      'GP de Fourmies / La Voix du Nord': 'Phase 5',
      'Grand Prix Cycliste de Montréal': 'Phase 5',
      'Trofeo Matteotti': 'Phase 5',
      'Okolo Slovenska / Tour de Slovaquie': 'Phase 5',
      'Grand Prix de Wallonie': 'Phase 5',
      'Skoda Tour de Luxembourg': 'Phase 5',
      'Kampioenschap van Vlaanderen': 'Phase 5',
      'SUPER 8 Classic': 'Phase 5',
      'World Championships ME - ITT': 'Phase 5',
      'Giro della Romagna': 'Phase 5',
      'Gooikse Pijl': 'Phase 5',
      'Grand Prix d\'Isbergues - Pas de Calais': 'Phase 5',
      'Omloop van het Houtland': 'Phase 5',
      'World Championships ME - Road Race': 'Phase 5',
      'Petronas Le Tour de Langkawi': 'Phase 5',
      'Paris-Chauny': 'Phase 5',
      'CRO Race': 'Phase 5',
      'European Continental Championships ME - ITT': 'Phase 5',
      'Sparkassen Münsterland Giro': 'Phase 5',
      'Giro dell\'Emilia': 'Phase 5',
      'European Continental Championships ME - Road Race': 'Phase 5',
      'Coppa Agostoni - Giro delle Brianze': 'Phase 5',
      'Coppa Bernocchi - GP Banco BPM': 'Phase 5',
      'Tre Valli Varesine': 'Phase 5',
      'Binche - Chimay - Binche / Mémorial Frank Vandenbroucke': 'Phase 5',
      'Gran Piemonte': 'Phase 5',
      'Paris - Bourges': 'Phase 5',
      'Tour de Kyushu': 'Phase 5',
      'Il Lombardia': 'Phase 5',
      'Tour de Vendée': 'Phase 5',
      'Paris - Tours Elite': 'Phase 5',
      'Trofeo Baracchi': 'Phase 5',
      'Gree-Tour of Guangxi': 'Phase 5',
      'Tour of Holland': 'Phase 5',
      'Giro del Veneto': 'Phase 5',
      'Utsunomiya Japan Cup Road Race': 'Phase 5',
      'Veneto Classic': 'Phase 5',
      'Chrono des Nations': 'Phase 5',
    };

    // Get all courses
    const { data: courses } = await supabase
      .from('courses')
      .select('id, nom');

    if (!courses) {
      return new Response(JSON.stringify({ error: 'No courses found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${courses.length} courses`);

    let updated = 0;
    let notFound = 0;
    const notFoundRaces: string[] = [];

    // Update each course with its phase
    for (const course of courses) {
      const phaseName = racePhaseMapping[course.nom];
      
      if (phaseName && phaseMap[phaseName]) {
        const phaseId = phaseMap[phaseName];
        
        const { error: updateError } = await supabase
          .from('courses')
          .update({ phase_id: phaseId })
          .eq('id', course.id);

        if (updateError) {
          console.error(`Error updating course ${course.nom}:`, updateError);
        } else {
          updated++;
          console.log(`Updated ${course.nom} -> ${phaseName}`);
        }
      } else {
        notFound++;
        notFoundRaces.push(course.nom);
        console.log(`Phase not found for: ${course.nom}`);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      updated,
      notFound,
      totalCourses: courses.length,
      notFoundRaces: notFoundRaces.slice(0, 10) // Return first 10 not found
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-race-phases:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
