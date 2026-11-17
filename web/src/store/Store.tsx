import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { availableLangs, defaultLang, translate } from '../i18n';
import { refresh } from '../api/auth';
import { setOnUnauthorized } from '../api/client';
import { setUserToken } from '../support/auth';
import Translatable from '../classes/Translatable';
import User, { isOwner } from '../classes/User';

type Lang = keyof Translatable;

interface StoreValue {
  lang: Lang,
  setLang: (lang: Lang) => void,
  user: User|null,
  setUser: (user: User|null) => void,
  isRestoringSession: boolean,
}

const StoreContext = createContext<StoreValue>(null as unknown as StoreValue);

// The language (saved in this browser) and the signed-in user, restored from the saved token.
export default function Store({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [lang, setLangState] = useState<Lang>(defaultLang.code as Lang);
  const [user, setUser] = useState<User|null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    try { localStorage.setItem('lang', newLang); } catch {}
  };

  useEffect(() => {
    setOnUnauthorized(() => {
      setUser(null);
      queryClient.clear();
    });
    try {
      const savedLang = localStorage.getItem('lang');
      if (savedLang && savedLang in availableLangs) {
        setLangState(savedLang as Lang);
      }
    } catch {}
    refresh()
      .then(profile => {
        if (profile) {
          setUserToken(profile.access_token!);
          setUser(profile);
        }
      })
      .catch(() => {}) // offline or rejected token: the login page shows
      .finally(() => setIsRestoringSession(false));
  }, [queryClient]);

  // The page follows the language's direction; MUI reads it from the theme (see _app).
  useEffect(() => {
    document.documentElement.dir = availableLangs[lang].writeFrom === 'right' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang.replace('tn', '');
  }, [lang]);

  return (
    <StoreContext.Provider value={{ lang, setLang, user, setUser, isRestoringSession }}>
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);

export function useLang() {
  const { lang, setLang } = useStore();
  return { selectedLang: lang, isRtl: availableLangs[lang].writeFrom === 'right', setLang };
}

// t('car:daily_price', { price }) in the selected language.
export function useT() {
  const { lang } = useStore();
  return (key: string, params: Record<string, any> = {}) => translate(key, lang, params);
}

export function useUser(): User|null {
  return useStore().user;
}

// Owner-only actions are hidden from managers (the API refuses them anyway).
export function useIsOwner(): boolean {
  const user = useUser();
  return !! user && isOwner(user);
}

export function useAuthenticateUser() {
  const { setUser } = useStore();
  // Token first: the home page's queries start as soon as the user is set.
  return (user: User) => {
    setUserToken(user.access_token!);
    setUser(user);
  };
}
