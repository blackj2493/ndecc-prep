import { Image, type ImageStyle, type StyleProp } from 'react-native';
import { photoUri } from '../lib/photos';

export function Photo({ name, style }: { name: string; style: StyleProp<ImageStyle> }) {
  return <Image source={{ uri: photoUri(name) }} style={style} />;
}
