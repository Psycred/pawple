import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_HOSTS = [
  'maps.app.goo.gl',
  'goo.gl',
  'google.com',
  'maps.google.com',
  'maps.apple.com',
  'apple.com',
];

function isAllowedHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function pickCoords(lat: string, lng: string): { lat: number; lng: number } | null {
  const la = Number(lat);
  const lo = Number(lng);
  if (!isValidLatLng(la, lo)) {
    return null;
  }
  return { lat: la, lng: lo };
}

function parseMapLinkCoords(url: string): { lat: number; lng: number } | null {
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    decoded = url;
  }

  const atMatch = decoded.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (atMatch) {
    return pickCoords(atMatch[1], atMatch[2]);
  }

  const bangMatch = decoded.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/i);
  if (bangMatch) {
    return pickCoords(bangMatch[1], bangMatch[2]);
  }

  const llMatch = decoded.match(/[?&]ll=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/i);
  if (llMatch) {
    return pickCoords(llMatch[1], llMatch[2]);
  }

  const qMatch = decoded.match(/[?&]q=(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/i);
  if (qMatch) {
    return pickCoords(qMatch[1], qMatch[2]);
  }

  const centerMatch = decoded.match(/[?&]center=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/i);
  if (centerMatch) {
    return pickCoords(centerMatch[1], centerMatch[2]);
  }

  const loose = decoded.match(/(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (loose) {
    return pickCoords(loose[1], loose[2]);
  }

  return null;
}

async function unwrapMapUrl(url: string): Promise<string> {
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(8000),
    headers: {
      'User-Agent': 'Pawple/1.0 (meetup-map-unwrap)',
    },
  });
  return response.url || url;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const url = String(body?.url ?? '').trim();

    if (!url) {
      return new Response(JSON.stringify({ venueLat: null, venueLng: null, resolvedUrl: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (!isAllowedHost(url)) {
      return new Response(JSON.stringify({ error: 'Unsupported map link host' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    let resolvedUrl = url;
    try {
      resolvedUrl = await unwrapMapUrl(url);
    } catch (unwrapError) {
      console.warn('[resolve-map-link] unwrap failed:', unwrapError);
    }

    const coords = parseMapLinkCoords(resolvedUrl) ?? parseMapLinkCoords(url);

    return new Response(
      JSON.stringify({
        venueLat: coords?.lat ?? null,
        venueLng: coords?.lng ?? null,
        resolvedUrl,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('[resolve-map-link]', error);
    return new Response(JSON.stringify({ error: 'Failed to resolve map link' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
