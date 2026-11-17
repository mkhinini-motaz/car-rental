import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Contract from '../../classes/Contract';
import { useLang } from '../../store/hooks';
import { formatMoneyDisplay } from '../../support/utils';
import { ANGLE_OTHER, ANGLES, ContractDamage, STAGE_PICKUP, STAGE_RETURN } from '../../classes/Inspection';
import Card from '../ui/Card';
import Icon from '../ui/Icon';
import LangAwareView from '../common/LangAwareView';
import TranslatableText from '../common/TranslatableText';
import CarOutline from './CarOutline';
import { useColors } from '../../store/ThemeContext';

interface PhotoBoxProps {
  uri?: string|null,
  caption?: string,
  onPress?: () => void, // defaults to showing the photo full screen
}

// One photo of the inspection; empty boxes show a camera to take it.
export function PhotoBox({ uri, caption, onPress }: PhotoBoxProps): React.JSX.Element {
  const COLORS = useColors();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View style={styles.box}>
      <Pressable onPress={onPress ?? (() => uri && setIsOpen(true))} style={[ styles.frame, { backgroundColor: COLORS.canvas, borderColor: COLORS.line } ]}>
        {uri ?
          <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode='cover' /> :
          <Icon name={onPress ? 'camera-outline' : 'camera-off-outline'} size={36} color={COLORS.muted} />
        }
      </Pressable>
      {caption && <TranslatableText data={caption} className='text-meta text-center text-muted' />}
      <Modal visible={isOpen} animationType='fade' onRequestClose={() => setIsOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setIsOpen(false)}>
            {uri && <Image source={{ uri }} style={{ flex: 1 }} resizeMode='contain' />}
          </Pressable>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// `amounts`: false for damages another client was charged for.
export function DamageList({ damages, amounts = true }: { damages: ContractDamage[], amounts?: boolean }): React.JSX.Element {
  const { selectedLang } = useLang();
  return (
    <>
      {damages.map((damage, index) =>
        <LangAwareView key={damage.id} className='gap-x-2 items-center'>
          <Text className='text-body font-semibold text-ink'>{index + 1}.</Text>
          <Text className='text-body text-ink flex-1'>{damage.note || '—'}</Text>
          {amounts && !! damage.amount && <Text className='text-body font-semibold text-danger'>{formatMoneyDisplay(damage.amount, selectedLang)}</Text>}
        </LangAwareView>
      )}
    </>
  );
}

// The same angle before and after, one above the other and as large as the screen allows, to
// show a client that a scratch is new.
function CompareModal({ pickup, back, onClose }: { pickup?: string, back?: string, onClose: () => void }): React.JSX.Element {
  return (
    <Modal visible animationType='fade' onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
        <Pressable style={{ flex: 1, gap: 6 }} onPress={onClose}>
          {[ [ pickup, 'inspection:at_pickup' ], [ back, 'inspection:at_return' ] ].map(([ uri, caption ]) =>
            <View key={caption} style={{ flex: 1 }}>
              {uri ? <Image source={{ uri }} style={{ flex: 1 }} resizeMode='contain' /> : <View style={{ flex: 1 }} />}
              <TranslatableText data={caption!} className='text-body text-center text-white' />
            </View>
          )}
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

// Pickup and return side by side, angle by angle, then the damage marked at each.
export default function InspectionSummary({ data }: { data: Contract }): React.JSX.Element|null {
  const [comparing, setComparing] = useState<number|null>(null); // the angle shown before/after
  const photos = data.photos ?? [];
  const damages = data.damages ?? [];
  if (! photos.length && ! damages.length) {
    return null;
  }
  const photoAt = (stage: number, angle: number) => photos.find(photo => photo.stage === stage && photo.angle === angle)?.url;
  const extras = photos.filter(photo => photo.angle === ANGLE_OTHER);
  const pickupDamages = damages.filter(damage => damage.stage === STAGE_PICKUP);
  const returnDamages = damages.filter(damage => damage.stage === STAGE_RETURN);

  return (
    <Card>
      <TranslatableText data='inspection:label' className='text-title font-semibold text-ink' />
      {ANGLES.filter(angle => photoAt(STAGE_PICKUP, angle) || photoAt(STAGE_RETURN, angle)).map(angle =>
        <View key={angle}>
          <TranslatableText data={'inspection:angle:' + angle} className='text-body font-semibold text-ink' />
          <LangAwareView className='gap-x-2'>
            <PhotoBox uri={photoAt(STAGE_PICKUP, angle)} caption='inspection:at_pickup' onPress={photoAt(STAGE_PICKUP, angle) ? () => setComparing(angle) : undefined} />
            <PhotoBox uri={photoAt(STAGE_RETURN, angle)} caption='inspection:at_return' onPress={photoAt(STAGE_RETURN, angle) ? () => setComparing(angle) : undefined} />
          </LangAwareView>
        </View>
      )}
      {extras.length > 0 && <>
        <TranslatableText data='inspection:angle:7' className='text-body font-semibold text-ink' />
        <LangAwareView className='gap-2 flex-wrap'>
          {extras.map(photo =>
            <PhotoBox key={photo.id} uri={photo.url} caption={photo.stage === STAGE_PICKUP ? 'inspection:at_pickup' : 'inspection:at_return'} />
          )}
        </LangAwareView>
      </>}

      {pickupDamages.length > 0 && <>
        <TranslatableText data='inspection:damages:pickup' className='text-body font-semibold text-ink' />
        <CarOutline marks={pickupDamages} />
        <DamageList damages={pickupDamages} />
      </>}
      {comparing !== null && <CompareModal pickup={photoAt(STAGE_PICKUP, comparing)} back={photoAt(STAGE_RETURN, comparing)} onClose={() => setComparing(null)} />}
      {returnDamages.length > 0 && <>
        <TranslatableText data='inspection:damages:return' className='text-body font-semibold text-ink' />
        <CarOutline earlier={pickupDamages} marks={returnDamages} />
        <DamageList damages={returnDamages} />
      </>}
    </Card>
  );
}

const styles = StyleSheet.create({
  box: {
    width: '48%',
    gap: 2,
  },
  frame: {
    aspectRatio: 4 / 3,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
