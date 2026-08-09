import React, { useState } from 'react';
import { useQueue } from '../../context/QueueContext';
import { Layout, Monitor, Tv, Settings, Wifi, WifiOff, Volume2, ExternalLink, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { ttsService } from '../../services/ttsService';

type AudioTestStatus = 'idle' | 'testing' | 'pass' | 'fail';

export const Navbar: React.FC = () => {
  const { activeTab, setActiveTab, isOnline } = useQueue();
  const [audioTestStatus, setAudioTestStatus] = useState<AudioTestStatus>('idle');
  const [audioTestDetail, setAudioTestDetail] = useState<string>('');

  const handleOpenTVTab = () => {
    setActiveTab('tv');
    window.open('/?view=tv', '_blank');
  };

  const handleTestAudio = async () => {
    if (audioTestStatus === 'testing') return;
    setAudioTestStatus('testing');
    setAudioTestDetail('Menguji...');

    try {
      const result = await ttsService.testAudio();
      if (result.success) {
        setAudioTestStatus('pass');
        const src = result.steps.voice.success ? 'LOCAL_WAV' : 'N/A';
        setAudioTestDetail(`Suara OK — ${src}`);

      } else {
        setAudioTestStatus('fail');
        const voiceErr = result.steps.voice.error || result.steps.context.error || 'VOICE_NOT_PLAYED';
        setAudioTestDetail(`Suara gagal — ${voiceErr}`);
      }
    } catch (err: any) {
      setAudioTestStatus('fail');
      setAudioTestDetail(err?.message || 'ERROR');
    }

    // Reset ke idle setelah 5 detik
    setTimeout(() => {
      setAudioTestStatus('idle');
      setAudioTestDetail('');
    }, 5000);
  };

  const audioTestColors = {
    idle:    { bg: 'rgba(2, 132, 199, 0.2)',  border: 'rgba(56, 189, 248, 0.4)',  text: '#38bdf8' },
    testing: { bg: 'rgba(245, 158, 11, 0.2)', border: 'rgba(245, 158, 11, 0.5)',  text: '#fbbf24' },
    pass:    { bg: 'rgba(34, 197, 94, 0.2)',   border: 'rgba(74, 222, 128, 0.5)',  text: '#4ade80' },
    fail:    { bg: 'rgba(239, 68, 68, 0.2)',   border: 'rgba(248, 113, 113, 0.5)', text: '#f87171' }
  };

  const colors = audioTestColors[audioTestStatus];

  return (
    <header 
      className="app-navbar-container"
      style={{
        background: 'linear-gradient(90deg, #071126 0%, #0d1a36 100%)',
        color: '#ffffff',
        padding: '12px 24px',
        borderBottom: '2px solid rgba(2, 132, 199, 0.4)',
        boxShadow: '0 6px 24px rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}
    >
      {/* Brand Identity DPPKB Majene */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
        <div style={{
          background: '#ffffff',
          padding: '6px 10px',
          borderRadius: '12px',
          boxShadow: '0 2px 12px rgba(255,255,255,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <img 
            src="/Logo_DPPKB.png" 
            alt="Logo Kabupaten Majene DPPKB" 
            style={{ height: '40px', width: 'auto', objectFit: 'contain' }}
          />
        </div>
        <div>
          <span style={{ 
            fontSize: '0.72rem', 
            fontWeight: 800, 
            color: '#38bdf8', 
            letterSpacing: '1px', 
            textTransform: 'uppercase',
            display: 'block',
            lineHeight: 1.2
          }}>
            Sistem Antrean Pelayanan Publik
          </span>
          <h1 style={{ 
            fontSize: '1.15rem', 
            fontWeight: 800, 
            margin: 0, 
            letterSpacing: '-0.3px', 
            color: '#ffffff',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)'
          }}>
            DPPKB KABUPATEN MAJENE
          </h1>
          <p style={{ fontSize: '0.75rem', color: '#cbd5e1', margin: 0, fontWeight: 500 }}>
            Dinas Pengendalian Penduduk & Keluarga Berencana
          </p>
        </div>
      </div>

      {/* Center & Right Navigation Section */}
      <div 
        className="app-navbar-menu"
        style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}
      >
        {/* Kelompok Navigasi Utama */}
        <nav style={{ 
          display: 'flex', 
          gap: '6px', 
          background: 'rgba(255, 255, 255, 0.06)', 
          padding: '4px 6px', 
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setActiveTab('kiosk')}
            className={`btn ${activeTab === 'kiosk' ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '8px 14px', fontSize: '0.85rem', color: activeTab === 'kiosk' ? '#fff' : '#cbd5e1', border: 'none' }}
          >
            <Layout size={15} /> Kios Antrean
          </button>

          <button
            onClick={() => setActiveTab('operator')}
            className={`btn ${activeTab === 'operator' ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '8px 14px', fontSize: '0.85rem', color: activeTab === 'operator' ? '#fff' : '#cbd5e1', border: 'none' }}
          >
            <Monitor size={15} /> Panel Operator
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className={`btn ${activeTab === 'admin' ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '8px 14px', fontSize: '0.85rem', color: activeTab === 'admin' ? '#fff' : '#cbd5e1', border: 'none' }}
          >
            <Settings size={15} /> Admin & Supervisor
          </button>
        </nav>

        {/* Tombol LAYAR TV 16:9 */}
        <button
          onClick={handleOpenTVTab}
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: '#ffffff',
            padding: '9px 18px',
            borderRadius: '12px',
            border: '1.5px solid #fbbf24',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.88rem',
            fontWeight: 800,
            letterSpacing: '0.3px',
            boxShadow: '0 0 20px rgba(245, 158, 11, 0.45)',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            userSelect: 'none',
            flexShrink: 0
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
            e.currentTarget.style.boxShadow = '0 0 28px rgba(245, 158, 11, 0.65)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 0 20px rgba(245, 158, 11, 0.45)';
          }}
          title="Buka Layar TV 16:9 di Tab Baru & Mode Fullscreen"
        >
          <Tv size={17} />
          <span>LAYAR TV</span>
          <ExternalLink size={14} style={{ opacity: 0.9 }} />
        </button>

        {/* Controls & Network Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* Tombol Tes Audio dengan feedback visual */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <button
              id="btn-tes-audio"
              onClick={handleTestAudio}
              disabled={audioTestStatus === 'testing'}
              title="Tes Suara Chime & Pemanggilan TTS (Nomor A-001, Loket 1, Pelayanan KB)"
              style={{
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                color: colors.text,
                borderRadius: '10px',
                padding: '6px 12px',
                cursor: audioTestStatus === 'testing' ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                transition: 'all 0.2s ease',
                opacity: audioTestStatus === 'testing' ? 0.8 : 1,
                minWidth: '100px'
              }}
            >
              {audioTestStatus === 'testing' && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
              {audioTestStatus === 'pass'    && <CheckCircle2 size={13} />}
              {audioTestStatus === 'fail'    && <XCircle size={13} />}
              {audioTestStatus === 'idle'    && <Volume2 size={14} />}
              {audioTestStatus === 'idle'    ? 'Tes Audio' :
               audioTestStatus === 'testing' ? 'Menguji...' :
               audioTestStatus === 'pass'    ? 'Audio OK' :
                                               'Audio Gagal'}
            </button>
            {audioTestDetail && audioTestStatus !== 'idle' && audioTestStatus !== 'testing' && (
              <span style={{
                fontSize: '0.64rem',
                color: colors.text,
                maxWidth: '120px',
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {audioTestDetail}
              </span>
            )}
          </div>

          {/* Indikator jaringan */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 10px',
            borderRadius: '9999px',
            background: isOnline ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${isOnline ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
            fontSize: '0.75rem',
            fontWeight: 700,
            color: isOnline ? '#4ade80' : '#f87171'
          }}>
            {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
            {isOnline ? 'Online' : 'Offline'}
          </div>
        </div>

      </div>
    </header>
  );
};
