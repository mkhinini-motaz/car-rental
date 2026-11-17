import { Linking, Share } from 'react-native';
import { pdfLink } from '../api/contract';
import Translatable from '../classes/Translatable';
import { useLang } from '../store/hooks';
import { alertRequestError } from './alert';

// Paperwork comes in French or Arabic: Arabic for the Arabic-script app languages.
export const pdfLang = (lang: keyof Translatable): 'fr'|'ar' => lang === 'ar' || lang === 'tnar' ? 'ar' : 'fr';

// Opens a contract's PDF in the phone's viewer (to read or print), or shares its link (WhatsApp...).
export function usePdf(contractId: number) {
  const { selectedLang } = useLang();
  return async (kind: 'contract'|'invoice'|'receipt', { lang = pdfLang(selectedLang), paymentId, share = false }: { lang?: 'fr'|'ar', paymentId?: number, share?: boolean } = {}) => {
    try {
      const url = await pdfLink(contractId, kind, lang, paymentId);
      await (share ? Share.share({ message: url }) : Linking.openURL(url));
    } catch (error) {
      alertRequestError(selectedLang, error);
    }
  };
}
