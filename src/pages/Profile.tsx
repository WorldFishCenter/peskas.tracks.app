import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangleIcon,
  BarChart3Icon,
  CalendarIcon,
  CheckIcon,
  InfoIcon,
  LockIcon,
  MapIcon,
  PhoneIcon,
  SettingsIcon,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { isDemoMode } from '../utils/demoData';
import { apiFetch } from '../api/httpClient';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
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

const Profile: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const isDemo = isDemoMode();

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Form state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [country, setCountry] = useState('');
  const [vesselType, setVesselType] = useState('');
  const [mainGearType, setMainGearType] = useState('');
  const [boatName, setBoatName] = useState('');
  const [createdAt, setCreatedAt] = useState<Date | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // User statistics state
  const [totalCatchReports, setTotalCatchReports] = useState<number>(0);
  const [statsLoading, setStatsLoading] = useState(false);

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

  const getVesselLabel = (value: string) => {
    const match = vesselTypes.find((v) => v.value === value);
    return match ? t(match.labelKey) : value;
  };

  const getGearLabel = (value: string) => {
    const match = gearTypes.find((g) => g.value === value);
    return match ? t(match.labelKey) : value;
  };

  // Load user profile data
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!currentUser) return;

      if (currentUser.role === 'admin' || isDemo) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await apiFetch(`/users/${currentUser.id}`);

        if (!response.ok) {
          throw new Error('Failed to load profile');
        }

        const userData = await response.json();

        setPhoneNumber(userData.phoneNumber || '');
        setCountry(userData.Country || '');
        setVesselType(userData.vessel_type || '');
        setMainGearType(userData.main_gear_type || '');
        setBoatName(userData.Boat || '');
        setCreatedAt(userData.createdAt ? new Date(userData.createdAt) : null);
      } catch (err) {
        console.error('Error loading profile:', err);
        setError(t('profile.errorLoadingProfile'));
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, [currentUser, isDemo, t]);

  // Load user statistics
  useEffect(() => {
    const loadUserStats = async () => {
      if (!currentUser || isDemo) return;

      try {
        setStatsLoading(true);
        const identifier = currentUser.imeis?.[0] || currentUser.username || '';

        if (!identifier) return;

        const response = await apiFetch(`/catch-events/user/${identifier}`);

        if (response.ok) {
          const events = await response.json();
          setTotalCatchReports(events.length);
        }
      } catch (err) {
        console.error('Error loading stats:', err);
      } finally {
        setStatsLoading(false);
      }
    };

    loadUserStats();
  }, [currentUser, isDemo]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!phoneNumber.trim()) {
      setError(t('auth.registration.phoneNumberRequired'));
      return;
    }
    if (!country) {
      setError(t('auth.registration.countryRequired'));
      return;
    }
    if (!vesselType) {
      setError(t('auth.registration.vesselTypeRequired'));
      return;
    }
    if (isBoatNameRequired && !boatName.trim()) {
      setError(t('auth.registration.boatNameRequired'));
      return;
    }
    if (!mainGearType) {
      setError(t('auth.registration.gearTypeRequired'));
      return;
    }

    try {
      setLoading(true);

      const response = await apiFetch(`/users/${currentUser?.id}`, {
        method: 'PUT',
        body: {
          phoneNumber,
          Country: country,
          vessel_type: vesselType,
          main_gear_type: mainGearType,
          Boat: vesselType !== 'Feet' ? boatName : null,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update profile');
      }

      setSuccess(t('profile.profileUpdated'));
      setIsEditingProfile(false);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err instanceof Error ? err.message : t('profile.errorUpdatingProfile'));
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 6) {
      setError(t('profile.passwordTooShort'));
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError(t('profile.passwordsDoNotMatch'));
      return;
    }

    try {
      setLoading(true);

      const response = await apiFetch(`/users/${currentUser?.id}/change-password`, {
        method: 'POST',
        body: {
          currentPassword,
          newPassword,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to change password');
      }

      setSuccess(t('profile.passwordChanged'));
      setIsChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error changing password:', err);
      setError(err instanceof Error ? err.message : t('profile.errorUpdatingProfile'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingProfile(false);
    setError(null);
  };

  const handleCancelPasswordChange = () => {
    setIsChangingPassword(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setError(null);
  };

  const getMemberSinceDate = () => {
    if (!createdAt) return '-';
    return format(createdAt, 'MMMM dd, yyyy');
  };

  const pageHeader = (
    <div className="border-b bg-background print:hidden">
      <div className="mx-auto max-w-7xl px-4 py-4">
        <h2 className="text-xl font-semibold tracking-tight">{t('profile.title')}</h2>
      </div>
    </div>
  );

  const isBoatNameRequired = vesselType !== 'Feet';

  return (
    <MainLayout pageHeader={pageHeader}>
      {/* Admin Mode - No Profile */}
      {currentUser?.role === 'admin' && (
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader className="items-center text-center">
              <div className="mb-2 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <SettingsIcon className="size-7" />
              </div>
              <CardTitle className="text-xl">{t('profile.adminMode')}</CardTitle>
              <CardDescription>{t('profile.adminModeDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <Alert className="text-left">
                <InfoIcon />
                <AlertTitle>{t('profile.adminCapabilities')}</AlertTitle>
                <AlertDescription>
                  <ul className="mt-1 flex list-disc flex-col gap-1 pl-4">
                    <li>{t('profile.adminCap1')}</li>
                    <li>{t('profile.adminCap2')}</li>
                    <li>{t('profile.adminCap3')}</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="justify-center">
              <Button render={<Link to="/" />} nativeButton={false}>
                <MapIcon data-icon="inline-start" />
                {t('profile.goToDashboard')}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Regular User Profile */}
      {currentUser?.role !== 'admin' && (
        <div className="flex flex-col gap-4">
          {success && (
            <Alert>
              <CheckIcon className="text-primary" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangleIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Account Overview Card */}
            <Card>
              <CardHeader>
                <CardTitle>{t('profile.accountInfo')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <Avatar size="lg">
                    <AvatarFallback>
                      {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold">
                      {isDemo ? 'Demo User' : currentUser?.username || currentUser?.name || '-'}
                    </div>
                    <div className="text-xs text-muted-foreground">{t('profile.username')}</div>
                  </div>
                </div>

                {phoneNumber && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      {t('profile.phoneNumber')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <PhoneIcon className="size-4 text-muted-foreground" />
                      <span>{isDemo ? '+255 *** *** ***' : phoneNumber}</span>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    {t('profile.accountType')}
                  </span>
                  <div>
                    {currentUser?.hasImei === true ||
                    (currentUser?.hasImei !== false && (currentUser?.imeis?.length ?? 0) > 0) ? (
                      <Badge>{t('profile.pdsUser')}</Badge>
                    ) : (
                      <Badge variant="secondary">{t('profile.nonPdsUser')}</Badge>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    {t('profile.memberSince')}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <CalendarIcon className="size-4 text-muted-foreground" />
                    <span>{getMemberSinceDate()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Statistics Card */}
            <Card>
              <CardHeader>
                <CardTitle>{t('profile.statistics')}</CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="flex justify-center py-6">
                    <Spinner className="size-5 text-primary" />
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {t('profile.totalCatchReports')}
                      </span>
                      <span className="text-4xl font-bold tabular-nums">{totalCatchReports}</span>
                    </div>
                    <BarChart3Icon className="size-12 text-muted-foreground/60" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Registration Details Card */}
          <form onSubmit={handleUpdateProfile}>
            <Card>
              <CardHeader>
                <CardTitle>{t('profile.registrationDetails')}</CardTitle>
                {!isEditingProfile && !isChangingPassword && !isDemo && (
                  <CardAction>
                    <Button type="button" onClick={() => setIsEditingProfile(true)}>
                      {t('profile.editProfile')}
                    </Button>
                  </CardAction>
                )}
              </CardHeader>
              <CardContent>
                <FieldGroup className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Phone Number */}
                  <Field>
                    <FieldLabel htmlFor="profile-phone">
                      {t('profile.phoneNumber')} {isEditingProfile ? '*' : ''}
                    </FieldLabel>
                    {isEditingProfile ? (
                      <Input
                        id="profile-phone"
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        disabled={loading}
                        required
                        placeholder={t('auth.registration.phoneNumberPlaceholder')}
                      />
                    ) : (
                      <div className="py-1 text-sm">
                        {isDemo ? '+255 *** *** ***' : phoneNumber || '-'}
                      </div>
                    )}
                  </Field>

                  {/* Country */}
                  <Field>
                    <FieldLabel>
                      {t('profile.country')} {isEditingProfile ? '*' : ''}
                    </FieldLabel>
                    {isEditingProfile ? (
                      <Select
                        items={countryItems}
                        value={country || null}
                        onValueChange={(v) => setCountry(v ?? '')}
                        disabled={loading}
                        required
                      >
                        <SelectTrigger className="w-full">
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
                    ) : (
                      <div className="py-1 text-sm">
                        {isDemo ? 'Demo Country' : country || '-'}
                      </div>
                    )}
                  </Field>

                  {/* Vessel Type */}
                  <Field>
                    <FieldLabel>
                      {t('profile.vesselType')} {isEditingProfile ? '*' : ''}
                    </FieldLabel>
                    {isEditingProfile ? (
                      <Select
                        items={vesselItems}
                        value={vesselType || null}
                        onValueChange={(v) => setVesselType(v ?? '')}
                        disabled={loading}
                        required
                      >
                        <SelectTrigger className="w-full">
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
                    ) : (
                      <div className="py-1 text-sm">
                        {vesselType ? getVesselLabel(vesselType) : '-'}
                      </div>
                    )}
                  </Field>

                  {/* Vessel Name */}
                  <Field data-disabled={(isEditingProfile && !isBoatNameRequired) || undefined}>
                    <FieldLabel htmlFor="profile-boat">
                      {t('profile.boatName')} {isBoatNameRequired && isEditingProfile ? '*' : ''}
                    </FieldLabel>
                    {isEditingProfile ? (
                      <>
                        <Input
                          id="profile-boat"
                          type="text"
                          value={boatName}
                          onChange={(e) => setBoatName(e.target.value)}
                          disabled={loading || !isBoatNameRequired}
                          required={isBoatNameRequired}
                          placeholder={
                            isBoatNameRequired
                              ? t('auth.registration.boatNamePlaceholder')
                              : t('profile.noBoatName')
                          }
                        />
                        {!isBoatNameRequired && (
                          <FieldDescription>
                            {t('auth.registration.boatNameNotRequired')}
                          </FieldDescription>
                        )}
                      </>
                    ) : (
                      <div className="py-1 text-sm">
                        {isDemo ? 'Demo Vessel' : boatName || t('profile.noBoatName')}
                      </div>
                    )}
                  </Field>

                  {/* Main Gear Type */}
                  <Field>
                    <FieldLabel>
                      {t('profile.mainGearType')} {isEditingProfile ? '*' : ''}
                    </FieldLabel>
                    {isEditingProfile ? (
                      <Select
                        items={gearItems}
                        value={mainGearType || null}
                        onValueChange={(v) => setMainGearType(v ?? '')}
                        disabled={loading}
                        required
                      >
                        <SelectTrigger className="w-full">
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
                    ) : (
                      <div className="py-1 text-sm">
                        {mainGearType ? getGearLabel(mainGearType) : '-'}
                      </div>
                    )}
                  </Field>
                </FieldGroup>
              </CardContent>
              {isEditingProfile && (
                <CardFooter className="justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={loading}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading && <Spinner data-icon="inline-start" />}
                    {loading ? t('profile.saving') : t('common.save')}
                  </Button>
                </CardFooter>
              )}
            </Card>
          </form>

          {/* Password Change Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.password')}</CardTitle>
              {!isChangingPassword && !isEditingProfile && !isDemo && (
                <CardAction>
                  <Button type="button" onClick={() => setIsChangingPassword(true)}>
                    {t('profile.changePassword')}
                  </Button>
                </CardAction>
              )}
            </CardHeader>
            {isChangingPassword && (
              <form onSubmit={handleChangePassword}>
                <CardContent className="pb-4">
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="current-password">
                        {t('profile.currentPassword')} *
                      </FieldLabel>
                      <InputGroup>
                        <InputGroupAddon>
                          <LockIcon />
                        </InputGroupAddon>
                        <InputGroupInput
                          id="current-password"
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          disabled={loading}
                          required
                        />
                      </InputGroup>
                    </Field>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="new-password">
                          {t('profile.newPassword')} *
                        </FieldLabel>
                        <InputGroup>
                          <InputGroupAddon>
                            <LockIcon />
                          </InputGroupAddon>
                          <InputGroupInput
                            id="new-password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            disabled={loading}
                            required
                            minLength={6}
                          />
                        </InputGroup>
                        <FieldDescription>{t('auth.registration.passwordHint')}</FieldDescription>
                      </Field>

                      <Field>
                        <FieldLabel htmlFor="confirm-new-password">
                          {t('profile.confirmNewPassword')} *
                        </FieldLabel>
                        <InputGroup>
                          <InputGroupAddon>
                            <LockIcon />
                          </InputGroupAddon>
                          <InputGroupInput
                            id="confirm-new-password"
                            type="password"
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            disabled={loading}
                            required
                          />
                        </InputGroup>
                      </Field>
                    </div>
                  </FieldGroup>
                </CardContent>
                <CardFooter className="justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelPasswordChange}
                    disabled={loading}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading && <Spinner data-icon="inline-start" />}
                    {loading ? t('profile.saving') : t('profile.changePassword')}
                  </Button>
                </CardFooter>
              </form>
            )}
          </Card>
        </div>
      )}
    </MainLayout>
  );
};

export default Profile;
