import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useColors } from '../../store/ThemeContext';

// The one look for every form field: a small label above a bordered input, an error below, in the
// agency's colours.
export function useFieldStyles() {
  const COLORS = useColors();
  return useMemo(() => StyleSheet.create({
    label: { fontSize: 14, fontWeight: '600', color: COLORS.ink, marginBottom: 6 },
    input: {
      minHeight: 48, borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
      fontSize: 16, color: COLORS.ink, backgroundColor: COLORS.surface,
    },
    inputError: { borderColor: COLORS.danger },
    helperText: { color: COLORS.danger, fontSize: 13, marginTop: 4 },
  }), [COLORS]);
}
