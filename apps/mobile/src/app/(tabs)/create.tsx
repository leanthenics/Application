import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ImageSourceSheet } from '@/components/image-source-sheet';
import { createJob } from '@/api/client';
import { pickFromCamera, pickFromLibrary, prepareForUpload } from '@/lib/image';
import { useJobsStore } from '@/store/jobs';

export default function CreateScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const addJob = useJobsStore((s) => s.addJob);

  const canSubmit = !!imageUri && prompt.trim().length > 0 && !submitting;

  async function onCamera() {
    setSheetVisible(false);
    setError(null);
    try {
      const picked = await pickFromCamera();
      if (picked) setImageUri(picked.uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the camera.');
    }
  }

  async function onGallery() {
    setSheetVisible(false);
    setError(null);
    try {
      const picked = await pickFromLibrary();
      if (picked) setImageUri(picked.uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the gallery.');
    }
  }

  async function onSubmit() {
    if (!imageUri || prompt.trim().length === 0) return;
    setError(null);
    setSubmitting(true);
    try {
      const { base64, mimeType } = await prepareForUpload(imageUri);
      const { jobId } = await createJob({ image: base64, mimeType, prompt: prompt.trim() });
      addJob({
        jobId,
        inputThumbUri: imageUri,
        prompt: prompt.trim(),
        status: 'queued',
        result: null,
        error: null,
        createdAt: Date.now(),
      });
      setImageUri(null);
      setPrompt('');
      router.navigate('/results');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not submit. Check your connection and API URL.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Restyle your space</Text>

        <View style={styles.card}>
          {imageUri ? (
            <>
              <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <Pressable
                style={styles.editBtn}
                onPress={() => setSheetVisible(true)}
                hitSlop={10}
                accessibilityLabel="Change photo">
                <Ionicons name="pencil" size={18} color="#fff" />
              </Pressable>
            </>
          ) : (
            <Pressable style={styles.picker} onPress={() => setSheetVisible(true)}>
              <Ionicons name="image-outline" size={52} color="#208AEF" />
              <Text style={styles.pickerText}>Add a photo of your room</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.promptRow}>
          <TextInput
            style={styles.input}
            placeholder="Describe the changes you want…"
            placeholderTextColor="#8E8E93"
            value={prompt}
            onChangeText={setPrompt}
            maxLength={2000}
            multiline
          />
          <Pressable
            style={[styles.arrowBtn, !canSubmit && styles.arrowBtnDisabled]}
            onPress={onSubmit}
            disabled={!canSubmit}
            accessibilityLabel="Generate">
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons name="arrow-forward" size={24} color="#fff" />
            )}
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <ImageSourceSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onCamera={onCamera}
        onGallery={onGallery}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 16, gap: 16 },
  heading: { fontSize: 22, fontWeight: '700', color: '#000', marginTop: 4 },
  card: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F0F0F3',
  },
  picker: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  pickerText: { fontSize: 15, color: '#8E8E93', fontWeight: '500' },
  editBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 140,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    color: '#000',
  },
  arrowBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBtnDisabled: { backgroundColor: '#B7D6F7' },
  error: { color: '#FF3B30', fontSize: 14 },
});
