import Car from "./Car";

export default interface Availability {
  car: Car,
  period: [number, number],
}

// Where a free stretch sits in the searched period, in percent from its start (the free stretches
// lie within it), and the seconds it leaves uncovered before and after.
export function coverage(period: [number, number], searched: [number, number]) {
  const length = searched[1] - searched[0];
  return {
    from: (period[0] - searched[0]) / length * 100,
    to: (period[1] - searched[0]) / length * 100,
    missingBefore: period[0] - searched[0],
    missingAfter: searched[1] - period[1],
  };
}

// Seconds as whole days and hours, rounded up to the hour: 30 h is [1, 6].
export function daysAndHours(seconds: number): [number, number] {
  const hours = Math.ceil(seconds / 3600);
  return [ Math.floor(hours / 24), hours % 24 ];
}
