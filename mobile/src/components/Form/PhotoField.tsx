import React, { memo } from 'react';
import { Image, View } from 'react-native';
import { useLang } from '../../store/hooks';
import { askForPhoto, PhotoFile } from '../../support/photo';
import TranslatableText from '../common/TranslatableText';
import Button from '../ui/Button';
import { useFieldStyles } from './fieldStyles';

interface PhotoFieldProps {
  value: PhotoFile|null, // newly picked, not uploaded yet
  currentUrl?: string|null, // what is saved now
  label: string,
  onChange: (newValue: PhotoFile) => void,
}

function PhotoField({ value, currentUrl, label, onChange }: PhotoFieldProps): React.JSX.Element {
  const fieldStyles = useFieldStyles();
  const { selectedLang } = useLang();
  const uri = value?.uri ?? currentUrl;

  return (
    <View style={{ gap: 8 }}>
      <TranslatableText data={label} style={fieldStyles.label} />
      {uri && <Image source={{ uri }} style={{ width: '100%', height: 180, borderRadius: 10 }} resizeMode='cover' />}
      <Button label='photo:choose' variant='secondary' icon='camera-plus-outline' onPress={() => askForPhoto(selectedLang).then(photo => photo && onChange(photo))} />
    </View>
  );
}

export default memo(PhotoField);
