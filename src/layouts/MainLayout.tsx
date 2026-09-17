import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IconSun, IconMoon, IconLogout, IconShip, IconChartBar, IconMap, IconSettings, IconLanguage, IconCheck, IconInfoCircle, IconUser, IconMessageCircle } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../hooks/useLanguage';
import LanguageSwitcher from '../components/LanguageSwitcher';
import BoatSelectionModal from '../components/BoatSelectionModal';
import { anonymizeImei, anonymizeBoatName, isDemoMode } from '../utils/demoData';
import { SailboatIcon } from '../components/SailboatIcon';

interface MainLayoutProps {
  children: React.ReactNode;
  pageHeader?: React.ReactNode; // Optional header content
  stickyFooter?: React.ReactNode; // Optional sticky footer content
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, pageHeader, stickyFooter }) => {
  const { logout, currentUser, updateUserImeis } = useAuth();
  const { t } = useTranslation();
  const { languages, currentLanguage, changeLanguage } = useLanguage();
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(false);
  const [showBoatSelection, setShowBoatSelection] = useState(false);

  // Initialize dark mode from localStorage on component mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');

    // Set initial state based on saved preference or default to light mode
    const isDarkMode = savedTheme === 'dark';
    setDarkMode(isDarkMode);

    // Apply theme to document
    applyTheme(isDarkMode);
  }, []);

  // Toggle between light and dark mode
  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);

    // Save preference to localStorage
    localStorage.setItem('theme', newDarkMode ? 'dark' : 'light');

    // Apply theme to document
    applyTheme(newDarkMode);
  };

  // Apply theme to the document element
  const applyTheme = (isDark: boolean) => {
    document.documentElement.setAttribute('data-bs-theme', isDark ? 'dark' : 'light');
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="page" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Main Navbar Header */}
      <header className="navbar navbar-expand-md d-print-none">
        <div className="container-xl">
          {/* Hamburger menu button - mobile only */}
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbar-menu"
            aria-controls="navbar-menu"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className="navbar-brand navbar-brand-autodark d-flex align-items-center">
            <SailboatIcon size={42} className="me-2 d-sm-none text-primary" />
            <SailboatIcon size={50} className="me-3 d-none d-sm-block text-primary" />
            <div>
              <div className="d-sm-none">
                <h1 className="h3 mb-0 fw-bold">PESKAS</h1>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                  2.9 {isDemoMode() && <span className="text-warning fw-bold">DEMO</span>}
                </div>
              </div>
              <div className="d-none d-sm-block d-md-none">
                <h1 className="h3 mb-0 fw-bold">PESKAS</h1>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                  Portal 2.9 {isDemoMode() && <span className="text-warning fw-bold">DEMO</span>}
                </div>
              </div>
              <div className="d-none d-md-block">
                <h1 className="h2 mb-0 fw-bold">PESKAS</h1>
                <div className="h4 text-muted mb-0">
                  Fishers Tracking Portal <span style={{ fontSize: '0.75rem' }}>2.9</span>
                  {isDemoMode() && <span className="text-warning fw-bold ms-2" style={{ fontSize: '1rem' }}>DEMO</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="navbar-nav flex-row order-md-last">
            {/* Desktop only - Theme toggle */}
            <div className="d-none d-md-flex">
              <div className="nav-item">
                <button
                  className="nav-link px-0"
                  onClick={toggleDarkMode}
                  title={darkMode ? t('common.switchToLightMode') : t('common.switchToDarkMode')}
                >
                  {darkMode ? <IconSun size={24} /> : <IconMoon size={24} />}
                </button>
              </div>
            </div>

            {/* Desktop only - Language switcher */}
            <div className="d-none d-md-flex">
              <LanguageSwitcher />
            </div>

            {/* Mobile only - Settings dropdown (theme + language) */}
            <div className="nav-item dropdown d-md-none">
              <a href="#" className="nav-link px-0" data-bs-toggle="dropdown" aria-label={t('navigation.settings')}>
                <IconSettings size={24} />
              </a>
              <div className="dropdown-menu dropdown-menu-end">
                <a href="#" className="dropdown-item d-flex align-items-center" onClick={(e) => { e.preventDefault(); toggleDarkMode(); }}>
                  {darkMode ? <IconSun size={16} className="me-2" /> : <IconMoon size={16} className="me-2" />}
                  <span className="flex-grow-1">{darkMode ? t('common.switchToLightMode') : t('common.switchToDarkMode')}</span>
                </a>
                <div className="dropdown-divider"></div>
                <div className="dropdown-header">
                  <IconLanguage size={16} className="me-2" />
                  {t('language.selectLanguage')}
                </div>
                {languages.map((language) => (
                  <a
                    key={language.code}
                    href="#"
                    className={`dropdown-item d-flex align-items-center ${currentLanguage.code === language.code ? 'active' : ''
                      }`}
                    onClick={(e) => {
                      e.preventDefault();
                      changeLanguage(language.code);
                    }}
                  >
                    <span className="me-2 fs-5">{language.flag}</span>
                    <span className="flex-grow-1">{language.name}</span>
                    {currentLanguage.code === language.code && (
                      <IconCheck size={16} className="text-primary ms-auto" />
                    )}
                  </a>
                ))}
              </div>
            </div>

            {/* User dropdown menu - always visible */}
            <div className="nav-item dropdown">
              <a href="#" className="nav-link d-flex lh-1 text-reset p-0" data-bs-toggle="dropdown" aria-label={t('common.openUserMenu')}>
                <span className="avatar avatar-sm">{currentUser?.name?.charAt(0).toUpperCase()}</span>
                <div className="d-none d-xl-block ps-2">
                  <div>{currentUser?.name && anonymizeBoatName(currentUser.name)}</div>
                  {currentUser?.role && currentUser.role.toLowerCase() !== 'user' && (
                    <div className="mt-1 small text-muted">{currentUser.role}</div>
                  )}
                </div>
              </a>
              <div className="dropdown-menu dropdown-menu-end dropdown-menu-arrow">
                <div className="dropdown-header">
                  {currentUser?.name && (
                    <div className="fw-bold">{anonymizeBoatName(currentUser.name)}</div>
                  )}
                  {currentUser?.role && currentUser.role.toLowerCase() !== 'user' && (
                    <div className="small text-muted">{currentUser.role}</div>
                  )}
                  {currentUser?.imeis && currentUser.imeis.length > 0 && (
                    <div className="small text-muted mt-1">
                      IMEI: {currentUser.imeis.map(imei => anonymizeImei(imei)).join(', ')}
                    </div>
                  )}
                </div>

                <Link to="/profile" className="dropdown-item">
                  <IconUser size={16} className="me-2" />
                  {t('navigation.profile')}
                </Link>
                <Link to="/feedback" className="dropdown-item">
                  <IconMessageCircle size={16} className="me-2" />
                  {t('navigation.feedback')}
                </Link>
                {currentUser?.role === 'admin' && (
                  <a href="#" className="dropdown-item" onClick={() => setShowBoatSelection(true)}>
                    <IconShip size={16} className="me-2" />
                    {t('navigation.selectBoat')}
                  </a>
                )}
                <div className="dropdown-divider"></div>
                <a href="#" className="dropdown-item" onClick={handleLogout}>
                  <IconLogout size={16} className="me-2" />
                  {t('navigation.logout')}
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Collapsible Navigation Menu - Separate Header */}
      <header className="navbar-expand-md">
        <div className="collapse navbar-collapse" id="navbar-menu">
          <div className="navbar">
            <div className="container-xl">
              <ul className="navbar-nav">
                <li className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}>
                  <Link to="/" className="nav-link">
                    <span className="nav-link-icon d-md-none d-lg-inline-block">
                      <IconMap size={24} />
                    </span>
                    <span className="nav-link-title">{t('navigation.dashboard')}</span>
                  </Link>
                </li>
                <li className={`nav-item ${location.pathname === '/stats' ? 'active' : ''}`}>
                  <Link to="/stats" className="nav-link">
                    <span className="nav-link-icon d-md-none d-lg-inline-block">
                      <IconChartBar size={24} />
                    </span>
                    <span className="nav-link-title">{t('navigation.stats')}</span>
                  </Link>
                </li>
                <li className={`nav-item ${location.pathname === '/info' ? 'active' : ''}`}>
                  <Link to="/info" className="nav-link">
                    <span className="nav-link-icon d-md-none d-lg-inline-block">
                      <IconInfoCircle size={24} />
                    </span>
                    <span className="nav-link-title">{t('navigation.info')}</span>
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </header>

      <div className="page-wrapper mt-0" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Page header with no extra padding */}
        {pageHeader}

        {/* Main content with no extra padding */}
        <div className="page-body pt-0" style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: stickyFooter ? '8px' : '0',
          overflowY: 'auto', // Enable scrolling for content that exceeds viewport
          WebkitOverflowScrolling: 'touch' // Smooth scrolling on iOS
        }}>
          <div className="container-xl" style={{ flex: 1 }}>
            {children}
          </div>
        </div>
      </div>

      {/* Sticky Footer */}
      {stickyFooter && (
        <div className="sticky-footer bg-body border-top shadow-lg d-print-none"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1030,
            backdropFilter: 'blur(10px)'
          }}
        >
          <div className="container-xl py-1">
            {stickyFooter}
          </div>
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