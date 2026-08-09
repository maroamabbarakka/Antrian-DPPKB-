// generate-voice-assets.mjs
// Script Node.js untuk mendownload dan menyimpan berkas WAV voice lokal
// Memastikan frasa 'silakan-menuju' adalah "Silakan menuju" (tanpa kata Loket)

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_BASE = path.join(__dirname, 'public', 'audio', 'queue');

/** Semua teks yang perlu di-download */
const ASSETS = [
  // Frasa (PERBAIKAN P0: 'silakan-menuju' = 'Silakan menuju', tanpa kata 'Loket')
  { key: 'phrases/nomor-antrean',            text: 'Nomor antrean' },
  { key: 'phrases/silakan-menuju',           text: 'Silakan menuju' },
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

import { execSync } from 'child_process';

function buildGoogleTtsUrl(text) {
  const params = new URLSearchParams({
    ie: 'UTF-8', client: 'tw-ob', tl: 'id', q: text
  });
  return `https://translate.google.com/translate_tts?${params.toString()}`;
}

/** Memeriksa apakah file adalah Genuine PCM WAV (RIFF/WAVE header) */
function isGenuineWav(filePath) {
  if (!fs.existsSync(filePath)) return false;
  try {
    const buf = Buffer.alloc(12);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);
    return buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE';
  } catch {
    return false;
  }
}

function downloadAndTranscode(url, destWavPath, force = false) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destWavPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (!force && isGenuineWav(destWavPath)) {
      resolve('SKIP');
      return;
    }

    const tempMp3Path = destWavPath + '.temp.mp3';
    const file = fs.createWriteStream(tempMp3Path);
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://translate.google.com/'
      }
    };

    https.get(url, options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        if (fs.existsSync(tempMp3Path)) fs.unlinkSync(tempMp3Path);
        downloadAndTranscode(res.headers.location, destWavPath, force).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        if (fs.existsSync(tempMp3Path)) fs.unlinkSync(tempMp3Path);
        reject(new Error(`HTTP ${res.statusCode} untuk: ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        try {
          // Transcode temp MP3 ke Genuine PCM WAV (Mono, 44100Hz, 16-bit PCM)
          execSync(`ffmpeg -y -i "${tempMp3Path}" -ac 1 -ar 44100 -c:a pcm_s16le "${destWavPath}"`, {
            stdio: 'ignore'
          });

          // Hapus temp MP3
          if (fs.existsSync(tempMp3Path)) fs.unlinkSync(tempMp3Path);

          // Verifikasi hasil transcode
          if (isGenuineWav(destWavPath)) {
            resolve('OK');
          } else {
            reject(new Error('TRANSCODE_FAILED_NOT_GENUINE_WAV'));
          }
        } catch (ffmpegErr) {
          if (fs.existsSync(tempMp3Path)) fs.unlinkSync(tempMp3Path);
          reject(new Error(`FFmpeg Transcode Error: ${ffmpegErr.message}`));
        }
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(tempMp3Path)) fs.unlinkSync(tempMp3Path);
      reject(err);
    });
  });
}

async function main() {
  const force = process.argv.includes('--force');
  console.log(`📥 Mengunduh & Mentranscode voice assets ke Genuine PCM WAV di public/audio/queue/...${force ? ' (FORCE ALL)' : ''}\n`);

  let ok = 0, skip = 0, fail = 0;

  for (const asset of ASSETS) {
    const destPath = path.join(OUTPUT_BASE, asset.key + '.wav');
    const url = buildGoogleTtsUrl(asset.text);

    try {
      const status = await downloadAndTranscode(url, destPath, force);
      if (status === 'SKIP') {
        console.log(`  ⏭  SKIP  ${asset.key}.wav (sudah Genuine PCM WAV)`);
        skip++;
      } else {
        console.log(`  ✅ OK    ${asset.key}.wav (Genuine PCM WAV)`);
        ok++;
      }
      await new Promise(r => setTimeout(r, 150));
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
    console.log('\n🎉 Semua 30 voice assets terverifikasi sebagai Genuine PCM WAV di public/audio/queue/');
  }
}

main().catch(console.error);
