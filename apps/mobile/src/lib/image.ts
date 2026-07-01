import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type PickedImage = { uri: string };

/** Longest-edge cap for the uploaded image (architecture: resize to 768px). */
const MAX_EDGE = 768;
/** JPEG quality for the resized upload. */
const JPEG_QUALITY = 0.8;

/** Pick an image from the photo library (asks permission first). */
export async function pickFromLibrary(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Photo library access is needed to pick an image.');
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (result.canceled) return null;
  return { uri: result.assets[0].uri };
}

/** Take a photo with the camera (asks permission first). */
export async function pickFromCamera(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Camera access is needed to take a photo.');
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  if (result.canceled) return null;
  return { uri: result.assets[0].uri };
}

/**
 * Resize to 768px wide, JPEG-compress, and return raw base64 (no data-uri
 * prefix) ready for CreateJobRequest. Uses the SDK 57 ImageManipulator context API.
 */
export async function prepareForUpload(
  uri: string,
): Promise<{ base64: string; mimeType: 'image/jpeg' }> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: MAX_EDGE });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: JPEG_QUALITY,
    base64: true,
  });
  if (!result.base64) throw new Error('Could not process the selected image.');
  return { base64: result.base64, mimeType: 'image/jpeg' };
}
