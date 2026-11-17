import {useContext, useEffect} from "react";
import I18nContext from "./context/I18nContext";
import {availableLangs, translate} from "../i18n";
import AuthContext from "./context/AuthContext";
import {setUserToken} from "../support/auth";
import User, { isOwner } from "../classes/User";
import {alertNetworkError} from "../support/alert";
import {formatMoneyDisplay} from "../support/utils";

export function useI18nContext() {
    return useContext(I18nContext);
}

export function useAuthContext() {
    return useContext(AuthContext);
}

export function useLangWriteFrom() {
    const { lang } = useI18nContext();
    return availableLangs[lang].writeFrom;
}

export function useLangCode() {
    const { lang } = useI18nContext();
    return lang;
}

export function useLang() {
    const { lang } = useI18nContext();
    return { selectedLang: lang, selectedLangWriteFrom: availableLangs[lang].writeFrom };
}

export function useSetLang() {
    const { setLang } = useI18nContext();
    return setLang;
}

export function useUser() : User {
    const { user } = useAuthContext();
    return user || {};
}

// Owner-only actions are hidden from managers (the API refuses them anyway).
export function useIsOwner(): boolean {
    return isOwner(useUser());
}

export function useIsRestoringSession(): boolean {
    const { isRestoringSession } = useAuthContext();
    return isRestoringSession;
}

export function useSetUser() {
    const { setUser } = useAuthContext();
    return setUser;
}

export function useAuthenticateUser() {
    const setUser = useSetUser();
    // Token first: the home screen's queries start as soon as the user is set.
    return (user: User) => setUserToken(user.access_token!).then(() => setUser(user));
}

// Replaces react-query v3's per-query onError, which TanStack Query v5 removed.
export function useNetworkErrorAlert(error: any) {
    const { selectedLang } = useLang();
    useEffect(() => {
        if (error?.code === 'ERR_NETWORK') {
            alertNetworkError(selectedLang);
        }
    }, [error, selectedLang]);
}

// translate() bound to the user's language: t('car:new'), t('dashboard:available', { count }).
export function useT() {
    const { selectedLang } = useLang();
    return (key: string, params = {}) => translate(key, selectedLang, params);
}

// Millimes as the user reads them: useMoney()(90000) → '90 TND'.
export function useMoney() {
    const { selectedLang } = useLang();
    return (millimes: number) => formatMoneyDisplay(millimes, selectedLang);
}
