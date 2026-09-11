import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import { LocateFixed, Search, X } from 'lucide-react';
import { searchPlaces, type PlaceResult } from '../../lib/geocode';
import { wantIcon } from '../map/markerIcons';

interface LocationPickerProps {
  lat: number;
  lon: number;
  onChange: (lat: number, lon: number) => void;
}

function ClickToPlace({ onPlace }: { onPlace: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onPlace(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function LocationPicker({ lat, lon, onChange }: LocationPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const found = await searchPlaces(query);
      setResults(found);
      setSearching(false);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function selectResult(r: PlaceResult) {
    onChange(r.lat, r.lon);
    mapRef.current?.flyTo([r.lat, r.lon], 17, { duration: 0.6 });
    setResults([]);
    setQuery(r.label);
  }

  function useCurrentLocation() {
    if (!('geolocation' in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(pos.coords.latitude, pos.coords.longitude);
        mapRef.current?.flyTo([pos.coords.latitude, pos.coords.longitude], 17, { duration: 0.6 });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for the pub or its address…"
          className="h-11 w-full rounded-xl border border-line bg-white pl-9 pr-8 text-sm focus:border-brand-600 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
        {(results.length > 0 || searching) && (
          <div className="absolute inset-x-0 top-12 z-10 max-h-48 overflow-y-auto rounded-xl border border-line bg-white shadow-pop">
            {searching && <div className="px-3 py-2.5 text-xs text-ink-soft">Searching…</div>}
            {!searching &&
              results.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectResult(r)}
                  className="block w-full truncate border-b border-line/60 px-3 py-2.5 text-left text-xs text-ink last:border-0 hover:bg-black/5"
                >
                  {r.label}
                </button>
              ))}
          </div>
        )}
      </div>

      <div className="relative h-52 w-full overflow-hidden rounded-xl">
        <MapContainer
          center={[lat, lon]}
          zoom={16}
          className="h-full w-full"
          ref={mapRef}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={[lat, lon]} icon={wantIcon} />
          <ClickToPlace onPlace={onChange} />
        </MapContainer>
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          className="absolute bottom-2 right-2 z-[400] flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-card active:scale-90"
          aria-label="Use my current location"
        >
          <LocateFixed size={16} className={locating ? 'animate-pulse text-brand-700' : 'text-ink'} />
        </button>
      </div>
      <p className="text-[11px] text-ink-soft">Tap the map to fine-tune the pin, or search above.</p>
    </div>
  );
}
