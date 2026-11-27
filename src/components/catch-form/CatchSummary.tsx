import React from 'react';
import { useTranslation } from 'react-i18next';
import { BanIcon } from 'lucide-react';
import { CatchEntry } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface CatchSummaryProps {
  noCatch: boolean;
  catches: CatchEntry[];
}

const CatchSummary: React.FC<CatchSummaryProps> = ({ noCatch, catches }) => {
  const { t } = useTranslation();

  const totalWeight = catches.reduce((sum, catchEntry) => sum + (catchEntry.quantity || 0), 0);

  return (
    <Card size="sm" className="bg-muted/40">
      <CardHeader className="border-b pb-2.5">
        <CardTitle className="text-sm">{t('catch.summary')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {noCatch ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center text-muted-foreground">
            <BanIcon className="size-8" />
            <p className="text-sm">{t('catch.noCatchWillBeReported')}</p>
          </div>
        ) : (
          <>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('catch.catchEntries')}
            </div>
            <div className="flex flex-col gap-1.5">
              {catches.map((catchEntry) => (
                <div key={catchEntry.id} className="flex items-center justify-between text-xs">
                  <span>
                    {t(`catch.fishGroups.${catchEntry.fishGroup.replace(/[^a-zA-Z]/g, '')}`)}
                  </span>
                  <span className="font-semibold tabular-nums">{catchEntry.quantity || 0} kg</span>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex items-center justify-between font-semibold">
              <span>{t('catch.totalWeight')}:</span>
              <span className="tabular-nums">{totalWeight.toFixed(1)} kg</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default React.memo(CatchSummary);
