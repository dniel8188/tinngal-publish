import { useEffect, useState } from "react";
import type { Photo } from "@/lib/types";

/** Drive's image CDNs occasionally reject a hotlink; walk the fallback chain before giving up. */
export function useImageChain(photo: Photo, primary: "thumb" | "full") {
  const chain = [
    primary === "full" ? photo.full : photo.thumb,
    primary === "full" ? photo.thumb : photo.full,
    photo.alt ?? "",
  ].filter(Boolean);
  const [step, setStep] = useState(0);

  useEffect(() => setStep(0), [photo.id, primary]);

  return {
    src: chain[Math.min(step, chain.length - 1)],
    onError: () => setStep((s) => (s < chain.length - 1 ? s + 1 : s)),
    exhausted: step >= chain.length - 1,
  };
}

interface Props {
  photo: Photo;
  className?: string;
}

export default function GalleryPhotoImage({ photo, className }: Props) {
  const { src, onError } = useImageChain(photo, "thumb");
  return (
    <img
      src={src}
      onError={onError}
      alt={photo.name}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={className}
    />
  );
}
