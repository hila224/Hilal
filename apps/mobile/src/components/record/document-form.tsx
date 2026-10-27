// Dépôt d'un document dans le dossier : photo d'un document papier, image ou PDF.
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chips, Notice, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { DOCUMENT_TYPES, MAX_DOCUMENT_BYTES, uploadDocument, type PickedFile } from '@/lib/api-record';
import { errorMessage } from '@/lib/supabase';
import type { DocumentType } from '@/lib/types';
import { optionalText } from '@/lib/validation';

const TYPES: DocumentType[] = ['resultat_analyse', 'imagerie', 'ordonnance', 'compte_rendu', 'autre'];

/** Type MIME d'après l'extension, quand le sélecteur ne le donne pas. */
function guessMimeType(name: string): string {
  const extension = name.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'png') return 'image/png';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

const IMAGE_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.7,
  // iPhone : convertit les photos HEIC en JPEG, format accepté par le dossier.
  preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
};

export function DocumentForm({ patientId, consultationId, onDone }: {
  patientId: string;
  consultationId?: string | null;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [file, setFile] = useState<PickedFile | null>(null);
  const [type, setType] = useState<DocumentType>('resultat_analyse');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [titleError, setTitleError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function accept(picked: PickedFile) {
    setMessage(null);
    if (!DOCUMENT_TYPES[picked.mimeType]) {
      setMessage(t('documentForm.unsupported'));
      return;
    }
    if (picked.size && picked.size > MAX_DOCUMENT_BYTES) {
      setMessage(t('documentForm.tooLarge'));
      return;
    }
    setFile(picked);
    if (!title) setTitle(picked.name.replace(/\.[^.]+$/, ''));
  }

  function fromImage(result: ImagePicker.ImagePickerResult) {
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    const name = asset.fileName ?? `photo-${Date.now()}.jpg`;
    accept({ uri: asset.uri, name, mimeType: asset.mimeType ?? guessMimeType(name), size: asset.fileSize });
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setMessage(t('documentForm.cameraDenied'));
      return;
    }
    fromImage(await ImagePicker.launchCameraAsync(IMAGE_OPTIONS));
  }

  async function choosePhoto() {
    fromImage(await ImagePicker.launchImageLibraryAsync(IMAGE_OPTIONS));
  }

  async function chooseFile() {
    const result = await DocumentPicker.getDocumentAsync({ type: Object.keys(DOCUMENT_TYPES), copyToCacheDirectory: true });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) accept({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? guessMimeType(asset.name), size: asset.size });
  }

  async function upload() {
    if (!file) {
      setMessage(t('documentForm.noFile'));
      return;
    }
    if (title.trim().length < 2) {
      setTitleError(t('validation.required'));
      return;
    }
    setTitleError(undefined);
    setSaving(true);
    setMessage(null);
    try {
      await uploadDocument(patientId, file, {
        type,
        titre: title.trim(),
        description: optionalText(description),
        consultation_id: consultationId ?? null,
      });
      onDone();
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setMessage(
        code === 'unsupported-type' ? t('documentForm.unsupported') : code === 'too-large' ? t('documentForm.tooLarge') : errorMessage(e)
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ThemedText themeColor="textSecondary">{t('documentForm.intro')}</ThemedText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
        {Platform.OS !== 'web' ? <Button compact label={t('documentForm.takePhoto')} onPress={takePhoto} /> : null}
        <Button compact variant="secondary" label={t('documentForm.choosePhoto')} onPress={choosePhoto} />
        <Button compact variant="secondary" label={t('documentForm.chooseFile')} onPress={chooseFile} />
      </View>
      {file ? (
        <Card>
          <ThemedText type="small">{t('documentForm.selected', { name: file.name })}</ThemedText>
        </Card>
      ) : null}
      <ThemedText type="smallBold">{t('documentForm.type')}</ThemedText>
      <Chips options={TYPES.map((value) => ({ value, label: t(`record.documentType.${value}`) }))} value={type} onChange={setType} />
      <TextField
        label={t('documentForm.docTitle')}
        value={title}
        onChangeText={setTitle}
        placeholder={t('documentForm.docTitlePlaceholder')}
        error={titleError}
      />
      <TextField label={t('documentForm.description')} value={description} onChangeText={setDescription} multiline />
      {message ? <Notice tone="danger">{message}</Notice> : null}
      <Button label={t('documentForm.upload')} onPress={upload} loading={saving} />
    </>
  );
}
