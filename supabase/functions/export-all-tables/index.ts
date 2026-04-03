import { createClient } from 'npm:@supabase/supabase-js@2';
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

async function exportTableToCSV(
  supabase: any,
  tableName: string,
): Promise<{ csv: string; count: number }> {
  const pageSize = 1000;
  let offset = 0;
  let count = 0;

  let headers: string[] | null = null;
  const lines: string[] = [];

  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Error fetching ${tableName}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    if (!headers) {
      headers = Object.keys(data[0]);
      lines.push(headers.join(';'));
    }

    for (const row of data) {
      lines.push(headers.map((h) => escapeCSVField(row[h])).join(';'));
    }

    count += data.length;
    offset += pageSize;

    if (data.length < pageSize) {
      break;
    }
  }

  if (!headers) {
    return { csv: '', count: 0 };
  }

  return { csv: lines.join('\n'), count };
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

        const { csv, count } = await exportTableToCSV(serviceClient, tableName);

        if (count > 0) {
          zip.file(`${tableName}.csv`, csv);
        } else {
          zip.file(`${tableName}.csv`, `# Table ${tableName} is empty`);
        }

        metadata[tableName] = {
          rows: count,
          exportedAt: exportDate,
        };

        console.log(`Exported ${tableName}: ${count} rows`);
      } catch (tableError) {
        const errMsg = tableError instanceof Error ? tableError.message : 'Unknown error';
        console.error(`Error exporting table ${tableName}:`, errMsg);
        metadata[tableName] = {
          rows: -1,
          exportedAt: exportDate,
        };
        zip.file(`${tableName}.csv`, `# Error exporting table: ${errMsg}`);
      }
    }
    // Add metadata file
    zip.file('_metadata.json', JSON.stringify({
      exported_at: new Date().toISOString(),
      tables: metadata
    }, null, 2));
    
    // Generate ZIP (STORE = no compression to avoid CPU limits)
    const zipContent = await zip.generateAsync({
      type: 'uint8array',
      compression: 'STORE',
      streamFiles: true,
    });
    
    const totalRows = Object.values(metadata).reduce((sum, t) => sum + (t.rows > 0 ? t.rows : 0), 0);
    console.log(`ZIP generated: ${zipContent.length} bytes, ${totalRows} total rows`);

    // Upload to private storage and return a short-lived signed URL (avoids Base64 memory spikes)
    const bucket = 'admin-exports';
    const { error: bucketError } = await serviceClient.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: 1024 * 1024 * 200, // 200MB
    });
    if (bucketError && !String(bucketError.message || '').includes('already exists')) {
      console.error('Bucket creation error:', bucketError);
    }

    const date = new Date().toISOString().split('T')[0];
    const objectPath = `db-backups/${date}/${crypto.randomUUID()}.zip`;

    const { error: uploadError } = await serviceClient.storage
      .from(bucket)
      .upload(objectPath, zipContent, {
        contentType: 'application/zip',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data: signed, error: signedError } = await serviceClient.storage
      .from(bucket)
      .createSignedUrl(objectPath, 60 * 10); // 10 minutes

    if (signedError || !signed?.signedUrl) {
      console.error('Signed URL error:', signedError);
      throw new Error('Failed to generate download URL');
    }

    return new Response(
      JSON.stringify({
        filename: `database_backup_${date}.zip`,
        download_url: signed.signedUrl,
        size_bytes: zipContent.length,
        total_rows: totalRows,
        tables_count: TABLES.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in export-all-tables:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
