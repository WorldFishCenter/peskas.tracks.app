import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangleIcon, CheckIcon, WifiIcon, WifiOffIcon } from 'lucide-react';
import { cn } from 'cn';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';

interface NetworkStatusProps {
  compact?: boolean;
  showDetails?: boolean;
}

const NetworkStatus: React.FC<NetworkStatusProps> = ({ compact = false, showDetails = true }) => {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionType, setConnectionType] = useState<string>('unknown');
  const [effectiveType, setEffectiveType] = useState<string>('4g');
  const [downlink, setDownlink] = useState<number>(0);
  const [, setWasOffline] = useState(false);
  const [showReconnectedMessage, setShowReconnectedMessage] = useState(false);

  useEffect(() => {
    const updateOnlineStatus = () => {
      const online = navigator.onLine;

      if (!isOnline && online) {
        setWasOffline(true);
        setShowReconnectedMessage(true);
        setTimeout(() => setShowReconnectedMessage(false), 5000);
      }

      setIsOnline(online);
    };

    const updateConnectionInfo = () => {
      // @ts-expect-error - Connection API might not be fully typed
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

      if (connection) {
        setConnectionType(connection.type || 'unknown');
        setEffectiveType(connection.effectiveType || '4g');
        setDownlink(connection.downlink || 0);
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // @ts-expect-error - Navigator connection API is not fully standardized
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      connection.addEventListener('change', updateConnectionInfo);
    }

    updateOnlineStatus();
    updateConnectionInfo();

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      if (connection) {
        connection.removeEventListener('change', updateConnectionInfo);
      }
    };
  }, [isOnline]);

  const getConnectionQuality = () => {
    if (!isOnline) return 'offline';

    if (effectiveType === '4g' || effectiveType === '3g') {
      return downlink > 1.5 ? 'excellent' : downlink > 0.5 ? 'good' : 'poor';
    }

    if (effectiveType === '2g' || effectiveType === 'slow-2g') {
      return 'poor';
    }

    return 'unknown';
  };

  const getConnectionIcon = () => {
    if (!isOnline) return <WifiOffIcon className="size-4 text-destructive" />;

    const quality = getConnectionQuality();
    switch (quality) {
      case 'excellent':
      case 'good':
        return <WifiIcon className="size-4 text-primary" />;
      case 'poor':
        return <WifiIcon className="size-4 text-destructive" />;
      default:
        return <WifiIcon className="size-4 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    if (!isOnline) return t('network.offline');

    const quality = getConnectionQuality();
    switch (quality) {
      case 'excellent':
        return t('network.excellentConnection');
      case 'good':
        return t('network.goodConnection');
      case 'poor':
        return t('network.poorConnection');
      default:
        return t('network.online');
    }
  };

  const getStatusColor = () => {
    if (!isOnline) return 'text-destructive';

    const quality = getConnectionQuality();
    switch (quality) {
      case 'excellent':
      case 'good':
        return 'text-primary';
      case 'poor':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {getConnectionIcon()}
        {showReconnectedMessage && (
          <span className="flex items-center gap-1 text-xs font-medium text-primary">
            <CheckIcon className="size-3" />
            {t('network.backOnline')}
          </span>
        )}
      </div>
    );
  }

  if (showReconnectedMessage) {
    return (
      <Alert>
        <CheckIcon className="text-primary" />
        <AlertTitle>{t('network.connectionRestored')}</AlertTitle>
        <AlertDescription>{t('network.pendingUploadsWillResume')}</AlertDescription>
      </Alert>
    );
  }

  if (!isOnline) {
    return (
      <Alert variant="destructive">
        <WifiOffIcon />
        <AlertTitle>{t('network.youreOffline')}</AlertTitle>
        <AlertDescription>{t('network.dataWillBeSaved')}</AlertDescription>
      </Alert>
    );
  }

  if (getConnectionQuality() === 'poor') {
    return (
      <Alert>
        <AlertTriangleIcon />
        <AlertTitle>{t('network.slowConnectionDetected')}</AlertTitle>
        <AlertDescription>{t('network.uploadsMayTakeLonger')}</AlertDescription>
      </Alert>
    );
  }

  if (!showDetails) {
    return null;
  }

  return (
    <Card size="sm" className="bg-muted/40">
      <CardContent className="flex items-center justify-between py-0">
        <div className="flex items-center gap-2">
          {getConnectionIcon()}
          <span className={cn('text-xs font-medium', getStatusColor())}>{getStatusText()}</span>
        </div>
        {showDetails && connectionType !== 'unknown' && (
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span>{effectiveType?.toUpperCase()}</span>
            {downlink > 0 && <span>{downlink.toFixed(1)} Mbps</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NetworkStatus;
