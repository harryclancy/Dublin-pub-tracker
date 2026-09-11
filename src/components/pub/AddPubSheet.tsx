import { lazy, Suspense, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomSheet } from '../ui/BottomSheet';
import { addCustomPub } from '../../db/actions';
import { nearestArea } from '../../lib/areas';
import { useToast } from '../ui/Toast';
import { usePubData } from '../../context/PubDataContext';

// Leaflet + react-leaflet are sizeable — only fetched once someone actually
// opens this sheet, instead of bloating every page's initial bundle.
const LocationPicker = lazy(() => import('./LocationPicker').then((m) => ({ default: m.LocationPicker })));

interface AddPubSheetProps {
  open: boolean;
  onClose: () => void;
  /** Optional starting coordinates, e.g. the map's current centre. */
  initialLat?: number;
  initialLon?: number;
}

const DUBLIN_CENTER = { lat: 53.3498, lon: -6.2603 };

export function AddPubSheet({ open, onClose, initialLat, initialLon }: AddPubSheetProps) {
  const { userLocation } = usePubData();
  const start = { lat: initialLat ?? userLocation?.lat ?? DUBLIN_CENTER.lat, lon: initialLon ?? userLocation?.lon ?? DUBLIN_CENTER.lon };

  const [name, setName] = useState('');
  const [lat, setLat] = useState(start.lat);
  const [lon, setLon] = useState(start.lon);
  const [area, setArea] = useState('');
  const [address, setAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const suggestedArea = nearestArea(lat, lon);

  function reset() {
    setName('');
    setLat(start.lat);
    setLon(start.lon);
    setArea('');
    setAddress('');
    setWebsite('');
    setPhone('');
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    const pub = await addCustomPub({
      name,
      lat,
      lon,
      area: area.trim() || undefined,
      address: address || undefined,
      website: website || undefined,
      phone: phone || undefined,
    });
    setSaving(false);
    toast.show(`${pub.name} added`);
    reset();
    onClose();
    navigate(`/pub/${pub.id}`);
  }

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Add a Pub"
      maxHeight="92vh"
    >
      <div className="space-y-5 pb-6">
        <p className="text-xs text-ink-soft">
          Our list is a great start but isn't every pub in Dublin. Add one that's missing — it'll behave exactly
          like any other pub: ratings, visits, photos, the lot.
        </p>

        <Field label="Pub name">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. The Bald Eagle"
            className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm focus:border-brand-600 focus:outline-none"
          />
        </Field>

        <Field label="Location">
          <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-xl bg-black/[0.06]" />}>
            <LocationPicker lat={lat} lon={lon} onChange={(newLat, newLon) => { setLat(newLat); setLon(newLon); }} />
          </Suspense>
        </Field>

        <Field label={`Area (suggested: ${suggestedArea.name})`}>
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder={suggestedArea.name}
            className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm focus:border-brand-600 focus:outline-none"
          />
        </Field>

        <Field label="Address (optional)">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm focus:border-brand-600 focus:outline-none"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Website (optional)">
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://…"
              className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm focus:border-brand-600 focus:outline-none"
            />
          </Field>
          <Field label="Phone (optional)">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm focus:border-brand-600 focus:outline-none"
            />
          </Field>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="w-full rounded-xl bg-brand-800 py-3.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? 'Adding…' : 'Add Pub'}
        </button>
      </div>
    </BottomSheet>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</div>
      {children}
    </div>
  );
}
