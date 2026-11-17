import Agency from '../classes/Agency';
import Contract, { STATUS_OUT, STATUS_RESERVED } from '../classes/Contract';
import { formatDateTime, formatLocalPhoneNumber, plate } from './utils';

// Messages to the client staff send from the agency's own WhatsApp with one tap: the chat opens
// with the text typed in, to check and send (no cost, no WhatsApp Business approval).
export type MessageKind = 'confirm'|'checkin'|'pickup'|'return';

// While reserved: the confirmation, the check-in link (the client fills in their papers before
// coming) and the pickup reminder; while the car is out, the return reminder.
export const messagesFor = (contract: Contract): MessageKind[] =>
  contract.status === STATUS_RESERVED ? [ 'confirm', 'checkin', 'pickup' ] : contract.status === STATUS_OUT ? [ 'return' ] : [];

export const whatsappUrl = (phone: string, text: string) => 'https://wa.me/' + phone.replace(/\D/g, '') + '?text=' + encodeURIComponent(text);

// `link`: the check-in page's, for 'checkin'.
export function messageText(kind: MessageKind, contract: Contract, agency: Agency|undefined, t: (key: string, params?: object) => string, money: (millimes: number) => string, link = ''): string {
  const car = contract.car;
  const place = kind === 'return' ? contract.return_location : contract.pickup_location;
  const signature = [ agency?.name, agency?.phone ? formatLocalPhoneNumber(agency.phone) : null ].filter(Boolean).join(' · ');
  return t('whatsapp:' + kind, {
    name: contract.client?.first_name ?? '',
    car: car ? `${car.manufacturer} ${car.model_name} (${plate(car.licence_plate)})` : '',
    start: formatDateTime(contract.starts_at),
    end: formatDateTime(contract.ends_at),
    place: place ? ' · ' + place : '',
    total: money(contract.total_price),
    link,
  }) + (signature ? '\n' + signature : '');
}
