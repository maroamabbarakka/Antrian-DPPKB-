export type ServiceGroup = 'KB' | 'SK';

export type TicketStatus = 
  | 'WAITING' 
  | 'CALLED' 
  | 'SERVING' 
  | 'TRANSFERRED' 
  | 'COMPLETED' 
  | 'NO_SHOW' 
  | 'CANCELED';

export interface ServiceItem {
  id: string;
  codeGroup: ServiceGroup;
  title: string;
  description: string;
  requirements: string[];
  slaMinutes: number;
  fee: string; // e.g. "Gratis (APBD/APBN)"
  targetCounter: string; // e.g. "Loket 1"
  active: boolean;
}

export interface Ticket {
  id: string;
  code: string; // A-001 / B-001
  sequence: number;
  dateStr: string; // YYYY-MM-DD WITA
  siteId: string;
  serviceGroup: ServiceGroup;
  serviceId: string;
  serviceTitle: string;
  status: TicketStatus;
  priorityClass: 'REGULAR' | 'PRIORITY';
  source: 'KIOSK' | 'ASSISTED';
  createdAt: number; // epoch ms
  calledAt?: number;
  serviceStartedAt?: number;
  completedAt?: number;
  counterId?: string;
  counterName?: string;
  operatorId?: string;
  operatorName?: string;
  callCount: number;
  version: number;
  idempotencyKey: string;
  notes?: string;
}

export interface Counter {
  id: string;
  name: string; // Loket 1, Loket 2, Pelayanan Sekretariat, dll.
  handledGroup: ServiceGroup | 'ALL';
  operatorName?: string;
  operatorUid?: string;
  active: boolean;
  status: 'OPEN' | 'BREAK' | 'CLOSED';
  currentTicketCode?: string;
  currentTicketId?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: 'INFORMASI' | 'PROGRAM' | 'DARURAT';
  active: boolean;
  order: number;
}

export interface MediaItem {
  id: string;
  title: string;
  sourceType: 'OFFLINE_MP4' | 'CLOUD_MP4' | 'YOUTUBE';
  url: string;
  offlineRequired: boolean;
  active: boolean;
  durationSec: number;
}

export interface PublicDisplayState {
  lastUpdated: number;
  currentCall: {
    ticketCode: string;
    counterName: string;
    serviceGroup: ServiceGroup;
    serviceTitle: string;
    timestamp: number;
  } | null;
  recentCalls: Array<{
    ticketCode: string;
    counterName: string;
    timeStr: string;
  }>;
  waitingKB: number;
  waitingSK: number;
}

export interface AuditLog {
  id: string;
  timestamp: number;
  actor: string;
  action: string;
  targetId: string;
  details: string;
  reason?: string;
}

