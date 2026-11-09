import { useEffect, useRef, useState } from 'react'
import { PRODUCT_GALLERY_COPY as COPY } from '@shared/lib/copy'
import { Input } from '@shared/ui/Input'
import { Button } from '@shared/ui/Button'
import { useManageImages } from '../../model/useManageImages'
import type { ImageChange } from '../../api/manageImagesApi'
import {
  PRODUCT_IMAGE_ACCEPT,
  productImageError,
  validateProductImage,
} from '../../lib/productImages'
import { ProductGalleryImage } from './-Image'
import type { ManageProductGalleryProps } from './ManageProductGallery.typings'
import styles from './ManageProductGallery.module.css'

export function ManageProductGallery({
  product,
  disabled = false,
  onRefresh,
}: ManageProductGalleryProps) {
  const { pending, change } = useManageImages(product?.id ?? '')
  const [error, setError] = useState('')
  const [fileError, setFileError] = useState('')
  const [saved, setSaved] = useState(false)
  const [refreshSuggested, setRefreshSuggested] = useState(false)
  const [confirming, setConfirming] = useState<number | null>(null)
  const active = useRef(false)
  const writing = useRef(false)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const demo = product?.origin === 'demo'
  const blocked = disabled || pending || demo || !product
  const images = [...(product?.images ?? [])].sort(
    (a, b) => a.order - b.order || a.id - b.id,
  )

  async function apply(changeImage: ImageChange) {
    if (blocked || writing.current) return
    writing.current = true
    setError('')
    setFileError('')
    setSaved(false)
    setRefreshSuggested(false)
    try {
      await change(changeImage)
      if (!active.current) return
      setConfirming(null)
      setSaved(true)
    } catch (error) {
      if (active.current) {
        const message = productImageError(error)
        if (changeImage.type === 'upload') setFileError(message)
        else setError(message)
        setRefreshSuggested(true)
      }
    } finally {
      writing.current = false
    }
  }

  return (
    <section
      className={styles.ManageProductGallery}
      aria-label={COPY.title}
      aria-busy={pending || undefined}
    >
      <h2>{COPY.title}</h2>
      {!product && <p>{COPY.createHint}</p>}
      {product && (
        <>
          <p>{demo ? COPY.demoHint : COPY.description}</p>
          {!demo && (
            <Input
              className={styles['ManageProductGallery-Upload']}
              type="file"
              label={COPY.upload}
              accept={PRODUCT_IMAGE_ACCEPT}
              helperText={COPY.formats}
              errorText={fileError}
              disabled={blocked}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file || blocked) return
                setSaved(false)
                setRefreshSuggested(false)
                const validation = validateProductImage(file)
                setError('')
                setFileError(validation)
                if (!validation) void apply({ type: 'upload', file })
              }}
            />
          )}
          {!images.length && <p>{COPY.empty}</p>}
          {!!images.length && (
            <ol className={styles['ManageProductGallery-List']}>
              {images.map((image, position) => (
                <ProductGalleryImage
                  key={image.id}
                  image={image}
                  name={product.name}
                  position={position}
                  count={images.length}
                  disabled={blocked}
                  mockHidden={product.origin === 'owner' && !!image.is_mock}
                  confirming={confirming === image.id}
                  onMain={() =>
                    void apply({
                      type: 'change',
                      imageId: image.id,
                      values: { is_main: true },
                    })
                  }
                  onMove={(order) =>
                    void apply({ type: 'change', imageId: image.id, values: { order } })
                  }
                  onAskRemove={() => {
                    setConfirming(image.id)
                    setSaved(false)
                    setError('')
                  }}
                  onCancelRemove={() => setConfirming(null)}
                  onRemove={() => void apply({ type: 'delete', imageId: image.id })}
                />
              ))}
            </ol>
          )}
        </>
      )}
      {pending && <p role="status">{COPY.saving}</p>}
      {saved && !disabled && <p role="status">{COPY.saved}</p>}
      {error && (
        <p className={styles['ManageProductGallery-Error']} role="alert">
          {error}
        </p>
      )}
      {(error || fileError) && refreshSuggested && (
        <Button
          variant="secondary"
          disabled={disabled || pending}
          onClick={async () => {
            const refreshed = await onRefresh()
            if (active.current && refreshed) {
              setError('')
              setFileError('')
              setRefreshSuggested(false)
              setConfirming(null)
            }
          }}
        >
          {COPY.refresh}
        </Button>
      )}
    </section>
  )
}
