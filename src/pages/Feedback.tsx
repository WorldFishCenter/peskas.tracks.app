import React, { useState } from 'react';
import MainLayout from '../layouts/MainLayout';
import { useTranslation } from 'react-i18next';
import FeedbackForm from '../components/feedback/FeedbackForm';
import { Card, CardContent } from '@/components/ui/card';

const Feedback: React.FC = () => {
  const { t } = useTranslation();
  const [formKey, setFormKey] = useState(0);

  const handleSuccess = () => {
    setFormKey((prev) => prev + 1);
  };

  const pageHeader = (
    <div className="border-b bg-background print:hidden">
      <div className="mx-auto max-w-7xl px-4 py-4">
        <h2 className="text-xl font-semibold tracking-tight">{t('feedback.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('feedback.subtitle')}</p>
      </div>
    </div>
  );

  return (
    <MainLayout pageHeader={pageHeader}>
      <Card>
        <CardContent className="pt-2">
          <FeedbackForm key={formKey} onSuccess={handleSuccess} />
        </CardContent>
      </Card>
    </MainLayout>
  );
};

export default Feedback;
