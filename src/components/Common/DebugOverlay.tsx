import React, { useState, useEffect } from 'react';
import { queueAudioEngine, AudioEngineState, AudioTestResult } from '../../services/audio/QueueAudioEngine';
import { Bug, Volume2, RotateCcw, X, CheckCircle2, XCircle, Loader2, Activity } from 'lucide-react';

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
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'done'>('idle');
  const [testResult, setTestResult] = useState<AudioTestResult | null>(null);
  const [ctxInfo, setCtxInfo] = useState<Record<string, string | number | undefined>>({});

  useEffect(() => {
    const unsubscribe = queueAudioEngine.subscribeState((state) => {
      setAudioState(state);
      setCtxInfo(queueAudioEngine.getAudioContextInfo());
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

  const handleTestCallFull = async () => {
    if (testStatus === 'testing') return;
    setTestStatus('testing');
    setTestResult(null);
    try {
      await queueAudioEngine.unlockFromUserGesture();
      const result = await queueAudioEngine.testCallFull();
      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        success: false,
        durationMs: 0,
        steps: {
          context: { success: false, error: err?.message || 'ERROR' },
          assets:  { success: false },
          decode:  { success: false },
          chime:   { success: false },
          voice:   { success: false, error: err?.message || 'ERROR' }
        }
      });
    }
    setTestStatus('done');
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed', bottom: '12px', left: '12px', zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.85)', color: '#38bdf8',
          border: '1px solid #38bdf8', borderRadius: '999px',
          padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          gap: '6px', backdropFilter: 'blur(4px)'
        }}
      >
        <Bug size={14} /> Debug
      </button>
    );
  }

  const statusColor = (ok: boolean | undefined) => ok ? '#4ade80' : '#f87171';

  return (
    <div style={{
      position: 'fixed', bottom: '16px', left: '16px', zIndex: 99999,
      background: '#091733', color: '#ffffff', border: '2px solid #38bdf8',
      borderRadius: '16px', padding: '16px', maxWidth: '380px', width: '100%',
      boxShadow: '0 20px 50px rgba(0,0,0,0.8)', fontSize: '0.8rem', fontFamily: 'monospace'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #1e293b', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontWeight: 800 }}>
          <Activity size={15} /> AUDIO & VIEWPORT DEBUG
        </div>
        <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
          <X size={18} />
        </button>
      </div>

      {/* Audio State */}
      <div style={{ marginBottom: '10px', background: '#0f172a', padding: '10px', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#94a3b8' }}>Audio State:</span>
          <strong style={{ color: audioState === 'READY' || audioState === 'PLAYING' ? '#4ade80' : '#f59e0b' }}>{audioState}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#94a3b8' }}>AudioContext:</span>
          <strong style={{ color: ctxInfo.state === 'running' ? '#4ade80' : '#f87171' }}>{ctxInfo.state ?? 'N/A'}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#94a3b8' }}>Buffers:</span>
          <strong style={{ color: '#38bdf8' }}>{queueAudioEngine.getBufferCount()} loaded</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#94a3b8' }}>Jaringan:</span>
          <strong style={{ color: navigator.onLine ? '#4ade80' : '#f87171' }}>
            {navigator.onLine ? 'ONLINE' : 'OFFLINE'}
          </strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94a3b8' }}>UA:</span>
          <span style={{ color: '#475569', fontSize: '0.68rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{navigator.userAgent.substring(0, 40)}</span>
        </div>
      </div>

      {/* Viewport Metrics */}
      <div style={{ marginBottom: '10px', background: '#0f172a', padding: '10px', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#94a3b8' }}>Viewport:</span>
          <strong style={{ color: '#38bdf8' }}>{viewport.width} × {viewport.height} px</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#94a3b8' }}>DPR:</span>
          <strong style={{ color: '#38bdf8' }}>{viewport.dpr}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#94a3b8' }}>Orientasi:</span>
          <strong style={{ color: '#38bdf8' }}>{viewport.orientation}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94a3b8' }}>Fullscreen:</span>
          <strong style={{ color: viewport.fullscreen ? '#4ade80' : '#cbd5e1' }}>{viewport.fullscreen ? 'YA' : 'TIDAK'}</strong>
        </div>
      </div>

      {/* Audio Test Result — Terstruktur */}
      {testResult && (
        <div style={{ marginBottom: '10px', background: testResult.success ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', padding: '10px', borderRadius: '8px', border: `1px solid ${testResult.success ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}` }}>
          <div style={{ fontWeight: 800, marginBottom: '6px', color: testResult.success ? '#4ade80' : '#f87171' }}>
            {testResult.success ? '✅ AUDIO TEST PASS' : '❌ AUDIO TEST FAILED'}
          </div>
          {(['context','assets','decode','chime','voice'] as const).map(step => (
            <div key={step} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ color: '#94a3b8', textTransform: 'capitalize' }}>{step}:</span>
              <span style={{ color: testResult.steps[step].success ? '#4ade80' : '#f87171', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {testResult.steps[step].success ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                {testResult.steps[step].success ? 'PASS' : (testResult.steps[step].error || 'FAIL')}
              </span>
            </div>
          ))}
          <div style={{ color: '#475569', marginTop: '4px', fontSize: '0.72rem' }}>Durasi: {testResult.durationMs} ms</div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <button
          onClick={() => queueAudioEngine.playChime()}
          style={{ padding: '8px', background: '#1e293b', color: '#fff', border: '1px solid #38bdf8', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}
        >
          <Volume2 size={12} style={{ display: 'inline', marginRight: '4px' }} /> Tes Chime
        </button>
        <button
          onClick={handleTestCallFull}
          disabled={testStatus === 'testing'}
          style={{ padding: '8px', background: '#1e293b', color: '#fff', border: `1px solid ${testStatus === 'done' && testResult ? (testResult.success ? '#4ade80' : '#f87171') : '#f59e0b'}`, borderRadius: '6px', cursor: testStatus === 'testing' ? 'not-allowed' : 'pointer', fontSize: '0.72rem', fontWeight: 700 }}
        >
          {testStatus === 'testing'
            ? <><Loader2 size={11} style={{ display: 'inline', marginRight: '4px' }} />Menguji...</>
            : <><Volume2 size={12} style={{ display: 'inline', marginRight: '4px' }} />Tes Call A-001</>
          }
        </button>
      </div>

      <button
        onClick={async () => {
          const ok = await queueAudioEngine.unlockFromUserGesture();
          if (ok) setTestResult(null);
        }}
        style={{ width: '100%', padding: '8px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800 }}
      >
        <RotateCcw size={12} style={{ display: 'inline', marginRight: '4px' }} /> Reset / Unlock Audio
      </button>
    </div>
  );
};
