import { useEffect, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024;

interface ProfileImageUploadProps {
  file: File | null;
  onChange: (file: File | null) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

export default function ProfileImageUpload({ file, onChange, onError, disabled }: ProfileImageUploadProps) {
  const [preview, setPreview] = useState('');

  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function selectFile(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (!selected) return;
    if (selected.size > MAX_SIZE) { onError('Image too large. Maximum size is 2 MB.'); return; }
    if (!ALLOWED_TYPES.includes(selected.type)) { onError('Unsupported image format. Please select a JPG, JPEG, PNG, or WEBP image.'); return; }
    onError('');
    onChange(selected);
  }

  return <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 p-4">
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      {preview ? <img src={preview} alt="Profile preview" className="h-24 w-24 rounded-2xl object-cover" /> : <div className="grid h-24 w-24 place-items-center rounded-2xl bg-slate-800 text-slate-500"><ImagePlus size={28}/></div>}
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-200">Profile picture <span className="font-normal text-slate-500">(optional)</span></p>
        <p className="mt-1 text-xs text-slate-500">JPG, JPEG, PNG or WEBP · maximum 2 MB</p>
        <div className="mt-3 flex gap-2">
          <label className="cursor-pointer rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:border-cyan-500/50">
            Choose image<input type="file" accept="image/*" className="sr-only" onChange={selectFile} disabled={disabled}/>
          </label>
          {file && <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-rose-300"><X size={15}/>Remove</button>}
        </div>
      </div>
    </div>
  </div>;
}
