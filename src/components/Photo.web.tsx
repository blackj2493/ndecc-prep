import { useEffect, useState } from 'react';
import { Image, View, type ImageStyle, type StyleProp } from 'react-native';
import { loadPhotoUrl } from '../lib/photos.web';
import { useTheme } from './ui';

/** The object URL of a stored photo, or null while it loads (or if it is not on this device). */
export function usePhotoUri(name: string): string | null {
  const [got, setGot] = useState<{ name: string; uri: string | null } | null>(null);
  useEffect(() => {
    let live = true;
    loadPhotoUrl(name).then((uri) => live && setGot({ name, uri }));
    return () => {
      live = false;
    };
  }, [name]);
  return got?.name === name ? got.uri : null;
}

export function Photo({ name, style }: { name: string; style: StyleProp<ImageStyle> }) {
  const c = useTheme();
  const uri = usePhotoUri(name);
  if (!uri) return <View style={[style as object, { backgroundColor: c.border }]} />;
  return <Image source={{ uri }} style={style} />;
}
