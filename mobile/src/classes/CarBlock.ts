// Days a car is off the planning without a contract; bookings can't use them.
export default interface CarBlock {
  id: number,
  car_id: number,
  starts_at: number,
  ends_at: number,
  reason: 1|2|3,
  note: string|null,
}

export const REASON_MAINTENANCE = 1;
export const REASON_PERSONAL = 2;
export const REASON_OTHER = 3;
export const REASONS = [ REASON_MAINTENANCE, REASON_PERSONAL, REASON_OTHER ];
