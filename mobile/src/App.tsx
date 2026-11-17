import { GestureHandlerRootView } from 'react-native-gesture-handler';
import RootNavigator from "./navigation/RootNavigator";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import Store from "./store/Store";
import { ThemeProvider } from "./store/ThemeContext";

const DAY = 24 * 60 * 60 * 1000;

// Lists open without network: the cache is kept on the phone for a day (cleared on logout).
export const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: DAY } } });
const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'query_cache' });

function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: DAY, buster: 'v2' }}>
        <Store>
          <ThemeProvider>
            <RootNavigator />
          </ThemeProvider>
        </Store>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}

export default App;
