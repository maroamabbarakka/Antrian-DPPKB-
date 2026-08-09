import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Ticket, ServiceItem, Counter, Announcement, MediaItem, ServiceGroup } from '../types/queue';
import {
  INITIAL_SERVICES,
  INITIAL_COUNTERS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_MEDIA,
  getTodayStrWITA
} from '../services/queueService';
import { ttsService } from '../services/ttsService';
import { queueAudioEngine } from '../services/audio/QueueAudioEngine';
import { queueRepository } from '../services/queue/queueRepository';
import { db } from '../config/firebase';
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  where
} from 'firebase/firestore';

interface QueueContextType {
  tickets: Ticket[];
  counters: Counter[];
  services: ServiceItem[];
  announcements: Announcement[];
  mediaList: MediaItem[];
  activeTab: 'kiosk' | 'operator' | 'tv' | 'admin';
  setActiveTab: (tab: 'kiosk' | 'operator' | 'tv' | 'admin') => void;
  isOnline: boolean;
  selectedCounterId: string;
  setSelectedCounterId: (id: string) => void;
  callOverlay: {
    active: boolean;
    ticketCode: string;
    counterName: string;
    serviceTitle: string;
    serviceGroup?: ServiceGroup;
  } | null;
  issueTicket: (service: ServiceItem, priorityClass?: 'REGULAR' | 'PRIORITY') => Promise<Ticket>;
  callNextTicket: (counterId: string) => Promise<Ticket | null>;
  recallTicket: (ticketId: string) => Promise<void>;
  startServiceTicket: (ticketId: string) => void;
  completeTicket: (ticketId: string) => void;
  markNoShowTicket: (ticketId: string) => void;
  transferTicket: (ticketId: string, targetGroup: 'KB' | 'SK', targetCounterName: string) => Promise<void>;
  cancelTicket: (ticketId: string) => void;
  updateService: (service: ServiceItem) => void;
  updateCounter: (counter: Counter) => void;
  addAnnouncement: (announcement: Announcement) => void;
  updateAnnouncement: (announcement: Announcement) => void;
  deleteAnnouncement: (id: string) => void;
  addMedia: (media: MediaItem) => void;
  updateMedia: (media: MediaItem) => void;
  deleteMedia: (id: string) => void;
  overrideTicketStatus: (ticketId: string, newStatus: Ticket['status'], reason: string) => void;
}

const QueueContext = createContext<QueueContextType | undefined>(undefined);

type ConfigKey = 'services' | 'counters' | 'announcements' | 'mediaList';

const CONFIG_STORAGE_KEYS: Record<ConfigKey, string> = {
  services: 'dppkb_services',
  counters: 'dppkb_counters',
  announcements: 'dppkb_announcements',
  mediaList: 'dppkb_media'
};

const CONFIG_COLLECTION = 'queueConfig';
const SITE_ID = 'dppkb-majene-main';

type ActiveTab = 'kiosk' | 'operator' | 'tv' | 'admin';

const getInitialActiveTab = (): ActiveTab => {
  const view = new URLSearchParams(window.location.search).get('view');
  return view === 'operator' || view === 'tv' || view === 'admin' || view === 'kiosk'
    ? view
    : 'kiosk';
};

const readLocalJson = <T,>(key: string, fallback: T): T => {
  try {
    const local = localStorage.getItem(key);
    return local ? JSON.parse(local) as T : fallback;
  } catch {
    return fallback;
  }
};

const sortTickets = (items: Ticket[]) =>
  [...items].sort((a, b) => {
    if (a.priorityClass === 'PRIORITY' && b.priorityClass !== 'PRIORITY') return -1;
    if (a.priorityClass !== 'PRIORITY' && b.priorityClass === 'PRIORITY') return 1;
    return a.createdAt - b.createdAt;
  });

export const QueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>(getInitialActiveTab);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [selectedCounterId, setSelectedCounterId] = useState<string>('counter-1');

  const [services, setServices] = useState<ServiceItem[]>(() =>
    readLocalJson<ServiceItem[]>(CONFIG_STORAGE_KEYS.services, INITIAL_SERVICES)
  );
  const [counters, setCounters] = useState<Counter[]>(() =>
    readLocalJson<Counter[]>(CONFIG_STORAGE_KEYS.counters, INITIAL_COUNTERS)
  );
  const [announcements, setAnnouncements] = useState<Announcement[]>(() =>
    readLocalJson<Announcement[]>(CONFIG_STORAGE_KEYS.announcements, INITIAL_ANNOUNCEMENTS)
  );
  const [mediaList, setMediaList] = useState<MediaItem[]>(() => {
    const local = readLocalJson<MediaItem[] | null>(CONFIG_STORAGE_KEYS.mediaList, null);
    if (local) {
      const hasOfficialVideo = local.some((m) => m.url && m.url.includes('Infografis%20DPPKB%20Majene%202026'));
      if (hasOfficialVideo) return local;
    }
    return INITIAL_MEDIA;
  });

  const dateStr = getTodayStrWITA();

  const [tickets, setTickets] = useState<Ticket[]>(() =>
    readLocalJson<Ticket[]>(`antri_tickets_${dateStr}`, [])
  );

  const [callOverlay, setCallOverlay] = useState<{
    active: boolean;
    ticketCode: string;
    counterName: string;
    serviceTitle: string;
    serviceGroup?: ServiceGroup;
  } | null>(null);

  const initialConfigRef = useRef({ services, counters, announcements, mediaList });
  const processedCallIdsRef = useRef<Set<string>>(new Set());
  const callEventsBootstrappedRef = useRef<boolean>(false);
  const overlayTimeoutRef = useRef<number | null>(null);
  const lastCallId = useRef<string>('');
  const activeTabRef = useRef<ActiveTab>(activeTab);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    const savedCounterId = localStorage.getItem('dppkb_selected_counter_id');
    if (savedCounterId) setSelectedCounterId(savedCounterId);
  }, []);

  useEffect(() => {
    localStorage.setItem('dppkb_selected_counter_id', selectedCounterId);
  }, [selectedCounterId]);

  const cacheConfig = <T,>(key: ConfigKey, items: T[]) => {
    localStorage.setItem(CONFIG_STORAGE_KEYS[key], JSON.stringify(items));
  };

  const persistConfig = <T,>(key: ConfigKey, items: T[]) => {
    cacheConfig(key, items);
    if (!navigator.onLine) return;

    setDoc(doc(db, CONFIG_COLLECTION, key), {
      items,
      updatedAt: Date.now(),
      siteId: SITE_ID
    }, { merge: true }).catch((err) => {
      console.warn(`Gagal menyinkronkan ${key} ke Firestore:`, err);
    });
  };

  const replaceTicketsLocal = (newTickets: Ticket[]) => {
    const sorted = sortTickets(newTickets);
    setTickets(sorted);
    localStorage.setItem(`antri_tickets_${dateStr}`, JSON.stringify(sorted));
  };

  const upsertTicketLocal = (ticket: Ticket) => {
    setTickets((prev) => {
      const next = sortTickets([...prev.filter((t) => t.id !== ticket.id), ticket]);
      localStorage.setItem(`antri_tickets_${dateStr}`, JSON.stringify(next));
      return next;
    });
  };

  const syncTicketToCloudAsync = (ticket: Ticket) => {
    const ticketDocRef = doc(db, 'tickets', ticket.id);
    setDoc(ticketDocRef, ticket, { merge: true }).catch((e) => {
      console.warn('Gagal mengunggah tiket ke Firestore Cloud:', e);
    });
  };

  const triggerCallAnnouncement = (ticketCode: string, counterName: string, serviceTitle: string, callId?: string, serviceGroup?: ServiceGroup) => {
    const uniqueId = callId || `${ticketCode}-${counterName}-${Date.now()}`;
    if (lastCallId.current === uniqueId) return;
    lastCallId.current = uniqueId;

    if (overlayTimeoutRef.current) {
      window.clearTimeout(overlayTimeoutRef.current);
    }

    setCallOverlay({ active: true, ticketCode, counterName, serviceTitle, serviceGroup });

    if (activeTabRef.current === 'tv') {
      ttsService.announceCall(ticketCode, counterName, serviceTitle, serviceGroup, undefined, uniqueId);
    }

    overlayTimeoutRef.current = window.setTimeout(() => {
      setCallOverlay(null);
      overlayTimeoutRef.current = null;
    }, 10000);
  };

  useEffect(() => {
    if (!isOnline) return;

    const attachConfigListener = <T,>(
      key: ConfigKey,
      fallbackItems: T[],
      setter: React.Dispatch<React.SetStateAction<T[]>>
    ) => onSnapshot(doc(db, CONFIG_COLLECTION, key), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const cloudItems = Array.isArray(data.items) ? data.items as T[] : fallbackItems;
        setter(cloudItems);
        cacheConfig(key, cloudItems);
        return;
      }

      setDoc(doc(db, CONFIG_COLLECTION, key), {
        items: fallbackItems,
        updatedAt: Date.now(),
        siteId: SITE_ID
      }, { merge: true }).catch((err) => {
        console.warn(`Gagal membuat config awal ${key}:`, err);
      });
    }, (error) => {
      console.warn(`Firestore ${key} listener warning:`, error);
    });

    const unsubscribeServices = attachConfigListener<ServiceItem>('services', initialConfigRef.current.services, setServices);
    const unsubscribeCounters = attachConfigListener<Counter>('counters', initialConfigRef.current.counters, setCounters);
    const unsubscribeAnnouncements = attachConfigListener<Announcement>('announcements', initialConfigRef.current.announcements, setAnnouncements);
    const unsubscribeMedia = attachConfigListener<MediaItem>('mediaList', initialConfigRef.current.mediaList, setMediaList);

    return () => {
      unsubscribeServices();
      unsubscribeCounters();
      unsubscribeAnnouncements();
      unsubscribeMedia();
    };
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline) return;

    const qTickets = query(collection(db, 'tickets'), where('dateStr', '==', dateStr));
    const unsubscribeTickets = onSnapshot(qTickets, (snapshot) => {
      const cloudTickets: Ticket[] = [];
      snapshot.forEach((docSnap) => cloudTickets.push(docSnap.data() as Ticket));
      replaceTicketsLocal(cloudTickets);
    }, (error) => {
      console.warn('Firestore Realtime Tickets Listener Warning:', error);
    });

    const qCallEvents = query(collection(db, 'callEvents'), where('dateStr', '==', dateStr));
    const unsubscribeCalls = onSnapshot(qCallEvents, (snapshot) => {
      if (!callEventsBootstrappedRef.current) {
        snapshot.docs.forEach((docSnap) => processedCallIdsRef.current.add(docSnap.id));
        callEventsBootstrappedRef.current = true;
        return;
      }

      const newEvents = snapshot.docChanges()
        .filter((change) => change.type === 'added' || change.type === 'modified')
        .map((change) => ({ id: change.doc.id, data: change.doc.data() as any }))
        .filter((event) => !processedCallIdsRef.current.has(event.id))
        .sort((a, b) => (a.data.timestamp || 0) - (b.data.timestamp || 0));

      newEvents.forEach((event) => {
        processedCallIdsRef.current.add(event.id);
        if (event.data.ticketCode && event.data.counterName) {
          triggerCallAnnouncement(
            event.data.ticketCode,
            event.data.counterName,
            event.data.serviceTitle || 'Pelayanan',
            event.id,
            event.data.serviceGroup
          );
        }
      });
    }, (error) => {
      console.warn('Firestore Realtime Call Events Listener Warning:', error);
    });

    return () => {
      unsubscribeTickets();
      unsubscribeCalls();
    };
  }, [dateStr, isOnline]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `antri_tickets_${dateStr}` && e.newValue) {
        setTickets(JSON.parse(e.newValue));
      }
      if (e.key === CONFIG_STORAGE_KEYS.counters && e.newValue) setCounters(JSON.parse(e.newValue));
      if (e.key === CONFIG_STORAGE_KEYS.mediaList && e.newValue) setMediaList(JSON.parse(e.newValue));
      if (e.key === CONFIG_STORAGE_KEYS.announcements && e.newValue) setAnnouncements(JSON.parse(e.newValue));
      if (e.key === CONFIG_STORAGE_KEYS.services && e.newValue) setServices(JSON.parse(e.newValue));

      if (e.key === 'dppkb_live_call_event' && e.newValue) {
        const callData = JSON.parse(e.newValue);
        const callId = callData.id || `${callData.ticketCode}-${callData.counterName}-${callData.timestamp}`;
        if (!processedCallIdsRef.current.has(callId)) {
          processedCallIdsRef.current.add(callId);
          triggerCallAnnouncement(callData.ticketCode, callData.counterName, callData.serviceTitle, callId, callData.serviceGroup);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [dateStr]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => () => {
    if (overlayTimeoutRef.current) window.clearTimeout(overlayTimeoutRef.current);
  }, []);

  const issueTicket = async (service: ServiceItem, priorityClass: 'REGULAR' | 'PRIORITY' = 'REGULAR'): Promise<Ticket> => {
    if (!navigator.onLine) {
      throw new Error('Perangkat sedang offline. Nomor antrean harus dibuat saat terhubung ke server agar tidak dobel.');
    }

    const newTicket = await queueRepository.issueTicketAtomic(service, priorityClass, tickets);
    upsertTicketLocal(newTicket);
    return newTicket;
  };

  const callNextTicket = async (counterId: string): Promise<Ticket | null> => {
    const counter = counters.find((c) => c.id === counterId);
    if (!counter || !counter.active || counter.status !== 'OPEN') return null;

    const result = await queueRepository.callNextTicketAtomic(counter, dateStr);
    if (result) {
      processedCallIdsRef.current.add(result.callEvent.id);
      upsertTicketLocal(result.updatedTicket);

      const updatedCounters = counters.map((item) => item.id === counterId
        ? { ...item, currentTicketCode: result.updatedTicket.code, currentTicketId: result.updatedTicket.id }
        : item
      );
      setCounters(updatedCounters);
      persistConfig('counters', updatedCounters);

      triggerCallAnnouncement(
        result.updatedTicket.code,
        counter.name,
        result.updatedTicket.serviceTitle,
        result.callEvent.id,
        result.updatedTicket.serviceGroup
      );

      return result.updatedTicket;
    }

    return null;
  };

  const recallTicket = async (ticketId: string) => {
    const target = tickets.find((t) => t.id === ticketId);
    if (!target) return;

    const { updatedTicket, callEvent } = await queueRepository.recallTicketAtomic(target);
    upsertTicketLocal(updatedTicket);
    processedCallIdsRef.current.add(callEvent.id);

    triggerCallAnnouncement(
      updatedTicket.code,
      updatedTicket.counterName || 'Loket 1',
      updatedTicket.serviceTitle,
      callEvent.id,
      updatedTicket.serviceGroup
    );
  };

  const updateTicketStatus = (ticketId: string, patch: Partial<Ticket>) => {
    const target = tickets.find((t) => t.id === ticketId);
    if (!target) return;

    const updated: Ticket = {
      ...target,
      ...patch,
      version: target.version + 1
    };
    upsertTicketLocal(updated);
    syncTicketToCloudAsync(updated);
  };

  const clearCounterCurrentTicket = (ticketId: string) => {
    const next = counters.map((counter) => {
      if (counter.currentTicketId !== ticketId) return counter;
      const { currentTicketCode, currentTicketId, ...rest } = counter;
      return rest;
    });

    if (next !== counters) {
      setCounters(next);
      persistConfig('counters', next);
    }
  };

  const startServiceTicket = (ticketId: string) => {
    updateTicketStatus(ticketId, { status: 'SERVING', serviceStartedAt: Date.now() });
  };

  const completeTicket = (ticketId: string) => {
    updateTicketStatus(ticketId, { status: 'COMPLETED', completedAt: Date.now() });
    clearCounterCurrentTicket(ticketId);
  };

  const markNoShowTicket = (ticketId: string) => {
    updateTicketStatus(ticketId, { status: 'NO_SHOW' });
    clearCounterCurrentTicket(ticketId);
  };

  const transferTicket = async (ticketId: string, targetGroup: 'KB' | 'SK', targetCounterName: string) => {
    const target = tickets.find((t) => t.id === ticketId);
    if (!target) return;

    const updated = await queueRepository.transferTicketAtomic(target, targetGroup, targetCounterName, `Ditransfer ke ${targetGroup}`);
    upsertTicketLocal(updated);
    clearCounterCurrentTicket(ticketId);
  };

  const cancelTicket = (ticketId: string) => {
    updateTicketStatus(ticketId, { status: 'CANCELED' });
    clearCounterCurrentTicket(ticketId);
  };

  const updateService = (service: ServiceItem) => {
    const next = services.map((item) => item.id === service.id ? service : item);
    setServices(next);
    persistConfig('services', next);
  };

  const updateCounter = (counter: Counter) => {
    const next = counters.map((item) => item.id === counter.id ? counter : item);
    setCounters(next);
    persistConfig('counters', next);
  };

  const addAnnouncement = (ann: Announcement) => {
    const next = [...announcements, ann];
    setAnnouncements(next);
    persistConfig('announcements', next);
  };

  const updateAnnouncement = (ann: Announcement) => {
    const next = announcements.map((item) => item.id === ann.id ? ann : item);
    setAnnouncements(next);
    persistConfig('announcements', next);
  };

  const deleteAnnouncement = (id: string) => {
    const next = announcements.filter((item) => item.id !== id);
    setAnnouncements(next);
    persistConfig('announcements', next);
  };

  const addMedia = (med: MediaItem) => {
    const next = [...mediaList, med];
    setMediaList(next);
    persistConfig('mediaList', next);
  };

  const updateMedia = (med: MediaItem) => {
    const next = mediaList.map((item) => item.id === med.id ? med : item);
    setMediaList(next);
    persistConfig('mediaList', next);
  };

  const deleteMedia = (id: string) => {
    const next = mediaList.filter((item) => item.id !== id);
    setMediaList(next);
    persistConfig('mediaList', next);
  };

  const overrideTicketStatus = (ticketId: string, newStatus: Ticket['status'], reason: string) => {
    updateTicketStatus(ticketId, {
      status: newStatus,
      notes: `Override oleh Supervisor (${reason})`
    });
  };

  return (
    <QueueContext.Provider value={{
      tickets, counters, services, announcements, mediaList,
      activeTab, setActiveTab, isOnline, selectedCounterId, setSelectedCounterId,
      callOverlay,
      issueTicket, callNextTicket, recallTicket, startServiceTicket,
      completeTicket, markNoShowTicket, transferTicket, cancelTicket,
      updateService, updateCounter, addAnnouncement, updateAnnouncement, deleteAnnouncement,
      addMedia, updateMedia, deleteMedia, overrideTicketStatus
    }}>
      {children}
    </QueueContext.Provider>
  );
};

export const useQueue = () => {
  const context = useContext(QueueContext);
  if (!context) throw new Error('useQueue harus digunakan di dalam QueueProvider');
  return context;
};
