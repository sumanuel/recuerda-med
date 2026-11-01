import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatLongDate } from './time';

type RecipeDocument = {
  date: number;
  doctor: string;
  specialty: string;
  notes: string;
  medications: string[];
  photoUris: string[];
};

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function mimeOf(uri: string): string {
  const ext = /\.(\w{2,5})(\?.*)?$/.exec(uri)?.[1]?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

async function ensureSharing() {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Este dispositivo no permite compartir archivos.');
  }
}

/** Genera un PDF con los datos de la cita y una página por foto, y abre el menú de compartir. */
export async function shareRecipePdf(doc: RecipeDocument): Promise<void> {
  await ensureSharing();

  // iOS y Android no cargan imágenes locales en el HTML del PDF: se incrustan en base64.
  const pages: string[] = [];
  for (const uri of doc.photoUris) {
    const base64 = await new File(uri).base64();
    pages.push(
      `<div class="page"><img src="data:${mimeOf(uri)};base64,${base64}" /></div>`,
    );
  }

  const title = doc.doctor || doc.specialty || 'Cita médica';
  const rows = [
    doc.doctor && doc.specialty ? `<p class="sub">${escapeHtml(doc.specialty)}</p>` : '',
    `<p class="sub">${escapeHtml(formatLongDate(doc.date))}</p>`,
    doc.medications.length
      ? `<h2>Medicamentos</h2><ul>${doc.medications.map((m) => `<li>${escapeHtml(m)}</li>`).join('')}</ul>`
      : '',
    doc.notes ? `<h2>Notas</h2><p class="notes">${escapeHtml(doc.notes)}</p>` : '',
  ].join('');

  const html = `<html><head><meta charset="utf-8" /><style>
    body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; }
    .cover { padding: 36px; }
    h1 { margin: 0 0 4px; color: #0f766e; font-size: 26px; }
    h2 { margin: 22px 0 6px; font-size: 15px; text-transform: uppercase; letter-spacing: .5px; color: #64748b; }
    .sub { margin: 2px 0; font-size: 16px; }
    .notes { white-space: pre-wrap; font-size: 15px; }
    li { font-size: 15px; margin: 2px 0; }
    .page { page-break-before: always; text-align: center; padding: 24px; }
    img { max-width: 100%; max-height: 760px; object-fit: contain; }
  </style></head><body>
    <div class="cover"><h1>${escapeHtml(title)}</h1>${rows}</div>${pages.join('')}
  </body></html>`;

  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });

  // Nombre legible para el archivo compartido.
  const d = new Date(doc.date);
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const named = new File(Paths.cache, `Receta-${stamp}.pdf`);
  await new File(uri).copy(named, { overwrite: true });

  await Sharing.shareAsync(named.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Compartir receta',
  });
}

export async function shareImage(uri: string): Promise<void> {
  await ensureSharing();
  await Sharing.shareAsync(uri, { mimeType: mimeOf(uri), UTI: 'public.image', dialogTitle: 'Compartir foto' });
}
