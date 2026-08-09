import React, { useEffect } from 'react';
import { QueueProvider, useQueue } from './context/QueueContext';
import { Navbar } from './components/Common/Navbar';
import { KioskView } from './components/Kiosk/KioskView';
import { OperatorView } from './components/Operator/OperatorView';
import { TVDisplayView } from './components/TVDisplay/TVDisplayView';
import { AdminView } from './components/Admin/AdminView';
import { DebugOverlay } from './components/Common/DebugOverlay';
import { GlobalAudioHost } from './components/Common/GlobalAudioHost';
import './styles/index.css';

const MainContainer: React.FC = () => {
  const { activeTab, setActiveTab } = useQueue();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view === 'tv' || view === 'operator' || view === 'admin' || view === 'kiosk') {
      setActiveTab(view);
    }
  }, [setActiveTab]);

  const isDirectTV = window.location.search.includes('view=tv');

  if (activeTab === 'tv') {
    return (
      <div style={{ background: '#070d19', minHeight: '100vh' }}>
        {!isDirectTV && <Navbar />}
        <TVDisplayView />
        <DebugOverlay />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      <Navbar />
      <main style={{ flex: 1, paddingBottom: '40px' }}>
        {activeTab === 'kiosk' && <KioskView />}
        {activeTab === 'operator' && <OperatorView />}
        {activeTab === 'admin' && <AdminView />}
      </main>

      <DebugOverlay />

      <footer style={{
        background: '#0f172a',
        color: '#94a3b8',
        padding: '16px 24px',
        textAlign: 'center',
        fontSize: '0.82rem',
        borderTop: '1px solid #1e293b'
      }}>
        Sistem Antrean Pelayanan Publik DPPKB Kabupaten Majene - Berbasis Firebase Web SDK & PWA Safe-Fail (WITA / Asia/Makassar)
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <QueueProvider>
      <GlobalAudioHost />
      <MainContainer />
    </QueueProvider>
  );
};

export default App;
