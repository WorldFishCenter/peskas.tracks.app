import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api/httpClient';
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  InfoIcon,
  LockIcon,
  PhoneIcon,
  ShipIcon,
  UserIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';

interface RegistrationModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const RegistrationModal: React.FC<RegistrationModalProps> = ({ onClose, onSuccess }) => {
  const { t } = useTranslation();

  // Form state
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [country, setCountry] = useState('');
  const [vesselType, setVesselType] = useState('');
  const [mainGearType, setMainGearType] = useState('');
  const [boatName, setBoatName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const countries = ['Tanzania', 'Zanzibar', 'Mozambique', 'Kenya'];

  const vesselTypes = [
    { value: 'Motorized Boat', labelKey: 'auth.registration.vesselOptions.motorizedBoat' },
    { value: 'Dhow', labelKey: 'auth.registration.vesselOptions.dhow' },
    { value: 'Raft', labelKey: 'auth.registration.vesselOptions.raft' },
    { value: 'Dugout Canoe', labelKey: 'auth.registration.vesselOptions.dugoutCanoe' },
    { value: 'Wooden Boat', labelKey: 'auth.registration.vesselOptions.woodenBoat' },
    { value: 'Planked Canoe', labelKey: 'auth.registration.vesselOptions.plankedCanoe' },
    { value: 'Outrigger Canoe', labelKey: 'auth.registration.vesselOptions.outriggerCanoe' },
    { value: 'Flat Boat', labelKey: 'auth.registration.vesselOptions.flatBoat' },
    { value: 'Surf Board', labelKey: 'auth.registration.vesselOptions.surfBoard' },
    { value: 'Other', labelKey: 'auth.registration.vesselOptions.other' },
    { value: 'Feet', labelKey: 'auth.registration.vesselOptions.feet' },
  ];

  const gearTypes = [
    { value: 'Nets', labelKey: 'auth.registration.gearOptions.nets' },
    { value: 'Lines & Hooks', labelKey: 'auth.registration.gearOptions.linesAndHooks' },
    { value: 'Traps', labelKey: 'auth.registration.gearOptions.traps' },
    { value: 'Spears & Harpoons', labelKey: 'auth.registration.gearOptions.spearsAndHarpoons' },
    { value: 'Gleaning', labelKey: 'auth.registration.gearOptions.gleaning' },
    { value: 'Other', labelKey: 'auth.registration.gearOptions.other' },
  ];

  const countryItems = [
    { value: null, label: t('auth.registration.selectCountry') },
    ...countries.map((c) => ({ value: c, label: c })),
  ];

  const vesselItems = [
    { value: null, label: t('auth.registration.selectVesselType') },
    ...vesselTypes.map(({ value, labelKey }) => ({ value, label: t(labelKey) })),
  ];

  const gearItems = [
    { value: null, label: t('auth.registration.selectGearType') },
    ...gearTypes.map(({ value, labelKey }) => ({ value, label: t(labelKey) })),
  ];

  const isBoatNameRequired = vesselType !== 'Feet';

  const validateForm = () => {
    const errors: string[] = [];

    if (!username.trim()) errors.push(t('auth.registration.usernameRequired'));
    if (!phoneNumber.trim()) errors.push(t('auth.registration.phoneNumberRequired'));
    if (!country) errors.push(t('auth.registration.countryRequired'));
    if (!vesselType) errors.push(t('auth.registration.vesselTypeRequired'));
    if (!mainGearType) errors.push(t('auth.registration.gearTypeRequired'));
    if (isBoatNameRequired && !boatName.trim()) errors.push(t('auth.registration.boatNameRequired'));
    if (!password) errors.push(t('auth.registration.passwordRequired'));
    if (password.length < 6) errors.push(t('auth.registration.passwordTooShort'));
    if (password !== confirmPassword) errors.push(t('auth.registration.passwordMismatch'));

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch('/auth/register', {
        method: 'POST',
        body: {
          username: username.trim(),
          phoneNumber: phoneNumber.trim(),
          country,
          vesselType,
          mainGearType,
          boatName: isBoatNameRequired ? boatName.trim() : null,
          password,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setError(t('auth.registration.usernameExists'));
        } else {
          setError(data.error || t('auth.registration.registrationFailed'));
        }
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      console.error('Registration error:', err);
      setError(t('auth.registration.registrationFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Dialog open onOpenChange={(open) => { if (!open) onSuccess(); }}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader className="items-center py-6 text-center">
            <CheckCircle2Icon className="mb-2 size-14 text-primary" />
            <DialogTitle className="text-xl">{t('auth.registration.success')}</DialogTitle>
            <DialogDescription>{t('auth.registration.successMessage')}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !loading) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('auth.registration.title')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('auth.registration.info')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Alert>
            <InfoIcon />
            <AlertDescription>{t('auth.registration.info')}</AlertDescription>
          </Alert>

          {error && (
            <Alert variant="destructive">
              <AlertTriangleIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form id="registration-form" onSubmit={handleSubmit}>
            <FieldGroup>
              {/* Username */}
              <Field>
                <FieldLabel htmlFor="reg-username">
                  {t('auth.registration.username')} *
                </FieldLabel>
                <InputGroup className="h-9">
                  <InputGroupAddon>
                    <UserIcon />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="reg-username"
                    type="text"
                    placeholder={t('auth.registration.usernamePlaceholder')}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                    required
                  />
                </InputGroup>
                <FieldDescription>{t('auth.registration.usernameHint')}</FieldDescription>
              </Field>

              {/* Phone Number */}
              <Field>
                <FieldLabel htmlFor="reg-phone">
                  {t('auth.registration.phoneNumber')} *
                </FieldLabel>
                <InputGroup className="h-9">
                  <InputGroupAddon>
                    <PhoneIcon />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="reg-phone"
                    type="tel"
                    placeholder={t('auth.registration.phoneNumberPlaceholder')}
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    disabled={loading}
                    required
                  />
                </InputGroup>
                <FieldDescription>{t('auth.registration.phoneNumberHint')}</FieldDescription>
              </Field>

              {/* Country */}
              <Field>
                <FieldLabel>{t('auth.registration.country')} *</FieldLabel>
                <Select
                  items={countryItems}
                  value={country || null}
                  onValueChange={(v) => setCountry(v ?? '')}
                  disabled={loading}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {countries.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              {/* Vessel Type */}
              <Field>
                <FieldLabel>{t('auth.registration.vesselType')} *</FieldLabel>
                <Select
                  items={vesselItems}
                  value={vesselType || null}
                  onValueChange={(v) => setVesselType(v ?? '')}
                  disabled={loading}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {vesselTypes.map(({ value, labelKey }) => (
                        <SelectItem key={value} value={value}>
                          {t(labelKey)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              {/* Vessel Name */}
              {vesselType && (
                <Field data-disabled={!isBoatNameRequired || undefined}>
                  <FieldLabel htmlFor="reg-boat-name">
                    {t('auth.registration.boatName')} {isBoatNameRequired ? '*' : ''}
                  </FieldLabel>
                  <InputGroup className="h-9">
                    <InputGroupAddon>
                      <ShipIcon />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="reg-boat-name"
                      type="text"
                      placeholder={
                        isBoatNameRequired
                          ? t('auth.registration.boatNamePlaceholder')
                          : t('auth.registration.boatNameOptional')
                      }
                      value={boatName}
                      onChange={(e) => setBoatName(e.target.value)}
                      disabled={loading || !isBoatNameRequired}
                      required={isBoatNameRequired}
                    />
                  </InputGroup>
                  {!isBoatNameRequired && (
                    <FieldDescription>
                      {t('auth.registration.boatNameNotRequired')}
                    </FieldDescription>
                  )}
                </Field>
              )}

              {/* Main Gear Type */}
              <Field>
                <FieldLabel>{t('auth.registration.mainGearType')} *</FieldLabel>
                <Select
                  items={gearItems}
                  value={mainGearType || null}
                  onValueChange={(v) => setMainGearType(v ?? '')}
                  disabled={loading}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {gearTypes.map(({ value, labelKey }) => (
                        <SelectItem key={value} value={value}>
                          {t(labelKey)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              {/* Password */}
              <Field>
                <FieldLabel htmlFor="reg-password">
                  {t('auth.registration.password')} *
                </FieldLabel>
                <InputGroup className="h-9">
                  <InputGroupAddon>
                    <LockIcon />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="reg-password"
                    type="password"
                    placeholder={t('auth.registration.passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                    minLength={6}
                  />
                </InputGroup>
                <FieldDescription>{t('auth.registration.passwordHint')}</FieldDescription>
              </Field>

              {/* Confirm Password */}
              <Field>
                <FieldLabel htmlFor="reg-confirm-password">
                  {t('auth.registration.confirmPassword')} *
                </FieldLabel>
                <InputGroup className="h-9">
                  <InputGroupAddon>
                    <LockIcon />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="reg-confirm-password"
                    type="password"
                    placeholder={t('auth.registration.confirmPasswordPlaceholder')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                </InputGroup>
              </Field>
            </FieldGroup>
          </form>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="registration-form" disabled={loading}>
            {loading ? (
              <>
                <Spinner data-icon="inline-start" />
                {t('common.loading')}...
              </>
            ) : (
              t('auth.registration.registerButton')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RegistrationModal;
