import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckIcon, ChevronDownIcon, LanguagesIcon } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const LanguageSwitcher: React.FC = () => {
  const { t } = useTranslation();
  const { languages, currentLanguage, changeLanguage } = useLanguage();

  return (
    <div className="hidden md:flex items-center">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              aria-label={t('language.selectLanguage')}
            />
          }
        >
          <LanguagesIcon data-icon="inline-start" />
          <ChevronDownIcon data-icon="inline-end" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuGroup>
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
  );
};

export default LanguageSwitcher;
