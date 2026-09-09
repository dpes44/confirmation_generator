'use client';

/** Thin fetch wrapper: unwraps { data } / { error } and redirects on 401. */
export async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });

  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Session expired.');
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status}).`);
  return body?.data as T;
}

/** Reads an image file into a data URI, rejecting anything too large to store. */
export function fileToDataUri(file: File, maxBytes = 900_000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file (PNG, JPG, or WebP).'));
      return;
    }
    if (file.size > maxBytes) {
      reject(new Error(`That image is ${(file.size / 1024).toFixed(0)} KB. Please use one under ${Math.round(maxBytes / 1024)} KB.`));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}
