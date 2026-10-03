import { useEffect, useState } from 'react';

/**
 * Keeps a decoded HTMLImageElement for a data URL so the renderer can paint the
 * logo synchronously.
 *
 * Loading the image inside the render pass was the reason exported PNGs
 * sometimes had no logo: the canvas was read before `onload` fired, and a late
 * load could paint a stale logo over a newer style.
 */
export function useLogoImage(src: string | null): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setImage(img);
    };
    img.onerror = () => {
      if (!cancelled) setImage(null);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return image;
}