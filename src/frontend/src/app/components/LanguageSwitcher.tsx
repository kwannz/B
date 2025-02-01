'use client';

import { IconButton, Menu, MenuItem, Tooltip } from '@mui/material';
import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const languages = {
  zh: '中文',
  en: 'English'
};

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLanguageSelect = (selectedLang: 'zh' | 'en') => {
    setLanguage(selectedLang);
    handleClose();
  };

  return (
    <>
      <Tooltip title="切换语言 / Switch Language">
        <IconButton
          onClick={handleClick}
          size="small"
          className="text-gray-600 hover:text-gray-900"
        >
          <span className="text-lg font-medium">
            {language === 'zh' ? '中' : 'EN'}
          </span>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {Object.entries(languages).map(([code, name]) => (
          <MenuItem
            key={code}
            onClick={() => handleLanguageSelect(code as 'zh' | 'en')}
            selected={language === code}
          >
            {name}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
