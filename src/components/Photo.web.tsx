import { useEffect, useState } from 'react';
import { Image, View, type ImageStyle, type StyleProp } from 'react-native';
import { loadPhotoUrl } from '../lib/photos.web';
import { useTheme } from './ui';

export function Photo({ name, style }: { name: string; style: StyleProp<ImageStyle> }) {
  const c = useTheme();
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loadPhotoUrl(name).then((u) => live && setUri(u));
    return () => {
      live = false;
    };
  }, [name]);
  if (!uri) return <View style={[style as object, { backgroundColor: c.border }]} />;
  return <Image source={{ uri }} style={style} />;
}
