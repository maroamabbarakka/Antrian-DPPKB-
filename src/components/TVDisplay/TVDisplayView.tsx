import React, { useState, useEffect, useRef } from 'react';
import { useQueue } from '../../context/QueueContext';
import { MediaItem } from '../../types/queue';
import { ttsService } from '../../services/ttsService';
import { queueAudioEngine, AudioEngineState } from '../../services/audio/QueueAudioEngine';
import '../../styles/tv.css';
import {
  Volume2, VolumeX, HeartHandshake, FileText,
  Play, Speaker, Maximize2, Minimize2, CheckCircle2,
  SkipBack, SkipForward, QrCode, ExternalLink, Users, Clock, ShieldCheck, AlertCircle
} from 'lucide-react';

export const TVDisplayView: React.FC = () => {
  const { tickets, mediaList, announcements, callOverlay } = useQueue();
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [currentMediaIdx, setCurrentMediaIdx] = useState<number>(0);
  const [videoMuted, setVideoMuted] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(!!document.fullscreenElement);
  const [videoError, setVideoError] = useState<boolean>(false);
  const [audioEngineState, setAudioEngineState] = useState<AudioEngineState>('LOCKED');

  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const unsubscribe = queueAudioEngine.subscribeState((state) => {
      setAudioEngineState(state);
    });
    return () => unsubscribe();
  }, []);

  const activeMedia = mediaList.filter(m => m.active);

  const defaultMedia: MediaItem = {
    id: "default-2026",
    title: "Infografis DPPKB Majene 2026",
    sourceType: "CLOUD_MP4",
    url: "https://dppkb-2026.web.app/Galeri%20Video/Infografis%20DPPKB%20Majene%202026.mp4",
    offlineRequired: true,
    active: true,
    durationSec: 120
  };

  const currentMedia: MediaItem = activeMedia[currentMediaIdx] || defaultMedia;
  const isYouTube = currentMedia.sourceType === 'YOUTUBE' || currentMedia.url.includes('youtube.com') || currentMedia.url.includes('youtu.be');

  const stopPassiveMediaInteraction = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const getYouTubeEmbedUrl = (url: string) => {
    let listId = '';
    let videoIdParam = '';

    if (url.includes('list=')) {
      const listMatch = url.match(/list=([\w-]+)/);
      if (listMatch) listId = listMatch[1];
    }

    const videoIdMatch = url.match(/(?:v=|\/embed\/|\/watch\?v=|youtu\.be\/)([\w-]+)/);
    if (videoIdMatch) videoIdParam = videoIdMatch[1];

    const params = new URLSearchParams({
      autoplay: '1',
      mute: videoMuted ? '1' : '0',
      controls: '0',
      disablekb: '1',
      fs: '0',
      iv_load_policy: '3',
      modestbranding: '1',
      playsinline: '1',
      rel: '0',
      showinfo: '0',
      cc_load_policy: '0',
      cc_lang_pref: 'id',
      hl: 'id',
      autohide: '1',
      loop: '1',
      enablejsapi: '0',
      widget_referrer: window.location.origin,
      origin: window.location.origin
    });

    if (listId) {
      params.set('list', listId);
      return `https://www.youtube-nocookie.com/embed/videoseries?${params.toString()}`;
    }

    if (videoIdParam) {
      params.set('playlist', videoIdParam);
      return `https://www.youtube-nocookie.com/embed/${videoIdParam}?${params.toString()}`;
    }

    params.set('list', 'PL2yRHg1b-nodI3kfIn5H5ufWHMEMykIKz');
    return `https://www.youtube-nocookie.com/embed/videoseries?${params.toString()}`;
  };

  const fallbackVideoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
  const skmTargetUrl = "https://skm.go.id/share/instansi/948f34b1-dd6a-4890-ab6c-24810e8889cf/1";
  const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(skmTargetUrl)}`;

  const handleNextVideo = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (activeMedia.length <= 1) return;
    setVideoError(false);
    setCurrentMediaIdx(prev => (prev + 1) % activeMedia.length);
  };

  const handlePrevVideo = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (activeMedia.length <= 1) return;
    setVideoError(false);
    setCurrentMediaIdx(prev => (prev - 1 + activeMedia.length) % activeMedia.length);
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleActivateAudio = async (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.stopPropagation();
    await queueAudioEngine.unlockFromUserGesture();
  };

  const handleToggleFullscreen = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.warn("Fullscreen error:", err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(() => {});
    }
  };

  useEffect(() => {
    if (videoRef.current) {
      if (callOverlay?.active) {
        videoRef.current.volume = 0.1;
      } else {
        videoRef.current.volume = 0.5;
      }
    }
  }, [callOverlay]);

  const calledOrServingTickets = tickets.filter(t => t.status === 'CALLED' || t.status === 'SERVING');
  const sortedCalled = [...calledOrServingTickets].sort((a, b) => (b.calledAt || b.createdAt) - (a.calledAt || a.createdAt));
  const latestCall = sortedCalled.length > 0 ? sortedCalled[0] : null;

  const waitingTickets = tickets.filter(t => t.status === 'WAITING').sort((a, b) => {
    if (a.priorityClass === 'PRIORITY' && b.priorityClass !== 'PRIORITY') return -1;
    if (a.priorityClass !== 'PRIORITY' && b.priorityClass === 'PRIORITY') return 1;
    return a.createdAt - b.createdAt;
  });
  const upcomingTickets = waitingTickets.slice(0, 3);

  const waitingKB = tickets.filter(t => t.serviceGroup === 'KB' && t.status === 'WAITING').length;
  const waitingSK = tickets.filter(t => t.serviceGroup === 'SK' && t.status === 'WAITING').length;

  const formatWITA = (date: Date) => {
    const timeStr = date.toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' });
    const dateStr = date.toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    return { timeStr, dateStr };
  };

  const { timeStr, dateStr } = formatWITA(currentTime);

  const defaultMarqueeItems = [
    "Mohon persiapkan dokumen persyaratan (KTP/KK/Buku KIA) sebelum menuju loket pelayanan",
    "Seluruh Pelayanan Keluarga Berencana & Pelayanan Sekretariat di DPPKB Majene GRATIS tanpa dipungut biaya",
    "Cegah Stunting Sejak Dini! Manfaatkan konseling 1.000 Hari Pertama Kehidupan (HPK) dan pendampingan calon pengantin",
    "Program Bangga Kencana: Berencana Itu Keren, Wujudkan Keluarga Berkualitas dan Majene Sejahtera",
    "Sampaikan saran dan pengaduan pelayanan Anda melalui Layanan Pengaduan Resmi SP4N-LAPOR! DPPKB Majene"
  ];

  const activeAnnouncements = announcements
    .filter((item) => item.active)
    .sort((a, b) => a.order - b.order)
    .map((item) => `${item.title}: ${item.content}`);

  const marqueeItems = activeAnnouncements.length > 0 ? activeAnnouncements : defaultMarqueeItems;

  const isAudioReady = audioEngineState === 'READY' || audioEngineState === 'PLAYING';

  return (
    <div className="tv-screen" onClick={handleActivateAudio}>
      {/* Header Bar TV Presisi */}
      <header className="tv-header">
        <div className="tv-logo-area">
          <div className="tv-logo-box">
            <img src="/Logo_DPPKB.png" alt="Logo Kabupaten Majene DPPKB" className="tv-logo-img" />
          </div>
          <div className="tv-header-title-box">
            <div className="tv-header-tag">SISTEM ANTRIAN PELAYANAN</div>
            <h1 className="tv-header-title">
              DINAS PENGENDALIAN PENDUDUK DAN KELUARGA BERENCANA<br />
              KABUPATEN MAJENE
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {!isAudioReady && (
            <button
              onClick={(e) => handleActivateAudio(e)}
              className="tv-audio-unlock-btn"
            >
              <Volume2 size={16} /> AKTIFKAN SUARA TV
            </button>
          )}

          <button
            onClick={(e) => handleToggleFullscreen(e)}
            className="tv-fullscreen-btn"
            title="Klik untuk Masuk/Keluar Mode Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            {isFullscreen ? 'FULLSCREEN ACTIVE' : 'FULLSCREEN'}
          </button>

          <div className="tv-status-pill">ONLINE | REALTIME</div>

          <div className="tv-header-clock">
            <div>
              <div className="tv-time">
                {timeStr} <span className="tv-time-unit">WITA</span>
              </div>
              <div className="tv-date">{dateStr}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid TV Layout Presisi */}
      <div className="tv-body">
        <div className="tv-main-left-section">
          <div className="tv-top-row-video-qr">
            {/* Pemutar Video 16:9 */}
            <div className="tv-video-container" onClick={(e) => e.stopPropagation()}>
              {isYouTube ? (
                <div className="tv-youtube-wrapper">
                  <iframe
                    src={getYouTubeEmbedUrl(currentMedia.url)}
                    title={currentMedia.title}
                    className="tv-youtube-iframe"
                    allow="autoplay; encrypted-media"
                    referrerPolicy="strict-origin-when-cross-origin"
                    sandbox="allow-scripts allow-same-origin"
                    aria-hidden="true"
                    tabIndex={-1}
                    onFocus={(e) => e.currentTarget.blur()}
                  />
                  <div
                    className="tv-youtube-click-mask"
                    aria-hidden="true"
                    tabIndex={-1}
                    onClick={stopPassiveMediaInteraction}
                    onDoubleClick={stopPassiveMediaInteraction}
                    onPointerDown={stopPassiveMediaInteraction}
                    onPointerUp={stopPassiveMediaInteraction}
                    onMouseDown={stopPassiveMediaInteraction}
                    onMouseUp={stopPassiveMediaInteraction}
                    onKeyDown={stopPassiveMediaInteraction}
                    onKeyUp={stopPassiveMediaInteraction}
                    onFocus={(e) => e.currentTarget.blur()}
                    onContextMenu={stopPassiveMediaInteraction}
                  />
                </div>
              ) : (
                <video
                  ref={videoRef}
                  src={videoError ? fallbackVideoUrl : (currentMedia.url || defaultMedia.url)}
                  autoPlay
                  loop={activeMedia.length <= 1}
                  muted={videoMuted}
                  onEnded={() => {
                    setVideoError(false);
                    if (activeMedia.length <= 1) {
                      if (videoRef.current) {
                        videoRef.current.currentTime = 0;
                        videoRef.current.play().catch(() => {});
                      }
                      return;
                    }
                    setCurrentMediaIdx(prev => (prev + 1) % activeMedia.length);
                  }}
                  onError={() => setVideoError(true)}
                  className="tv-video-player"
                />
              )}

              <div className={`tv-video-bottom-bar ${isYouTube ? 'tv-video-bottom-bar-youtube' : ''}`}>
                <div className="tv-video-overlay-tag">
                  <div className="tv-video-play-btn">
                    <Play size={14} fill="#ffffff" />
                  </div>
                  <div>
                    <div className="tv-video-tag-title">{currentMedia.title || "VIDEO EDUKASI"}</div>
                    <div className="tv-video-tag-sub">Program Bangga Kencana - Majene</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', pointerEvents: 'auto' }}>
                  {activeMedia.length > 1 && (
                    <>
                      <button onClick={(e) => handlePrevVideo(e)} className="tv-icon-only-btn" title="Video Sebelumnya">
                        <SkipBack size={14} />
                      </button>
                      <button onClick={(e) => handleNextVideo(e)} className="tv-icon-only-btn" title="Video Selanjutnya">
                        <SkipForward size={14} />
                      </button>
                    </>
                  )}

                  {!isYouTube && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setVideoMuted(!videoMuted); }}
                      className="tv-icon-only-btn"
                      title={videoMuted ? "Buka Suara Video" : "Matikan Suara Video"}
                    >
                      {videoMuted ? <VolumeX size={14} style={{ color: '#ef4444' }} /> : <Volume2 size={14} style={{ color: '#4ade80' }} />}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Kartu QR Code SKM */}
            <div className="tv-skm-card">
              <div className="tv-skm-title-text">
                SURVEY KEPUASAN MASYARAKAT
                <span className="tv-skm-year">2026</span>
              </div>
              <div className="tv-skm-scan-badge">
                <QrCode size={16} /> SCAN DISINI
              </div>
              <div className="tv-skm-qr-box">
                <img src={qrCodeApiUrl} alt="Barcode QR Code SKM 2026" className="tv-skm-qr-img" />
              </div>
              <div className="tv-skm-link-box">
                <ExternalLink size={12} style={{ flexShrink: 0 }} />
                <span className="tv-skm-link-text">skm.go.id/share/instansi/...</span>
              </div>
            </div>
          </div>

          {/* Kartu Status Pelayanan KB & Pelayanan Sekretariat */}
          <div className="tv-bottom-cards-row">
            <div className="tv-service-status-card">
              <div className="tv-card-header-line">
                <div className="tv-card-header-left">
                  <div className="tv-icon-box-kb"><HeartHandshake size={26} /></div>
                  <div>
                    <h2 className="tv-card-large-title">PELAYANAN KELUARGA BERENCANA</h2>
                    <span className="tv-card-sub-code">Kelompok Kode Antrean: A</span>
                  </div>
                </div>
                <span className="tv-badge-buka">OPERASIONAL BUKA</span>
              </div>
              <div className="tv-card-body-rich-stack">
                <div className="tv-rich-stat-box-kb">
                  <div className="tv-rich-stat-label"><Users size={16} /> ANTREAN MENUNGGU SAAT INI</div>
                  <div className="tv-rich-stat-value-kb">{String(waitingKB).padStart(2, '0')} <span className="tv-rich-stat-unit">ORANG</span></div>
                </div>
                <div className="tv-rich-stat-box-est">
                  <div className="tv-rich-stat-label"><Clock size={16} /> RATA-RATA ESTIMASI WAKTU TUNGGU</div>
                  <div className="tv-rich-stat-value-est">{waitingKB > 0 ? `${waitingKB * 10} MENIT` : '0 MENIT (BEBAS ANTREAN)'}</div>
                </div>
              </div>
              <div className="tv-card-footer-info">
                <ShieldCheck size={15} style={{ color: '#34d399', flexShrink: 0 }} />
                <span>Konseling Kontrasepsi - Stunting - Kesehatan Reproduksi - Ibu & Anak</span>
              </div>
            </div>

            <div className="tv-service-status-card">
              <div className="tv-card-header-line">
                <div className="tv-card-header-left">
                  <div className="tv-icon-box-sk"><FileText size={26} /></div>
                  <div>
                    <h2 className="tv-card-large-title">PELAYANAN SEKRETARIAT</h2>
                    <span className="tv-card-sub-code">Kelompok Kode Antrean: B</span>
                  </div>
                </div>
                <span className="tv-badge-buka">OPERASIONAL BUKA</span>
              </div>
              <div className="tv-card-body-rich-stack">
                <div className="tv-rich-stat-box-sk">
                  <div className="tv-rich-stat-label"><Users size={16} /> ANTREAN MENUNGGU SAAT INI</div>
                  <div className="tv-rich-stat-value-sk">{String(waitingSK).padStart(2, '0')} <span className="tv-rich-stat-unit">ORANG</span></div>
                </div>
                <div className="tv-rich-stat-box-est">
                  <div className="tv-rich-stat-label"><Clock size={16} /> RATA-RATA ESTIMASI WAKTU TUNGGU</div>
                  <div className="tv-rich-stat-value-est">{waitingSK > 0 ? `${waitingSK * 5} MENIT` : '0 MENIT (BEBAS ANTREAN)'}</div>
                </div>
              </div>
              <div className="tv-card-footer-info">
                <ShieldCheck size={15} style={{ color: '#38bdf8', flexShrink: 0 }} />
                <span>Surat Masuk/Keluar - Rekomendasi Dinas - Administrasi Umum</span>
              </div>
            </div>
          </div>
        </div>

        {/* Panel Kanan Pemanggilan Aktif */}
        <div className="tv-right-col">
          <div className="tv-current-call-card">
            <div className="tv-call-large-label">SEDANG DIPANGGIL</div>
            <div className="tv-call-number" style={{ color: latestCall ? '#ffffff' : '#94a3b8' }}>
              {latestCall ? latestCall.code : '---'}
            </div>
            <div className="tv-call-divider" />
            <div className="tv-call-counter-single" style={{ color: latestCall ? '#f59e0b' : '#38bdf8' }}>
              {latestCall ? (latestCall.counterName || 'LOKET 1') : 'LOKET SIAP MELAYANI'}
            </div>
            <div className="tv-call-service">
              {latestCall ? latestCall.serviceTitle : 'Silakan mengambil tiket antrean di Loket Registrasi'}
            </div>
            {latestCall ? (
              <div className="tv-call-chime-info"><Speaker size={16} /> Panggilan ke-{latestCall.callCount || 1}</div>
            ) : (
              <div className="tv-call-chime-info" style={{ background: 'rgba(34, 197, 94, 0.15)', borderColor: 'rgba(34, 197, 94, 0.4)', color: '#4ade80' }}>
                <CheckCircle2 size={15} /> Loket Bebas Antrean
              </div>
            )}
          </div>

          <div className="tv-upcoming-card">
            <div className="tv-upcoming-title">ANTREAN BERIKUTNYA</div>
            <div className="tv-upcoming-grid">
              {upcomingTickets.length > 0 ? (
                upcomingTickets.map((item, idx) => (
                  <div key={item.id || idx} className="tv-upcoming-item">
                    <div className="tv-item-left">
                      <div className="tv-circle-num">{idx + 1}</div>
                      <div className="tv-item-code">{item.code}</div>
                    </div>
                    <div style={{ color: '#cbd5e1', fontWeight: 600 }}>|</div>
                    <div className="tv-item-counter">{item.counterName || 'Loket Service'}</div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '16px 12px', textAlign: 'center', color: '#94a3b8', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>Belum Ada Antrean Menunggu</p>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Semua antrean hari ini telah terlayani</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Banner */}
      <footer className="tv-footer-bar">
        <div className="tv-footer-left-marquee">
          <div className="tv-marquee-badge-box"><div className="tv-info-icon-badge">i</div></div>
          <div className="tv-marquee-container">
            <div className="tv-marquee-track">
              {[...marqueeItems, ...marqueeItems].map((item, idx) => (
                <span key={idx} className="tv-marquee-item"><span className="tv-marquee-star">*</span> {item}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="tv-footer-right">Melayani dengan Ramah, Cepat, dan Transparan</div>
      </footer>

      {/* Overlay Panggilan Fokus */}
      {callOverlay?.active && (
        <div className="tv-call-overlay">
          <div className="tv-call-overlay-box">
            <div className="tv-overlay-badge">PEMANGGILAN ANTREAN</div>
            <div className="tv-overlay-number">{callOverlay.ticketCode}</div>
            <div className="tv-overlay-counter">SILAKAN MENUJU {callOverlay.counterName}</div>
            <p style={{ color: '#cbd5e1', marginTop: '1.2rem', fontSize: '1.4rem' }}>{callOverlay.serviceTitle}</p>
          </div>
        </div>
      )}

      {/* Modal Startup Audio Gate Overlay saat Audio Terkunci */}
      {!isAudioReady && (
        <div className="tv-audio-startup-overlay" onClick={(e) => handleActivateAudio(e)}>
          <div className="tv-audio-startup-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'inline-flex', padding: '16px', background: 'rgba(245, 158, 11, 0.15)', borderRadius: '99px', marginBottom: '16px', color: '#f59e0b' }}>
              <Volume2 size={48} />
            </div>
            <h2 className="tv-audio-startup-title">SISTEM ANTRIAN DPPKB MAJENE</h2>
            <p className="tv-audio-startup-desc">
              {audioEngineState === 'BLOCKED'
                ? 'Suara panggilan terkunci oleh kebijakan keamanan browser. Tekan tombol di bawah atau sentuh layar untuk mengaktifkan kembali.'
                : 'Audio panggilan suara belum aktif. Tekan tombol di bawah atau sentuh layar untuk memulai pemanggilan antrean otomatis.'
              }
            </p>
            <button
              autoFocus
              tabIndex={0}
              onClick={(e) => handleActivateAudio(e)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleActivateAudio(e);
                }
              }}
              className="tv-audio-startup-btn"
            >
              <Volume2 size={24} /> AKTIFKAN SUARA & MULAI
            </button>
            <p className="tv-audio-startup-hint">
              Tekan OK / ENTER pada Remote Control TV atau sentuh sembarang tempat pada layar.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
