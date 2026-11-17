import { createContext } from "react";
import Translatable from "../../classes/Translatable";

export type Lang = keyof Translatable;

const I18nContext = createContext<{ lang: Lang, setLang: (lang: Lang) => void }>({ lang: 'tnfr', setLang: () => {} });

export default I18nContext;
