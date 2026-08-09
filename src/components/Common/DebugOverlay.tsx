import React, { useState, useEffect } from 'react';
import { queueAudioEngine, AudioEngineState } from '../../services/audio/QueueAudioEngine';
import { Bug, Volume2, RotateCcw, Monitor, ShieldCheck, X } from 'lucide-react';

export const DebugOverlay: React.FC = () => {
  const [audioState, setAudioState] = useState<AudioEngineState>(queueAudioEngine.getState());
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio,
    orientation: window.screen?.orientation?.type || (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'),
    fullscreen: !!document.fullscreenElement
  });

  const [isOpen, setIsOpen] = useState<boolean>(() => {
    const search = window.location.search;
    return search.includes('debugAudio=1') || search.includes('debugLayout=1');
  });

  useEffect(() => {
    const unsubscribe = queueAudioEngine.subscribeState((state) => {
      setAudioState(state);
    });

    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: window.devicePixelRatio,
        orientation: window.screen?.orientation?.type || (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'),
        fullscreen: !!document.fullscreenElement
      });
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', handleResize);

    return () => {
      unsubscribe();
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleResize);
    };
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '12px',
          left: '12px',
          zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.85)',
          color: '#38bdf8',
          border: '1px solid #38bdf8',
          borderRadius: '999px',
          padding: '6px 12px',
          fontSize: '0.75rem',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backdropFilter: 'blur(4px)'
        }}
      >
        <Bug size={14} /> Debug Mode
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '16px',
      left: '16px',
      zIndex: 99999,
      background: '#091733',
      color: '#ffffff',
      border: '2px solid #38bdf8',
      borderRadius: '16px',
      padding: '16px',
      maxWidth: '360px',
      width: '100%',
      boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
      fontSize: '0.8rem',
      fontFamily: 'monospace'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #1e293b', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontWeight: 800 }}>
          <Bug size={16} /> AUDIO & VIEWPORT DIAGNOSTICS
        </div>
        <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
          <X size={18} />
        </button>
      </div>

      {/* State Audio Engine */}
      <div style={{ marginBottom: '12px', background: '#0f172a', padding: '10px', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#94a3b8' }}>Audio State:</span>
          <strong style={{ color: audioState === 'READY' || audioState === 'PLAYING' ? '#4ade80' : '#f59e0b' }}>{audioState}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#94a3b8' }}>Web Speech API:</span>
          <strong style={{ color: 'speechSynthesis' in window ? '#4ade80' : '#ef4444' }}>
            {'speechSynthesis' in window ? 'SUPPORTED' : 'UNSUPPORTED'}
          </strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94a3b8' }}>Network:</span>
          <strong style={{ color: navigator.onLine ? '#4ade80' : '#ef4444' }}>
            {navigator.onLine ? 'ONLINE' : 'OFFLINE'}
          </strong>
        </div>
      </div>

      {/* Viewport & Device Metrics */}
      <div style={{ marginBottom: '14px', background: '#0f172a', padding: '10px', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#94a3b8' }}>Viewport Size:</span>
          <strong style={{ color: '#38bdf8' }}>{viewport.width} x {viewport.height} px</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#94a3b8' }}>Device Pixel Ratio:</span>
          <strong style={{ color: '#38bdf8' }}>{viewport.dpr}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#94a3b8' }}>Orientasi:</span>
          <strong style={{ color: '#38bdf8' }}>{viewport.orientation}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94a3b8' }}>Fullscreen:</span>
          <strong style={{ color: viewport.fullscreen ? '#4ade80' : '#cbd5e1' }}>
            {viewport.fullscreen ? 'YES' : 'NO'}
          </strong>
        </div>
      </div>

      {/* Action Diagnostic Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <button
          onClick={() => queueAudioEngine.playChime()}
          style={{ padding: '8px', background: '#1e293b', color: '#fff', border: '1px solid #38bdf8', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}
        >
          <Volume2 size={12} style={{ display: 'inline', marginRight: '4px' }} /> Test Chime
        </button>
        <button
          onClick={() => queueAudioEngine.queueCall({
            id: `test-${Date.now()}`,
            ticketCode: 'A-001',
            counterName: 'Loket 1',
            serviceTitle: 'Pelayanan KB',
            serviceGroup: 'KB',
            timestamp: Date.now()
          })}
          style={{ padding: '8px', background: '#1e293b', color: '#fff', border: '1px solid #f59e0b', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}
        >
          <Volume2 size={12} style={{ display: 'inline', marginRight: '4px' }} /> Test Call A-001
        </button>
      </div>

      <button
        onClick={() => queueAudioEngine.unlockFromUserGesture()}
        style={{ width: '100%', marginTop: '8px', padding: '8px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800 }}
      >
        <RotateCcw size={12} style={{ display: 'inline', marginRight: '4px' }} /> Reset / Unlock Audio
      </button>
    </div>
  );
};
