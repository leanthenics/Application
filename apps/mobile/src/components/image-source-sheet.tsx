import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Add a photo</Text>
          <Pressable style={styles.option} onPress={onCamera} android_ripple={{ color: '#E5E5EA' }}>
            <Ionicons name="camera-outline" size={22} color="#208AEF" />
            <Text style={styles.optionText}>Take photo</Text>
          </Pressable>
          <Pressable style={styles.option} onPress={onGallery} android_ripple={{ color: '#E5E5EA' }}>
            <Ionicons name="images-outline" size={22} color="#208AEF" />
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
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D1D6',
    marginBottom: 12,
  },
  title: { fontSize: 15, fontWeight: '600', color: '#8E8E93', marginBottom: 6, paddingHorizontal: 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  optionText: { fontSize: 17, color: '#000' },
  cancel: { justifyContent: 'center', marginTop: 4 },
  cancelText: { fontSize: 17, fontWeight: '600', color: '#FF3B30' },
});
