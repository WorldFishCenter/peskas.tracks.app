import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronDownIcon,
  InfoIcon,
  LockIcon,
  SmartphoneIcon,
  UserPlusIcon,
} from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { PeskasLogo } from '../components/PeskasLogo';
import RegistrationModal from '../components/RegistrationModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Spinner } from '@/components/ui/spinner';

const Login: React.FC = () => {
  const [imei, setImei] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const { login, loginDemo } = useAuth();
  const { t } = useTranslation();
  const { languages, currentLanguage, changeLanguage } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedImei = imei.trim();
    const trimmedPassword = password.trim();

    if (!trimmedImei || !trimmedPassword) {
      setError(t('auth.enterBothFields'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(trimmedImei, trimmedPassword);
    } catch (err) {
      setError(t('auth.invalidCredentials'));
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      await loginDemo();
    } catch (err) {
      setError('Demo mode error');
      console.error('Demo login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-8">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="m-0 flex justify-center">
            <span className="peskas-lockup flex items-center gap-2">
              <PeskasLogo />
              <span className="peskas-baseline text-2xl font-medium leading-none text-muted-foreground">
                Tracks
              </span>
            </span>
          </h1>

          {/* Language switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="lg"
                  className="min-w-36"
                  title={t('language.selectLanguage')}
                />
              }
            >
              <span>{currentLanguage.flag}</span>
              <span>{currentLanguage.name}</span>
              <ChevronDownIcon data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="min-w-44">
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t('language.selectLanguage')}</DropdownMenuLabel>
                {languages.map((language) => (
                  <DropdownMenuItem
                    key={language.code}
                    onClick={() => changeLanguage(language.code)}
                    className="flex min-h-10 items-center gap-2"
                  >
                    <span>{language.flag}</span>
                    <span className="flex-1">{language.name}</span>
                    {currentLanguage.code === language.code && (
                      <CheckIcon className="text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{t('auth.loginTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {error && (
              <div className="flex flex-col gap-3">
                <Alert variant="destructive">
                  <AlertTriangleIcon />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>

                <Alert>
                  <InfoIcon />
                  <AlertTitle>{t('auth.troubleshootingTitle')}</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-1 flex list-disc flex-col gap-1 pl-4">
                      {(t('auth.troubleshootingTips', { returnObjects: true }) as string[]).map(
                        (tip: string, index: number) => (
                          <li key={index}>{tip}</li>
                        )
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="login-imei">{t('auth.imeiOrBoatName')}</FieldLabel>
                  <InputGroup className="h-10">
                    <InputGroupAddon>
                      <SmartphoneIcon />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="login-imei"
                      type="text"
                      placeholder={t('common.enterImeiOrBoatName')}
                      value={imei}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImei(e.target.value)}
                      autoComplete="off"
                      disabled={loading}
                      required
                    />
                  </InputGroup>
                  <FieldDescription>{t('common.exampleImeiOrBoatName')}</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="login-password">{t('auth.password')}</FieldLabel>
                  <InputGroup className="h-10">
                    <InputGroupAddon>
                      <LockIcon />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="login-password"
                      type="password"
                      placeholder={t('common.yourPassword')}
                      value={password}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setPassword(e.target.value)
                      }
                      autoComplete="current-password"
                      disabled={loading}
                      required
                    />
                  </InputGroup>
                </Field>

                <Button type="submit" size="lg" className="h-12 w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Spinner data-icon="inline-start" />
                      {t('common.loading')}...
                    </>
                  ) : (
                    t('auth.loginButton')
                  )}
                </Button>
              </FieldGroup>
            </form>

            {/* Demo Mode Section */}
            <div className="flex flex-col gap-3">
              <FieldSeparator>{t('common.or')}</FieldSeparator>
              <div className="flex flex-col items-center gap-2 text-center">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-12 w-full"
                  onClick={handleDemoLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Spinner data-icon="inline-start" />
                      {t('common.loading')}...
                    </>
                  ) : (
                    <>
                      <SmartphoneIcon data-icon="inline-start" />
                      {t('auth.tryDemoMode')}
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">{t('auth.demoModeDescription')}</p>
              </div>
            </div>

            {/* Registration Section */}
            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={() => setShowRegistrationModal(true)}
                disabled={loading}
              >
                <UserPlusIcon data-icon="inline-start" />
                {t('auth.registration.noAccount')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {showRegistrationModal && (
        <RegistrationModal
          onClose={() => setShowRegistrationModal(false)}
          onSuccess={() => {
            setShowRegistrationModal(false);
            setError(null);
          }}
        />
      )}
    </div>
  );
};

export default Login;
