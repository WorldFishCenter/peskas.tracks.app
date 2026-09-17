import React, { useState, useEffect } from 'react';
import MainLayout from '../layouts/MainLayout';
import { useTranslation } from 'react-i18next';
import { IconLock, IconCheck, IconAlertTriangle, IconCalendar, IconChartBar, IconPhone } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { isDemoMode } from '../utils/demoData';
import { apiFetch } from '../api/httpClient';

const Profile: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const isDemo = isDemoMode();

  // Edit mode state
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

  // Predefined lists (same as RegistrationModal)
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
    { value: 'Feet', labelKey: 'auth.registration.vesselOptions.feet' }
  ];
  const gearTypes = [
    { value: 'Nets', labelKey: 'auth.registration.gearOptions.nets' },
    { value: 'Lines & Hooks', labelKey: 'auth.registration.gearOptions.linesAndHooks' },
    { value: 'Traps', labelKey: 'auth.registration.gearOptions.traps' },
    { value: 'Spears & Harpoons', labelKey: 'auth.registration.gearOptions.spearsAndHarpoons' },
    { value: 'Gleaning', labelKey: 'auth.registration.gearOptions.gleaning' },
    { value: 'Other', labelKey: 'auth.registration.gearOptions.other' }
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

      // Skip profile loading for admin users - they don't have profiles.
      // Nor does the demo account: it exists in no database.
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

        // Set form fields from user data
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
      // The demo's catch reports are simulated and never stored.
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

    try {
      setLoading(true);

      const response = await apiFetch(`/users/${currentUser?.id}`, {
        method: 'PUT',
        body: {
          phoneNumber: phoneNumber,
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

      // Clear success message after 3 seconds
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

    // Validation
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

      // Clear success message after 3 seconds
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

  // Calculate member since date
  const getMemberSinceDate = () => {
    if (!createdAt) {
      return '-';
    }
    return format(createdAt, 'MMMM dd, yyyy');
  };

  // Create the page header
  const pageHeader = (
    <div className="page-header d-print-none">
      <div className="container-xl">
        <h2 className="page-title">{t('profile.title')}</h2>
      </div>
    </div>
  );

  const isBoatNameRequired = vesselType !== 'Feet';

  return (
    <MainLayout pageHeader={pageHeader}>
      {/* Admin Mode - No Profile */}
      {currentUser?.role === 'admin' && (
        <div className="row justify-content-center">
          <div className="col-lg-8">
            <div className="card card-lg">
              <div className="card-body text-center py-5">
                <div className="empty-icon mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-lg text-primary" width="48" height="48" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                    <path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" />
                    <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
                  </svg>
                </div>
                <h2 className="mb-3">{t('profile.adminMode')}</h2>
                <p className="text-secondary mb-4">
                  {t('profile.adminModeDesc')}
                </p>
                <div className="alert alert-info text-start mb-4">
                  <div className="d-flex">
                    <div className="me-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="icon alert-icon" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                        <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
                        <path d="M12 9h.01" />
                        <path d="M11 12h1v4h1" />
                      </svg>
                    </div>
                    <div>
                      <strong>{t('profile.adminCapabilities')}</strong>
                      <ul className="mb-0 mt-2">
                        <li>{t('profile.adminCap1')}</li>
                        <li>{t('profile.adminCap2')}</li>
                        <li>{t('profile.adminCap3')}</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <a href="/" className="btn btn-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" className="icon me-2" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                    <path d="M3 7l6 -3l6 3l6 -3v13l-6 3l-6 -3l-6 3v-13" />
                    <path d="M9 4v13" />
                    <path d="M15 7v13" />
                  </svg>
                  {t('profile.goToDashboard')}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Regular User Profile */}
      {currentUser?.role !== 'admin' && (
        <>
          {/* Demo Mode Banner
          {isDemo && (
            <div className="alert alert-warning" role="alert">
              <div className="d-flex align-items-center">
                <IconAlertTriangle className="me-2" />
                <div>
                  <strong>Demo Mode:</strong> All personal information shown below is anonymized for privacy.
                  Profile editing is disabled in demo mode.
                </div>
              </div>
            </div>
          )} */}

          {/* Success/Error Alerts */}
      {success && (
        <div className="alert alert-success" role="alert">
          <div className="d-flex">
            <div>
              <IconCheck className="me-2" />
            </div>
            <div>{success}</div>
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" role="alert">
          <div className="d-flex">
            <div>
              <IconAlertTriangle className="me-2" />
            </div>
            <div>{error}</div>
          </div>
        </div>
      )}

      <div className="row row-cards">
        {/* Account Overview Card */}
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">{t('profile.accountInfo')}</h3>
            </div>
            <div className="card-body">
              <div className="d-flex align-items-center mb-3">
                <span className="avatar avatar-md me-3">{currentUser?.name?.charAt(0).toUpperCase()}</span>
                <div>
                  <div className="fw-bold">
                    {isDemo ? 'Demo User' : (currentUser?.username || currentUser?.name || '-')}
                  </div>
                  <div className="text-muted">{t('profile.username')}</div>
                </div>
              </div>
              {phoneNumber && (
                <div className="mb-3">
                  <div className="text-muted mb-2">{t('profile.phoneNumber')}</div>
                  <div className="d-flex align-items-center">
                    <IconPhone size={16} className="me-1" />
                    <span>{isDemo ? '+255 *** *** ***' : phoneNumber}</span>
                  </div>
                </div>
              )}
              <div className="mb-3">
                <div className="text-muted mb-2">{t('profile.accountType')}</div>
                <div>
                  {(currentUser?.hasImei === true || (currentUser?.hasImei !== false && (currentUser?.imeis?.length ?? 0) > 0)) ? (
                    <span className="badge bg-primary-lt">{t('profile.pdsUser')}</span>
                  ) : (
                    <span className="badge bg-info-lt">{t('profile.nonPdsUser')}</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-muted mb-2">{t('profile.memberSince')}</div>
                <div className="d-flex align-items-center">
                  <IconCalendar size={16} className="me-1" />
                  <span>{getMemberSinceDate()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Card */}
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">{t('profile.statistics')}</h3>
            </div>
            <div className="card-body">
              {statsLoading ? (
                <div className="text-center py-3">
                  <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                </div>
              ) : (
                <div className="row">
                  <div className="col">
                    <div className="subheader">{t('profile.totalCatchReports')}</div>
                    <div className="h1 mb-0">{totalCatchReports}</div>
                  </div>
                  <div className="col-auto">
                    <IconChartBar size={48} className="text-muted" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Registration Details Card */}
        <div className="col-12">
          <form onSubmit={handleUpdateProfile} className="card">
            <div className="card-header">
              <h3 className="card-title">{t('profile.registrationDetails')}</h3>
              {!isEditingProfile && !isChangingPassword && !isDemo && (
                <div className="card-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setIsEditingProfile(true)}
                  >
                    {t('profile.editProfile')}
                  </button>
                </div>
              )}
            </div>
            <div className="card-body">
              <div className="row g-3">
                {/* Phone Number */}
                <div className="col-md-6">
                  <label className="form-label required">
                    {t('profile.phoneNumber')}
                  </label>
                  {isEditingProfile ? (
                    <input
                      type="tel"
                      className="form-control"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      disabled={loading}
                      required
                      placeholder={t('auth.registration.phoneNumberPlaceholder')}
                    />
                  ) : (
                    <div className="form-control-plaintext">
                      {isDemo ? '+255 *** *** ***' : (phoneNumber || '-')}
                    </div>
                  )}
                </div>

                {/* Country */}
                <div className="col-md-6">
                  <label className="form-label required">
                    {t('profile.country')}
                  </label>
                  {isEditingProfile ? (
                    <select
                      className="form-select"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      disabled={loading}
                      required
                    >
                      <option value="">{t('auth.registration.selectCountry')}</option>
                      {countries.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="form-control-plaintext">
                      {isDemo ? 'Demo Country' : (country || '-')}
                    </div>
                  )}
                </div>

                {/* Vessel Type */}
                <div className="col-md-6">
                  <label className="form-label required">
                    {t('profile.vesselType')}
                  </label>
                  {isEditingProfile ? (
                    <select
                      className="form-select"
                      value={vesselType}
                      onChange={(e) => setVesselType(e.target.value)}
                      disabled={loading}
                      required
                    >
                      <option value="">{t('auth.registration.selectVesselType')}</option>
                      {vesselTypes.map(({ value, labelKey }) => (
                        <option key={value} value={value}>{t(labelKey)}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="form-control-plaintext">{vesselType ? getVesselLabel(vesselType) : '-'}</div>
                  )}
                </div>

                {/* Boat Name */}
                <div className="col-md-6">
                  <label className={`form-label ${isBoatNameRequired && isEditingProfile ? 'required' : ''}`}>
                    {t('profile.boatName')}
                  </label>
                  {isEditingProfile ? (
                    <>
                      <input
                        type="text"
                        className="form-control"
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
                        <div className="form-hint">{t('auth.registration.boatNameNotRequired')}</div>
                      )}
                    </>
                  ) : (
                    <div className="form-control-plaintext">
                      {isDemo ? 'Demo Vessel' : (boatName || t('profile.noBoatName'))}
                    </div>
                  )}
                </div>

                {/* Main Gear Type */}
                <div className="col-md-6">
                  <label className="form-label required">
                    {t('profile.mainGearType')}
                  </label>
                  {isEditingProfile ? (
                    <select
                      className="form-select"
                      value={mainGearType}
                      onChange={(e) => setMainGearType(e.target.value)}
                      disabled={loading}
                      required
                    >
                      <option value="">{t('auth.registration.selectGearType')}</option>
                      {gearTypes.map(({ value, labelKey }) => (
                        <option key={value} value={value}>{t(labelKey)}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="form-control-plaintext">{mainGearType ? getGearLabel(mainGearType) : '-'}</div>
                  )}
                </div>
              </div>
            </div>
            {isEditingProfile && (
              <div className="card-footer text-end">
                <button
                  type="button"
                  className="btn btn-link link-secondary me-2"
                  onClick={handleCancelEdit}
                  disabled={loading}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? t('profile.saving') : t('common.save')}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Password Change Card */}
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">{t('profile.password')}</h3>
              {!isChangingPassword && !isEditingProfile && !isDemo && (
                <div className="card-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setIsChangingPassword(true)}
                  >
                    {t('profile.changePassword')}
                  </button>
                </div>
              )}
            </div>
            {isChangingPassword && (
              <form onSubmit={handleChangePassword}>
                <div className="card-body">
                  <div className="row g-3">
                    <div className="col-md-12">
                      <label className="form-label required">{t('profile.currentPassword')}</label>
                      <div className="input-group input-group-flat">
                        <span className="input-group-text">
                          <IconLock size={18} stroke={1.5} />
                        </span>
                        <input
                          type="password"
                          className="form-control"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          disabled={loading}
                          required
                        />
                      </div>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label required">{t('profile.newPassword')}</label>
                      <div className="input-group input-group-flat">
                        <span className="input-group-text">
                          <IconLock size={18} stroke={1.5} />
                        </span>
                        <input
                          type="password"
                          className="form-control"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          disabled={loading}
                          required
                          minLength={6}
                        />
                      </div>
                      <div className="form-hint">{t('auth.registration.passwordHint')}</div>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label required">{t('profile.confirmNewPassword')}</label>
                      <div className="input-group input-group-flat">
                        <span className="input-group-text">
                          <IconLock size={18} stroke={1.5} />
                        </span>
                        <input
                          type="password"
                          className="form-control"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          disabled={loading}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="card-footer text-end">
                  <button
                    type="button"
                    className="btn btn-link link-secondary me-2"
                    onClick={handleCancelPasswordChange}
                    disabled={loading}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? t('profile.saving') : t('profile.changePassword')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
        </>
      )}
    </MainLayout>
  );
};

export default Profile;
