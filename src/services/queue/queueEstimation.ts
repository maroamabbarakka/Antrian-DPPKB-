// queueEstimation.ts — Perhitungan Estimasi Waktu Tunggu (ETA) Terpusat untuk Kios & TV

export interface EtaCalcInput {
  waitingCount: number;
  activeCountersCount: number;
  slaMinutes?: number;
}

export interface EtaCalcOutput {
  minMinutes: number;
  maxMinutes: number;
  text: string;
}

/**
 * Rumus Estimasi Waktu Tunggu (ETA) terpadu.
 * Memastikan tidak ada perbedaan rumus antara Kios dan TV Display.
 */
export function calculateEstimatedWait(input: EtaCalcInput): EtaCalcOutput {
  const { waitingCount, activeCountersCount, slaMinutes = 12 } = input;

  if (waitingCount <= 0) {
    return {
      minMinutes: 0,
      maxMinutes: 2,
      text: "Segera dipanggil"
    };
  }

  const counters = Math.max(1, activeCountersCount);
  const estimatedTotal = Math.ceil((waitingCount * slaMinutes) / counters);
  const min = Math.max(2, estimatedTotal - 3);
  const max = estimatedTotal + 5;

  return {
    minMinutes: min,
    maxMinutes: max,
    text: `Sekitar ${min} - ${max} menit`
  };
}
