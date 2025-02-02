import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { TradingChart } from './TradingChart';
import { Grid, GridItem } from '../ui/grid';
import { OrderForm } from './OrderForm';
import { SocialMetrics } from './SocialMetrics';
import { WhaleActivity } from './WhaleActivity';

export function MemeTradingView() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Meme Token Trading</CardTitle>
      </CardHeader>
      <CardContent>
        <Grid className="gap-4">
          <GridItem className="col-span-8">
            <TradingChart />
            <OrderForm marketType="MEME" />
          </GridItem>
          <GridItem className="col-span-4">
            <SocialMetrics />
            <WhaleActivity />
          </GridItem>
        </Grid>
      </CardContent>
    </Card>
  );
}
