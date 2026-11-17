import { useRef, useState } from 'react';
import { LayoutChangeEvent, Modal, PanResponder, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SIGNATURE_HEIGHT, SIGNATURE_WIDTH, Stroke, toPath, toStrokes } from '../../support/signature';
import TranslatableText from '../common/TranslatableText';
import LangAwareView from '../common/LangAwareView';
import Button from '../ui/Button';
import { useColors } from '../../store/ThemeContext';

// Strokes drawn as thin rotated views (the app has no SVG library): each segment is one view.
function Ink({ strokes, width }: { strokes: Stroke[], width: number }): React.JSX.Element {
  const COLORS = useColors();
  const scale = width / SIGNATURE_WIDTH;
  return (
    <>
      {strokes.flatMap((stroke, strokeIndex) => stroke.slice(1).map(([ x2, y2 ], index) => {
        const [ x1, y1 ] = stroke[index];
        const length = Math.hypot(x2 - x1, y2 - y1) * scale;
        return <View key={strokeIndex + '-' + index} pointerEvents='none' style={{
          position: 'absolute', height: 3, borderRadius: 1.5, backgroundColor: COLORS.ink, width: length + 2,
          left: (x1 + x2) / 2 * scale - (length + 2) / 2, top: (y1 + y2) / 2 * scale - 1.5,
          transform: [ { rotate: Math.atan2(y2 - y1, x2 - x1) + 'rad' } ],
        }} />;
      }))}
    </>
  );
}

// The client's signature: a preview, and a full-screen pad to draw it with a finger.
export default function SignatureField({ value, onChange, label = 'signature:label' }: { value: string|null, onChange: (path: string) => void, label?: string }): React.JSX.Element {
  const COLORS = useColors();
  const [isOpen, setIsOpen] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [previewWidth, setPreviewWidth] = useState(0);
  const [padWidth, setPadWidth] = useState(0);
  const padWidthRef = useRef(0);
  const toBox = (x: number, y: number): [number, number] => {
    const scale = SIGNATURE_WIDTH / (padWidthRef.current || 1);
    return [ Math.max(0, Math.min(SIGNATURE_WIDTH, x * scale)), Math.max(0, Math.min(SIGNATURE_HEIGHT, y * scale)) ];
  };
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    // Read the point now: the event is gone by the time the state updater runs.
    onPanResponderGrant: event => {
      const point = toBox(event.nativeEvent.locationX, event.nativeEvent.locationY);
      setStrokes(current => [ ...current, [ point ] ]);
    },
    onPanResponderMove: event => {
      const point = toBox(event.nativeEvent.locationX, event.nativeEvent.locationY);
      setStrokes(current => [ ...current.slice(0, -1), [ ...(current[current.length - 1] ?? []), point ] ]);
    },
  })).current;
  const open = () => {
    setStrokes([]);
    setIsOpen(true);
  };
  const onPadLayout = (event: LayoutChangeEvent) => {
    padWidthRef.current = event.nativeEvent.layout.width;
    setPadWidth(event.nativeEvent.layout.width);
  };

  return (
    <View style={{ gap: 8 }}>
      <TranslatableText data={label} className='text-body font-semibold text-ink' />
      {value && <View onLayout={event => setPreviewWidth(event.nativeEvent.layout.width)} style={{ aspectRatio: SIGNATURE_WIDTH / SIGNATURE_HEIGHT, borderWidth: 1, borderColor: COLORS.line, borderRadius: 8, overflow: 'hidden' }}>
        {previewWidth > 0 && <Ink strokes={toStrokes(value)} width={previewWidth} />}
      </View>}
      <Button label={value ? 'signature:again' : 'signature:sign'} variant='secondary' icon='draw' onPress={open} />

      <Modal visible={isOpen} animationType='slide' onRequestClose={() => setIsOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.canvas, padding: 16, gap: 12, justifyContent: 'center' }}>
          <TranslatableText data='signature:hint' className='text-body text-muted text-center' />
          <View
            {...responder.panHandlers}
            onLayout={onPadLayout}
            style={{ aspectRatio: SIGNATURE_WIDTH / SIGNATURE_HEIGHT, backgroundColor: 'white', borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, overflow: 'hidden' }}
          >
            {padWidth > 0 && <Ink strokes={strokes} width={padWidth} />}
          </View>
          <LangAwareView style={{ gap: 8 }}>
            <View style={{ flex: 1 }}><Button label='common:cancel' variant='secondary' onPress={() => setIsOpen(false)} /></View>
            <View style={{ flex: 1 }}><Button label='signature:clear' variant='secondary' icon='eraser' onPress={() => setStrokes([])} /></View>
            <View style={{ flex: 1 }}><Button label='common:save' icon='check' disabled={! toPath(strokes)} onPress={() => {
              onChange(toPath(strokes));
              setIsOpen(false);
            }} /></View>
          </LangAwareView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
