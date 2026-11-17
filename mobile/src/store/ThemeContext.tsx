import React, { createContext, ReactNode, useContext, useMemo } from 'react';
import { useColorScheme, View } from 'react-native';
import { vars } from 'nativewind';
import { useQuery } from '@tanstack/react-query';
import { show } from '../api/agency';
import { THEME_MODE_DARK, THEME_MODE_LIGHT } from '../classes/Agency';
import { DEFAULT_THEME, isThemeId, Palette, PALETTES, Scheme } from '../classes/Theme';
import { useUser } from './hooks';

export type Colors = Palette & { scheme: Scheme };

const ThemeContext = createContext<Colors>({ ...PALETTES[DEFAULT_THEME].light, scheme: 'light' });

// The Tailwind colours (tailwind.config.js) are these variables, as 'r g b' for `<alpha-value>`.
const TAILWIND_COLORS = [ 'primary', 'nav', 'onNav', 'canvas', 'surface', 'line', 'ink', 'muted', 'ok', 'info', 'warn', 'danger' ] as const;
const channels = (hex: string) => [ 1, 3, 5 ].map(index => parseInt(hex.slice(index, index + 2), 16)).join(' ');

// The agency's theme, chosen by its owner (the default before sign-in), in light or dark as the
// owner set it or, by default, as the phone is set. Screens read it with `useColors()`, and every
// `bg-…`/`text-…` class follows it.
export function ThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const user = useUser();
  const device = useColorScheme();
  const { data: agency } = useQuery({ queryKey: ['agency.show'], queryFn: show, enabled: !! user.id });
  const scheme: Scheme = agency?.theme_mode === THEME_MODE_DARK ? 'dark' : agency?.theme_mode === THEME_MODE_LIGHT ? 'light' : device === 'dark' ? 'dark' : 'light';
  const palette = PALETTES[isThemeId(agency?.theme) ? agency.theme : DEFAULT_THEME][scheme];
  const value = useMemo(() => ({ ...palette, scheme }), [palette, scheme]);
  const variables = useMemo(() => vars(Object.fromEntries(TAILWIND_COLORS.map(key => [ '--color-' + key, channels(palette[key]) ]))), [palette]);

  return (
    <ThemeContext.Provider value={value}>
      <View style={[ { flex: 1 }, variables ]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export const useColors = () => useContext(ThemeContext);
