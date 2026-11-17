import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import I18nContext, { Lang } from './context/I18nContext'
import AuthContext from './context/AuthContext'
import { availableLangs, defaultLang } from "../i18n";
import { refresh } from "../api/auth";
import { setOnUnauthorized } from "../api/client";
import { setUserToken } from "../support/auth";
import User from "../classes/User";

interface StoreProps {
  children: any,
}

export default function Store({ children }: StoreProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const [lang, setLangState] = useState<Lang>(defaultLang.code);
  const [user, setUser] = useState<User>({} as User);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    AsyncStorage.setItem('lang', newLang);
  };

  useEffect(() => {
    setOnUnauthorized(() => {
      setUser({} as User);
      queryClient.clear();
    });

    const restoreLang = AsyncStorage.getItem('lang')
      .then(savedLang => savedLang && savedLang in availableLangs && setLangState(savedLang as Lang));
    const restoreUser = refresh()
      .then(profile => profile && setUserToken(profile.access_token!).then(() => setUser(profile)))
      .catch(() => {}); // offline or rejected token: the login screen shows
    Promise.all([restoreLang, restoreUser]).finally(() => setIsRestoringSession(false));
  }, [queryClient]);

  return (
    <I18nContext.Provider value={{ lang, setLang }}>
      <AuthContext.Provider value={{ user, setUser, isRestoringSession }}>
        {children}
      </AuthContext.Provider>
    </I18nContext.Provider>
  );
};
