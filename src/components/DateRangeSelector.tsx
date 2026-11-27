import React, { useEffect, useState } from 'react';
import { format, isToday } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface DateRangeSelectorProps {
  dateFrom: Date;
  dateTo: Date;
  onDateChange: (dateFrom: Date, dateTo: Date) => void;
}

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  dateFrom,
  dateTo,
  onDateChange,
}) => {
  const { t } = useTranslation();
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  const getDaysDifference = (): number => {
    return Math.round((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24));
  };

  const applyDaysPreset = (days: number) => {
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - days);
    onDateChange(from, today);
  };

  // Set week as default on first render
  useEffect(() => {
    applyDaysPreset(7);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const daysDiff = getDaysDifference();
  const activePreset =
    isToday(dateTo) && [1, 7, 30, 90].includes(daysDiff) ? [String(daysDiff)] : [];

  return (
    <div className="flex flex-col gap-3">
      <ToggleGroup
        value={activePreset}
        onValueChange={(values) => {
          // Re-clicking an active preset resets the range to end today instead of deselecting.
          const next = values[0] ?? activePreset[0];
          if (next) applyDaysPreset(Number(next));
        }}
        variant="outline"
        spacing={1}
        className="grid w-full grid-cols-2"
      >
        <ToggleGroupItem value="1" className="h-9 w-full">
          {t('dateRange.presets.today')}
        </ToggleGroupItem>
        <ToggleGroupItem value="7" className="h-9 w-full">
          {t('dateRange.presets.last7Days')}
        </ToggleGroupItem>
        <ToggleGroupItem value="30" className="h-9 w-full">
          {t('dateRange.presets.last30Days')}
        </ToggleGroupItem>
        <ToggleGroupItem value="90" className="h-9 w-full">
          {t('dateRange.presets.last90Days')}
        </ToggleGroupItem>
      </ToggleGroup>

      <FieldGroup className="grid grid-cols-2 gap-2">
        <Field className="gap-1">
          <FieldLabel className="text-xs text-muted-foreground">
            {t('dateRange.from')}
          </FieldLabel>
          <Popover open={fromOpen} onOpenChange={setFromOpen}>
            <PopoverTrigger
              render={
                <Button variant="outline" className="w-full justify-start font-normal" />
              }
            >
              <CalendarIcon data-icon="inline-start" />
              <span className="truncate">{format(dateFrom, 'MMM d')}</span>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                defaultMonth={dateFrom}
                selected={dateFrom}
                onSelect={(date) => {
                  if (date) {
                    onDateChange(date, dateTo);
                    setFromOpen(false);
                  }
                }}
              />
            </PopoverContent>
          </Popover>
        </Field>

        <Field className="gap-1">
          <FieldLabel className="text-xs text-muted-foreground">
            {t('dateRange.to')}
          </FieldLabel>
          <Popover open={toOpen} onOpenChange={setToOpen}>
            <PopoverTrigger
              render={
                <Button variant="outline" className="w-full justify-start font-normal" />
              }
            >
              <CalendarIcon data-icon="inline-start" />
              <span className="truncate">{format(dateTo, 'MMM d')}</span>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                defaultMonth={dateTo}
                selected={dateTo}
                onSelect={(date) => {
                  if (date) {
                    onDateChange(dateFrom, date);
                    setToOpen(false);
                  }
                }}
                disabled={{ before: dateFrom }}
              />
            </PopoverContent>
          </Popover>
        </Field>
      </FieldGroup>
    </div>
  );
};

export default DateRangeSelector;
