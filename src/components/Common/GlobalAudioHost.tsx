import React, { useEffect, useRef } from 'react';
import { queueAudioEngine } from '../../services/audio/QueueAudioEngine';

export const GlobalAudioHost: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      queueAudioEngine.bindPlayer(audioRef.current);
    }

    return () => {
      queueAudioEngine.unbindPlayer();
    };
  }, []);

  return (
    <audio
      ref={audioRef}
      preload="auto"
      playsInline
      style={{
        position: 'fixed',
        width: '1px',
        height: '1px',
        opacity: 0,
        pointerEvents: 'none',
        bottom: 0,
        right: 0
      }}
    />
  );
};
