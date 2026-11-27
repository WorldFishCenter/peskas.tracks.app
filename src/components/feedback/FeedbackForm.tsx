import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangleIcon, CheckIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { submitFeedback, FeedbackSubmission } from '../../api/feedbackService';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';

interface FeedbackFormProps {
  onSuccess?: () => void;
}

const FeedbackForm: React.FC<FeedbackFormProps> = ({ onSuccess }) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [type, setType] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const feedbackTypes = [
    { value: 'opinion', labelKey: 'feedback.types.opinion' },
    { value: 'problem', labelKey: 'feedback.types.problem' },
    { value: 'suggestion', labelKey: 'feedback.types.suggestion' },
    { value: 'question', labelKey: 'feedback.types.question' },
    { value: 'other', labelKey: 'feedback.types.other' },
  ];

  const feedbackItems = [
    { value: null, label: t('feedback.form.selectType') },
    ...feedbackTypes.map((opt) => ({ value: opt.value, label: t(opt.labelKey) })),
  ];

  const maxMessageLength = 2000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!type) {
      setError(t('feedback.form.typeRequired'));
      return;
    }

    if (!message.trim()) {
      setError(t('feedback.form.messageRequired'));
      return;
    }

    if (message.trim().length > maxMessageLength) {
      setError(t('feedback.form.messageTooLong', { max: maxMessageLength }));
      return;
    }

    const imei = currentUser?.imeis?.[0] || null;
    const username = currentUser?.username || null;

    if (!imei && !username) {
      setError(t('feedback.errors.submitFailed'));
      return;
    }

    setLoading(true);

    try {
      const feedbackData: FeedbackSubmission = {
        type,
        message: message.trim(),
      };

      await submitFeedback(feedbackData, imei, username);

      setSuccess(true);
      setType('');
      setMessage('');

      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 2000);
      }
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setError(err instanceof Error ? err.message : t('feedback.errors.submitFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Alert>
        <CheckIcon className="text-primary" />
        <AlertTitle>{t('feedback.form.success')}</AlertTitle>
        <AlertDescription>{t('feedback.form.successMessage')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <FieldGroup>
        <Field>
          <FieldLabel>{t('feedback.form.type')} *</FieldLabel>
          <Select
            items={feedbackItems}
            value={type || null}
            onValueChange={(v) => setType(v ?? '')}
            disabled={loading}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {feedbackTypes.map((typeOption) => (
                  <SelectItem key={typeOption.value} value={typeOption.value}>
                    {t(typeOption.labelKey)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="feedback-message">{t('feedback.form.message')} *</FieldLabel>
          <Textarea
            id="feedback-message"
            rows={6}
            placeholder={t('feedback.form.messagePlaceholder')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={loading}
            maxLength={maxMessageLength}
            required
          />
          <FieldDescription>
            {maxMessageLength - message.length} {t('feedback.form.charactersRemaining')}
          </FieldDescription>
        </Field>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Spinner data-icon="inline-start" />
              {t('feedback.form.submitting')}
            </>
          ) : (
            t('feedback.form.submit')
          )}
        </Button>
      </FieldGroup>
    </form>
  );
};

export default FeedbackForm;
