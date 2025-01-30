'use client';

import React from 'react';
import type { ReactNode } from 'react';
import MainLayout from './components/MainLayout';

interface TemplateProps {
  children: ReactNode;
}

export default function Template({ children }: TemplateProps) {
  return <MainLayout>{children}</MainLayout>;
}
