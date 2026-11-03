import React, { useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  BarElement,
  Chart as ChartJS,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import ChartInsightModal from './ChartInsightModal';
import { describeSelectedBar, trendFindings } from '../utils/chartInsights';

ChartJS.register(
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip
);

const DEFAULT_COLORS = {
  border: 'rgb(14, 116, 144)',
  fill: 'rgba(14, 116, 144, 0.12)',
};

const normalizeDataset = (dataset, chartType, premium) => {
  const colors = dataset.colors || DEFAULT_COLORS;
  return {
    label: dataset.label || 'Forecast',
    data: dataset.data || [],
    borderColor: colors.border,
    backgroundColor: chartType === 'bar' ? colors.fillStrong || colors.fill : (context) => createGradient(context, colors),
    borderRadius: chartType === 'bar' ? 10 : 0,
    borderSkipped: false,
    fill: dataset.fill ?? chartType !== 'bar',
    tension: 0.42,
    borderWidth: premium ? 3 : 2,
    pointRadius: premium ? 3 : 3,
    pointHoverRadius: 6,
    pointBackgroundColor: colors.point || colors.border,
    pointBorderColor: premium ? '#ffffff' : colors.border,
    pointBorderWidth: 2,
  };
};

const createGradient = (context, colors) => {
  const chart = context.chart;
  const { ctx, chartArea } = chart;

  if (!chartArea) {
    return colors.fill;
  }

  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  gradient.addColorStop(0, colors.fillStrong || colors.fill);
  gradient.addColorStop(0.48, colors.fill);
  gradient.addColorStop(1, 'rgba(15, 23, 42, 0)');
  return gradient;
};

const PredictionChart = ({
  labels = [],
  values = [],
  label = 'Forecast',
  colors = DEFAULT_COLORS,
  datasets,
  valueSuffix = '',
  premium = false,
  chartType = 'line',
  insight,
}) => {
  const [activeInsight, setActiveInsight] = useState(null);
  const resolvedDatasets = (datasets?.length ? datasets : [{ label, data: values, colors }])
    .map((dataset) => normalizeDataset(dataset, chartType, premium));

  const chartData = {
    labels,
    datasets: resolvedDatasets,
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: (_event, elements) => {
      if (!insight) return;
      const element = elements?.[0];
      const index = element?.index ?? 0;
      const datasetIndex = element?.datasetIndex ?? 0;
      const selectedDataset = resolvedDatasets[datasetIndex] || resolvedDatasets[0];
      const selectedLabel = labels[index] || labels[0];
      const selectedValues = selectedDataset?.data || values;
      const selectedValue = selectedValues[index];
      if (selectedValue == null) {
        setActiveInsight({ ...insight, selectedLabel, selectedValue: 'Not recorded', findings: ['No supported value is available for this period.'] });
        return;
      }
      setActiveInsight({
        ...insight,
        selectedLabel,
        selectedValue: `${selectedDataset?.label || label}: ${selectedValue}${valueSuffix && valueSuffix !== ' PHP' ? valueSuffix : ''}`,
        itemInsight: insight.itemInsightFor
          ? insight.itemInsightFor({ label: selectedLabel, value: selectedValue, index, datasetLabel: selectedDataset?.label })
          : describeSelectedBar({
            label: selectedLabel,
            value: selectedValue,
            unit: valueSuffix && valueSuffix !== ' PHP' ? valueSuffix : '',
            threshold: Math.max(...selectedValues.map((value) => Number(value || 0))) || 0,
            highLabel: 'highest forecast',
            lowLabel: 'forecast',
            action: 'Use this point to see when planning pressure may appear and prepare support before that year.',
          }),
        findings: insight.findings || (selectedValues.some(value => value == null) ? ['Missing periods are excluded; a complete trend comparison is unavailable.'] : trendFindings(labels, selectedValues, valueSuffix && valueSuffix !== ' PHP' ? valueSuffix : '')),
      });
    },
    onHover: (event) => {
      if (event?.native?.target) {
        event.native.target.style.cursor = insight ? 'pointer' : 'default';
      }
    },
    plugins: {
      legend: {
        display: true,
        labels: {
          color: premium ? '#e2e8f0' : '#334155',
          boxWidth: 12,
          boxHeight: 12,
          useBorderRadius: true,
          borderRadius: 4,
          font: { size: 11, weight: '700' },
        },
      },
      tooltip: {
        displayColors: false,
        backgroundColor: premium ? 'rgba(15, 23, 42, 0.92)' : undefined,
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        padding: 12,
        cornerRadius: 10,
        callbacks: {
          label: (context) => `${context.dataset.label}: ${context.parsed.y}${valueSuffix}`,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: premium ? 'rgba(226, 232, 240, 0.78)' : '#64748b',
          font: { size: 11, weight: '600' },
        },
        grid: { display: false },
        border: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: premium ? 'rgba(226, 232, 240, 0.78)' : '#64748b',
          font: { size: 11, weight: '600' },
          callback: (value) => `${value}${valueSuffix && valueSuffix !== ' PHP' ? valueSuffix : ''}`,
        },
        grid: {
          color: premium ? 'rgba(148, 163, 184, 0.13)' : 'rgba(148, 163, 184, 0.18)',
        },
        border: { display: false },
      },
    },
  };
  const ChartComponent = chartType === 'bar' ? Bar : Line;

  return (
    <>
      <div className={premium ? 'h-64' : 'h-40'} title={insight ? 'Click the chart for an explanation.' : undefined}>
        <ChartComponent data={chartData} options={options} />
      </div>
      <ChartInsightModal insight={activeInsight} onClose={() => setActiveInsight(null)} />
    </>
  );
};

export default PredictionChart;
