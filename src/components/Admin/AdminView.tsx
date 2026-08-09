import React, { useState } from 'react';
import { useQueue } from '../../context/QueueContext';
import { ServiceItem, Counter, Announcement, MediaItem, Ticket } from '../../types/queue';
import { 
  BarChart3, Settings, ShieldAlert, FileSpreadsheet, Plus, 
  Trash2, MonitorPlay, Upload, Link as LinkIcon, Film
} from 'lucide-react';

export const AdminView: React.FC = () => {
  const { 
    tickets, services, announcements, mediaList, 
    updateService, addAnnouncement, deleteAnnouncement,
    addMedia, updateMedia, deleteMedia, overrideTicketStatus 
  } = useQueue();

  const [adminTab, setAdminTab] = useState<'supervisor' | 'services' | 'announcements' | 'media'>('supervisor');
  
  // State Override Ticket Modal
  const [overrideModalTicket, setOverrideModalTicket] = useState<Ticket | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<Ticket['status']>('WAITING');
  const [overrideReason, setOverrideReason] = useState<string>('');

  // State Form New Announcement
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnContent, setNewAnnContent] = useState('');
  const [newAnnCategory, setNewAnnCategory] = useState<'INFORMASI' | 'PROGRAM' | 'DARURAT'>('INFORMASI');

  // State Form New Video Media
  const [newMediaTitle, setNewMediaTitle] = useState('');
  const [newMediaSourceType, setNewMediaSourceType] = useState<'OFFLINE_MP4' | 'CLOUD_MP4' | 'YOUTUBE'>('CLOUD_MP4');
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaOfflineReq, setNewMediaOfflineReq] = useState(true);
  const [newMediaDuration, setNewMediaDuration] = useState(120);
  const [newMediaError, setNewMediaError] = useState<string | null>(null);

  // Handler Upload File MP4 Lokal
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const blobUrl = URL.createObjectURL(file);
      setNewMediaUrl(blobUrl);
      setNewMediaSourceType('OFFLINE_MP4');
      setNewMediaError('Berkas MP4 lokal hanya tersedia di browser admin saat ini. Untuk tampil di TV/device lain, unggah dulu ke hosting/cloud lalu pakai URL MP4 publik.');
      if (!newMediaTitle) {
        setNewMediaTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleAddMediaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNewMediaError(null);
    if (!newMediaTitle.trim() || !newMediaUrl.trim()) return;
    if (newMediaUrl.startsWith('blob:')) {
      setNewMediaError('Media belum bisa disimpan: URL blob lokal tidak sinkron lintas device. Gunakan link MP4 publik atau YouTube.');
      return;
    }

    addMedia({
      id: `med-${Date.now()}`,
      title: newMediaTitle,
      sourceType: newMediaSourceType,
      url: newMediaUrl,
      offlineRequired: newMediaOfflineReq,
      active: true,
      durationSec: Number(newMediaDuration) || 120
    });

    setNewMediaTitle('');
    setNewMediaUrl('');
  };

  // Metrik Statistik
  const totalTaken = tickets.length;
  const waitingCount = tickets.filter(t => t.status === 'WAITING').length;
  const calledCount = tickets.filter(t => t.status === 'CALLED').length;
  const servingCount = tickets.filter(t => t.status === 'SERVING').length;
  const completedCount = tickets.filter(t => t.status === 'COMPLETED').length;
  const noShowCount = tickets.filter(t => t.status === 'NO_SHOW').length;

  const handleExportCSV = () => {
    const headers = "ID Tiket,Kode,Kelompok,Jenis Layanan,Status,Loket,Waktu Buat\n";
    const rows = tickets.map(t => 
      `"${t.id}","${t.code}","${t.serviceGroup}","${t.serviceTitle}","${t.status}","${t.counterName || '-'}","${new Date(t.createdAt).toLocaleString('id-ID')}"`
    ).join("\n");

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Laporan_Antrean_DPPKB_Majene_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOverrideSubmit = () => {
    if (!overrideModalTicket || !overrideReason.trim()) return;
    overrideTicketStatus(overrideModalTicket.id, overrideStatus, overrideReason);
    setOverrideModalTicket(null);
    setOverrideReason('');
  };

  const handleAddAnnouncementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle.trim()) return;
    addAnnouncement({
      id: `ann-${Date.now()}`,
      title: newAnnTitle,
      content: newAnnContent,
      category: newAnnCategory,
      active: true,
      order: announcements.length + 1
    });
    setNewAnnTitle('');
    setNewAnnContent('');
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Admin Title & Tab Switcher */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Panel Admin & Supervisor</h2>
          <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0 }}>Manajemen Master Data, Konten Layanan & Oversight Operasional DPPKB Majene</p>
        </div>

        <div style={{ display: 'flex', gap: '8px', background: '#e2e8f0', padding: '4px', borderRadius: '10px' }}>
          <button
            onClick={() => setAdminTab('supervisor')}
            className={`btn ${adminTab === 'supervisor' ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            <BarChart3 size={16} /> Supervisor & Laporan
          </button>

          <button
            onClick={() => setAdminTab('services')}
            className={`btn ${adminTab === 'services' ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            <Settings size={16} /> Master Layanan
          </button>

          <button
            onClick={() => setAdminTab('announcements')}
            className={`btn ${adminTab === 'announcements' ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            <Settings size={16} /> Kartu Pengumuman
          </button>

          <button
            onClick={() => setAdminTab('media')}
            className={`btn ${adminTab === 'media' ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            <MonitorPlay size={16} /> Playlist Video TV
          </button>
        </div>
      </div>

      {/* TAB 1: SUPERVISOR & LAPORAN */}
      {adminTab === 'supervisor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Summary Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '16px' }}>
            <div className="card-modern" style={{ padding: '16px', background: '#f8fafc' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Total Tiket</span>
              <p style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>{totalTaken}</p>
            </div>
            <div className="card-modern" style={{ padding: '16px', background: '#fef3c7' }}>
              <span style={{ fontSize: '0.78rem', color: '#92400e' }}>Menunggu</span>
              <p style={{ fontSize: '1.8rem', fontWeight: 800, color: '#b45309', margin: 0 }}>{waitingCount}</p>
            </div>
            <div className="card-modern" style={{ padding: '16px', background: '#dbeafe' }}>
              <span style={{ fontSize: '0.78rem', color: '#1e40af' }}>Sedang Dipanggil</span>
              <p style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1d4ed8', margin: 0 }}>{calledCount}</p>
            </div>
            <div className="card-modern" style={{ padding: '16px', background: '#e0e7ff' }}>
              <span style={{ fontSize: '0.78rem', color: '#3730a3' }}>Sedang Dilayani</span>
              <p style={{ fontSize: '1.8rem', fontWeight: 800, color: '#4338ca', margin: 0 }}>{servingCount}</p>
            </div>
            <div className="card-modern" style={{ padding: '16px', background: '#dcfce7' }}>
              <span style={{ fontSize: '0.78rem', color: '#166534' }}>Selesai</span>
              <p style={{ fontSize: '1.8rem', fontWeight: 800, color: '#15803d', margin: 0 }}>{completedCount}</p>
            </div>
            <div className="card-modern" style={{ padding: '16px', background: '#fee2e2' }}>
              <span style={{ fontSize: '0.78rem', color: '#991b1b' }}>Tidak Hadir (No-Show)</span>
              <p style={{ fontSize: '1.8rem', fontWeight: 800, color: '#b91c1c', margin: 0 }}>{noShowCount}</p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleExportCSV} className="btn btn-success">
              <FileSpreadsheet size={18} /> Ekspor Laporan Lintas Hari (CSV)
            </button>
          </div>

          <div className="card-modern" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '16px' }}>Pengawasan Tiket & Override Status Supervisor</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '12px' }}>Kode</th>
                    <th style={{ padding: '12px' }}>Kelompok</th>
                    <th style={{ padding: '12px' }}>Jenis Layanan</th>
                    <th style={{ padding: '12px' }}>Status Saat Ini</th>
                    <th style={{ padding: '12px' }}>Loket</th>
                    <th style={{ padding: '12px' }}>Waktu Buat</th>
                    <th style={{ padding: '12px' }}>Aksi Supervisor</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                        Belum ada tiket antrean tercatat hari ini.
                      </td>
                    </tr>
                  ) : (
                    tickets.map(t => (
                      <tr key={t.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '12px', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>{t.code}</td>
                        <td style={{ padding: '12px' }}>
                          <span className={`badge ${t.serviceGroup === 'KB' ? 'badge-kb' : 'badge-sk'}`}>
                            {t.serviceGroup}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>{t.serviceTitle}</td>
                        <td style={{ padding: '12px' }}>
                          <span className={`badge status-${t.status.toLowerCase()}`}>{t.status}</span>
                        </td>
                        <td style={{ padding: '12px' }}>{t.counterName || '-'}</td>
                        <td style={{ padding: '12px' }}>{new Date(t.createdAt).toLocaleTimeString('id-ID')} WITA</td>
                        <td style={{ padding: '12px' }}>
                          <button
                            onClick={() => { setOverrideModalTicket(t); setOverrideStatus(t.status); }}
                            className="btn btn-outline"
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          >
                            <ShieldAlert size={14} /> Override Status
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MASTER LAYANAN */}
      {adminTab === 'services' && (
        <div className="card-modern" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '16px' }}>Master Data Jenis Pelayanan DPPKB Majene</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {services.map(srv => (
              <div key={srv.id} style={{ border: '1px solid #cbd5e1', borderRadius: '12px', padding: '16px', background: srv.active ? '#fff' : '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span className={`badge ${srv.codeGroup === 'KB' ? 'badge-kb' : 'badge-sk'}`}>{srv.codeGroup}</span>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={srv.active}
                      onChange={(e) => updateService({ ...srv, active: e.target.checked })}
                      style={{ marginRight: '6px' }}
                    />
                    {srv.active ? 'Status: Aktif' : 'Status: Nonaktif'}
                  </label>
                </div>

                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{srv.title}</h4>
                <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '8px' }}>{srv.description}</p>
                <div style={{ fontSize: '0.78rem', color: '#0d9488', fontWeight: 700 }}>SLA Standard: {srv.slaMinutes} Menit | Tarif: {srv.fee}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: KARTU PENGUMUMAN */}
      {adminTab === 'announcements' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
          <form onSubmit={handleAddAnnouncementSubmit} className="card-modern" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '14px' }}>Tambah Kartu Pengumuman</h4>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Judul Singkat:</label>
              <input
                type="text"
                value={newAnnTitle}
                onChange={(e) => setNewAnnTitle(e.target.value)}
                placeholder="Contoh: Pelayanan KB Keliling Malunda"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                required
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Isi Pengumuman:</label>
              <textarea
                value={newAnnContent}
                onChange={(e) => setNewAnnContent(e.target.value)}
                rows={3}
                placeholder="Teks informasi yang tampil pada footer TV..."
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                required
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Kategori:</label>
              <select
                value={newAnnCategory}
                onChange={(e) => setNewAnnCategory(e.target.value as any)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                <option value="INFORMASI">INFORMASI</option>
                <option value="PROGRAM">PROGRAM</option>
                <option value="DARURAT">DARURAT</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary w-full">
              <Plus size={16} /> Publikasikan Pengumuman
            </button>
          </form>

          <div className="card-modern" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '14px' }}>Daftar Pengumuman Layanan TV</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {announcements.map(ann => (
                <div key={ann.id} style={{ padding: '14px', border: '1px solid #cbd5e1', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', marginBottom: '4px' }}>{ann.category}</span>
                    <h5 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>{ann.title}</h5>
                    <p style={{ fontSize: '0.85rem', color: '#475569', margin: 0 }}>{ann.content}</p>
                  </div>
                  <button onClick={() => deleteAnnouncement(ann.id)} className="btn btn-outline" style={{ padding: '6px', color: '#dc2626' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PLAYLIST VIDEO TV DENGAN FORM TAMBAH VIDEO OFFLINE & ONLINE */}
      {adminTab === 'media' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
          {/* Form Tambah Video Playlist Baru */}
          <form onSubmit={handleAddMediaSubmit} className="card-modern" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Film size={20} style={{ color: '#0284c7' }} /> Tambah Video Playlist Baru
            </h4>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Judul Video:</label>
              <input
                type="text"
                value={newMediaTitle}
                onChange={(e) => setNewMediaTitle(e.target.value)}
                placeholder="Contoh: Profil Pelayanan KB Majene 2026"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                required
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Tipe Sumber Video:</label>
              <select
                value={newMediaSourceType}
                onChange={(e) => {
                  setNewMediaSourceType(e.target.value as any);
                  setNewMediaError(null);
                  if (newMediaUrl.startsWith('blob:')) setNewMediaUrl('');
                }}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                <option value="CLOUD_MP4">Link Video Online / Cloud MP4</option>
                <option value="OFFLINE_MP4">File MP4 Lokal (Tidak Lintas Device)</option>
                <option value="YOUTUBE">YouTube Embed Resmi</option>
              </select>
            </div>

            {/* Pilihan Unggah File MP4 Offline atau Input Link */}
            {newMediaSourceType === 'OFFLINE_MP4' ? (
              <div style={{ marginBottom: '12px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px dashed #0284c7' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '6px', color: '#0284c7' }}>
                  <Upload size={14} style={{ display: 'inline', marginRight: '4px' }} /> Unggah File Berkas MP4 Offline:
                </label>
                <input
                  type="file"
                  accept="video/mp4"
                  onChange={handleFileUpload}
                  style={{ width: '100%', fontSize: '0.82rem' }}
                />
                {newMediaUrl && (
                  <p style={{ fontSize: '0.75rem', color: '#b45309', marginTop: '6px', fontWeight: 700 }}>
                    File lokal terpilih untuk pratinjau perangkat ini saja.
                  </p>
                )}
              </div>
            ) : (
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>URL / Link Video Direct (MP4):</label>
                <input
                  type="url"
                  value={newMediaUrl}
                  onChange={(e) => setNewMediaUrl(e.target.value)}
                  placeholder="https://domain.com/video.mp4"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  required
                />
              </div>
            )}

            {newMediaError && (
              <div style={{
                marginBottom: '12px',
                padding: '10px 12px',
                borderRadius: '8px',
                background: '#fffbeb',
                border: '1px solid #f59e0b',
                color: '#92400e',
                fontSize: '0.8rem',
                fontWeight: 700,
                lineHeight: 1.35
              }}>
                {newMediaError}
              </div>
            )}

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Durasi (Detik):</label>
              <input
                type="number"
                value={newMediaDuration}
                onChange={(e) => setNewMediaDuration(Number(e.target.value))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={newMediaOfflineReq}
                  onChange={(e) => setNewMediaOfflineReq(e.target.checked)}
                />
                Prioritaskan cache perangkat jika browser mendukung
              </label>
            </div>

            <button type="submit" className="btn btn-primary w-full">
              <Plus size={16} /> Tambahkan ke Playlist Video TV
            </button>
          </form>

          {/* Daftar Playlist Video Aktif & Pengaturan */}
          <div className="card-modern" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '14px' }}>Daftar Playlist Video Layanan TV 16:9</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {mediaList.map(med => (
                <div key={med.id} style={{ border: '1px solid #cbd5e1', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: med.active ? '#fff' : '#f8fafc' }}>
                  <div style={{ flex: 1, paddingRight: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                      <span className="badge" style={{ background: med.sourceType === 'OFFLINE_MP4' ? '#dcfce7' : '#e0e7ff', color: med.sourceType === 'OFFLINE_MP4' ? '#15803d' : '#3730a3' }}>
                        {med.sourceType}
                      </span>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                        <input type="checkbox" checked={med.active} onChange={(e) => updateMedia({ ...med, active: e.target.checked })} style={{ marginRight: '4px' }} />
                        {med.active ? 'Status: Aktif' : 'Status: Nonaktif'}
                      </label>
                    </div>

                    <h5 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>{med.title}</h5>
                    <p style={{ fontSize: '0.78rem', color: '#64748b', wordBreak: 'break-all', margin: '4px 0 8px 0' }}>{med.url}</p>
                    <div style={{ fontSize: '0.75rem', color: med.offlineRequired ? '#0d9488' : '#64748b', fontWeight: 700 }}>
                      {med.offlineRequired ? 'OK - Wajib Cache Offline PWA' : 'Streaming Online'}
                    </div>
                  </div>

                  <button onClick={() => deleteMedia(med.id)} className="btn btn-outline" style={{ padding: '6px', color: '#dc2626' }} title="Hapus Video dari Playlist">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Override Status Tiket */}
      {overrideModalTicket && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '16px'
        }}>
          <div className="card-modern" style={{ maxWidth: '420px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '8px' }}>Override Tiket {overrideModalTicket.code}</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>
              Setiap koreksi status wajib menyantumkan alasan resmi untuk pencatatan audit log.
            </p>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Status Baru:</label>
              <select
                value={overrideStatus}
                onChange={(e) => setOverrideStatus(e.target.value as any)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                <option value="WAITING">WAITING (Kembalikan ke Antrean)</option>
                <option value="CALLED">CALLED (Panggil ke Loket)</option>
                <option value="SERVING">SERVING (Sedang Dilayani)</option>
                <option value="COMPLETED">COMPLETED (Selesai)</option>
                <option value="NO_SHOW">NO_SHOW (Tidak Hadir)</option>
                <option value="CANCELED">CANCELED (Batalkan)</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Alasan Koreksi Supervisor:</label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Contoh: Pengunjung hadir kembali dari toilet..."
                rows={3}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setOverrideModalTicket(null)} className="btn btn-outline w-full">Batal</button>
              <button onClick={handleOverrideSubmit} className="btn btn-primary w-full">Simpan Override</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

