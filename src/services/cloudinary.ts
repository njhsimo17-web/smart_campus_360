const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface CloudinaryUploadResponse {
  secure_url?: string;
  error?: { message?: string };
}

export async function uploadProfileImage(file: File): Promise<string> {
  if (file.size > MAX_IMAGE_SIZE) throw new Error('Image too large. Maximum size is 2 MB.');
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) throw new Error('Unsupported format. Use JPG, JPEG, PNG, or WEBP.');

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) throw new Error('Cloudinary upload failed: configuration is missing.');

  const body = new FormData();
  body.append('file', file);
  body.append('upload_preset', uploadPreset);

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body });
    const result = await response.json() as CloudinaryUploadResponse;
    if (!response.ok || !result.secure_url) throw new Error(result.error?.message || 'No secure image URL was returned.');
    return result.secure_url;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown upload error.';
    throw new Error(`Cloudinary upload failed: ${message}`);
  }
}
