// queueRepository.ts — Repositori Transaksi Atomik & Lifecycle Antrean Firestore Terpusat
// Menangani State Machine Tiket, Atomic Sequence, Recall Limit, Transfer History, dan Log Event

import { db } from '../../config/firebase';
import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where
} from 'firebase/firestore';
import { Counter, ServiceItem, Ticket, TicketStatus } from '../../types/queue';
import { getTodayStrWITA } from '../queueService';

const SITE_ID = 'dppkb-majene-main';

export const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  WAITING: ['CALLED', 'CANCELED'],
  CALLED: ['SERVING', 'NO_SHOW', 'WAITING'], // WAITING untuk recall/return SOP
  SERVING: ['COMPLETED', 'TRANSFERRED'],
  TRANSFERRED: ['WAITING'],
  COMPLETED: [],
  NO_SHOW: ['WAITING'], // Restore oleh supervisor/operator
  CANCELED: ['WAITING']  // Restore jika dibatalkan keliru
};

export function isValidTransition(from: TicketStatus, to: TicketStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export class QueueRepository {
  /**
   * Pembuatan Tiket Atomik dengan Idempotency Key & Transaction Sequence
   */
  public async issueTicketAtomic(
    service: ServiceItem,
    priorityClass: 'REGULAR' | 'PRIORITY' = 'REGULAR',
    existingTickets: Ticket[] = []
  ): Promise<Ticket> {
    const dateStr = getTodayStrWITA();
    const group = service.codeGroup;
    const prefixCode = group === 'KB' ? 'A' : 'B';
    const sequenceId = `${dateStr}_${SITE_ID}_${prefixCode}`;

    const existingMaxSeq = existingTickets
      .filter((t) => t.dateStr === dateStr && t.code.startsWith(`${prefixCode}-`))
      .reduce((max, t) => Math.max(max, t.sequence || 0), 0);

    const resultTicket = await runTransaction(db, async (transaction) => {
      const sequenceRef = doc(db, 'sequences', sequenceId);
      const sequenceSnap = await transaction.get(sequenceRef);

      const currentSeq = sequenceSnap.exists()
        ? Number(sequenceSnap.data().current || 0)
        : existingMaxSeq;

      const nextSeq = currentSeq + 1;
      const paddedNum = String(nextSeq).padStart(3, '0');
      const ticketId = `${dateStr}-${prefixCode}-${paddedNum}`;
      const ticketRef = doc(db, 'tickets', ticketId);
      const timestamp = Date.now();

      const ticket: Ticket = {
        id: ticketId,
        code: `${prefixCode}-${paddedNum}`,
        sequence: nextSeq,
        dateStr,
        siteId: SITE_ID,
        serviceGroup: group,
        serviceId: service.id,
        serviceTitle: service.title,
        status: 'WAITING',
        priorityClass,
        source: 'KIOSK',
        createdAt: timestamp,
        callCount: 0,
        version: 1,
        idempotencyKey: `${dateStr}-${prefixCode}-${timestamp}-${Math.random().toString(36).slice(2, 8)}`
      };

      const eventRef = doc(collection(db, 'ticketEvents'));
      const eventData = {
        id: eventRef.id,
        ticketId: ticket.id,
        ticketCode: ticket.code,
        type: 'ISSUED',
        fromStatus: null,
        toStatus: 'WAITING',
        serviceGroup: group,
        timestamp,
        siteId: SITE_ID
      };

      transaction.set(sequenceRef, {
        current: nextSeq,
        dateStr,
        prefixCode,
        siteId: SITE_ID,
        updatedAt: timestamp
      }, { merge: true });

      transaction.set(ticketRef, ticket);
      transaction.set(eventRef, eventData);

      return ticket;
    });

    return resultTicket;
  }

  /**
   * Transaksi Pemanggilan Antrean Berikutnya secara Atomik (Call Next Ticket)
   */
  public async callNextTicketAtomic(counter: Counter, dateStr: string): Promise<{ updatedTicket: Ticket; callEvent: any } | null> {
    if (!counter.active || counter.status !== 'OPEN') return null;

    const waitingSnapshot = await getDocs(query(
      collection(db, 'tickets'),
      where('dateStr', '==', dateStr)
    ));

    const candidates = waitingSnapshot.docs
      .map((docSnap) => docSnap.data() as Ticket)
      .filter((ticket) => ticket.status === 'WAITING')
      .filter((ticket) => counter.handledGroup === 'ALL' || ticket.serviceGroup === counter.handledGroup)
      .sort((a, b) => {
        if (a.priorityClass === 'PRIORITY' && b.priorityClass !== 'PRIORITY') return -1;
        if (a.priorityClass !== 'PRIORITY' && b.priorityClass === 'PRIORITY') return 1;
        return a.createdAt - b.createdAt;
      });

    for (const candidate of candidates) {
      const callEventRef = doc(collection(db, 'callEvents'));
      const result = await runTransaction(db, async (transaction) => {
        const ticketRef = doc(db, 'tickets', candidate.id);
        const ticketSnap = await transaction.get(ticketRef);
        if (!ticketSnap.exists()) return null;

        const latest = ticketSnap.data() as Ticket;
        if (latest.status !== 'WAITING') return null;
        if (counter.handledGroup !== 'ALL' && latest.serviceGroup !== counter.handledGroup) return null;

        const timestamp = Date.now();
        const updatedTicket: Ticket = {
          ...latest,
          status: 'CALLED',
          calledAt: timestamp,
          counterId: counter.id,
          counterName: counter.name,
          callCount: latest.callCount + 1,
          version: latest.version + 1
        };

        const callEvent = {
          id: callEventRef.id,
          dateStr,
          ticketId: updatedTicket.id,
          ticketCode: updatedTicket.code,
          counterName: counter.name,
          serviceTitle: updatedTicket.serviceTitle,
          serviceGroup: updatedTicket.serviceGroup,
          timestamp,
          siteId: SITE_ID
        };

        const eventRef = doc(collection(db, 'ticketEvents'));
        const ticketEventData = {
          id: eventRef.id,
          ticketId: updatedTicket.id,
          ticketCode: updatedTicket.code,
          type: 'CALLED',
          fromStatus: 'WAITING',
          toStatus: 'CALLED',
          counterId: counter.id,
          counterName: counter.name,
          timestamp,
          siteId: SITE_ID
        };

        transaction.set(ticketRef, updatedTicket, { merge: true });
        transaction.set(callEventRef, callEvent);
        transaction.set(doc(db, 'calls', 'latest'), callEvent, { merge: true });
        transaction.set(eventRef, ticketEventData);

        return { updatedTicket, callEvent };
      });

      if (result) return result;
    }

    return null;
  }

  /**
   * Memanggil Ulang Tiket (Recall Limit Enforcement maks 2x)
   */
  public async recallTicketAtomic(ticket: Ticket): Promise<{ updatedTicket: Ticket; callEvent: any }> {
    if (!ticket.counterName) {
      throw new Error('Tiket belum memiliki loket panggilan.');
    }

    if (ticket.callCount >= 3) {
      throw new Error('Batas maksimum pemanggilan ulang (recall) telah dicapai untuk tiket ini.');
    }

    const timestamp = Date.now();
    const updatedTicket: Ticket = {
      ...ticket,
      status: 'CALLED',
      calledAt: timestamp,
      callCount: ticket.callCount + 1,
      version: ticket.version + 1
    };

    const callEventRef = doc(collection(db, 'callEvents'));
    const callEventData = {
      id: callEventRef.id,
      dateStr: ticket.dateStr,
      ticketId: ticket.id,
      ticketCode: ticket.code,
      counterName: ticket.counterName,
      serviceTitle: ticket.serviceTitle,
      serviceGroup: ticket.serviceGroup,
      timestamp,
      siteId: SITE_ID
    };

    const ticketEventRef = doc(collection(db, 'ticketEvents'));
    const ticketEventData = {
      id: ticketEventRef.id,
      ticketId: ticket.id,
      ticketCode: ticket.code,
      type: 'RECALLED',
      fromStatus: ticket.status,
      toStatus: 'CALLED',
      counterName: ticket.counterName,
      timestamp,
      siteId: SITE_ID
    };

    await Promise.all([
      setDoc(doc(db, 'tickets', ticket.id), updatedTicket, { merge: true }),
      setDoc(callEventRef, callEventData),
      setDoc(doc(db, 'calls', 'latest'), callEventData, { merge: true }),
      setDoc(ticketEventRef, ticketEventData)
    ]);

    return { updatedTicket, callEvent: callEventData };
  }

  /**
   * Transfer Tiket ke Kelompok Layanan Lain dengan History Terdistribusi
   */
  public async transferTicketAtomic(
    ticket: Ticket,
    targetGroup: 'KB' | 'SK',
    targetCounterName: string,
    reason?: string
  ): Promise<Ticket> {
    const timestamp = Date.now();
    const updatedTicket: Ticket = {
      ...ticket,
      status: 'WAITING',
      serviceGroup: targetGroup,
      counterName: targetCounterName,
      notes: `Ditransfer dari ${ticket.serviceGroup} ke ${targetGroup} (${reason || 'Transfer Loket'})`,
      version: ticket.version + 1
    };

    const ticketEventRef = doc(collection(db, 'ticketEvents'));
    const ticketEventData = {
      id: ticketEventRef.id,
      ticketId: ticket.id,
      ticketCode: ticket.code,
      type: 'TRANSFERRED',
      fromGroup: ticket.serviceGroup,
      toGroup: targetGroup,
      fromStatus: ticket.status,
      toStatus: 'WAITING',
      reason,
      timestamp,
      siteId: SITE_ID
    };

    await Promise.all([
      setDoc(doc(db, 'tickets', ticket.id), updatedTicket, { merge: true }),
      setDoc(ticketEventRef, ticketEventData)
    ]);

    return updatedTicket;
  }
}

export const queueRepository = new QueueRepository();
