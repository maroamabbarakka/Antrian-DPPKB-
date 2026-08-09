// generate-voice-assets.mjs
// Script Node.js untuk menghasilkan berkas WAV voice lokal menggunakan
// Google TTS (sekali saja — offline setelah ini). Tidak perlu di-run ulang.
// Berkas disimpan di public/audio/queue/**
//
// Cara menjalankan: node generate-voice-assets.mjs

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_BASE = path.join(__dirname, 'public', 'audio', 'queue');

/** Semua teks yang perlu di-download */
const ASSETS = [
  // Frasa
  { key: 'phrases/nomor-antrean',            text: 'Nomor antrean' },
  { key: 'phrases/silakan-menuju',           text: 'Silakan menuju Loket' },
  { key: 'phrases/pelayanan-keluarga-berencana', text: 'Pelayanan Keluarga Berencana' },
  { key: 'phrases/pelayanan-sekretariat',    text: 'Pelayanan Sekretariat' },

  // Huruf tiket
  { key: 'letters/a', text: 'A' },
  { key: 'letters/b', text: 'B' },
  { key: 'letters/c', text: 'C' },
  { key: 'letters/d', text: 'D' },
  { key: 'letters/e', text: 'E' },

  // Digit 0-9
  { key: 'digits/nol',      text: 'nol' },
  { key: 'digits/satu',     text: 'satu' },
  { key: 'digits/dua',      text: 'dua' },
  { key: 'digits/tiga',     text: 'tiga' },
  { key: 'digits/empat',    text: 'empat' },
  { key: 'digits/lima',     text: 'lima' },
  { key: 'digits/enam',     text: 'enam' },
  { key: 'digits/tujuh',    text: 'tujuh' },
  { key: 'digits/delapan',  text: 'delapan' },
  { key: 'digits/sembilan', text: 'sembilan' },

  // Loket
  { key: 'counters/loket',    text: 'Loket' },
  { key: 'counters/satu',     text: 'satu' },
  { key: 'counters/dua',      text: 'dua' },
  { key: 'counters/tiga',     text: 'tiga' },
  { key: 'counters/empat',    text: 'empat' },
  { key: 'counters/lima',     text: 'lima' },
  { key: 'counters/enam',     text: 'enam' },
  { key: 'counters/tujuh',    text: 'tujuh' },
  { key: 'counters/delapan',  text: 'delapan' },
  { key: 'counters/sembilan', text: 'sembilan' },
  { key: 'counters/sepuluh',  text: 'sepuluh' },
];

function buildGoogleTtsUrl(text) {
  const params = new URLSearchParams({
    ie: 'UTF-8', client: 'tw-ob', tl: 'id', q: text
  });
  return `https://translate.google.com/translate_tts?${params.toString()}`;
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(destPath)) { resolve('SKIP'); return; }

    const file = fs.createWriteStream(destPath);
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://translate.google.com/'
      }
    };

    https.get(url, options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`HTTP ${res.statusCode} untuk: ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve('OK'); });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

async function main() {
  console.log('📥 Mengunduh voice assets ke public/audio/queue/...\n');

  let ok = 0, skip = 0, fail = 0;

  for (const asset of ASSETS) {
    const destPath = path.join(OUTPUT_BASE, asset.key + '.wav');
    const url = buildGoogleTtsUrl(asset.text);

    try {
      const status = await downloadFile(url, destPath);
      if (status === 'SKIP') {
        console.log(`  ⏭  SKIP  ${asset.key}.wav (sudah ada)`);
        skip++;
      } else {
        console.log(`  ✅ OK    ${asset.key}.wav`);
        ok++;
      }
      // Jeda kecil agar tidak kena rate limit
      await new Promise(r => setTimeout(r, 350));
    } catch (err) {
      console.error(`  ❌ FAIL  ${asset.key}.wav — ${err.message}`);
      fail++;
    }
  }

  console.log(`\n📊 Selesai: ${ok} OK, ${skip} Skip, ${fail} Gagal dari ${ASSETS.length} berkas`);

  if (fail > 0) {
    console.warn('\n⚠ Beberapa berkas gagal. Jalankan ulang untuk retry.');
    process.exit(1);
  } else {
    console.log('\n🎉 Semua voice assets siap di public/audio/queue/');
  }
}

main().catch(console.error);
