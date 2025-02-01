import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const StrategyCreation = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Trading Strategy</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label>Max Trade Size</Label>
            <Input type="number" defaultValue={1.0} />
          </div>
          <div>
            <Label>Stop Loss (%)</Label>
            <Input type="number" defaultValue={10} />
          </div>
          <div>
            <Label>Take Profit (%)</Label>
            <Input type="number" defaultValue={20} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
