import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { HandoverInput, invalidateContractQueries, pickup, takeBack } from '../api/contract';
import { STAGE_PICKUP } from '../classes/Inspection';

// Handovers happen in car parks with no signal: a pickup or return that can't reach the API is
// kept on the phone, photos included (their files stay in the app's cache), and sent again when
// the network is back (on start, when the app comes to the front, and every 30 s while waiting).
// ponytail: photos are referenced, not copied; an OS that empties the app's cache before the
// retry loses them. Copy them to the documents folder (react-native-fs) if that shows up.

const KEY = 'handover_queue';
const RETRY_EVERY = 30 * 1000;

export interface QueuedHandover {
  contractId: number,
  stage: number, // STAGE_PICKUP or STAGE_RETURN
  input: HandoverInput,
  queuedAt: number, // Unix seconds
  error?: string, // the API refused it (not a network problem): shown on the contract, can be dropped
}

let items: QueuedHandover[] = [];
let isLoaded = false;
const listeners = new Set<() => void>();

const save = async (next: QueuedHandover[]) => {
  items = next;
  listeners.forEach(listener => listener());
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
};

async function load() {
  if (! isLoaded) {
    isLoaded = true;
    items = JSON.parse(await AsyncStorage.getItem(KEY) ?? '[]');
    listeners.forEach(listener => listener());
  }
}

// A request that never got an answer (no network, timeout), as opposed to the API saying no.
export const isOffline = (error: any) => ! error?.response && (error?.code === 'ERR_NETWORK' || error?.code === 'ECONNABORTED' || error?.message === 'Network Error');

export async function enqueueHandover(contractId: number, stage: number, input: HandoverInput) {
  await load();
  await save([ ...items.filter(item => item.contractId !== contractId), { contractId, stage, input, queuedAt: Math.floor(Date.now() / 1000) } ]);
}

export async function discardHandover(contractId: number) {
  await save(items.filter(item => item.contractId !== contractId));
}

let isFlushing = false;

// Sends what is waiting, oldest first; stops at the first network failure.
export async function flushHandovers(queryClient: QueryClient) {
  await load();
  if (isFlushing) {
    return;
  }
  isFlushing = true;
  try {
    for (const item of items.filter(queued => ! queued.error)) {
      try {
        await (item.stage === STAGE_PICKUP ? pickup : takeBack)(item.contractId, item.input);
        await save(items.filter(queued => queued.contractId !== item.contractId));
        invalidateContractQueries(queryClient);
      } catch (error: any) {
        if (isOffline(error)) {
          break;
        }
        const message = Object.values(error?.response?.data?.errors ?? {}).flat()[0] ?? 'common:error:happened';
        await save(items.map(queued => queued.contractId === item.contractId ? { ...queued, error: String(message) } : queued));
      }
    }
  } finally {
    isFlushing = false;
  }
}

// What is waiting to be sent, for badges.
export function usePendingHandovers(): QueuedHandover[] {
  useEffect(() => {
    load();
  }, []);
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, () => items);
}

// Mounted once while logged in: retries on start, when the app comes back, and on a timer.
export function useHandoverQueue(queryClient: QueryClient) {
  const pending = usePendingHandovers();
  const waiting = pending.filter(item => ! item.error).length;
  useEffect(() => {
    flushHandovers(queryClient);
    const subscription = AppState.addEventListener('change', state => state === 'active' && flushHandovers(queryClient));
    return () => subscription.remove();
  }, [queryClient]);
  useEffect(() => {
    if (! waiting) {
      return;
    }
    const timer = setInterval(() => flushHandovers(queryClient), RETRY_EVERY);
    return () => clearInterval(timer);
  }, [waiting, queryClient]);
}
