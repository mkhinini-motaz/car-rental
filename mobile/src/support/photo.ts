import { Alert } from 'react-native';
import { Asset, CameraOptions, ImagePickerResponse, launchCamera, launchImageLibrary } from 'react-native-image-picker';
import Translatable from '../classes/Translatable';
import { translate } from '../i18n';

// A picked photo as React Native's FormData uploads it.
export interface PhotoFile {
  uri: string,
  name: string,
  type: string,
}

// Small enough to upload several at once over mobile data, sharp enough to see a scratch.
const OPTIONS: CameraOptions = { mediaType: 'photo', maxWidth: 1600, maxHeight: 1600, quality: 0.7 };

const toPhotoFile = (response: ImagePickerResponse): PhotoFile|null => {
  const asset: Asset|undefined = response.assets?.[0];
  if (! asset?.uri) {
    return null;
  }
  return { uri: asset.uri, name: asset.fileName ?? 'photo.jpg', type: asset.type ?? 'image/jpeg' };
};

export const choosePhoto = () => launchImageLibrary(OPTIONS).then(toPhotoFile);

// Opens the camera; falls back to the gallery where there is none (simulators).
export async function takePhoto(): Promise<PhotoFile|null> {
  const response = await launchCamera(OPTIONS);
  return response.errorCode === 'camera_unavailable' ? choosePhoto() : toPhotoFile(response);
}

// Lets the user pick between the camera and the gallery.
export function askForPhoto(selectedLang: keyof Translatable): Promise<PhotoFile|null> {
  return new Promise(resolve => Alert.alert('', translate('photo:choose', selectedLang), [
    { text: translate('common:cancel', selectedLang), style: 'cancel', onPress: () => resolve(null) },
    { text: translate('photo:gallery', selectedLang), onPress: () => choosePhoto().then(resolve) },
    { text: translate('photo:camera', selectedLang), onPress: () => takePhoto().then(resolve) },
  ], { cancelable: true, onDismiss: () => resolve(null) }));
}
