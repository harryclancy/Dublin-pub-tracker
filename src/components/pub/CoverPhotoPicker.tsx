import { useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { compressForStorage, blobToDataUrl } from '../../lib/photos';
import { PubImage } from '../ui/PubImage';

interface CoverPhotoPickerProps {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  pubName: string;
}

/** A single cover/exterior photo the user supplies for a pub — used when no
 * exterior shot is available from the seed data. Compressed the same way
 * drink photos are, so it doesn't bloat IndexedDB or backup exports. Omitting
 * the `capture` attribute lets iOS/Android show their native "Camera or
 * Photo Library" picker, so one button covers both. */
export function CoverPhotoPicker({ value, onChange, pubName }: CoverPhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const compressed = await compressForStorage(file);
      const dataUrl = await blobToDataUrl(compressed);
      onChange(dataUrl);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <PubImage src={value} name={pubName} className="h-16 w-16 rounded-xl" iconSize={20} />
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-xs font-semibold text-ink disabled:opacity-60"
        >
          <Camera size={13} />
          {busy ? 'Processing…' : value ? 'Change photo' : 'Add photo'}
        </button>
        {value && (
          <button type="button" onClick={() => onChange(null)} className="flex items-center gap-1 text-xs font-medium text-red-600">
            <X size={12} /> Remove
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
