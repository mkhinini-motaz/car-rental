import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Dialog, DialogActions, DialogTitle, Snackbar } from '@mui/material';
import { useT } from '../store/Store';
import { requestErrorKey } from '../support/alert';

interface FeedbackValue {
  notify: (key: string, severity?: 'success'|'error'|'info') => void,
  confirm: (key: string) => Promise<boolean>,
  requestError: (error: unknown) => void,
}

const FeedbackContext = createContext<FeedbackValue>(null as unknown as FeedbackValue);

// The web side of the phone app's Alert.alert: a snackbar for messages, a dialog to confirm.
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [message, setMessage] = useState<{ key: string, severity: 'success'|'error'|'info' }|null>(null);
  const [question, setQuestion] = useState<string|null>(null);
  const answer = useRef<(value: boolean) => void>(() => {});
  const queryClient = useQueryClient();

  // Any query that can't reach the API says so (the phone app's useNetworkErrorAlert, once for all).
  useEffect(() => queryClient.getQueryCache().subscribe(event => {
    if (event.type === 'updated' && event.action.type === 'error' && (event.action.error as any)?.code === 'ERR_NETWORK') {
      setMessage({ key: 'network:error', severity: 'error' });
    }
  }), [queryClient]);

  const value: FeedbackValue = {
    notify: (key, severity = 'info') => setMessage({ key, severity }),
    confirm: (key) => new Promise(resolve => {
      answer.current = resolve;
      setQuestion(key);
    }),
    requestError: (error) => setMessage({ key: requestErrorKey(error), severity: 'error' }),
  };
  const close = (result: boolean) => {
    setQuestion(null);
    answer.current(result);
  };

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {/* Not on a click elsewhere: the click that raises the next message would close it at once. */}
      <Snackbar open={!! message} autoHideDuration={5000} onClose={(_event, reason) => reason !== 'clickaway' && setMessage(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {message ? <Alert severity={message.severity} variant='filled' onClose={() => setMessage(null)}>{t(message.key)}</Alert> : undefined}
      </Snackbar>
      <Dialog open={question !== null} onClose={() => close(false)}>
        <DialogTitle>{question && t(question)}</DialogTitle>
        <DialogActions>
          <Button onClick={() => close(false)}>{t('common:cancel')}</Button>
          <Button variant='contained' onClick={() => close(true)} autoFocus>{t('common:confirm')}</Button>
        </DialogActions>
      </Dialog>
    </FeedbackContext.Provider>
  );
}

export const useFeedback = () => useContext(FeedbackContext);
