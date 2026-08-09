import React, { useEffect, useRef, useState } from 'react';
import { useQueue } from '../../context/QueueContext';
import { Counter, Ticket, TicketStatus } from '../../types/queue';
import { 
  Volume2, Play, CheckCircle2, UserX, ArrowRightLeft, 
  RotateCcw, Clock, AlertTriangle, UserCheck, ShieldAlert, ChevronDown, Building2, ClipboardList, Check 
} from 'lucide-react';


type CounterProfile = {
  groupLabel: string;
  functionTitle: string;
  detail: string;
  accent: string;
  background: string;
};

const getCounterProfile = (counter: Counter): CounterProfile => {
  const profiles: Record<string, Omit<CounterProfile, 'groupLabel'>> = {
    'counter-1': {
      functionTitle: 'Pelayanan KB Inti',
      detail: 'Konseling kontrasepsi, edukasi Bangga Kencana, dan informasi KB.',
      accent: '#14b8a6',
      background: 'rgba(20, 184, 166, 0.14)'
    },
    'counter-2': {
      functionTitle: 'Konseling Keluarga',
      detail: 'Pendampingan stunting, ibu hamil, calon pengantin, dan kesehatan reproduksi.',
      accent: '#22c55e',
      background: 'rgba(34, 197, 94, 0.14)'
    },
    'counter-3': {
      functionTitle: 'Pelayanan Sekretariat',
      detail: 'Surat masuk, rekomendasi dinas, berkas administrasi, dan layanan umum.',
      accent: '#38bdf8',
      background: 'rgba(56, 189, 248, 0.14)'
    },
    'counter-4': {
      functionTitle: 'Loket Fleksibel Semua Layanan',
      detail: 'Dapat melayani antrean KB dan Sekretariat saat beban layanan berubah.',
      accent: '#f59e0b',
      background: 'rgba(245, 158, 11, 0.14)'
    }
  };

  const fallback = counter.handledGroup === 'ALL'
    ? profiles['counter-4']
    : counter.handledGroup === 'KB'
      ? profiles['counter-1']
      : profiles['counter-3'];

  return {
    ...(profiles[counter.id] || fallback),
    groupLabel: counter.handledGroup === 'ALL'
      ? 'Semua Layanan'
      : counter.handledGroup === 'KB'
        ? 'Kelompok KB'
        : 'Kelompok Sekretariat'
  };
};
export const OperatorView: React.FC = () => {
  const { 
    counters, selectedCounterId, setSelectedCounterId, 
    tickets, callNextTicket, recallTicket, startServiceTicket, 
    completeTicket, markNoShowTicket, transferTicket, cancelTicket 
  } = useQueue();

  const [transferTargetGroup, setTransferTargetGroup] = useState<'KB' | 'SK'>('SK');
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [isCalling, setIsCalling] = useState<boolean>(false);
  const [isCounterMenuOpen, setIsCounterMenuOpen] = useState<boolean>(false);
  const counterMenuRef = useRef<HTMLDivElement | null>(null);

  const activeCounter = counters.find(c => c.id === selectedCounterId) || counters[0] || {
    id: 'counter-fallback',
    name: 'Loket Layanan',
    handledGroup: 'ALL',
    active: true,
    status: 'OPEN'
  } as Counter;
  const activeCounterProfile = getCounterProfile(activeCounter);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!counterMenuRef.current?.contains(event.target as Node)) {
        setIsCounterMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cari tiket yang saat ini berada di loket ini (CALLED / SERVING)
  const currentTicket = [...tickets]
    .filter(t =>
      (t.status === 'CALLED' || t.status === 'SERVING') &&
      t.counterId === activeCounter.id
    )
    .sort((a, b) => (b.calledAt || b.createdAt) - (a.calledAt || a.createdAt))[0];

  // Daftar antrean yang sedang WAITING
  const waitingTickets = tickets.filter(t => {
    if (!activeCounter.active || activeCounter.status !== 'OPEN') return false;
    if (t.status !== 'WAITING') return false;
    if (activeCounter.handledGroup === 'ALL') return true;
    return t.serviceGroup === activeCounter.handledGroup;
  });

  const handleCallNext = async () => {
    if (isCalling) return;
    setIsCalling(true);
    try {
      await callNextTicket(activeCounter.id);
    } catch (e) {
      console.error("Gagal memanggil berikutnya:", e);
    } finally {
      setIsCalling(false);
    }
  };

  const handleTransferSubmit = () => {
    if (!currentTicket) return;
    transferTicket(currentTicket.id, transferTargetGroup, `Transfer ke ${transferTargetGroup}`);
    setShowTransferModal(false);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Selector Loket Operator */}
      <div className="card-modern" style={{ padding: '20px 24px', marginBottom: '24px', background: '#0f172a', color: '#fff' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>PANEL OPERATOR PETUGAS</span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>{activeCounter.name}</h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>
              Kelompok Layanan: {activeCounter.handledGroup === 'ALL' ? 'Semua (KB & Sekretariat)' : `Spesialisasi ${activeCounter.handledGroup}`}
            </p>
          </div>

          <div ref={counterMenuRef} style={{ position: 'relative', flex: '0 1 520px', width: '100%', minWidth: '280px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
              color: '#cbd5e1',
              fontWeight: 800,
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.4px'
            }}>
              <ClipboardList size={15} /> Pilih Loket Tugas
            </label>

            <button
              type="button"
              onClick={() => setIsCounterMenuOpen((open) => !open)}
              style={{
                width: '100%',
                border: `1.5px solid ${activeCounterProfile.accent}`,
                background: 'linear-gradient(135deg, #111c31 0%, #18253c 100%)',
                color: '#ffffff',
                borderRadius: '14px',
                padding: '12px 14px',
                cursor: 'pointer',
                display: 'grid',
                gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                alignItems: 'center',
                gap: '12px',
                textAlign: 'left',
                boxShadow: `0 0 0 3px ${activeCounterProfile.background}`
              }}
            >
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: activeCounterProfile.background,
                color: activeCounterProfile.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Building2 size={22} />
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '1.05rem', lineHeight: 1.1 }}>{activeCounter.name}</strong>
                  <span style={{
                    color: activeCounterProfile.accent,
                    background: activeCounterProfile.background,
                    border: `1px solid ${activeCounterProfile.accent}`,
                    borderRadius: '999px',
                    padding: '2px 8px',
                    fontSize: '0.68rem',
                    fontWeight: 900,
                    textTransform: 'uppercase'
                  }}>
                    {activeCounterProfile.groupLabel}
                  </span>
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#e2e8f0', marginTop: '3px' }}>
                  {activeCounterProfile.functionTitle}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#94a3b8', lineHeight: 1.25, marginTop: '2px' }}>
                  {activeCounterProfile.detail}
                </div>
              </div>

              <ChevronDown
                size={22}
                style={{
                  color: '#38bdf8',
                  transform: isCounterMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease'
                }}
              />
            </button>

            {isCounterMenuOpen && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 10px)',
                width: 'min(680px, calc(100vw - 32px))',
                zIndex: 50,
                background: '#0f172a',
                border: '1px solid rgba(56, 189, 248, 0.28)',
                borderRadius: '16px',
                padding: '14px',
                boxShadow: '0 24px 60px rgba(2, 6, 23, 0.45)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ color: '#38bdf8', fontSize: '0.76rem', fontWeight: 900, textTransform: 'uppercase' }}>
                      Daftar Loket Operasional
                    </div>
                    <div style={{ color: '#cbd5e1', fontSize: '0.78rem' }}>
                      Pilih sesuai fungsi layanan yang sedang ditangani petugas.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '10px' }}>
                  {counters.map((counter) => {
                    const profile = getCounterProfile(counter);
                    const selected = counter.id === selectedCounterId;
                    const isOpen = counter.active && counter.status === 'OPEN';

                    return (
                      <button
                        key={counter.id}
                        type="button"
                        onClick={() => {
                          setSelectedCounterId(counter.id);
                          setIsCounterMenuOpen(false);
                        }}
                        style={{
                          border: selected ? `2px solid ${profile.accent}` : '1px solid rgba(148, 163, 184, 0.22)',
                          background: selected ? profile.background : 'rgba(15, 23, 42, 0.92)',
                          color: '#ffffff',
                          borderRadius: '12px',
                          padding: '12px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          minHeight: '150px',
                          boxShadow: selected ? `0 0 0 3px ${profile.background}` : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <span style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '10px',
                              background: profile.background,
                              color: profile.accent,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <Building2 size={18} />
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '1rem', fontWeight: 900, lineHeight: 1.1 }}>{counter.name}</div>
                              <div style={{ fontSize: '0.72rem', color: profile.accent, fontWeight: 900, textTransform: 'uppercase' }}>
                                {profile.groupLabel}
                              </div>
                            </div>
                          </div>

                          {selected && <Check size={18} style={{ color: profile.accent, flexShrink: 0 }} />}
                        </div>

                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#e2e8f0' }}>{profile.functionTitle}</div>
                          <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.35, margin: '3px 0 0 0' }}>
                            {profile.detail}
                          </p>
                        </div>

                        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 700 }}>
                            Menangani: {counter.handledGroup === 'ALL' ? 'KB & SK' : counter.handledGroup}
                          </span>
                          <span style={{
                            borderRadius: '999px',
                            padding: '3px 8px',
                            fontSize: '0.68rem',
                            fontWeight: 900,
                            color: isOpen ? '#4ade80' : '#fbbf24',
                            background: isOpen ? 'rgba(34, 197, 94, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                            border: `1px solid ${isOpen ? 'rgba(34, 197, 94, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`
                          }}>
                            {counter.status}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Control Panel vs Waiting List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '24px' }}>
        
        {/* Panel Kontrol Tiket Aktif */}
        <div className="card-modern" style={{ padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>STATUS PANGGULAN LOKET</span>
              {currentTicket && (
                <span className={`badge status-${currentTicket.status.toLowerCase()}`}>
                  {currentTicket.status}
                </span>
              )}
            </div>

            {currentTicket ? (
              <div style={{
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                color: '#ffffff',
                borderRadius: '20px',
                padding: '24px',
                textAlign: 'center',
                marginBottom: '24px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
              }}>
                <span style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 700 }}>
                  {currentTicket.serviceGroup === 'KB' ? 'PELAYANAN KB' : 'PELAYANAN SEKRETARIAT'}
                </span>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '4.5rem', fontWeight: 800, color: '#f59e0b', margin: '4px 0', lineHeight: 1 }}>
                  {currentTicket.code}
                </div>
                <p style={{ fontSize: '1rem', fontWeight: 600, color: '#e2e8f0', margin: '8px 0 0 0' }}>
                  {currentTicket.serviceTitle}
                </p>
                {currentTicket.priorityClass === 'PRIORITY' && (
                  <span className="badge" style={{ background: '#f59e0b', color: '#fff', marginTop: '8px' }}>
                    KELOMPOK PRIORITAS (LANSIA/DISABILITAS/HAMIL)
                  </span>
                )}
              </div>
            ) : (
              <div style={{
                background: '#f8fafc',
                border: '2px dashed #cbd5e1',
                borderRadius: '20px',
                padding: '40px 20px',
                textAlign: 'center',
                marginBottom: '24px'
              }}>
                <Clock size={40} style={{ color: '#94a3b8', marginBottom: '8px' }} />
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#475569' }}>Tidak Ada Tiket Aktif</h4>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Tekan "Panggil Berikutnya" untuk memproses antrean baru.</p>
              </div>
            )}
          </div>

          {/* Action Button Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {!currentTicket ? (
              <button
                onClick={handleCallNext}
                disabled={isCalling || waitingTickets.length === 0 || !activeCounter.active || activeCounter.status !== 'OPEN'}
                className="btn btn-gold w-full"
                style={{ padding: '16px', fontSize: '1.1rem' }}
              >
                <Volume2 size={22} />
                {isCalling ? 'Memanggil...' : activeCounter.status !== 'OPEN' ? 'Loket Tidak Buka' : 'Panggil Berikutnya'}
              </button>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    onClick={() => recallTicket(currentTicket.id)}
                    className="btn btn-outline"
                    style={{ padding: '12px' }}
                  >
                    <RotateCcw size={18} /> Panggil Ulang
                  </button>

                  {currentTicket.status === 'CALLED' ? (
                    <button
                      onClick={() => startServiceTicket(currentTicket.id)}
                      className="btn btn-primary"
                      style={{ padding: '12px' }}
                    >
                      <Play size={18} /> Mulai Layanan
                    </button>
                  ) : (
                    <button
                      onClick={() => completeTicket(currentTicket.id)}
                      className="btn btn-success"
                      style={{ padding: '12px' }}
                    >
                      <CheckCircle2 size={18} /> Selesai
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    onClick={() => setShowTransferModal(true)}
                    className="btn btn-outline"
                    style={{ padding: '10px', fontSize: '0.85rem' }}
                  >
                    <ArrowRightLeft size={16} /> Transfer Loket
                  </button>

                  <button
                    onClick={() => markNoShowTicket(currentTicket.id)}
                    className="btn btn-danger"
                    style={{ padding: '10px', fontSize: '0.85rem' }}
                  >
                    <UserX size={16} /> Tidak Hadir
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Daftar Antrean Menunggu */}
        <div className="card-modern" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Daftar Antrean Menunggu</h3>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Total: {waitingTickets.length} orang</span>
            </div>
            <span className="badge badge-kb">{activeCounter.handledGroup}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
            {waitingTickets.length === 0 ? (
              <p style={{ fontSize: '0.9rem', color: '#94a3b8', textAlign: 'center', padding: '30px 0' }}>
                Belum ada antrean yang menunggu di kelompok ini.
              </p>
            ) : (
              waitingTickets.map((t, idx) => (
                <div key={t.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: idx === 0 ? '#f0fdf4' : '#f8fafc',
                  border: idx === 0 ? '1px solid #bbf7d0' : '1px solid #e2e8f0'
                }}>
                  <div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                      {t.code}
                    </span>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>{t.serviceTitle}</p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {new Date(t.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA
                    </span>
                    {t.priorityClass === 'PRIORITY' && (
                      <div>
                        <span className="badge" style={{ background: '#f59e0b', color: '#fff', fontSize: '0.65rem' }}>PRIORITAS</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Modal Transfer Tiket */}
      {showTransferModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '16px'
        }}>
          <div className="card-modern" style={{ maxWidth: '400px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '12px' }}>Transfer Antrean</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>
              Pindahkan tiket <strong>{currentTicket?.code}</strong> ke kelompok antrean tujuan lain tanpa menghapus urutan kedatangan awal.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                Kelompok Tujuan:
              </label>
              <select
                value={transferTargetGroup}
                onChange={(e) => setTransferTargetGroup(e.target.value as 'KB' | 'SK')}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              >
                <option value="KB">Pelayanan Keluarga Berencana (KB)</option>
                <option value="SK">Pelayanan Sekretariat (SK)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowTransferModal(false)} className="btn btn-outline w-full">Batal</button>
              <button onClick={handleTransferSubmit} className="btn btn-primary w-full">Proses Transfer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
