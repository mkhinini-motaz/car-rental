import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { destroy, store } from '../../api/document';
import DocumentPhoto from '../../classes/Document';
import { Tone } from '../../constants';
import { useLang } from '../../store/hooks';
import { alertConfirm, alertRequestError } from '../../support/alert';
import { askForPhoto, PhotoFile } from '../../support/photo';
import LangAwareView from '../common/LangAwareView';
import TranslatableText from '../common/TranslatableText';
import Card from '../ui/Card';
import Icon from '../ui/Icon';
import { useColors } from '../../store/ThemeContext';

interface DocumentsProps {
  owner: 'car'|'client',
  ownerId: number,
  documents: DocumentPhoto[],
  types: number[],
  dates?: Record<number, { date: string, tone?: Tone }>, // the paper's expiry, shown beside it
  hint?: string,
}

// Photos of a car's or a client's papers, one row per kind: add with the camera, tap to see one
// full screen and delete it.
export default function Documents({ owner, ownerId, documents, types, dates = {}, hint }: DocumentsProps): React.JSX.Element {
  const COLORS = useColors();
  const { selectedLang } = useLang();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<DocumentPhoto|null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: [owner + '.show'] });
  const add = useMutation({
    mutationFn: ({ type, photo }: { type: number, photo: PhotoFile }) => store(owner, ownerId, type, photo),
    onSuccess: refresh,
    onError: requestError => alertRequestError(selectedLang, requestError),
  });
  const remove = useMutation({
    mutationFn: (id: number) => destroy(id),
    onSuccess: () => {
      setOpen(null);
      refresh();
    },
    onError: requestError => alertRequestError(selectedLang, requestError),
  });
  const onAdd = async (type: number) => {
    const photo = await askForPhoto(selectedLang);
    if (photo) {
      add.mutate({ type, photo });
    }
  };

  return (
    <Card>
      <TranslatableText data='document:title' className='text-title font-semibold text-ink' />
      {hint && <TranslatableText data={hint} className='text-meta text-muted' />}
      {types.map(type => {
        const photos = documents.filter(document => document.type === type);
        const date = dates[type];
        return (
          <LangAwareView key={type} style={{ alignItems: 'center', gap: 8, paddingVertical: 4 }}>
            <View style={{ flex: 1 }}>
              <TranslatableText data={'document:type:' + type} className='text-body text-ink' />
              {date && <TranslatableText data='document:until' params={{ date: date.date }} className='text-meta font-semibold' style={{ color: date.tone ? COLORS[date.tone] : COLORS.muted }} />}
            </View>
            <ScrollView horizontal style={{ flexGrow: 0, maxWidth: '55%' }} contentContainerStyle={{ gap: 6 }}>
              {photos.map(photo =>
                <TouchableOpacity key={photo.id} onPress={() => setOpen(photo)}>
                  <Image source={{ uri: photo.url }} style={{ width: 44, height: 44, borderRadius: 6, backgroundColor: COLORS.line }} />
                </TouchableOpacity>
              )}
            </ScrollView>
            {add.isPending && add.variables?.type === type ?
              <ActivityIndicator color={COLORS.primary} style={{ width: 44 }} /> :
              <TouchableOpacity onPress={() => onAdd(type)} hitSlop={6} style={{ width: 44, height: 44, borderRadius: 6, borderWidth: 1, borderColor: COLORS.line, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name='camera-plus-outline' color={COLORS.primary} />
              </TouchableOpacity>}
          </LangAwareView>
        );
      })}

      <Modal visible={!! open} animationType='fade' onRequestClose={() => setOpen(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
          <LangAwareView style={{ justifyContent: 'space-between', alignItems: 'center', padding: 12 }}>
            <TouchableOpacity onPress={() => setOpen(null)} hitSlop={8}><Icon name='close' size={24} color='white' /></TouchableOpacity>
            {remove.isPending ? <ActivityIndicator color='white' /> :
              <TouchableOpacity onPress={() => open && alertConfirm(selectedLang, 'document:delete:confirm', () => remove.mutate(open.id))} hitSlop={8}>
                <Icon name='trash-can-outline' size={24} color={COLORS.danger} />
              </TouchableOpacity>}
          </LangAwareView>
          <Pressable style={{ flex: 1 }} onPress={() => setOpen(null)}>
            {open && <Image source={{ uri: open.url }} style={{ flex: 1 }} resizeMode='contain' />}
          </Pressable>
        </SafeAreaView>
      </Modal>
    </Card>
  );
}
