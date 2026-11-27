import React from 'react';
import { useTranslation } from 'react-i18next';
import { IconList, IconWeight, IconTrash } from '@tabler/icons-react';
import { FishGroup, CatchEntry } from '../../types';
import PhotoSection from './PhotoSection';

interface CatchEntryFormProps {
  catchEntry: CatchEntry;
  index: number;
  totalCatches: number;
  loading: boolean;
  isDarkMode: boolean;
  isDirectCatch: boolean;
  fileInputRefs: React.MutableRefObject<{ [key: string]: HTMLInputElement | null }>;
  onUpdate: (id: string, field: keyof CatchEntry, value: string | number) => void;
  onRemove: (id: string) => void;
  onFileUpload: (catchEntryId: string, file: File) => void;
  onTriggerFileInput: (catchEntryId: string) => void;
  onRemovePhoto: (catchEntryId: string, photoIndex: number) => void;
}

const FISH_GROUPS: FishGroup[] = [
  'reef fish',
  'sharks/rays', 
  'small pelagics',
  'large pelagics',
  'tuna/tuna-like'
];

const CatchEntryForm: React.FC<CatchEntryFormProps> = ({
  catchEntry,
  index,
  totalCatches,
  loading,
  isDarkMode,
  fileInputRefs,
  onUpdate,
  onRemove,
  onFileUpload,
  onRemovePhoto
}) => {
  const { t } = useTranslation();

  return (
    <div className={`catch-entry ${index > 0 ? 'border-top pt-3 mt-3' : ''} ${index < totalCatches - 1 ? 'mb-3' : ''}`}>
      <div className="row g-3">
        <div className="col-12 col-sm-6 col-lg-5">
          <label className="form-label fw-medium mb-2 d-flex align-items-center">
            <IconList className="me-2" size={16} />
            {t('catch.fishGroup')}
            {totalCatches > 1 && (
              <span className="ms-auto badge badge-outline text-primary" style={{ fontSize: '11px', fontWeight: '500' }}>
                #{index + 1}
              </span>
            )}
          </label>
          <select
            className="form-select"
            value={catchEntry.fishGroup}
            onChange={(e) => onUpdate(catchEntry.id, 'fishGroup', e.target.value as FishGroup)}
            disabled={loading}
            required
            style={{ minHeight: '50px', fontSize: '16px', padding: '12px 16px' }}
          >
            {FISH_GROUPS.map(group => (
              <option key={group} value={group}>
                {t(`catch.fishGroups.${group.replace(/[^a-zA-Z]/g, '')}`)}
              </option>
            ))}
          </select>
        </div>
        
        <div className="col-8 col-sm-4 col-lg-5">
          <label className="form-label fw-medium mb-2 d-flex align-items-center">
            <IconWeight className="me-2" size={16} />
            {t('catch.weightKg')}
          </label>
          <input
            type="number"
            className="form-control"
            value={catchEntry.quantity || ''}
            onChange={(e) => onUpdate(catchEntry.id, 'quantity', parseFloat(e.target.value) || 0)}
            onWheel={(e) => e.currentTarget.blur()} // Prevent scroll from changing value
            placeholder="0.0"
            min="0"
            step="0.1"
            disabled={loading}
            style={{ minHeight: '50px', fontSize: '16px', padding: '12px 16px' }}
          />
        </div>
        
        <div className="col-4 col-sm-2 col-lg-2">
          {totalCatches > 1 && (
            <>
              <label className="form-label opacity-0 mb-2 d-flex align-items-center">
                <span className="me-2" style={{ width: '16px' }}></span>
                {t('catch.remove')}
              </label>
              <button
                type="button"
                className="btn btn-outline-danger w-100 d-flex align-items-center justify-content-center"
                onClick={() => onRemove(catchEntry.id)}
                disabled={loading}
                title={t('catch.removeCatchEntry')}
                style={{ minHeight: '50px', fontSize: '15px' }}
              >
                <IconTrash size={18} />
                <span className="d-none d-lg-inline ms-1">{t('catch.remove')}</span>
              </button>
            </>
          )}
        </div>
        
        {/* Photo Section */}
        <div className="col-12 mt-3">
          <PhotoSection
            catchEntryId={catchEntry.id}
            photos={catchEntry.photos || []}
            fishGroup={catchEntry.fishGroup}
            loading={loading}
            isDarkMode={isDarkMode}
            fileInputRef={{ 
              current: fileInputRefs.current[catchEntry.id] || null 
            }}
            onFileUpload={onFileUpload}
            onRemovePhoto={onRemovePhoto}
            onSetRef={(el) => {
              fileInputRefs.current[catchEntry.id] = el;
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default React.memo(CatchEntryForm);