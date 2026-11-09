import { PRODUCT_GALLERY_COPY as COPY } from '@shared/lib/copy'
import { Badge } from '@shared/ui/Badge'
import { Button } from '@shared/ui/Button'
import type { ProductGalleryImageProps } from '../ManageProductGallery.typings'
import styles from '../ManageProductGallery.module.css'

export function ProductGalleryImage({
  image,
  name,
  position,
  count,
  disabled,
  mockHidden,
  confirming,
  onMain,
  onMove,
  onAskRemove,
  onCancelRemove,
  onRemove,
}: ProductGalleryImageProps) {
  const number = position + 1
  return (
    <li
      className={styles['ManageProductGallery-Image']}
      aria-label={COPY.photo(number)}
    >
      <img
        src={image.url}
        alt={COPY.photoAlt(name, number)}
        className={styles['ManageProductGallery-Preview']}
      />
      <div className={styles['ManageProductGallery-Caption']}>
        <span>{COPY.photo(number)}</span>
        {image.is_main && !mockHidden && <Badge>{COPY.main}</Badge>}
        {image.is_mock && <Badge>{COPY.mock}</Badge>}
      </div>
      {mockHidden && <p>{COPY.mockHidden}</p>}
      <div className={styles['ManageProductGallery-Actions']}>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || position === 0}
          aria-label={COPY.earlierLabel(number)}
          onClick={() => onMove(position - 1)}
        >
          {COPY.earlier}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || position === count - 1}
          aria-label={COPY.laterLabel(number)}
          onClick={() => onMove(position + 1)}
        >
          {COPY.later}
        </Button>
        {!image.is_main && !mockHidden && (
          <Button
            variant="secondary"
            size="sm"
            disabled={disabled}
            aria-label={COPY.mainLabel(number)}
            onClick={onMain}
          >
            {COPY.makeMain}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          aria-label={COPY.removeLabel(number)}
          onClick={onAskRemove}
        >
          {COPY.remove}
        </Button>
      </div>
      {confirming && (
        <div className={styles['ManageProductGallery-Confirmation']}>
          <p>{COPY.removeQuestion}</p>
          {image.is_main && <p>{COPY.removeHint}</p>}
          <div className={styles['ManageProductGallery-Actions']}>
            <Button size="sm" disabled={disabled} onClick={onRemove}>
              {COPY.confirmRemove}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={onCancelRemove}
            >
              {COPY.cancel}
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}
