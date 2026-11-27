import React from 'react';
import { ClipboardListIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface ReportCatchFooterProps {
  onReportCatchClick: () => void;
}

const ReportCatchFooter: React.FC<ReportCatchFooterProps> = ({ onReportCatchClick }) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center">
      <Button
        size="lg"
        className="h-11 w-full font-semibold shadow-sm"
        onClick={onReportCatchClick}
      >
        <ClipboardListIcon data-icon="inline-start" />
        {t('catch.reportCatch')}
      </Button>
    </div>
  );
};

export default ReportCatchFooter;
