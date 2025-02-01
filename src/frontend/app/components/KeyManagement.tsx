import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export const KeyManagement = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>API Key Management</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label>API Key</Label>
            <Input type="password" />
          </div>
          <div>
            <Label>Secret Key</Label>
            <Input type="password" />
          </div>
          <Button data-testid="save-keys">Save Keys</Button>
        </div>
      </CardContent>
    </Card>
  );
};
