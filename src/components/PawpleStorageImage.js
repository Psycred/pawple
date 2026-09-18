import React, { useEffect, useState } from 'react';
import { Image } from 'react-native';
import { resolveStorageMediaUrl } from '../lib/storageMedia';

/**
 * Image wrapper that signs private Supabase Storage URLs at render time.
 * Local file/content URIs pass through unchanged.
 */
export default function PawpleStorageImage({ source, ...props }) {
  const rawUri =
    typeof source === 'string'
      ? source
      : typeof source?.uri === 'string'
        ? source.uri
        : null;
  const [uri, setUri] = useState(rawUri);

  useEffect(() => {
    let cancelled = false;
    if (!rawUri) {
      setUri(null);
      return undefined;
    }

    resolveStorageMediaUrl(rawUri).then((resolved) => {
      if (!cancelled) {
        setUri(resolved);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [rawUri]);

  if (!uri) {
    return null;
  }

  return <Image source={{ uri }} {...props} />;
}
