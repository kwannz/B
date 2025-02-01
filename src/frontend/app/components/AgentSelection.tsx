import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const AgentSelection = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Trading Agent</CardTitle>
      </CardHeader>
      <CardContent>
        <Select defaultValue="dex-swap">
          <SelectTrigger>
            <SelectValue placeholder="Select trading type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dex-swap">DEX Swap Trading</SelectItem>
            <SelectItem value="meme-coin">Meme Coin Trading</SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
};
