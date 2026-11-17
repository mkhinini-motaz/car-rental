import { Pricing } from '../api/agency';
import Client from '../classes/Client';
import { Extra, withAutoExtra } from '../classes/Contract';
import Translatable from '../classes/Translatable';
import { translate } from '../i18n';

// The fees that follow the second driver and the delivery places, from the agency's pricing:
// the driver's price per day, each place's fee for delivering and for collecting the car.
// A typed-in address has no fee; staff add one by hand if they charge it.
export function syncAutoExtras(
  extras: Extra[],
  rules: Pricing|undefined,
  selectedLang: keyof Translatable,
  { secondDriver, pickupLocation, returnLocation }: { secondDriver: Client|null, pickupLocation: string|null, returnLocation: string|null },
): Extra[] {
  if (! rules) {
    return extras;
  }
  const fee = (location: string|null) => rules.locations.find(place => place.name === location)?.fee ?? 0;
  const place = (kind: 'pickup'|'return', location: string|null) => fee(location) ?
    { name: translate('location:' + kind + ':extra', selectedLang, { place: location }), price: fee(location), per: 'rental' as const } :
    null;

  let result = withAutoExtra(extras, 'driver', secondDriver && rules.second_driver_price ?
    { name: translate('driver:second:extra', selectedLang), price: rules.second_driver_price, per: 'day' } :
    null);
  result = withAutoExtra(result, 'pickup', place('pickup', pickupLocation));
  return withAutoExtra(result, 'return', place('return', returnLocation));
}
