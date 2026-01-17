import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import JSZip from 'https://esm.sh/jszip@3.10.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// All 44 public tables to export
const TABLES = [
  'annonces',
  'announcement_banner',
  'app_feature_flags',
  'app_migrations',
  'auctions',
  'audits',
  'bids',
  'bonus_points',
  'bonus_rider_selections',
  'category_aliases',
  'coureurs',
  'coureurs_saisons',
  'course_stage_config',
  'courses',
  'equipes',
  'equipes_saisons',
  'league_invite_uses',
  'league_invites',
  'league_members',
  'league_scopes',
  'league_templates',
  'leagues',
  'manager_bonus_points',
  'manager_fun_awards',
  'manager_sponsors',
  'managers',
  'name_aliases',
  'notifications',
  'phases',
  'points_ledger',
  'race_result_sets',
  'race_results',
  'race_results_history',
  'rider_favorites',
  'rosters',
  'saisons',
  'scoring_rules',
  'scoring_rules_saisons',
  'startlist_entries',
  'startlist_imports',
  'startlist_manager_ratings',
  'user_activity_logs',
  'user_roles'
];

function escapeCSVField(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = typeof value === 'object' 
    ? JSON.stringify(value) 
    : String(value);
  
  // Escape quotes and wrap in quotes if contains special characters
  if (stringValue.includes('"') || stringValue.includes(';') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

function arrayToCSV(data: Record<string, unknown>[]): string {
  if (!data || data.length === 0) {
    return '';
  }
  
  const headers = Object.keys(data[0]);
  const headerRow = headers.join(';');
  
  const rows = data.map(row => 
    headers.map(header => escapeCSVField(row[header])).join(';')
  );
  
  return [headerRow, ...rows].join('\n');
}

async function fetchAllRows(
  supabase: any,
  tableName: string
): Promise<{ data: Record<string, unknown>[]; count: number }> {
  const allData: Record<string, unknown>[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(offset, offset + pageSize - 1);
    
    if (error) {
      console.error(`Error fetching ${tableName}:`, error.message);
      break;
    }
    
    if (data && data.length > 0) {
      allData.push(...data);
      offset += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }
  
  return { data: allData, count: allData.length };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create client with user's token for auth verification
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is superadmin using user's context
    const { data: isSuperAdmin, error: roleError } = await userClient.rpc('is_superadmin');
    
    if (roleError) {
      console.error('Role check error:', roleError);
      return new Response(JSON.stringify({ error: 'Failed to verify permissions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isSuperAdmin) {
      console.error('User is not superadmin');
      return new Response(JSON.stringify({ error: 'Forbidden - Superadmin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Starting full database export for user ${user.id}`);
    
    // Create service role client for exporting all data (bypasses RLS)
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    
    // Create ZIP file
    const zip = new JSZip();
    const metadata: Record<string, { rows: number; exportedAt: string }> = {};
    const exportDate = new Date().toISOString();
    
    // Export each table
    for (const tableName of TABLES) {
      try {
        console.log(`Exporting table: ${tableName}`);
        const { data, count } = await fetchAllRows(serviceClient, tableName);
        
        if (data.length > 0) {
          const csv = arrayToCSV(data);
          zip.file(`${tableName}.csv`, csv);
        } else {
          // Create empty CSV with just a comment
          zip.file(`${tableName}.csv`, `# Table ${tableName} is empty`);
        }
        
        metadata[tableName] = {
          rows: count,
          exportedAt: exportDate
        };
        
        console.log(`Exported ${tableName}: ${count} rows`);
      } catch (tableError) {
        console.error(`Error exporting table ${tableName}:`, tableError);
        metadata[tableName] = {
          rows: -1,
          exportedAt: exportDate
        };
        zip.file(`${tableName}.csv`, `# Error exporting table: ${tableError instanceof Error ? tableError.message : 'Unknown error'}`);
      }
    }
    
    // Add metadata file
    zip.file('_metadata.json', JSON.stringify({
      exportedAt: exportDate,
      exportedBy: user.id,
      tablesCount: TABLES.length,
      tables: metadata
    }, null, 2));
    
    // Generate ZIP (STORE = no compression to avoid CPU limits)
    const zipContent = await zip.generateAsync({
      type: 'uint8array',
      compression: 'STORE',
      streamFiles: true,
    });
    
    const totalRows = Object.values(metadata).reduce((sum, t) => sum + (t.rows > 0 ? t.rows : 0), 0);
    console.log(`Export complete: ${TABLES.length} tables, ${totalRows} total rows`);

    return new Response(new Uint8Array(zipContent), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="database_backup_${exportDate.split('T')[0]}.zip"`,
      },
    });

  } catch (error) {
    console.error('Error in export-all-tables:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
