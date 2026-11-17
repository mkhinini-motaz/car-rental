// The vehicle inspection done at pickup and at return.

export interface ContractPhoto {
  id: number,
  stage: 1|2,
  angle: number,
  url: string,
  created_at: number,
}

// Position on the car outline in thousandths of its width and height; the front is at the top.
export interface ContractDamage {
  id: number,
  stage: 1|2|null, // null: marked on the car outside a handover (already there when it came into the app)
  x: number,
  y: number,
  note: string|null,
  amount: number|null, // charged at return, millimes
  contract_id: number|null, // the rental whose handover marked it; null: already on the car
  repaired_at: number|null, // null: still on the car, shown at its next handovers
  created_at: number,
}

export const STAGE_PICKUP = 1;
export const STAGE_RETURN = 2;

// The fixed angles, in the order staff walk around the car, then extra close-ups.
export const ANGLES = [ 1, 2, 3, 4, 5, 6 ]; // front, back, left, right, interior, dashboard (km and fuel)
export const ANGLE_OTHER = 7;
