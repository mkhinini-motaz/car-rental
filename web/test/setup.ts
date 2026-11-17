import { afterEach, vi } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

// A busy machine (or CI runner) renders MUI slowly: wait longer before giving up on a text.
configure({ asyncUtilTimeout: 15000 });

// Next's router as a page sees it: tests set the path, and read where the page navigated.
vi.mock('next/router', () => {
  const router = { pathname: '/', asPath: '/', query: {} as Record<string, string>, isReady: true, push: vi.fn(), replace: vi.fn(), back: vi.fn() };
  return { useRouter: () => router, default: router };
});

// jsdom has no blob URLs; photo previews only need a string.
URL.createObjectURL = () => 'blob:preview';
URL.revokeObjectURL = () => {};

// jsdom has no PointerEvent: the signature pad reads the pointer's position from it.
if (! window.PointerEvent) {
  window.PointerEvent = class extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  } as typeof PointerEvent;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});
