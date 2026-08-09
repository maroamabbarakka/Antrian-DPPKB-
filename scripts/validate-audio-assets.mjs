// scripts/validate-audio-assets.mjs
// Script validasi otomatis untuk berkas audio sebelum build (Dokumen 10 P0 #24)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const QUEUE_AUDIO_DIR = path.join(ROOT_DIR, 'public', 'audio', 'queue');

// Daftar 30 file audio yang wajib ada
const REQUIRED_FILES = [
  'phrases/nomor-antrean.wav',
  'phrases/silakan-menuju.wav',
  'phrases/pelayanan-keluarga-berencana.wav',
  'phrases/pelayanan-sekretariat.wav',
  'letters/a.wav', 'letters/b.wav', 'letters/c.wav', 'letters/d.wav', 'letters/e.wav',
  'digits/nol.wav', 'digits/satu.wav', 'digits/dua.wav', 'digits/tiga.wav', 'digits/empat.wav',
  'digits/lima.wav', 'digits/enam.wav', 'digits/tujuh.wav', 'digits/delapan.wav', 'digits/sembilan.wav',
  'counters/loket.wav', 'counters/satu.wav', 'counters/dua.wav', 'counters/tiga.wav', 'counters/empat.wav',
  'counters/lima.wav', 'counters/enam.wav', 'counters/tujuh.wav', 'counters/delapan.wav', 'counters/sembilan.wav', 'counters/sepuluh.wav'
];

console.log('🔍 [VALIDATE-AUDIO] Memeriksa keberadaan & integritas berkas audio lokal...\n');

let passCount = 0;
let failCount = 0;

for (const relPath of REQUIRED_FILES) {
  const fullPath = path.join(QUEUE_AUDIO_DIR, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ MISSING: public/audio/queue/${relPath}`);
    failCount++;
    continue;
  }

  const stat = fs.statSync(fullPath);
  if (stat.size < 500) {
    console.error(`❌ INVALID (Size < 500 bytes): public/audio/queue/${relPath} (${stat.size} bytes)`);
    failCount++;
    continue;
  }

  // Verifikasi Magic Header RIFF/WAVE (Genuine PCM WAV)
  try {
    const buf = Buffer.alloc(12);
    const fd = fs.openSync(fullPath, 'r');
    fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);

    const riff = buf.toString('ascii', 0, 4);
    const wave = buf.toString('ascii', 8, 12);
    if (riff !== 'RIFF' || wave !== 'WAVE') {
      console.error(`❌ INVALID WAV HEADER (${riff}/${wave}): public/audio/queue/${relPath}`);
      failCount++;
      continue;
    }
  } catch (err) {
    console.error(`❌ FILE READ ERROR: public/audio/queue/${relPath} — ${err.message}`);
    failCount++;
    continue;
  }

  passCount++;
}

if (failCount > 0) {
  console.error(`\n⛔ [VALIDATE-AUDIO] FAILED: ${failCount} berkas bermasalah dari ${REQUIRED_FILES.length}.`);
  process.exit(1);
} else {
  console.log(`✅ [VALIDATE-AUDIO] PASS: Seluruh ${passCount} berkas audio terverifikasi & siap.`);
}
