import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3Icon,
  CheckIcon,
  InfoIcon,
  LanguagesIcon,
  LogOutIcon,
  MapIcon,
  MenuIcon,
  MessageCircleIcon,
  MoonIcon,
  SettingsIcon,
  ShipIcon,
  SunIcon,
  UserIcon,
} from 'lucide-react';
import { cn } from 'cn';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../hooks/useLanguage';
import { useTheme } from '@/components/theme-provider';
import LanguageSwitcher from '../components/LanguageSwitcher';
import BoatSelectionModal from '../components/BoatSelectionModal';
import { anonymizeImei, anonymizeBoatName, isDemoMode } from '../utils/demoData';
import { PeskasLogo, PeskasMark } from '../components/PeskasLogo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface MainLayoutProps {
  children: React.ReactNode;
  pageHeader?: React.ReactNode;
  stickyFooter?: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, pageHeader, stickyFooter }) => {
  const { logout, currentUser, updateUserImeis } = useAuth();
  const { t } = useTranslation();
  const { languages, currentLanguage, changeLanguage } = useLanguage();
  const { resolvedTheme, setTheme } = useTheme();
  const location = useLocation();
  const [showBoatSelection, setShowBoatSelection] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const darkMode = resolvedTheme === 'dark';

  const toggleDarkMode = () => {
    setTheme(darkMode ? 'light' : 'dark');
  };

  const navItems = [
    { to: '/', label: t('navigation.dashboard'), icon: MapIcon },
    { to: '/stats', label: t('navigation.stats'), icon: BarChart3Icon },
    { to: '/info', label: t('navigation.info'), icon: InfoIcon },
  ];

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      {/* Main Navbar Header */}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 print:hidden">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            {/* Mobile navigation trigger */}
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    aria-label="Toggle navigation"
                  />
                }
              >
                <MenuIcon />
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <span className="peskas-lockup flex items-center gap-2">
                      <PeskasMark />
                      <span>Tracks</span>
                    </span>
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 px-4">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = location.pathname === item.to;
                    return (
                      <Button
                        key={item.to}
                        variant={active ? 'secondary' : 'ghost'}
                        className="justify-start"
                        render={<Link to={item.to} onClick={() => setMobileNavOpen(false)} />}
                        nativeButton={false}
                      >
                        <Icon data-icon="inline-start" />
                        {item.label}
                      </Button>
                    );
                  })}
                </nav>
              </SheetContent>
            </Sheet>

            {/* Peskas logo + Tracks lockup */}
            <div className="peskas-responsive flex items-center gap-1.5">
              <h1 className="m-0">
                <Link
                  to="/"
                  className="peskas-lockup flex items-center gap-2 text-foreground no-underline"
                >
                  <PeskasLogo className="peskas-logo" />
                  <PeskasMark className="peskas-mark" />
                  <span className="peskas-baseline text-lg font-medium leading-none text-muted-foreground">
                    Tracks
                  </span>
                </Link>
              </h1>
              <span className="peskas-baseline flex items-center gap-1.5 leading-none">
                <span className="text-xs text-muted-foreground">
                  {__APP_VERSION__.replace(/\.0$/, '')}
                </span>
                {isDemoMode() && (
                  <Badge variant="outline">DEMO</Badge>
                )}
              </span>
            </div>

            {/* Desktop navigation */}
            <nav className="ml-4 hidden items-center gap-1 md:flex">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.to;
                return (
                  <Button
                    key={item.to}
                    variant={active ? 'secondary' : 'ghost'}
                    size="sm"
                    render={<Link to={item.to} />}
                    nativeButton={false}
                    className={cn(active && 'font-medium text-foreground')}
                  >
                    <Icon data-icon="inline-start" />
                    {item.label}
                  </Button>
                );
              })}
            </nav>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-1.5">
            {/* Desktop theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex"
              onClick={toggleDarkMode}
              title={darkMode ? t('common.switchToLightMode') : t('common.switchToDarkMode')}
              aria-label={darkMode ? t('common.switchToLightMode') : t('common.switchToDarkMode')}
            >
              {darkMode ? <SunIcon /> : <MoonIcon />}
            </Button>

            {/* Desktop language switcher */}
            <LanguageSwitcher />

            {/* Mobile settings dropdown (theme + language) */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('navigation.settings')}
                    />
                  }
                >
                  <SettingsIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-48">
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={toggleDarkMode}>
                      {darkMode ? <SunIcon /> : <MoonIcon />}
                      <span className="flex-1">
                        {darkMode ? t('common.switchToLightMode') : t('common.switchToDarkMode')}
                      </span>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="flex items-center gap-1.5">
                      <LanguagesIcon className="size-3.5" />
                      {t('language.selectLanguage')}
                    </DropdownMenuLabel>
                    {languages.map((language) => (
                      <DropdownMenuItem
                        key={language.code}
                        onClick={() => changeLanguage(language.code)}
                        className="flex items-center gap-2"
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

            {/* User dropdown menu */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    className="flex h-auto items-center gap-2 px-1.5 py-1"
                    aria-label={t('common.openUserMenu')}
                  />
                }
              >
                <Avatar size="sm">
                  <AvatarFallback>
                    {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden text-left xl:block">
                  <div className="text-sm font-medium leading-tight">
                    {currentUser?.name && anonymizeBoatName(currentUser.name)}
                  </div>
                  {currentUser?.role && currentUser.role.toLowerCase() !== 'user' && (
                    <div className="text-xs text-muted-foreground">{currentUser.role}</div>
                  )}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-52">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
                    {currentUser?.name && (
                      <span className="font-semibold text-foreground">
                        {anonymizeBoatName(currentUser.name)}
                      </span>
                    )}
                    {currentUser?.role && currentUser.role.toLowerCase() !== 'user' && (
                      <span className="text-xs text-muted-foreground">{currentUser.role}</span>
                    )}
                    {currentUser?.imeis && currentUser.imeis.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        IMEI: {currentUser.imeis.map((imei) => anonymizeImei(imei)).join(', ')}
                      </span>
                    )}
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem render={<Link to="/profile" />}>
                    <UserIcon />
                    {t('navigation.profile')}
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link to="/feedback" />}>
                    <MessageCircleIcon />
                    {t('navigation.feedback')}
                  </DropdownMenuItem>
                  {currentUser?.role === 'admin' && (
                    <DropdownMenuItem onClick={() => setShowBoatSelection(true)}>
                      <ShipIcon />
                      {t('navigation.selectBoat')}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem variant="destructive" onClick={logout}>
                    <LogOutIcon />
                    {t('navigation.logout')}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex flex-1 flex-col">
        {pageHeader}

        <main
          className={cn(
            'mx-auto w-full max-w-7xl flex-1 px-4 py-3',
            stickyFooter && 'pb-20 md:pb-4'
          )}
        >
          {children}
        </main>
      </div>

      {/* Sticky Footer (mobile) */}
      {stickyFooter && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85 print:hidden md:hidden">
          <div className="mx-auto max-w-7xl px-4 py-2">{stickyFooter}</div>
        </div>
      )}

      {showBoatSelection && (
        <BoatSelectionModal
          onSelect={(imei) => {
            updateUserImeis([imei]);
            setShowBoatSelection(false);
          }}
          onClose={() => setShowBoatSelection(false)}
        />
      )}
    </div>
  );
};

export default MainLayout;
