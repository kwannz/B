import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useRiskMonitoring } from './useRiskMonitoring';
import { useRiskAnalyzer } from './useRiskAnalyzer';
import { useRiskController } from './useRiskController';

interface RiskReport {
  timestamp: string;
  overall_status: {
    risk_level: string;
    score: number;
    trend: 'improving' | 'stable' | 'deteriorating';
  };
  key_metrics: {
    volatility: number;
    exposure: number;
    drawdown: number;
    liquidity: number;
  };
  risk_breakdown: {
    market_risk: number;
    position_risk: number;
    execution_risk: number;
    systemic_risk: number;
  };
  alerts_summary: {
    critical: number;
    warning: number;
    info: number;
  };
  recommendations: {
    priority: 'immediate' | 'high' | 'medium' | 'low';
    action: string;
    impact: string;
    deadline: string;
  }[];
}

interface ReportingConfig {
  reportingInterval: number;
  retentionPeriod: number;
  alertThresholds: {
    critical: number;
    warning: number;
    info: number;
  };
}

export const useRiskReporting = (botId: string | null, config: Partial<ReportingConfig> = {}) => {
  const [reports, setReports] = useState<RiskReport[]>([]);
  const [latestReport, setLatestReport] = useState<RiskReport | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { state: monitoringState } = useRiskMonitoring(botId);
  const { analysis, score } = useRiskAnalyzer(botId);
  const { state: controlState } = useRiskController(botId);

  const defaultConfig: ReportingConfig = {
    reportingInterval: 3600000,
    retentionPeriod: 7 * 24 * 3600000,
    alertThresholds: {
      critical: 0.8,
      warning: 0.6,
      info: 0.4,
      ...config.alertThresholds
    },
    ...config
  };

  useEffect(() => {
    if (!monitoringState || !analysis || !score) return;

    const generateReport = (): RiskReport => {
      const timestamp = new Date().toISOString();

      const calculateTrend = () => {
        if (reports.length < 2) return 'stable';
        const prevScore = reports[0].overall_status.score;
        const currentScore = score.total_score;
        const diff = currentScore - prevScore;
        return diff < -0.05 ? 'improving' :
               diff > 0.05 ? 'deteriorating' : 'stable';
      };

      const countAlerts = () => ({
        critical: monitoringState.alerts.filter(a => a.level === 'critical').length,
        warning: monitoringState.alerts.filter(a => a.level === 'warning').length,
        info: monitoringState.alerts.filter(a => a.level === 'info').length
      });

      const generateRecommendations = () => {
        const recommendations = [];
        const now = new Date();

        if (score.total_score > defaultConfig.alertThresholds.critical) {
          recommendations.push({
            priority: 'immediate',
            action: 'Reduce Position Size',
            impact: 'Critical Risk Mitigation',
            deadline: new Date(now.getTime() + 3600000).toISOString()
          });
        }

        if (analysis.market_risk.volatility_impact > defaultConfig.alertThresholds.warning) {
          recommendations.push({
            priority: 'high',
            action: 'Increase Hedging',
            impact: 'Volatility Protection',
            deadline: new Date(now.getTime() + 7200000).toISOString()
          });
        }

        if (analysis.position_risk.leverage_risk > defaultConfig.alertThresholds.warning) {
          recommendations.push({
            priority: 'medium',
            action: 'Adjust Leverage',
            impact: 'Risk Optimization',
            deadline: new Date(now.getTime() + 14400000).toISOString()
          });
        }

        return recommendations;
      };

      return {
        timestamp,
        overall_status: {
          risk_level: score.risk_level,
          score: score.total_score,
          trend: calculateTrend()
        },
        key_metrics: {
          volatility: analysis.market_risk.volatility_impact,
          exposure: analysis.position_risk.size_risk,
          drawdown: analysis.position_risk.margin_risk,
          liquidity: 1 - analysis.market_risk.liquidity_risk
        },
        risk_breakdown: {
          market_risk: score.component_scores.market,
          position_risk: score.component_scores.position,
          execution_risk: score.component_scores.execution,
          systemic_risk: score.component_scores.systemic
        },
        alerts_summary: countAlerts(),
        recommendations: generateRecommendations()
      };
    };

    const reportingInterval = setInterval(() => {
      try {
        setIsGenerating(true);
        const newReport = generateReport();
        
        setReports(prev => {
          const now = Date.now();
          const filteredReports = prev.filter(report => 
            now - new Date(report.timestamp).getTime() < defaultConfig.retentionPeriod
          );
          return [newReport, ...filteredReports];
        });
        
        setLatestReport(newReport);
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to generate risk report',
          code: 'REPORT_ERROR'
        });
      } finally {
        setIsGenerating(false);
      }
    }, defaultConfig.reportingInterval);

    return () => clearInterval(reportingInterval);
  }, [monitoringState, analysis, score, reports, defaultConfig]);

  const getReportsByDateRange = (startDate: Date, endDate: Date) => {
    return reports.filter(report => {
      const reportDate = new Date(report.timestamp);
      return reportDate >= startDate && reportDate <= endDate;
    });
  };

  const getReportsByRiskLevel = (riskLevel: string) => {
    return reports.filter(report => 
      report.overall_status.risk_level === riskLevel
    );
  };

  return {
    reports,
    latestReport,
    error,
    isGenerating,
    getReportsByDateRange,
    getReportsByRiskLevel
  };
};
