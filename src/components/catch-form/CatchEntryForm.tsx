import React from 'react';
import { useTranslation } from 'react-i18next';
import { ListIcon, ScaleIcon, Trash2Icon } from 'lucide-react';
import { FishGroup, CatchEntry } from '../../types';
import PhotoSection from './PhotoSection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

interface CatchEntryFormProps {
  catchEntry: CatchEntry;
  index: number;
  totalCatches: number;
  loading: boolean;
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
  'tuna/tuna-like',
];

const CatchEntryForm: React.FC<CatchEntryFormProps> = ({
  catchEntry,
  index,
  totalCatches,
  loading,
  fileInputRefs,
  onUpdate,
  onRemove,
  onFileUpload,
  onRemovePhoto,
}) => {
  const { t } = useTranslation();

  const fishGroupItems = FISH_GROUPS.map((group) => ({
    value: group,
    label: t(`catch.fishGroups.${group.replace(/[^a-zA-Z]/g, '')}`),
  }));

  return (
    <div className="flex flex-col gap-3">
      {index > 0 && <Separator />}

      <FieldGroup className="grid grid-cols-1 gap-3 sm:grid-cols-12">
        <div className="sm:col-span-6 lg:col-span-5">
          <Field>
            <FieldLabel className="w-full justify-between">
              <span className="flex items-center gap-1.5">
                <ListIcon className="size-4 text-muted-foreground" />
                {t('catch.fishGroup')}
              </span>
              {totalCatches > 1 && <Badge variant="outline">#{index + 1}</Badge>}
            </FieldLabel>
            <Select
              items={fishGroupItems}
              value={catchEntry.fishGroup}
              onValueChange={(value) => {
                if (value) onUpdate(catchEntry.id, 'fishGroup', value as FishGroup);
              }}
              disabled={loading}
            >
              <SelectTrigger className="h-11 w-full text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {fishGroupItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className={totalCatches > 1 ? 'sm:col-span-4 lg:col-span-5' : 'sm:col-span-6 lg:col-span-7'}>
          <Field>
            <FieldLabel htmlFor={`weight-${catchEntry.id}`}>
              <ScaleIcon className="size-4 text-muted-foreground" />
              {t('catch.weightKg')}
            </FieldLabel>
            <Input
              id={`weight-${catchEntry.id}`}
              type="number"
              inputMode="decimal"
              className="h-11 text-base"
              value={catchEntry.quantity || ''}
              onChange={(e) =>
                onUpdate(catchEntry.id, 'quantity', parseFloat(e.target.value) || 0)
              }
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="0.0"
              min="0"
              step="0.1"
              disabled={loading}
            />
          </Field>
        </div>

        {totalCatches > 1 && (
          <div className="flex items-end sm:col-span-2">
            <Button
              type="button"
              variant="destructive"
              className="h-11 w-full"
              onClick={() => onRemove(catchEntry.id)}
              disabled={loading}
              title={t('catch.removeCatchEntry')}
            >
              <Trash2Icon data-icon="inline-start" />
              <span className="sm:hidden lg:inline">{t('catch.remove')}</span>
            </Button>
          </div>
        )}
      </FieldGroup>

      <PhotoSection
        catchEntryId={catchEntry.id}
        photos={catchEntry.photos || []}
        fishGroup={catchEntry.fishGroup}
        loading={loading}
        fileInputRef={{ current: fileInputRefs.current[catchEntry.id] || null }}
        onFileUpload={onFileUpload}
        onRemovePhoto={onRemovePhoto}
        onSetRef={(el) => {
          fileInputRefs.current[catchEntry.id] = el;
        }}
      />
    </div>
  );
};

export default React.memo(CatchEntryForm);
