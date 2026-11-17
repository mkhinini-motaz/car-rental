// A signature is an SVG path in a 600 × 200 box, moves and lines only ('M10 20 L30 40 ...'), the
// format the API stores and prints on the contract.
export const SIGNATURE_WIDTH = 600;
export const SIGNATURE_HEIGHT = 200;

export type Stroke = [number, number][]; // points in the 600 × 200 box

export const toPath = (strokes: Stroke[]) => strokes.filter(stroke => stroke.length > 1)
  .map(stroke => stroke.map(([ x, y ], index) => (index ? 'L' : 'M') + Math.round(x) + ' ' + Math.round(y)).join(' ')).join(' ');

export function toStrokes(path: string|null): Stroke[] {
  const strokes: Stroke[] = [];
  for (const [ , command, x, y ] of (path ?? '').matchAll(/([ML])\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/g)) {
    if (command === 'M' || ! strokes.length) {
      strokes.push([]);
    }
    strokes[strokes.length - 1].push([ Number(x), Number(y) ]);
  }
  return strokes;
}
