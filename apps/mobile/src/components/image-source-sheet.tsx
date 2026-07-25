import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, type } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCamera: () => void;
  onGallery: () => void;
};

/** Bottom sheet offering Camera / Gallery, used to pick or change the image. */
export function ImageSourceSheet({ visible, onClose, onCamera, onGallery }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.sm }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Add a photo</Text>
          <Pressable style={styles.option} onPress={onCamera} android_ripple={{ color: colors.ripple }}>
            <View style={styles.optionIcon}>
              <Ionicons name="camera-outline" size={20} color={colors.primary} />
            </View>
            <Text style={styles.optionText}>Take photo</Text>
          </Pressable>
          <Pressable style={styles.option} onPress={onGallery} android_ripple={{ color: colors.ripple }}>
            <View style={styles.optionIcon}>
              <Ionicons name="images-outline" size={20} color={colors.primary} />
            </View>
            <Text style={styles.optionText}>Choose from gallery</Text>
          </Pressable>
          <Pressable style={[styles.option, styles.cancel]} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.md,
  },
  title: { ...type.label, color: colors.textMuted, marginBottom: spacing.xs, paddingHorizontal: spacing.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { ...type.subheading, fontWeight: '500', color: colors.text },
  cancel: { justifyContent: 'center', marginTop: spacing.xs },
  cancelText: { ...type.subheading, color: colors.danger, textAlign: 'center', width: '100%' },
});
