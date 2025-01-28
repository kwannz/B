export interface ChartData {
  time: string;
  price: number;
  volume: number;
  type: 'ask' | 'bid';
}

export interface EnrichedChartData extends ChartData {
  priceNormalized: number;
  volumeNormalized: number;
}
