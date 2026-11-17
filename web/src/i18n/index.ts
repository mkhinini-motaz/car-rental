import fr from './fr.json';
import en from './en.json';
import tnar from './tnar.json';
import tnfr from './tnfr.json';
import ar from './ar.json';
import Translatable from '../classes/Translatable';

// The phone app's dictionaries, copied as they are: add a key there and here, in all five files.
export const i18n: Record<keyof Translatable, Record<string, string>> = { fr, en, tnar, tnfr, ar };

export const availableLangs = {
  fr: { code: 'fr', writeFrom: 'left' },
  en: { code: 'en', writeFrom: 'left' },
  tnfr: { code: 'tnfr', writeFrom: 'left' },
  tnar: { code: 'tnar', writeFrom: 'right' },
  ar: { code: 'ar', writeFrom: 'right' },
};

export const defaultLang = availableLangs.tnfr;

// The key's text with its `${name}` params filled in; the key itself when it has no translation.
export function translate(key: string, languageCode: keyof Translatable, params: Record<string, any> = {}): string {
  let value = i18n[languageCode]?.[key] || key;
  for (const [ name, param ] of Object.entries(params)) {
    value = value.replace('${' + name + '}', String(param ?? ''));
  }
  return value;
}
