import { doc, setDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { Ticket, ServiceItem, Counter, Announcement, MediaItem } from "../types/queue";

// Master data awal default DPPKB Majene
export const INITIAL_SERVICES: ServiceItem[] = [
  // Kelompok Pelayanan KB (Kode Awalan A)
  {
    id: "srv-kb-01",
    codeGroup: "KB",
    title: "Konseling & Edukasi Bangga Kencana",
    description: "Konseling perencanaan keluarga, kesehatan reproduksi, dan metode kontrasepsi.",
    requirements: ["KTP/Kartu Keluarga (jika ada)", "Kartu Berobat (jika ada)"],
    slaMinutes: 15,
    fee: "Gratis",
    targetCounter: "Loket 1 (Pelayanan KB)",
    active: true
  },
  {
    id: "srv-kb-02",
    codeGroup: "KB",
    title: "Pelayanan Kontrasepsi Ulang & Rujukan",
    description: "Pelayanan lanjutan dan informasi fasilitas kesehatan rujukan KB di Majene.",
    requirements: ["KTP / Kartu Identitas", "Kartu Peserta KB"],
    slaMinutes: 10,
    fee: "Gratis",
    targetCounter: "Loket 1 (Pelayanan KB)",
    active: true
  },
  {
    id: "srv-kb-03",
    codeGroup: "KB",
    title: "Konseling Pendampingan Stunting & Ibu Hamil",
    description: "Edukasi 1.000 HPK dan pendampingan calon pengantin / ibu hamil.",
    requirements: ["Buku KIA / Dokumen Elsimil (bila ada)"],
    slaMinutes: 20,
    fee: "Gratis",
    targetCounter: "Loket 2 (Konseling Keluarga)",
    active: true
  },

  // Kelompok Pelayanan Sekretariat (Kode Awalan B)
  {
    id: "srv-sk-01",
    codeGroup: "SK",
    title: "Pengurusan Surat Masuk & Rekomendasi Dinas",
    description: "Penyerahan berkas persuratan, rekomendasi, dan permohonan dinas.",
    requirements: ["Surat Pengantar / Naskah Dinas Resmi"],
    slaMinutes: 10,
    fee: "Gratis",
    targetCounter: "Loket 3 (Pelayanan Sekretariat)",
    active: true
  },
  {
    id: "srv-sk-02",
    codeGroup: "SK",
    title: "Konsultasi Pegawai & Layanan Administrasi Umum",
    description: "Layanan Kepegawaian, Magang, dan Informasi Kehumasan DPPKB.",
    requirements: ["Kartu Identitas / KTP"],
    slaMinutes: 15,
    fee: "Gratis",
    targetCounter: "Loket 4 (Administrasi Umum)",
    active: true
  }
];

export const INITIAL_COUNTERS: Counter[] = [
  { id: "counter-1", name: "Loket 1", handledGroup: "KB", active: true, status: "OPEN" },
  { id: "counter-2", name: "Loket 2", handledGroup: "KB", active: true, status: "OPEN" },
  { id: "counter-3", name: "Loket 3", handledGroup: "SK", active: true, status: "OPEN" },
  { id: "counter-4", name: "Loket 4", handledGroup: "ALL", active: true, status: "OPEN" }
];

export const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "ann-1",
    title: "Pelayanan Gratis Tanpa Pungutan Biaya",
    content: "Seluruh pelayanan Keluarga Berencana dan Sekretariat di DPPKB Majene GRATIS tanpa dipungut biaya apapun.",
    category: "INFORMASI",
    active: true,
    order: 1
  },
  {
    id: "ann-2",
    title: "Program 1.000 Hari Pertama Kehidupan",
    content: "Cegah Stunting sejak dini! Manfaatkan konseling kesehatan reproduksi dan pendampingan keluarga di DPPKB Kabupaten Majene.",
    category: "PROGRAM",
    active: true,
    order: 2
  },
  {
    id: "ann-3",
    title: "Kanal Pengaduan Resmi",
    content: "Sampaikan saran & pengaduan pelayanan Anda melalui Layanan Aspirasi dan Pengaduan Online Rakyat (SP4N-LAPOR!) atau kontak dinas.",
    category: "INFORMASI",
    active: true,
    order: 3
  }
];

export const INITIAL_MEDIA: MediaItem[] = [
  {
    id: "med-1",
    title: "Infografis DPPKB Majene 2026",
    sourceType: "CLOUD_MP4",
    url: "https://dppkb-2026.web.app/Galeri%20Video/Infografis%20DPPKB%20Majene%202026.mp4",
    offlineRequired: true,
    active: true,
    durationSec: 120
  },
  {
    id: "med-yt-playlist",
    title: "Playlist Edukasi Bangga Kencana BKKBN Official",
    sourceType: "YOUTUBE",
    url: "https://www.youtube.com/embed/videoseries?list=PL2yRHg1b-nodI3kfIn5H5ufWHMEMykIKz",
    offlineRequired: false,
    active: true,
    durationSec: 300
  },
  {
    id: "med-2",
    title: "Sosialisasi 1.000 Hari Pertama Kehidupan & Stunting",
    sourceType: "CLOUD_MP4",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    offlineRequired: false,
    active: true,
    durationSec: 90
  },
  {
    id: "med-3",
    title: "Video Profile Pelayanan Publik DPPKB Majene",
    sourceType: "CLOUD_MP4",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    offlineRequired: false,
    active: true,
    durationSec: 120
  }
];

export function getTodayStrWITA(): string {
  const options = { timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit' } as const;
  const formatter = new Intl.DateTimeFormat('en-CA', options);
  return formatter.format(new Date());
}

class QueueService {
  public calculateEstimatedWait(ticketsInFront: number, activeCountersCount: number, slaMinutes: number = 12): { minMinutes: number; maxMinutes: number; text: string } {
    if (ticketsInFront <= 0) {
      return { minMinutes: 0, maxMinutes: 2, text: "Segera dipanggil" };
    }
    const counters = Math.max(1, activeCountersCount);
    const estimatedTotal = Math.ceil((ticketsInFront * slaMinutes) / counters);
    const min = Math.max(3, estimatedTotal - 3);
    const max = estimatedTotal + 5;

    return {
      minMinutes: min,
      maxMinutes: max,
      text: `Sekitar ${min} - ${max} menit`
    };
  }

  /**
   * Mengambil tiket nomor antrean baru (Koleksi Utama Tingkat Atas 'tickets' untuk Realtime Multi-Device Instan!)
   * Kode prefix: 'A' untuk Pelayanan KB, 'B' untuk Pelayanan Sekretariat
   */
  public async issueTicket(service: ServiceItem, priorityClass: 'REGULAR' | 'PRIORITY' = 'REGULAR'): Promise<Ticket> {
    const dateStr = getTodayStrWITA();
    const group = service.codeGroup; // 'KB' atau 'SK'
    
    const prefixCode = group === 'KB' ? 'A' : 'B';
    const idempotencyKey = `${dateStr}-${prefixCode}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    // Hitung nomor urut dari LocalStorage + Cloud Sync
    const localKey = `antri_seq_${dateStr}_${prefixCode}`;
    const curSeq = parseInt(localStorage.getItem(localKey) || '0', 10) + 1;
    localStorage.setItem(localKey, curSeq.toString());

    const paddedNum = String(curSeq).padStart(3, '0');
    const code = `${prefixCode}-${paddedNum}`; // A-001 atau B-001
    const ticketId = `${prefixCode}-${Date.now()}-${Math.floor(Math.random()*1000)}`;

    const newTicket: Ticket = {
      id: ticketId,
      code,
      sequence: curSeq,
      dateStr,
      siteId: "dppkb-majene-main",
      serviceGroup: group,
      serviceId: service.id,
      serviceTitle: service.title,
      status: 'WAITING',
      priorityClass,
      source: 'KIOSK',
      createdAt: Date.now(),
      callCount: 0,
      version: 1,
      idempotencyKey
    };

    // Simpan ke LocalStorage seketika
    const existingLocal = JSON.parse(localStorage.getItem(`antri_tickets_${dateStr}`) || '[]');
    existingLocal.push(newTicket);
    localStorage.setItem(`antri_tickets_${dateStr}`, JSON.stringify(existingLocal));

    // Unggah ke Firestore koleksi tingkat atas 'tickets' secara non-blocking di latar belakang
    const ticketRef = doc(db, "tickets", ticketId);
    setDoc(ticketRef, newTicket).catch(err => {
      console.warn("Firestore background write ticket warning:", err);
    });

    return newTicket;
  }
}

export const queueService = new QueueService();



