// One line of a contract's history: who did what. `changes` depends on the action:
// updated: { field: [old, new] } (clients by name); picked_up / returned: { mileage, deposit | charges };
// closed: { deposit_kept, deposit_kept_reason }; payment_added / payment_removed: { amount, method }.
export default interface Activity {
  id: number,
  action: 'created'|'updated'|'cancelled'|'picked_up'|'returned'|'closed'|'payment_added'|'payment_removed',
  changes: Record<string, any>|null,
  user: { id: number, first_name: string, last_name: string }|null,
  created_at: number,
}
