import { Directory, File, Paths } from 'expo-file-system';

/** Copia la foto elegida a un directorio persistente de la app y devuelve su URI. */
export async function persistPhoto(uri: string, folder = 'medications'): Promise<string> {
  const dir = new Directory(Paths.document, folder);
  dir.create({ idempotent: true, intermediates: true });
  const ext = /\.(\w{2,5})(\?.*)?$/.exec(uri)?.[1] ?? 'jpg';
  const dest = new File(dir, `${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`);
  await new File(uri).copy(dest);
  return dest.uri;
}

export function deletePhoto(uri: string | null | undefined) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Archivo ya inexistente: nada que limpiar.
  }
}
