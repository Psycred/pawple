import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  buildShareLandingScript,
  buildSharePreviewImageUrl,
} from '../_shared/shareLanding.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PUBLIC_SHARE_ORIGIN = 'https://pawple.app';
const CRAWLER_RE =
  /bot|crawl|spider|facebook|whatsapp|telegram|twitter|linkedin|slack|discord|preview|embed/i;

function escapeHtml(value: string) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const meetupId = String(url.searchParams.get('id') ?? '').trim();

    if (!meetupId) {
      return new Response('Missing meetup id', { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceKey) {
      return new Response('Server misconfigured', { status: 500, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: meetup, error } = await supabase
      .from('meetups')
      .select('id, title, description, city, user_id')
      .eq('id', meetupId)
      .maybeSingle();

    if (error) {
      console.error('[meetup-share]', error);
      return new Response('Lookup failed', { status: 500, headers: corsHeaders });
    }

    if (!meetup?.id || !meetup?.user_id) {
      return new Response('Meetup not found', { status: 404, headers: corsHeaders });
    }

    const canonicalUrl = `${PUBLIC_SHARE_ORIGIN}/meetup/${encodeURIComponent(meetup.id)}`;
    const previewOwnerId =
      String(url.searchParams.get('preview') ?? '').trim() || String(meetup.user_id);
    const previewImage = buildSharePreviewImageUrl(
      supabaseUrl,
      previewOwnerId,
      'meetup-share',
      String(meetup.id),
    );
    const title = escapeHtml(meetup.title || 'Pawple Meetup');
    const description = escapeHtml(
      meetup.description?.trim() || meetup.city?.trim() || 'Join on Pawple',
    );
    const userAgent = req.headers.get('user-agent') ?? '';
    const isCrawler = CRAWLER_RE.test(userAgent);

    const landingScript = isCrawler
      ? ''
      : buildShareLandingScript('meetup', String(meetup.id));

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Pawple" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${previewImage}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${previewImage}" />
</head>
<body>
  <p>Open this meetup in Pawple.</p>
  ${landingScript}
</body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    console.error('[meetup-share]', error);
    return new Response('Unexpected error', { status: 500, headers: corsHeaders });
  }
});
