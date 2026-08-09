// GlobalAudioHost.tsx — Komponen ini tidak lagi diperlukan dalam arsitektur Web Audio baru.
// Engine baru (QueueAudioEngine v2) menggunakan AudioContext + AudioBufferSourceNode
// dan tidak membutuhkan persistent HTMLAudioElement.
// Komponen ini dipertahankan untuk menghindari perubahan import di App.tsx.

import React from 'react';

export const GlobalAudioHost: React.FC = () => {
  // Tidak ada HTMLAudioElement — semua audio melalui Web Audio API
  return null;
};
