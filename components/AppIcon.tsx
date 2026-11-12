import { Image } from 'react-native';
import { useEffect, useState } from 'react';
import { IconChip } from '@/components/ui';
import { AUTHENTICATOR_APPS, iconLookupUrl, iconsFromLookup } from '@/src/lib/authenticators';

let cache: Record<string, string> | null = null;

/** The authenticator apps' real App Store icons, fetched once per launch. Empty until loaded or if offline. */
export function useAuthenticatorIcons() {
  const [icons, setIcons] = useState<Record<string, string>>(cache ?? {});
  useEffect(() => {
    if (cache) return;
    let live = true;
    fetch(iconLookupUrl(AUTHENTICATOR_APPS))
      .then((r) => r.json())
      .then((json) => { cache = iconsFromLookup(json); if (live) setIcons(cache); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  return icons;
}

/** An app icon with iOS's rounded corners, or a plain key chip until the icon loads. */
export function AppIcon({ uri, size = 40 }: { uri?: string; size?: number }) {
  if (!uri) return <IconChip icon={{ ios: 'lock.shield.fill', android: 'shield', web: 'shield' }} size={size} />;
  return <Image source={{ uri }} accessibilityIgnoresInvertColors style={{ width: size, height: size, borderRadius: size * 0.225, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.08)' }} />;
}
