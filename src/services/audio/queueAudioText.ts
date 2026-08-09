// Module pemformatan teks pengumuman suara antrean DPPKB Majene
// Aturan Wajib: "KB" TIDAK BOLEH diucapkan sebagai singkatan, WAJIB "Pelayanan Keluarga Berencana"

export type ServiceGroupKey = 'KB' | 'SK';

export const SERVICE_SPEECH_LABELS: Record<string, string> = {
  KB: 'Pelayanan Keluarga Berencana',
  SK: 'Pelayanan Sekretariat'
};

export const SERVICE_DISPLAY_LABELS: Record<string, string> = {
  KB: 'Pelayanan KB',
  SK: 'Pelayanan Sekretariat'
};

/**
 * Mendapatkan teks pengucapan nama pelayanan yang resmi & utuh.
 */
export function getServiceSpeechLabel(serviceGroup?: string, serviceTitle?: string): string {
  const normalizedGroup = (serviceGroup || '').toUpperCase();
  if (normalizedGroup === 'KB' || normalizedGroup.startsWith('KB') || normalizedGroup.startsWith('A')) {
    return SERVICE_SPEECH_LABELS.KB;
  }
  if (normalizedGroup === 'SK' || normalizedGroup.startsWith('SK') || normalizedGroup.startsWith('B')) {
    return SERVICE_SPEECH_LABELS.SK;
  }

  const title = (serviceTitle || '').toLowerCase();
  if (/keluarga|berencana|kontrasepsi|stunting|kia/.test(title)) {
    return SERVICE_SPEECH_LABELS.KB;
  }
  if (/sekretariat|sekretariatan|surat|administrasi|rekomendasi/.test(title)) {
    return SERVICE_SPEECH_LABELS.SK;
  }

  return SERVICE_SPEECH_LABELS.KB;
}

/**
 * Memformat ucapan kode antrean digit per digit.
 * Contoh: "A-001" -> letterSpoken: "A", digitsSpoken: "nol nol satu"
 */
export function formatCodeSpoken(code: string): { letterSpoken: string; digitsSpoken: string; inferredGroup: ServiceGroupKey } {
  const [rawPrefix = '', rawNumber = ''] = code.split('-');
  const prefix = rawPrefix.toUpperCase();
  const inferredGroup: ServiceGroupKey = (prefix === 'B' || prefix === 'SK' || prefix.startsWith('B')) ? 'SK' : 'KB';

  const digitWords: Record<string, string> = {
    '0': 'nol',
    '1': 'satu',
    '2': 'dua',
    '3': 'tiga',
    '4': 'empat',
    '5': 'lima',
    '6': 'enam',
    '7': 'tujuh',
    '8': 'delapan',
    '9': 'sembilan'
  };

  const digitsSpoken = rawNumber
    .split('')
    .map(digit => digitWords[digit] || digit)
    .join(' ');

  return {
    letterSpoken: inferredGroup === 'SK' ? 'B' : 'A',
    digitsSpoken: digitsSpoken || 'nol nol satu',
    inferredGroup
  };
}

/**
 * Membersihkan nama loket agar enak dan alami diucapkan.
 * Contoh: "Loket 1 (Pelayanan KB)" -> "Loket satu"
 */
export function cleanCounterNameSpoken(counterName: string): string {
  const wordNumbers: Record<string, string> = {
    '1': 'satu',
    '2': 'dua',
    '3': 'tiga',
    '4': 'empat',
    '5': 'lima',
    '6': 'enam',
    '7': 'tujuh',
    '8': 'delapan',
    '9': 'sembilan',
    '10': 'sepuluh'
  };

  let cleaned = counterName
    .replace(/,?\s*Pelayanan\s*(Keluarga\s*Berencana|Sekretariat|KB|SK).*/i, '')
    .replace(/\(.*\)/, '')
    .replace(/-\s*Pelayanan.*/i, '')
    .trim();

  // Ubah "Loket 1" menjadi "Loket satu"
  cleaned = cleaned.replace(/\b(\d+)\b/g, (_, num) => wordNumbers[num] || num);

  return cleaned || 'Loket satu';
}

/**
 * Membangun naskah teks pengumuman suara lengkap.
 */
export function buildAnnouncementText(
  ticketCode: string,
  counterName: string,
  serviceTitle?: string,
  serviceGroup?: string
): string {
  const { letterSpoken, digitsSpoken } = formatCodeSpoken(ticketCode);
  const counterSpoken = cleanCounterNameSpoken(counterName);
  const serviceSpeech = getServiceSpeechLabel(serviceGroup, serviceTitle);

  return `Nomor antrean ${letterSpoken} ${digitsSpoken}. Silakan menuju ${counterSpoken}. ${serviceSpeech}.`;
}
