// Today on this phone as Unix seconds: [ midnight, next midnight ).
export function todayBounds(now = new Date()): [number, number] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return [ start.getTime() / 1000, end.getTime() / 1000 ];
}
