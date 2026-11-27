import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CameraIcon, ImageIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PhotoSectionProps {
  catchEntryId: string;
  photos: string[];
  fishGroup: string;
  loading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileUpload: (catchEntryId: string, file: File) => void;
  onRemovePhoto: (catchEntryId: string, photoIndex: number) => void;
  onSetRef: (el: HTMLInputElement | null) => void;
}

const PhotoSection: React.FC<PhotoSectionProps> = ({
  catchEntryId,
  photos,
  fishGroup,
  loading,
  fileInputRef,
  onFileUpload,
  onRemovePhoto,
  onSetRef,
}) => {
  const { t } = useTranslation();
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const fishGroupLabel = t(`catch.fishGroups.${fishGroup.replace(/[^a-zA-Z]/g, '')}`);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          onClick={() => {
            const cameraInput = document.getElementById(
              `camera-input-${catchEntryId}`
            ) as HTMLInputElement;
            cameraInput?.click();
          }}
          disabled={loading || photos.length >= 3}
        >
          <CameraIcon data-icon="inline-start" />
          <span>{t('catch.takePhoto')}</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          onClick={() => {
            const galleryInput = document.getElementById(
              `gallery-input-${catchEntryId}`
            ) as HTMLInputElement;
            galleryInput?.click();
          }}
          disabled={loading || photos.length >= 3}
        >
          <ImageIcon data-icon="inline-start" />
          <span>{t('catch.gallery')}</span>
        </Button>
      </div>

      {/* Hidden camera input */}
      <input
        id={`camera-input-${catchEntryId}`}
        ref={(el) => {
          onSetRef(el);
          if (fileInputRef) {
            (fileInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
          }
        }}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onFileUpload(catchEntryId, file);
            e.target.value = '';
          }
        }}
      />

      {/* Hidden gallery input */}
      <input
        id={`gallery-input-${catchEntryId}`}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onFileUpload(catchEntryId, file);
            e.target.value = '';
          }
        }}
      />

      {/* Photo Preview Grid */}
      {photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {photos.map((photo, photoIndex) => (
            <div key={photoIndex} className="relative overflow-hidden rounded-lg border">
              <img
                src={photo}
                alt={`${t('catch.photoOf')} ${fishGroupLabel}`}
                className="h-20 w-full cursor-pointer object-cover"
                onClick={() => setPreviewPhoto(photo)}
              />
              <Button
                type="button"
                variant="destructive"
                size="icon-xs"
                className="absolute top-1 right-1"
                onClick={() => onRemovePhoto(catchEntryId, photoIndex)}
                disabled={loading}
                title={t('catch.removePhoto')}
                aria-label={t('catch.removePhoto')}
              >
                <XIcon />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">{t('catch.noPhotosAdded')}</div>
      )}

      {/* Full-size Photo Preview Dialog */}
      <Dialog
        open={Boolean(previewPhoto)}
        onOpenChange={(open) => {
          if (!open) setPreviewPhoto(null);
        }}
      >
        <DialogContent className="p-2 sm:max-w-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{`${t('catch.photoOf')} ${fishGroupLabel}`}</DialogTitle>
            <DialogDescription>{fishGroupLabel}</DialogDescription>
          </DialogHeader>
          {previewPhoto && (
            <img
              src={previewPhoto}
              alt={`${t('catch.photoOf')} ${fishGroupLabel}`}
              className="max-h-[80vh] w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default React.memo(PhotoSection);
