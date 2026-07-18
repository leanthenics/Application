import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ImageSourceSheet } from '@/components/image-source-sheet';
import { pickFromCamera, pickFromLibrary } from '@/lib/image';
import { useDraftStore } from '@/store/draft';

export default function CreateScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [night, setNight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const setDraft = useDraftStore((s) => s.setDraft);

  // Only the photo is required now — the style (next screen) drives the design;
  // the text is optional extra detail.
  const canProceed = !!imageUri;

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

  // Hand the capture to the style-picker screen, which submits the job.
  function onNext() {
    if (!imageUri) return;
    setDraft({ imageUri, prompt: prompt.trim(), night });
    router.push('/style');
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Design your garden</Text>

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
              <Text style={styles.pickerText}>Add a photo of your outdoor space</Text>
            </Pressable>
          )}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Add optional details… (e.g. add a water feature)"
          placeholderTextColor="#8E8E93"
          value={prompt}
          onChangeText={setPrompt}
          maxLength={2000}
          multiline
        />

        <View style={styles.nightRow}>
          <Ionicons name="moon" size={20} color="#208AEF" />
          <View style={styles.nightText}>
            <Text style={styles.nightTitle}>Night mode</Text>
            <Text style={styles.nightSubtitle}>Show your garden at night</Text>
          </View>
          <Switch
            value={night}
            onValueChange={setNight}
            trackColor={{ true: '#208AEF' }}
            accessibilityLabel="Night mode"
          />
        </View>

        <Pressable
          style={[styles.nextBtn, !canProceed && styles.nextBtnDisabled]}
          onPress={onNext}
          disabled={!canProceed}
          accessibilityLabel="Choose a style">
          <Text style={styles.nextText}>Choose a style</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </Pressable>

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
  input: {
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
  nightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
  },
  nightText: { flex: 1 },
  nightTitle: { fontSize: 16, fontWeight: '600', color: '#000' },
  nightSubtitle: { fontSize: 13, color: '#8E8E93', marginTop: 1 },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#208AEF',
  },
  nextBtnDisabled: { backgroundColor: '#B7D6F7' },
  nextText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  error: { color: '#FF3B30', fontSize: 14 },
});
