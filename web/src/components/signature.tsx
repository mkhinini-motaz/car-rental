import React, { useRef, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, Stack, Typography } from '@mui/material';
import Draw from '@mui/icons-material/Draw';
import { useT } from '../store/Store';
import { SIGNATURE_HEIGHT, SIGNATURE_WIDTH, Stroke, toPath } from '../support/signature';

// A signature is dark ink on white paper in both themes, as on the printed contract.
const PAPER = '#FFFFFF';
const PEN = '#111826';

// The client's signature: a preview, and a pad to draw it with the mouse, a finger or a stylus.
export function SignatureField({ value, onChange, label = 'signature:label', hint = 'signature:hint' }: { value: string|null, onChange: (path: string) => void, label?: string, hint?: string }) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const pad = useRef<SVGSVGElement>(null);
  const isDrawing = useRef(false);
  const point = (event: React.PointerEvent): [number, number] => {
    const box = pad.current!.getBoundingClientRect();
    return [ (event.clientX - box.left) * SIGNATURE_WIDTH / box.width, (event.clientY - box.top) * SIGNATURE_HEIGHT / box.height ];
  };
  const svg = (path: string, height: number, props: object = {}) =>
    <svg viewBox={`0 0 ${SIGNATURE_WIDTH} ${SIGNATURE_HEIGHT}`} style={{ width: '100%', height, display: 'block', touchAction: 'none' }} {...props}>
      <path d={path} fill='none' stroke={PEN} strokeWidth={4} strokeLinecap='round' strokeLinejoin='round' />
    </svg>;

  return (
    <Stack sx={{ gap: 1 }}>
      <Typography sx={{ fontWeight: 600 }}>{t(label)}</Typography>
      {value && <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, maxWidth: 420, bgcolor: PAPER }}>{svg(value, 140)}</Box>}
      <Box><Button variant='outlined' startIcon={<Draw />} onClick={() => {
        setStrokes([]);
        setIsOpen(true);
      }}>{t(value ? 'signature:again' : 'signature:sign')}</Button></Box>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)} fullWidth maxWidth='md'>
        <DialogContent>
          <Typography color='text.secondary' sx={{ textAlign: 'center', mb: 1 }}>{t(hint)}</Typography>
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: PAPER, cursor: 'crosshair' }}>
            {svg(toPath(strokes), 260, {
              ref: pad,
              onPointerDown: (event: React.PointerEvent) => {
                event.currentTarget.setPointerCapture?.(event.pointerId);
                isDrawing.current = true;
                const start = point(event);
                setStrokes(current => [ ...current, [ start ] ]);
              },
              onPointerMove: (event: React.PointerEvent) => {
                if (isDrawing.current) {
                  const next = point(event);
                  setStrokes(current => [ ...current.slice(0, -1), [ ...(current[current.length - 1] ?? []), next ] ]);
                }
              },
              // A cancelled gesture (a system swipe, a second finger) ends the stroke too, or hovering would draw.
              onPointerUp: () => { isDrawing.current = false; },
              onPointerCancel: () => { isDrawing.current = false; },
              onLostPointerCapture: () => { isDrawing.current = false; },
            })}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsOpen(false)}>{t('common:cancel')}</Button>
          <Button onClick={() => setStrokes([])}>{t('signature:clear')}</Button>
          <Button variant='contained' disabled={! toPath(strokes)} onClick={() => {
            onChange(toPath(strokes));
            setIsOpen(false);
          }}>{t('common:save')}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
