import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api/httpClient';
import {
  IconUser,
  IconLock,
  IconMapPin,
  IconShip,
  IconTool,
  IconAlertTriangle,
  IconCheck,
  IconInfoCircle,
  IconPhone
} from '@tabler/icons-react';

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

  // Validation state
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Predefined lists
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

  // Field validation
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

  const handleBlur = (field: string) => {
    setTouched({ ...touched, [field]: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setError(validationErrors[0]); // Show first error
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

      // Success!
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

  // Success screen
  if (success) {
    return (
      <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-body text-center py-5">
              <div className="mb-3">
                <IconCheck size={64} className="text-success" />
              </div>
              <h3 className="mb-3">{t('auth.registration.success')}</h3>
              <p className="text-muted">{t('auth.registration.successMessage')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h3 className="modal-title">{t('auth.registration.title')}</h3>
            <button type="button" className="btn-close" onClick={onClose} disabled={loading}></button>
          </div>

          <div className="modal-body">
            <div className="alert alert-info mb-3" role="alert">
              <div className="d-flex">
                <div>
                  <IconInfoCircle className="me-2" />
                </div>
                <div>
                  {t('auth.registration.info')}
                </div>
              </div>
            </div>

            {error && (
              <div className="alert alert-danger mb-3" role="alert">
                <div className="d-flex">
                  <div>
                    <IconAlertTriangle className="me-2" />
                  </div>
                  <div>{error}</div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Username */}
              <div className="mb-3">
                <label className="form-label required">{t('auth.registration.username')}</label>
                <div className="input-group input-group-flat">
                  <span className="input-group-text">
                    <IconUser size={18} stroke={1.5} />
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder={t('auth.registration.usernamePlaceholder')}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onBlur={() => handleBlur('username')}
                    disabled={loading}
                    required
                  />
                </div>
                <div className="form-hint">
                  {t('auth.registration.usernameHint')}
                </div>
              </div>

              {/* Phone Number */}
              <div className="mb-3">
                <label className="form-label required">{t('auth.registration.phoneNumber')}</label>
                <div className="input-group input-group-flat">
                  <span className="input-group-text">
                    <IconPhone size={18} stroke={1.5} />
                  </span>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder={t('auth.registration.phoneNumberPlaceholder')}
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    onBlur={() => handleBlur('phoneNumber')}
                    disabled={loading}
                    required
                  />
                </div>
                <div className="form-hint">
                  {t('auth.registration.phoneNumberHint')}
                </div>
              </div>

              {/* Country */}
              <div className="mb-3">
                <label className="form-label required">{t('auth.registration.country')}</label>
                <div className="input-group input-group-flat">
                  <span className="input-group-text">
                    <IconMapPin size={18} stroke={1.5} />
                  </span>
                  <select
                    className="form-select"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    onBlur={() => handleBlur('country')}
                    disabled={loading}
                    required
                  >
                    <option value="">{t('auth.registration.selectCountry')}</option>
                    {countries.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Vessel Type */}
              <div className="mb-3">
                <label className="form-label required">{t('auth.registration.vesselType')}</label>
                <div className="input-group input-group-flat">
                  <span className="input-group-text">
                    <IconShip size={18} stroke={1.5} />
                  </span>
                  <select
                    className="form-select"
                    value={vesselType}
                    onChange={(e) => setVesselType(e.target.value)}
                    onBlur={() => handleBlur('vesselType')}
                    disabled={loading}
                    required
                  >
                    <option value="">{t('auth.registration.selectVesselType')}</option>
                    {vesselTypes.map(({ value, labelKey }) => (
                      <option key={value} value={value}>{t(labelKey)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Boat Name */}
              {vesselType && (
                <div className="mb-3">
                  <label className={`form-label ${isBoatNameRequired ? 'required' : ''}`}>
                    {t('auth.registration.boatName')}
                  </label>
                  <div className="input-group input-group-flat">
                    <span className="input-group-text">
                      <IconShip size={18} stroke={1.5} />
                    </span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder={
                        isBoatNameRequired
                          ? t('auth.registration.boatNamePlaceholder')
                          : t('auth.registration.boatNameOptional')
                      }
                      value={boatName}
                      onChange={(e) => setBoatName(e.target.value)}
                      onBlur={() => handleBlur('boatName')}
                      disabled={loading || !isBoatNameRequired}
                      required={isBoatNameRequired}
                    />
                  </div>
                  {!isBoatNameRequired && (
                    <div className="form-hint text-muted">
                      {t('auth.registration.boatNameNotRequired')}
                    </div>
                  )}
                </div>
              )}

              {/* Main Gear Type */}
              <div className="mb-3">
                <label className="form-label required">{t('auth.registration.mainGearType')}</label>
                <div className="input-group input-group-flat">
                  <span className="input-group-text">
                    <IconTool size={18} stroke={1.5} />
                  </span>
                  <select
                    className="form-select"
                    value={mainGearType}
                    onChange={(e) => setMainGearType(e.target.value)}
                    onBlur={() => handleBlur('mainGearType')}
                    disabled={loading}
                    required
                  >
                    <option value="">{t('auth.registration.selectGearType')}</option>
                    {gearTypes.map(({ value, labelKey }) => (
                      <option key={value} value={value}>{t(labelKey)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Password */}
              <div className="mb-3">
                <label className="form-label required">{t('auth.registration.password')}</label>
                <div className="input-group input-group-flat">
                  <span className="input-group-text">
                    <IconLock size={18} stroke={1.5} />
                  </span>
                  <input
                    type="password"
                    className="form-control"
                    placeholder={t('auth.registration.passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => handleBlur('password')}
                    disabled={loading}
                    required
                    minLength={6}
                  />
                </div>
                <div className="form-hint">
                  {t('auth.registration.passwordHint')}
                </div>
              </div>

              {/* Confirm Password */}
              <div className="mb-3">
                <label className="form-label required">{t('auth.registration.confirmPassword')}</label>
                <div className="input-group input-group-flat">
                  <span className="input-group-text">
                    <IconLock size={18} stroke={1.5} />
                  </span>
                  <input
                    type="password"
                    className="form-control"
                    placeholder={t('auth.registration.confirmPasswordPlaceholder')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onBlur={() => handleBlur('confirmPassword')}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer px-0 pb-0">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={onClose}
                  disabled={loading}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      {t('common.loading')}...
                    </>
                  ) : t('auth.registration.registerButton')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrationModal;
