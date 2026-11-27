import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { subDays, differenceInDays, isToday } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface StatsControlsProps {
  dateFrom: Date;
  dateTo: Date;
  compareWith: 'community' | 'previous';
  onDateChange: (from: Date, to: Date) => void;
  onCompareChange: (comparison: 'community' | 'previous') => void;
}

const StatsControls: React.FC<StatsControlsProps> = ({
  dateFrom,
  dateTo,
  compareWith,
  onDateChange,
  onCompareChange,
}) => {
  const { t } = useTranslation();
  const [activePreset, setActivePreset] = useState<string>('last30Days');

  useEffect(() => {
    const now = new Date();
    const daysDiff = differenceInDays(now, dateFrom);

    if (!isToday(dateTo)) {
      setActivePreset('custom');
    } else if (daysDiff === 7) {
      setActivePreset('last7Days');
    } else if (daysDiff === 30) {
      setActivePreset('last30Days');
    } else if (daysDiff === 90) {
      setActivePreset('last90Days');
    } else {
      setActivePreset('custom');
    }
  }, [dateFrom, dateTo]);

  const handlePresetChange = (preset: string) => {
    const now = new Date();
    let from: Date;

    switch (preset) {
      case 'last7Days':
        from = subDays(now, 7);
        break;
      case 'last30Days':
        from = subDays(now, 30);
        break;
      case 'last90Days':
        from = subDays(now, 90);
        break;
      default:
        return;
    }

    setActivePreset(preset);
    onDateChange(from, now);
  };

  const formatDateForInput = (date: Date): string => date.toISOString().split('T')[0];

  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    if (!isNaN(newDate.getTime())) {
      onDateChange(newDate, dateTo);
    }
  };

  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    if (!isNaN(newDate.getTime())) {
      onDateChange(dateFrom, newDate);
    }
  };

  return (
    <Card>
      <CardContent>
        <FieldGroup className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Date Range Selection */}
          <Field>
            <FieldLabel className="flex items-center gap-1.5">
              <CalendarIcon className="size-4 text-primary" />
              {t('stats.dateRange')}
            </FieldLabel>
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={formatDateForInput(dateFrom)}
                  onChange={handleDateFromChange}
                  max={formatDateForInput(dateTo)}
                />
                <Input
                  type="date"
                  value={formatDateForInput(dateTo)}
                  onChange={handleDateToChange}
                  min={formatDateForInput(dateFrom)}
                  max={formatDateForInput(new Date())}
                />
              </div>
              <ToggleGroup
                value={activePreset !== 'custom' ? [activePreset] : []}
                onValueChange={(values) => {
                  const next = values[0] ?? (activePreset !== 'custom' ? activePreset : undefined);
                  if (next) handlePresetChange(next);
                }}
                variant="outline"
                spacing={0}
                size="sm"
                className="grid w-full grid-cols-3"
              >
                <ToggleGroupItem value="last7Days" className="w-full">
                  {t('stats.last7Days')}
                </ToggleGroupItem>
                <ToggleGroupItem value="last30Days" className="w-full">
                  {t('stats.last30Days')}
                </ToggleGroupItem>
                <ToggleGroupItem value="last90Days" className="w-full">
                  {t('stats.last90Days')}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </Field>

          {/* Comparison Toggle */}
          <Field>
            <FieldLabel>{t('stats.compareWith')}</FieldLabel>
            <ToggleGroup
              value={[compareWith]}
              onValueChange={(values) => {
                const next = values[0] as 'community' | 'previous' | undefined;
                if (next) onCompareChange(next);
              }}
              variant="outline"
              spacing={0}
              className="grid w-full grid-cols-2"
            >
              <ToggleGroupItem value="community" className="h-9 w-full">
                {t('stats.community')}
              </ToggleGroupItem>
              <ToggleGroupItem value="previous" className="h-9 w-full">
                {t('stats.previousPeriod')}
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
};

export default StatsControls;
