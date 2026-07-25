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
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { ImageSourceSheet } from '@/components/image-source-sheet';
import { Button } from '@/components/ui/button';
import { NightToggle } from '@/components/ui/night-toggle';
import { TextField } from '@/components/ui/text-field';
import { pickFromCamera, pickFromLibrary } from '@/lib/image';
import { useDraftStore } from '@/store/draft';
import { colors, radius, spacing, type } from '@/theme';

export default function CreateScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [night, setNight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const setDraft = useDraftStore((s) => s.setDraft);

  // Explicit numeric height for the photo card: the image fills it at 100% height,
  // so the card needs a concrete height (4:3 off the screen width), not aspectRatio.
  const { width: winW } = useWindowDimensions();
  const cardHeight = Math.round(((winW - spacing.lg * 2) * 3) / 4);

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
        <View style={styles.header}>
          <Text style={styles.heading}>Design your garden</Text>
          <Text style={styles.subheading}>Add a photo of your space to get started.</Text>
        </View>

        <View style={[styles.card, { height: cardHeight }, !imageUri && styles.cardEmpty]}>
          {imageUri ? (
            <>
              {/* In-flow (non-absolute) so Android paints it inside the rounded,
                  overflow-hidden card. An absoluteFill child disappears there. */}
              <Image source={{ uri: imageUri }} style={styles.cardImage} contentFit="cover" />
              <Pressable
                style={styles.editBtn}
                onPress={() => setSheetVisible(true)}
                hitSlop={10}
                accessibilityLabel="Change photo">
                <Ionicons name="pencil" size={17} color="#fff" />
              </Pressable>
            </>
          ) : (
            <Pressable style={styles.picker} onPress={() => setSheetVisible(true)}>
              <View style={styles.pickerIcon}>
                <Ionicons name="image-outline" size={34} color={colors.primary} />
              </View>
              <Text style={styles.pickerText}>Add a photo of your outdoor space</Text>
            </Pressable>
          )}
        </View>

        <TextField
          placeholder="Add optional details… (e.g. add a water feature)"
          value={prompt}
          onChangeText={setPrompt}
          maxLength={2000}
          multiline
        />

        <View style={styles.nightRow}>
          <View style={styles.nightIcon}>
            <Ionicons name="moon" size={18} color={colors.primary} />
          </View>
          <View style={styles.nightText}>
            <Text style={styles.nightTitle}>Night mode</Text>
            <Text style={styles.nightSubtitle}>Show your garden at night</Text>
          </View>
          <NightToggle value={night} onValueChange={setNight} />
        </View>

        <Button
          label="Choose a style"
          icon="arrow-forward"
          iconPosition="right"
          size="lg"
          onPress={onNext}
          disabled={!canProceed}
        />

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
  flex: { flex: 1, backgroundColor: colors.canvas },
  container: { padding: spacing.lg, gap: spacing.lg },
  header: { gap: spacing.xs, marginTop: spacing.xs },
  heading: { ...type.title, fontSize: 24, color: colors.text },
  subheading: { ...type.body, color: colors.textSecondary },
  card: {
    width: '100%',
    borderRadius: radius.lg,
    // NOTE: no `overflow: 'hidden'` here — on Android that clip stops the image
    // layer from painting (you get the card background instead). The image rounds
    // its own corners via `cardImage.borderRadius`.
    backgroundColor: colors.surfaceAlt,
  },
  cardEmpty: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  cardImage: { width: '100%', height: '100%', borderRadius: radius.lg },
  picker: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  pickerIcon: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerText: { ...type.bodyStrong, color: colors.textSecondary },
  editBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  nightIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nightText: { flex: 1 },
  nightTitle: { ...type.bodyStrong, fontSize: 16, color: colors.text },
  nightSubtitle: { ...type.caption, color: colors.textSecondary, marginTop: 1 },
  error: { ...type.body, color: colors.danger },
});
