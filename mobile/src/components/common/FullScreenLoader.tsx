import React, { memo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useColors } from '../../store/ThemeContext';

interface FullScreenLoaderProps {

}

function FullScreenLoader({ }: FullScreenLoaderProps): React.JSX.Element {
  const COLORS = useColors();
  return (
    <View style={[ styles.container, { backgroundColor: COLORS.canvas } ]}>
      <ActivityIndicator size={'large'} color={COLORS.primary} style={styles.indicator} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    transform: [{ scaleX: 2 }, { scaleY: 2 }]
  }
});

export default memo(FullScreenLoader);