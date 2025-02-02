import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { OrderBook } from './OrderBook';
import { TradingChart } from './TradingChart';
import { Grid, GridItem } from '../ui/grid';
import { OrderForm } from './OrderForm';
import { PositionList } from './PositionList';

export function DexTradingView() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>DEX Trading</CardTitle>
      </CardHeader>
      <CardContent>
        <Grid className="gap-4">
          <GridItem className="col-span-8">
            <TradingChart />
            <OrderForm marketType="DEX" />
          </GridItem>
          <GridItem className="col-span-4">
            <OrderBook />
            <PositionList />
          </GridItem>
        </Grid>
      </CardContent>
    </Card>
  );
}
