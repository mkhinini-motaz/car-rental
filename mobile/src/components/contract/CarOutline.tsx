import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../../store/ThemeContext';

export interface DamageMark {
  x: number, // thousandths of the outline's width, from the left
  y: number, // thousandths of its height, from the top (the front of the car)
}

interface CarOutlineProps {
  older?: DamageMark[], // left from earlier rentals, not repaired yet, shown in orange
  earlier?: DamageMark[], // already recorded (at pickup), shown in grey
  marks: DamageMark[], // this inspection's, numbered from 1
  onPress?: (mark: DamageMark) => void,
}

// A car seen from above, front at the top. Tapping marks a damage where the finger landed.
export default function CarOutline({ older = [], earlier = [], marks, onPress }: CarOutlineProps): React.JSX.Element {
  const COLORS = useColors();
  const glass = { backgroundColor: COLORS.info + '24', borderColor: COLORS.primary };
  const [size, setSize] = useState({ width: 0, height: 0 });

  const marker = (mark: DamageMark, colour: string, label: string, key: string) => (
    <View
      key={key}
      pointerEvents='none'
      style={[ styles.marker, { backgroundColor: colour, left: mark.x / 1000 * size.width - 14, top: mark.y / 1000 * size.height - 14 } ]}
    >
      <Text style={[ styles.markerText, { color: COLORS.on } ]}>{label}</Text>
    </View>
  );

  return (
    <Pressable
      disabled={! onPress}
      onLayout={(event) => setSize(event.nativeEvent.layout)}
      onPress={(event) => size.width && onPress?.({
        x: Math.round(event.nativeEvent.locationX / size.width * 1000),
        y: Math.round(event.nativeEvent.locationY / size.height * 1000),
      })}
      style={styles.frame}
    >
      {/* The drawing ignores touches so that locationX/Y are relative to the frame. */}
      <View pointerEvents='none' style={[ styles.body, { borderColor: COLORS.primary, backgroundColor: COLORS.surface } ]}>
        <View style={[ styles.glass, glass, { top: '22%' } ]} />
        <View style={[ styles.roof, { borderColor: COLORS.primary + '66' } ]} />
        <View style={[ styles.glass, glass, { bottom: '14%', height: '9%' } ]} />
      </View>
      {[ [ '4%', '14%' ], [ '4%', '72%' ] ].map(([ side, top ]) => <View key={top} pointerEvents='none' style={[ styles.wheel, { left: side, top, backgroundColor: COLORS.muted } ]} />)}
      {[ [ '4%', '14%' ], [ '4%', '72%' ] ].map(([ side, top ]) => <View key={top} pointerEvents='none' style={[ styles.wheel, { right: side, top, backgroundColor: COLORS.muted } ]} />)}
      {older.map((mark, index) => marker(mark, COLORS.warn, '•', 'older-' + index))}
      {earlier.map((mark, index) => marker(mark, COLORS.muted, '•', 'earlier-' + index))}
      {marks.map((mark, index) => marker(mark, COLORS.danger, String(index + 1), 'mark-' + index))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: 'center',
    width: '70%',
    aspectRatio: 0.55,
    marginVertical: 10,
  },
  body: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    top: 0,
    bottom: 0,
    borderWidth: 3,
    borderRadius: 60,
  },
  glass: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    height: '12%',
    borderRadius: 12,
    borderWidth: 2,
  },
  roof: {
    position: 'absolute',
    left: '16%',
    right: '16%',
    top: '36%',
    bottom: '25%',
    borderRadius: 10,
    borderWidth: 2,
  },
  wheel: {
    position: 'absolute',
    width: '12%',
    height: '14%',
    borderRadius: 6,
  },
  marker: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: {
    fontWeight: '700',
  },
});
