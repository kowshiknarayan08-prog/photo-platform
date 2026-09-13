import { useEffect, useState } from 'react';
import { fetchImageObjectUrl } from '../lib/api.js';
import { Spinner } from './ui.jsx';

/**
 * <img> for an endpoint that needs the Authorization header. Fetches the bytes
 * as a blob and shows an object URL, cleaning it up on unmount.
 */
export default function ProtectedImage({ path, alt, className }) {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let url;
    let cancelled = false;
    setError(false);
    setSrc(null);
    fetchImageObjectUrl(path)
      .then((objectUrl) => {
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        url = objectUrl;
        setSrc(objectUrl);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-xs text-slate-400 ${className}`}>
        unavailable
      </div>
    );
  }
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 ${className}`}>
        <Spinner className="h-4 w-4" />
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} loading="lazy" />;
}
