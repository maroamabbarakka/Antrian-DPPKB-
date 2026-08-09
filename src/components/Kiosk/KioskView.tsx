import React, { useState } from 'react';
import { useQueue } from '../../context/QueueContext';
import { ServiceItem, Ticket, ServiceGroup } from '../../types/queue';
import { queueService } from '../../services/queueService';
import { HeartHandshake, FileText, CheckCircle2, Clock, Printer, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

export const KioskView: React.FC = () => {
  const { services, tickets, counters, issueTicket, isOnline } = useQueue();
  const [selectedGroup, setSelectedGroup] = useState<ServiceGroup>('KB');
  const [isPriority, setIsPriority] = useState<boolean>(false);
  const [issuedTicket, setIssuedTicket] = useState<Ticket | null>(null);
  const [issuedTicketsInFront, setIssuedTicketsInFront] = useState<number>(0);
  const [issuedEstWaitText, setIssuedEstWaitText] = useState<string>('Segera dipanggil');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const groupServices = services.filter(s => s.codeGroup === selectedGroup && s.active);

  const activeCountersCount = counters.filter(c =>
    c.active &&
    c.status === 'OPEN' &&
    (c.handledGroup === 'ALL' || c.handledGroup === selectedGroup)
  ).length;

  const handleTakeTicket = async (service: ServiceItem) => {
    if (isSubmitting) return; // Prevent double click
    setErrorMessage(null);

    if (!isOnline || !navigator.onLine) {
      setErrorMessage('Perangkat sedang offline. Sambungkan internet lalu coba ambil nomor lagi.');
      return;
    }

    setIsSubmitting(true);

    try {
      const ticketsAheadBeforeIssue = calculateTicketsInFront(service.codeGroup);
      const relevantCounters = counters.filter(c =>
        c.active &&
        c.status === 'OPEN' &&
        (c.handledGroup === 'ALL' || c.handledGroup === service.codeGroup)
      ).length;
      const estimateAtIssue = queueService.calculateEstimatedWait(ticketsAheadBeforeIssue, relevantCounters, service.slaMinutes);
      const ticket = await issueTicket(service, isPriority ? 'PRIORITY' : 'REGULAR');
      setIssuedTicket(ticket);
      setIssuedTicketsInFront(ticketsAheadBeforeIssue);
      setIssuedEstWaitText(estimateAtIssue.text);

      // Trigger Confetti Effect saat tiket berhasil dibuat (tanpa panggilan suara)
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 }
      });
    } catch (e: any) {
      console.error("Gagal membuat tiket antrean:", e);
      const code = e?.code || '';
      const message = String(e?.message || '');

      if (code.includes('permission-denied') || message.includes('Missing or insufficient permissions')) {
        setErrorMessage('Gagal membuat nomor: izin Firestore belum mengizinkan perangkat ini menulis data.');
      } else if (code.includes('unavailable') || code.includes('deadline-exceeded')) {
        setErrorMessage('Gagal membuat nomor: koneksi ke server antrean tidak stabil. Coba lagi beberapa detik.');
      } else if (message.includes('offline')) {
        setErrorMessage('Gagal membuat nomor: perangkat terbaca offline. Periksa koneksi internet.');
      } else {
        setErrorMessage('Gagal membuat nomor antrean. Muat ulang halaman, lalu coba lagi.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateTicketsInFront = (serviceGroup: ServiceGroup): number => {
    return tickets.filter(t => t.serviceGroup === serviceGroup && t.status === 'WAITING').length;
  };

  const ticketsInFront = calculateTicketsInFront(selectedGroup);
  const estWait = queueService.calculateEstimatedWait(ticketsInFront, activeCountersCount);

  return (
    <div className="kiosk-view" style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '24px 16px', overflow: 'hidden', boxSizing: 'border-box' }}>
      {/* Banner Selamat Datang Kios */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #0284c7 100%)',
        color: '#ffffff',
        borderRadius: '20px',
        padding: 'clamp(22px, 6vw, 32px)',
        marginBottom: '28px',
        boxShadow: '0 10px 25px rgba(2, 132, 199, 0.2)',
        textAlign: 'center'
      }}>
        <h2 style={{ fontSize: 'clamp(1.45rem, 8vw, 2rem)', fontWeight: 800, marginBottom: '8px', lineHeight: 1.25, overflowWrap: 'anywhere' }}>
          Selamat Datang di Kios Antrean DPPKB Kabupaten Majene
        </h2>
        <p style={{ fontSize: 'clamp(0.92rem, 4vw, 1.05rem)', opacity: 0.9, maxWidth: '750px', margin: '0 auto', overflowWrap: 'anywhere' }}>
          Silakan pilih kelompok pelayanan yang Anda butuhkan di bawah ini untuk mengambil nomor antrean.
        </p>
      </div>

      {/* Selector Group Button: Kode A vs Kode B */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        {/* Tombol Pelayanan KB (Kode A) */}
        <button
          onClick={() => { setSelectedGroup('KB'); setErrorMessage(null); }}
          className="card-modern card-hover"
          style={{
            padding: 'clamp(18px, 5vw, 24px)',
            cursor: 'pointer',
            textAlign: 'left',
            border: selectedGroup === 'KB' ? '3px solid #0d9488' : '1px solid #e2e8f0',
            background: selectedGroup === 'KB' ? 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)' : '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: 'clamp(14px, 4vw, 20px)',
            minWidth: 0
          }}
        >
          <div style={{
            background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
            color: '#fff',
            width: 'clamp(52px, 16vw, 64px)',
            height: 'clamp(52px, 16vw, 64px)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <HeartHandshake size={36} style={{ margin: 'auto' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <span className="badge badge-kb" style={{ marginBottom: '6px' }}>Kode Antrean: A</span>
            <h3 style={{ fontSize: 'clamp(1.05rem, 5vw, 1.3rem)', fontWeight: 800, color: '#0f172a', lineHeight: 1.15 }}>Pelayanan Keluarga Berencana</h3>
            <p style={{ fontSize: '0.88rem', color: '#64748b', overflowWrap: 'anywhere' }}>Konseling Kontrasepsi, Stunting & Kesehatan Reproduksi</p>
          </div>
        </button>

        {/* Tombol Pelayanan Sekretariat (Kode B) */}
        <button
          onClick={() => { setSelectedGroup('SK'); setErrorMessage(null); }}
          className="card-modern card-hover"
          style={{
            padding: 'clamp(18px, 5vw, 24px)',
            cursor: 'pointer',
            textAlign: 'left',
            border: selectedGroup === 'SK' ? '3px solid #0284c7' : '1px solid #e2e8f0',
            background: selectedGroup === 'SK' ? 'linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%)' : '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: 'clamp(14px, 4vw, 20px)',
            minWidth: 0
          }}
        >
          <div style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
            color: '#fff',
            width: 'clamp(52px, 16vw, 64px)',
            height: 'clamp(52px, 16vw, 64px)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <FileText size={36} style={{ margin: 'auto' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <span className="badge badge-sk" style={{ marginBottom: '6px' }}>Kode Antrean: B</span>
            <h3 style={{ fontSize: 'clamp(1.05rem, 5vw, 1.3rem)', fontWeight: 800, color: '#0f172a', lineHeight: 1.15 }}>Pelayanan Sekretariat</h3>
            <p style={{ fontSize: '0.88rem', color: '#64748b', overflowWrap: 'anywhere' }}>Surat Masuk, Rekomendasi Dinas & Administrasi Umum</p>
          </div>
        </button>
      </div>

      {/* Info Ringkasan Antrean Saat Ini */}
      <div className="card-modern" style={{ padding: '20px 24px', marginBottom: '28px', background: '#f8fafc' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Clock size={24} style={{ color: '#0284c7' }} />
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Informasi Antrean {selectedGroup === 'KB' ? 'Pelayanan Keluarga Berencana (Kode A)' : 'Pelayanan Sekretariat (Kode B)'}</h4>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>Jumlah antrean menunggu di depan Anda saat ini</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
            <div>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Menunggu</span>
              <p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>{ticketsInFront} Orang</p>
            </div>
            <div>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Estimasi Waktu</span>
              <p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0d9488', margin: 0 }}>{estWait.text}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Opsi Antrean Prioritas */}
      <div className="card-modern" style={{ padding: '16px 20px', marginBottom: '28px', borderColor: isPriority ? '#d97706' : '#e2e8f0', background: isPriority ? '#fffbeb' : '#fff' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={isPriority} 
            onChange={(e) => setIsPriority(e.target.checked)}
            style={{ width: '22px', height: '22px', accentColor: '#d97706' }}
          />
          <div>
            <span style={{ fontWeight: 700, color: isPriority ? '#b45309' : '#0f172a', fontSize: '1rem' }}>
              Bantuan Khusus / Kelompok Prioritas (Lansia, Disabilitas, Ibu Hamil)
            </span>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
              Sesuai SOP DPPKB Majene, kelompok prioritas mendapat perhatian sesuai kebijakan urutan pelayanan.
            </p>
          </div>
        </label>
      </div>

      {/* Sublayanan Master Data Cards */}
      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '16px', color: '#0f172a' }}>
        Pilih Jenis Layanan {selectedGroup === 'KB' ? 'Keluarga Berencana (Kode A)' : 'Sekretariat (Kode B)'}:
      </h3>

      {errorMessage && (
        <div className="card-modern" style={{
          padding: '14px 16px',
          marginBottom: '18px',
          borderColor: '#fecaca',
          background: '#fef2f2',
          color: '#991b1b',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 700
        }}>
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '20px' }}>
        {groupServices.map(srv => (
          <div key={srv.id} className="card-modern card-hover" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{srv.title}</h4>
                <span className="badge badge-status" style={{ background: '#dcfce7', color: '#15803d' }}>{srv.fee}</span>
              </div>
              <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '16px' }}>{srv.description}</p>
              
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Persyaratan Dokumen:
                </span>
                <ul style={{ paddingLeft: '18px', fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
                  {srv.requirements.map((req, idx) => (
                    <li key={idx}>{req}</li>
                  ))}
                </ul>
              </div>
            </div>

            <button
              onClick={() => handleTakeTicket(srv)}
              disabled={isSubmitting || !isOnline}
              className="btn btn-primary w-full"
              style={{ padding: '14px', fontSize: '1.05rem' }}
            >
              <CheckCircle2 size={20} />
              {isSubmitting ? 'Memproses Tiket...' : !isOnline ? 'Perangkat Offline' : 'Ambil Nomor Antrean'}
            </button>
          </div>
        ))}
      </div>

      {/* Modal Tiket Setelah Berhasil Ambil Nomor */}
      {issuedTicket && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: '16px'
        }}>
          <div className="card-modern" style={{
            maxWidth: '440px',
            width: '100%',
            padding: '32px',
            textAlign: 'center',
            background: '#ffffff',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            borderRadius: '24px'
          }}>
            <div style={{ color: '#16a34a', marginBottom: '12px' }}>
              <CheckCircle2 size={54} style={{ margin: 'auto' }} />
            </div>
            
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              TIKET ANTREAN RESMI
            </span>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>DPPKB KABUPATEN MAJENE</p>

            <div style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              color: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              margin: '20px 0'
            }}>
              <span style={{ fontSize: '0.9rem', color: '#38bdf8', fontWeight: 700 }}>
                {issuedTicket.serviceGroup === 'KB' ? 'PELAYANAN KELUARGA BERENCANA' : 'PELAYANAN SEKRETARIAT'}
              </span>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '3.8rem', fontWeight: 800, color: '#f59e0b', margin: '4px 0' }}>
                {issuedTicket.code}
              </div>
              <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                {issuedTicket.serviceTitle}
              </span>
            </div>

            <div style={{ fontSize: '0.88rem', color: '#475569', textAlign: 'left', background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>Waktu Cetak:</span>
                <strong style={{ color: '#0f172a' }}>{new Date(issuedTicket.createdAt).toLocaleTimeString('id-ID')} WITA</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>Antrean di depan:</span>
                <strong style={{ color: '#0284c7' }}>{issuedTicketsInFront} Orang</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Estimasi Panggil:</span>
                <strong style={{ color: '#0d9488' }}>{issuedEstWaitText}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => window.print()} 
                className="btn btn-outline w-full"
              >
                <Printer size={18} /> Cetak (80mm)
              </button>
              <button 
                onClick={() => setIssuedTicket(null)} 
                className="btn btn-primary w-full"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


