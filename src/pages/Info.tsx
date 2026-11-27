import React from 'react';
import MainLayout from '../layouts/MainLayout';
import { useTranslation } from 'react-i18next';
import {
  AwardIcon,
  BarChart3Icon,
  CalendarIcon,
  CameraIcon,
  CheckCircle2Icon,
  ClockIcon,
  CrosshairIcon,
  FishIcon,
  InfoIcon,
  LanguagesIcon,
  LightbulbIcon,
  LogInIcon,
  MapIcon,
  MapPinIcon,
  TargetIcon,
  TrendingUpIcon,
  UserCogIcon,
  UserPlusIcon,
  UsersIcon,
  WavesIcon,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const Info: React.FC = () => {
  const { t } = useTranslation();

  const pageHeader = (
    <div className="border-b bg-background print:hidden">
      <div className="mx-auto max-w-7xl px-4 py-4">
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <InfoIcon className="size-6 text-primary" />
          {t('info.title')}
        </h2>
      </div>
    </div>
  );

  return (
    <MainLayout pageHeader={pageHeader}>
      <div className="flex flex-col gap-5">
        {/* Hero Welcome Section */}
        <Card className="bg-primary/5 ring-primary/20">
          <CardHeader className="flex-row items-center gap-4">
            <LightbulbIcon className="size-10 shrink-0 text-primary" />
            <div className="flex flex-col gap-1">
              <CardTitle className="text-lg">{t('info.welcome.title')}</CardTitle>
              <CardDescription>{t('info.welcome.subtitle')}</CardDescription>
            </div>
          </CardHeader>
        </Card>

        {/* Getting Started */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogInIcon className="size-5 text-primary" />
              {t('info.gettingStarted.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 font-semibold">
                <UserPlusIcon className="size-4 text-primary" />
                <span>1. {t('info.gettingStarted.step1Title')}</span>
              </div>
              <p className="text-sm text-muted-foreground">{t('info.gettingStarted.step1Desc')}</p>
            </div>

            <div className="flex flex-col gap-1">
              <div className="font-semibold">2. {t('info.gettingStarted.step2Title')}</div>
              <p className="text-sm text-muted-foreground">{t('info.gettingStarted.step2Desc')}</p>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 font-semibold">
                <LanguagesIcon className="size-4 text-primary" />
                <span>3. {t('info.gettingStarted.step3Title')}</span>
              </div>
              <p className="text-sm text-muted-foreground">{t('info.gettingStarted.step3Desc')}</p>
            </div>

            <div className="flex flex-col gap-1">
              <div className="font-semibold">4. {t('info.gettingStarted.step4Title')}</div>
              <p className="text-sm text-muted-foreground">{t('info.gettingStarted.step4Desc')}</p>
            </div>

            <Alert>
              <CheckCircle2Icon className="text-primary" />
              <AlertTitle>{t('info.gettingStarted.refreshTitle')}</AlertTitle>
              <AlertDescription>{t('info.gettingStarted.refreshDesc')}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Main Features - Accordion */}
        <Card>
          <CardHeader>
            <CardTitle>{t('info.features.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion defaultValue={['trips']}>
              {/* Feature 1: View Fishing Trips */}
              <AccordionItem value="trips">
                <AccordionTrigger className="gap-2">
                  <span className="flex items-center gap-2">
                    <MapIcon className="size-4 text-primary" />
                    {t('info.features.viewTrips.title')}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="flex flex-col gap-3">
                  <ul className="flex flex-col gap-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{t('info.features.viewTrips.point1')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{t('info.features.viewTrips.point2')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{t('info.features.viewTrips.point3')}</span>
                    </li>
                  </ul>
                  <Alert>
                    <CalendarIcon className="text-primary" />
                    <AlertDescription>{t('info.features.viewTrips.tip')}</AlertDescription>
                  </Alert>
                </AccordionContent>
              </AccordionItem>

              {/* Feature 2: Report Catches */}
              <AccordionItem value="catch">
                <AccordionTrigger className="gap-2">
                  <span className="flex items-center gap-2">
                    <FishIcon className="size-4 text-primary" />
                    {t('info.features.reportCatch.title')}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="flex flex-col gap-3">
                  <div>
                    <h4 className="font-semibold">{t('info.features.reportCatch.whenTitle')}</h4>
                    <p className="text-muted-foreground">
                      {t('info.features.reportCatch.whenDesc')}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold">{t('info.features.reportCatch.whatTitle')}</h4>
                    <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
                      <li>{t('info.features.reportCatch.whatPoint1')}</li>
                      <li>{t('info.features.reportCatch.whatPoint2')}</li>
                      <li>{t('info.features.reportCatch.whatPoint3')}</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center gap-1.5 font-semibold">
                      <CameraIcon className="size-4 text-primary" />
                      {t('info.features.reportCatch.photosTitle')}
                    </h4>
                    <p className="text-muted-foreground">
                      {t('info.features.reportCatch.photosDesc')}
                    </p>
                  </div>
                  <Alert>
                    <AlertTitle>{t('info.features.reportCatch.whyTitle')}</AlertTitle>
                    <AlertDescription>{t('info.features.reportCatch.whyDesc')}</AlertDescription>
                  </Alert>
                </AccordionContent>
              </AccordionItem>

              {/* Feature 3: My Stats */}
              <AccordionItem value="stats">
                <AccordionTrigger className="gap-2">
                  <span className="flex items-center gap-2">
                    <BarChart3Icon className="size-4 text-primary" />
                    {t('info.features.myStats.title')}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="flex flex-col gap-3">
                  <ul className="flex flex-col gap-2">
                    <li className="flex items-start gap-2">
                      <TrendingUpIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span>{t('info.features.myStats.point1')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <UsersIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span>{t('info.features.myStats.point2')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AwardIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span>{t('info.features.myStats.point3')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <TargetIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span>{t('info.features.myStats.point4')}</span>
                    </li>
                  </ul>
                  <Alert>
                    <AlertTitle>{t('info.features.myStats.benefitTitle')}</AlertTitle>
                    <AlertDescription>{t('info.features.myStats.benefitDesc')}</AlertDescription>
                  </Alert>
                </AccordionContent>
              </AccordionItem>

              {/* Feature 4: Live Location */}
              <AccordionItem value="location">
                <AccordionTrigger className="gap-2">
                  <span className="flex items-center gap-2">
                    <MapPinIcon className="size-4 text-primary" />
                    {t('info.features.liveLocation.title')}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="flex flex-col gap-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span>{t('info.features.liveLocation.point1')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span>{t('info.features.liveLocation.point2')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span>{t('info.features.liveLocation.point3')}</span>
                    </li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              {/* Feature 5: Profile Management */}
              <AccordionItem value="profile">
                <AccordionTrigger className="gap-2">
                  <span className="flex items-center gap-2">
                    <UserCogIcon className="size-4 text-primary" />
                    {t('info.features.profile.title')}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="flex flex-col gap-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span>{t('info.features.profile.point1')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span>{t('info.features.profile.point2')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span>{t('info.features.profile.point3')}</span>
                    </li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              {/* Feature 6: GPS Location (Non-PDS Users) */}
              <AccordionItem value="gps">
                <AccordionTrigger className="gap-2">
                  <span className="flex items-center gap-2">
                    <CrosshairIcon className="size-4 text-primary" />
                    {t('info.features.gpsLocation.title')}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="flex flex-col gap-3">
                  <p className="text-muted-foreground">{t('info.features.gpsLocation.desc')}</p>
                  <ul className="flex flex-col gap-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span>{t('info.features.gpsLocation.point1')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span>{t('info.features.gpsLocation.point2')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span>{t('info.features.gpsLocation.point3')}</span>
                    </li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              {/* Feature 7: Waypoints */}
              <AccordionItem value="waypoints">
                <AccordionTrigger className="gap-2">
                  <span className="flex items-center gap-2">
                    <MapPinIcon className="size-4 text-primary" />
                    {t('info.features.waypoints.title')}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="flex flex-col gap-3">
                  <p className="text-muted-foreground">{t('info.features.waypoints.desc')}</p>

                  <div>
                    <h4 className="font-semibold">{t('info.features.waypoints.howToAddTitle')}</h4>
                    <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
                      <li>{t('info.features.waypoints.howToAddPoint1')}</li>
                      <li>{t('info.features.waypoints.howToAddPoint2')}</li>
                      <li>{t('info.features.waypoints.howToAddPoint3')}</li>
                      <li>{t('info.features.waypoints.howToAddPoint4')}</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold">{t('info.features.waypoints.typesTitle')}</h4>
                    <ul className="mt-1 flex flex-col gap-1.5">
                      <li className="flex items-center gap-2">
                        <CheckCircle2Icon className="size-4 shrink-0 text-primary" />
                        <span>{t('info.features.waypoints.typePort')}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2Icon className="size-4 shrink-0 text-primary" />
                        <span>{t('info.features.waypoints.typeAnchorage')}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2Icon className="size-4 shrink-0 text-primary" />
                        <span>{t('info.features.waypoints.typeFishing')}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2Icon className="size-4 shrink-0 text-primary" />
                        <span>{t('info.features.waypoints.typeFavorite')}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2Icon className="size-4 shrink-0 text-muted-foreground" />
                        <span>{t('info.features.waypoints.typeOther')}</span>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold">{t('info.features.waypoints.manageTitle')}</h4>
                    <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
                      <li>{t('info.features.waypoints.managePoint1')}</li>
                      <li>{t('info.features.waypoints.managePoint2')}</li>
                      <li>{t('info.features.waypoints.managePoint3')}</li>
                    </ul>
                  </div>

                  <Alert>
                    <AlertTitle>{t('info.features.waypoints.privacyTitle')}</AlertTitle>
                    <AlertDescription>{t('info.features.waypoints.privacyDesc')}</AlertDescription>
                  </Alert>
                </AccordionContent>
              </AccordionItem>

              {/* Feature 8: Bathymetry */}
              <AccordionItem value="bathymetry">
                <AccordionTrigger className="gap-2">
                  <span className="flex items-center gap-2">
                    <WavesIcon className="size-4 text-primary" />
                    {t('info.features.bathymetry.title')}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="flex flex-col gap-3">
                  <p className="text-muted-foreground">{t('info.features.bathymetry.desc')}</p>
                  <ul className="flex flex-col gap-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span>{t('info.features.bathymetry.point1')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span>{t('info.features.bathymetry.point2')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span>{t('info.features.bathymetry.point3')}</span>
                    </li>
                  </ul>
                  <Alert>
                    <AlertTitle>{t('info.features.bathymetry.tipTitle')}</AlertTitle>
                    <AlertDescription>{t('info.features.bathymetry.tipDesc')}</AlertDescription>
                  </Alert>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Tips Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LightbulbIcon className="size-5 text-primary" />
              {t('info.tips.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex items-start gap-3">
                <FishIcon className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="flex flex-col gap-1">
                  <h4 className="font-semibold">{t('info.tips.tip1Title')}</h4>
                  <p className="text-sm text-muted-foreground">{t('info.tips.tip1Desc')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CameraIcon className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="flex flex-col gap-1">
                  <h4 className="font-semibold">{t('info.tips.tip2Title')}</h4>
                  <p className="text-sm text-muted-foreground">{t('info.tips.tip2Desc')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ClockIcon className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="flex flex-col gap-1">
                  <h4 className="font-semibold">{t('info.tips.tip3Title')}</h4>
                  <p className="text-sm text-muted-foreground">{t('info.tips.tip3Desc')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <TrendingUpIcon className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="flex flex-col gap-1">
                  <h4 className="font-semibold">{t('info.tips.tip4Title')}</h4>
                  <p className="text-sm text-muted-foreground">{t('info.tips.tip4Desc')}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Understanding Your Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUpIcon className="size-5 text-primary" />
              {t('info.understanding.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-1">
                <div className="font-semibold text-primary">
                  {t('info.understanding.point1Title')}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('info.understanding.point1Desc')}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <div className="font-semibold text-primary">
                  {t('info.understanding.point2Title')}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('info.understanding.point2Desc')}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <div className="font-semibold text-primary">
                  {t('info.understanding.point3Title')}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('info.understanding.point3Desc')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Info;
