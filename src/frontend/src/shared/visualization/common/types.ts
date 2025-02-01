/**
 * Common type definitions for visualization components
 */

export interface ChartData {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface IndicatorData {
    timestamp: number;
    value: number;
    color?: string;
    label?: string;
}

export interface ChartOptions {
    timeframe: string;
    theme: 'light' | 'dark';
    height?: number;
    width?: number;
    showVolume?: boolean;
    showGrid?: boolean;
    showTooltip?: boolean;
    showLegend?: boolean;
    indicators?: string[];
}

export interface HeatmapData {
    x: string | number;
    y: string | number;
    value: number;
    color?: string;
    label?: string;
}

export interface HeatmapOptions {
    theme: 'light' | 'dark';
    height?: number;
    width?: number;
    colorScale?: string[];
    showTooltip?: boolean;
    showLegend?: boolean;
}

export interface VisualizationTheme {
    background: string;
    text: string;
    grid: string;
    tooltip: {
        background: string;
        text: string;
        border: string;
    };
    crosshair: string;
    legend: {
        background: string;
        text: string;
        border: string;
    };
}

export interface ChartDimensions {
    width: number;
    height: number;
    margin: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
}

export interface TooltipData {
    x: number;
    y: number;
    data: any;
    visible: boolean;
} 