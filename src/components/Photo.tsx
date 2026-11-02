import { Image, type ImageStyle, type StyleProp } from 'react-native';
import { photoUri } from '../lib/photos';

export const usePhotoUri = (name: string): string | null => photoUri(name);

export function Photo({ name, style }: { name: string; style: StyleProp<ImageStyle> }) {
  return <Image source={{ uri: photoUri(name) }} style={style} />;
}
