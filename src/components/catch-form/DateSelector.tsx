import React from 'react';
import { useTranslation } from 'react-i18next';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface DateSelectorProps {
  selectedDate: Date;
  onDateSelection: (daysAgo: number) => void;
}

const DateSelector: React.FC<DateSelectorProps> = ({ selectedDate, onDateSelection }) => {
  const { t } = useTranslation();

  const today = new Date();
  const isToday = selectedDate.toDateString() === today.toDateString();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = selectedDate.toDateString() === yesterday.toDateString();

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const isTwoDaysAgo = selectedDate.toDateString() === twoDaysAgo.toDateString();

  const activeValue = isToday ? ['0'] : isYesterday ? ['1'] : isTwoDaysAgo ? ['2'] : [];

  return (
    <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
      <h4 className="text-sm font-semibold">{t('catch.whenWasCatchMade')}</h4>
      <ToggleGroup
        value={activeValue}
        onValueChange={(values) => {
          const next = values[0];
          if (next !== undefined) onDateSelection(Number(next));
        }}
        variant="outline"
        spacing={0}
      >
        <ToggleGroupItem value="0" className="h-10 px-3">
          {t('catch.today')}
        </ToggleGroupItem>
        <ToggleGroupItem value="1" className="h-10 px-3">
          {t('catch.yesterday')}
        </ToggleGroupItem>
        <ToggleGroupItem value="2" className="h-10 px-3">
          {t('catch.twoDaysAgo')}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
};

export default React.memo(DateSelector);
