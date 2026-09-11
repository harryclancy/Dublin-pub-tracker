export interface PlaceResult {
  lat: number;
  lon: number;
  label: string;
}

// Dublin city + county bounding box, used to bias/limit search results.
const DUBLIN_VIEWBOX = '-6.6,53.65,-6.0,53.15'; // left,top,right,bottom

/**
 * Free-text place search via OpenStreetMap's public Nominatim API — no API key,
 * no account. Runs entirely in the visitor's own browser (not this build), so
 * it's unaffected by any sandbox/dev-environment network restrictions.
 * Respects Nominatim's usage policy: debounce the caller side, one request at
 * a time, and this is a low-volume personal app.
 */
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('q', q);
  url.searchParams.set('viewbox', DUBLIN_VIEWBOX);
  url.searchParams.set('bounded', '1');
  url.searchParams.set('countrycodes', 'ie');
  url.searchParams.set('limit', '6');

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    return data.map((d) => ({ lat: parseFloat(d.lat), lon: parseFloat(d.lon), label: d.display_name }));
  } catch {
    // Offline, blocked, or rate-limited — the map pin/current-location fallback still works.
    return [];
  }
}
