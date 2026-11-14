import { useEffect, useState } from 'react';
import type { ArchiveImage } from './catalog';

type Props = { images: ArchiveImage[] };

export function ArchiveGallery({ images }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const activeImage = images[activeIndex];

  useEffect(() => {
    if (!expanded) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [expanded]);

  if (!activeImage) return null;

  return (
    <>
      <aside className="archive-gallery" aria-label="Surveyor 3 archival image gallery">
      <div className="archive-gallery-header">
        <div>
          <p className="eyebrow">PHOTO ARCHIVE · SURVEYOR 3</p>
          <span className="archive-gallery-count">{String(activeIndex + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}</span>
        </div>
        <span className="archive-image-hint">SELECT A FRAME TO ENLARGE</span>
      </div>

      <button
        className="archive-feature-button"
        type="button"
        onClick={() => setExpanded(true)}
        aria-label={`Enlarge image: ${activeImage.caption}`}
      >
        <img src={activeImage.src} alt={activeImage.alt} fetchPriority="high" decoding="async" />
        <span className="archive-enlarge-label">ENLARGE ↗</span>
      </button>

      <div className="archive-gallery-caption" aria-live="polite">{activeImage.caption}</div>

      <div className="archive-thumbnails" aria-label="Choose an archival image">
        {images.map((image, index) => (
          <button
            key={image.src}
            type="button"
            className={`archive-thumbnail ${index === activeIndex ? 'active' : ''}`}
            onClick={() => setActiveIndex(index)}
            aria-pressed={index === activeIndex}
            aria-label={`Show image ${index + 1}: ${image.caption}`}
          >
            <img src={image.src} alt="" loading="lazy" decoding="async" />
            <span>0{index + 1}</span>
          </button>
        ))}
      </div>

      </aside>

      {expanded && (
        <div
          className="archive-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Archival photograph: ${activeImage.caption}`}
          onClick={() => setExpanded(false)}
        >
          <button className="archive-lightbox-close" type="button" onClick={() => setExpanded(false)}>
            Close <span aria-hidden="true">×</span>
          </button>
          <figure onClick={event => event.stopPropagation()}>
            <img src={activeImage.src} alt={activeImage.alt} />
            <figcaption>{activeImage.caption}</figcaption>
          </figure>
        </div>
      )}
    </>
  );
}
