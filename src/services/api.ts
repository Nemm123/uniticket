import { EventItem, PurchasedTicket, CheckInResult } from '../types';
import * as storage from '../utils/storage';
import { getWalletSession } from './authSession';

/**
 * MOCK ASYNC API
 * This module abstracts all direct localStorage calls to simulate a remote backend.
 * All functions here are asynchronous.
 */

const MOCK_DELAY = 500; // ms

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// -------------------------------------
// TICKETS
// -------------------------------------

export async function fetchMyTickets(params?: { wallet?: string; eventId?: string; ticketCode?: string }): Promise<PurchasedTicket[]> {
  await delay(MOCK_DELAY);
  const allTickets = storage.getStoredPurchasedTickets();
  
  if (!params) return allTickets;
  
  return allTickets.filter(t => {
    let match = true;
    if (params.wallet && t.customerWallet !== params.wallet) match = false;
    if (params.eventId && t.eventId !== params.eventId) match = false;
    if (params.ticketCode && t.ticketCode !== params.ticketCode) match = false;
    return match;
  });
}

export async function createTickets(
  eventId: string,
  tierId: string,
  quantity: number,
  tickets: PurchasedTicket[]
): Promise<boolean> {
  await delay(MOCK_DELAY);
  return storage.savePurchaseAtomically(eventId, tierId, quantity, tickets);
}

export async function verifyTicketCheckIn(input: string): Promise<CheckInResult> {
  await delay(MOCK_DELAY);
  return storage.validateTicketForCheckIn(input);
}

export async function confirmCheckIn(ticketId: string): Promise<CheckInResult> {
  await delay(MOCK_DELAY);
  const session = getWalletSession();
  const checkedInBy = session?.walletAddress || 'Organizers';
  return storage.confirmTicketCheckIn(ticketId, checkedInBy);
}

// -------------------------------------
// EVENTS
// -------------------------------------

export async function fetchEvents(): Promise<EventItem[]> {
  await delay(MOCK_DELAY);
  return storage.getStoredEvents();
}

export async function updateEvent(event: EventItem): Promise<boolean> {
  await delay(MOCK_DELAY);
  return storage.updateStoredEvent(event);
}
