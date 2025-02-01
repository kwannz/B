import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const BotIntegration = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bot Integration</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button data-testid="connect-bot">Connect Trading Bot</Button>
          <Button data-testid="verify-connection">Verify Connection</Button>
        </div>
      </CardContent>
    </Card>
  );
};
