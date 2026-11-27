import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { GPSCoordinate } from '../../../types';
import { getCurrentGPSCoordinate } from '../../../utils/gpsUtils';

export interface UsePhotoHandlingProps {
  onError: (error: string) => void;
  onPhotoAdd: (catchEntryId: string, base64Photo: string, gpsCoordinate?: GPSCoordinate) => void;
  onPhotoRemove: (catchEntryId: string, photoIndex: number) => void;
  gpsLocationEnabled?: boolean;
}

export const usePhotoHandling = ({
  onError,
  onPhotoAdd,
  onPhotoRemove,
  gpsLocationEnabled = false
}: UsePhotoHandlingProps) => {
  const { t } = useTranslation();
  const [cameraSupported, setCameraSupported] = useState(false);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const checkCameraSupport = async () => {
    try {
      if (navigator.mediaDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCameraSupported(devices.some((device) => device.kind === 'videoinput'));
      }
    } catch {
      setCameraSupported(false);
    }
  };

  // Compress photo asynchronously to JPEG base64 with GPS-aware sizing.
  const compressImage = (file: File, withGPS: boolean = false): Promise<string> => {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const maxSize = withGPS ? 600 : 800;
        const quality = withGPS ? 0.6 : 0.8;

        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(t('catch.photoError')));
      };
      img.src = objectUrl;
    });
  };

  const handleFileUpload = async (catchEntryId: string, file: File) => {
    try {
      if (file.size > 10 * 1024 * 1024) {
        onError(t('catch.photoTooLarge'));
        return;
      }

      if (!file.type.startsWith('image/')) {
        onError(t('catch.photoError'));
        return;
      }

      let gpsCoordinate: GPSCoordinate | null = null;
      if (gpsLocationEnabled) {
        const result = await getCurrentGPSCoordinate();
        gpsCoordinate = result.coordinate;
      }

      const base64 = await compressImage(file, Boolean(gpsCoordinate));
      onPhotoAdd(catchEntryId, base64, gpsCoordinate || undefined);
    } catch (err) {
      console.error('Photo upload error:', err);
      onError(t('catch.photoError'));
    }
  };

  const triggerFileInput = (catchEntryId: string) => {
    fileInputRefs.current[catchEntryId]?.click();
  };

  return {
    cameraSupported,
    fileInputRefs,
    checkCameraSupport,
    handleFileUpload,
    triggerFileInput,
    removePhoto: onPhotoRemove
  };
};
