'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAddress } from "@thirdweb-dev/react";
import { Box } from '@mui/material';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const address = useAddress();

  useEffect(() => {
    if (!address) {
      router.push('/');
    }
  }, [address, router]);

  if (!address) {
    return null;
  }

  return (
    <Box sx={{ p: 3 }}>
      {children}
    </Box>
  );
}
