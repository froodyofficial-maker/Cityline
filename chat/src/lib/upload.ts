import { config, UPLOAD_LIMITS } from './config';
import { supabase } from './supabase';
import type { Attachment, NeonTier } from './types';
import { fileSize, uuid } from './utils';

export const BUCKET = 'media';

export function uploadLimit(tier: NeonTier) {
  return tier === 'neon' ? UPLOAD_LIMITS.neon : tier === 'lite' ? UPLOAD_LIMITS.lite : UPLOAD_LIMITS.free;
}

export function checkSize(file: File, tier: NeonTier) {
  const max = uploadLimit(tier);
  if (file.size > max) {
    throw new Error(`${file.name} is ${fileSize(file.size)} — the limit is ${fileSize(max)}${tier !== 'neon' ? ' (Neon raises it to 50 MB)' : ''}`);
  }
}

function safeName(name: string) {
  const clean = name.normalize('NFKD').replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').slice(-80);
  return clean || 'file';
}

async function dimensions(file: File): Promise<{ width?: number; height?: number; duration?: number }> {
  const url = URL.createObjectURL(file);
  try {
    if (file.type.startsWith('image/')) {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { width: img.naturalWidth, height: img.naturalHeight };
    }
    if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
      const el = document.createElement(file.type.startsWith('video/') ? 'video' : 'audio');
      el.preload = 'metadata';
      el.src = url;
      await new Promise<void>((res) => { el.onloadedmetadata = () => res(); el.onerror = () => res(); setTimeout(res, 4000); });
      const v = el as HTMLVideoElement;
      return { width: v.videoWidth || undefined, height: v.videoHeight || undefined, duration: Number.isFinite(el.duration) ? el.duration : undefined };
    }
  } catch { /* ignore */ } finally {
    URL.revokeObjectURL(url);
  }
  return {};
}

export function publicUrl(path: string) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Uploads into media/<user id>/<folder>/… and reports progress (0–1). */
export async function uploadFile(file: File | Blob, folder: string, onProgress?: (p: number) => void, name?: string): Promise<Attachment> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');
  const fileName = name ?? (file instanceof File ? file.name : 'file');
  const path = `${session.user.id}/${folder}/${uuid()}/${safeName(fileName)}`;
  const type = file.type || 'application/octet-stream';
  const meta = file instanceof File ? await dimensions(file) : {};
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${config.supabaseUrl}/storage/v1/object/${BUCKET}/${path}`);
    xhr.setRequestHeader('authorization', `Bearer ${session.access_token}`);
    xhr.setRequestHeader('apikey', config.supabaseAnonKey);
    xhr.setRequestHeader('content-type', type);
    xhr.setRequestHeader('cache-control', 'max-age=31536000');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        let msg = `Upload failed (${xhr.status})`;
        try { msg = JSON.parse(xhr.responseText).message || msg; } catch { /* keep */ }
        if (/maximum allowed size|too large|Payload/i.test(msg)) msg = 'That file is larger than your storage bucket allows (see SUPABASE_SETUP.md).';
        if (/Bucket not found/i.test(msg)) msg = 'Storage bucket "media" is missing — re-run supabase/schema.sql.';
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed — check your connection'));
    xhr.send(file);
  });
  onProgress?.(1);
  return { url: publicUrl(path), name: fileName, size: file.size, type, ...meta };
}

export async function removeUploaded(url: string) {
  const marker = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return;
  await supabase.storage.from(BUCKET).remove([decodeURIComponent(url.slice(i + marker.length))]);
}

/** Crops/resizes an image file to a square (avatars, icons, emoji). GIFs are kept as-is to stay animated. */
export async function squareImage(file: File, size = 512): Promise<File> {
  if (file.type === 'image/gif' || !file.type.startsWith('image/')) return file;
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.min(size, s);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/webp', 0.9));
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' });
}

export async function bannerImage(file: File, w = 1200, h = 480): Promise<File> {
  if (file.type === 'image/gif' || !file.type.startsWith('image/')) return file;
  const bmp = await createImageBitmap(file);
  const ratio = w / h;
  let sw = bmp.width, sh = bmp.width / ratio;
  if (sh > bmp.height) { sh = bmp.height; sw = sh * ratio; }
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, 0, 0, w, h);
  const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/webp', 0.88));
  return new File([blob], 'banner.webp', { type: 'image/webp' });
}
