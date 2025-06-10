import React, { useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { format, subDays } from 'date-fns';
import { sr } from 'date-fns/locale';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TicketVolumeChartProps {
  configuration: {
    chartType?: 'line' | 'bar' | 'area';
    showLegend?: boolean;
    timeframe?: string;
    height?: number;
  };
}

const TicketVolumeChart: React.FC<TicketVolumeChartProps> = ({ configuration }) => {
  const chartRef = useRef<ChartJS>(null);

  const {
    chartType = 'line',
    showLegend = true,
    timeframe = '30days',
    height = 300
  } = configuration;

  // Generate mock data for the last 30 days
  const generateMockData = () => {
    const days = 30;
    const labels = [];
    const totalTickets = [];
    const resolvedTickets = [];
    const pendingTickets = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      labels.push(format(date, 'dd.MM', { locale: sr }));
      
      // Generate realistic mock data
      const baseTotal = 30 + Math.floor(Math.random() * 20);
      const resolved = Math.floor(baseTotal * (0.7 + Math.random() * 0.25));
      const pending = baseTotal - resolved;
      
      totalTickets.push(baseTotal);
      resolvedTickets.push(resolved);
      pendingTickets.push(pending);
    }

    return {
      labels,
      datasets: [
        {
          label: 'Укупно тикета',
          data: totalTickets,
          backgroundColor: chartType === 'area' ? 'rgba(25, 118, 210, 0.1)' : 'rgba(25, 118, 210, 0.8)',
          borderColor: 'rgba(25, 118, 210, 1)',
          borderWidth: 2,
          fill: chartType === 'area',
          tension: 0.1,
          pointBackgroundColor: 'rgba(25, 118, 210, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        },
        {
          label: 'Решени тикети',
          data: resolvedTickets,
          backgroundColor: chartType === 'area' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(76, 175, 80, 0.8)',
          borderColor: 'rgba(76, 175, 80, 1)',
          borderWidth: 2,
          fill: chartType === 'area',
          tension: 0.1,
          pointBackgroundColor: 'rgba(76, 175, 80, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        },
        {
          label: 'Тикети на чекању',
          data: pendingTickets,
          backgroundColor: chartType === 'area' ? 'rgba(255, 152, 0, 0.1)' : 'rgba(255, 152, 0, 0.8)',
          borderColor: 'rgba(255, 152, 0, 1)',
          borderWidth: 2,
          fill: chartType === 'area',
          tension: 0.1,
          pointBackgroundColor: 'rgba(255, 152, 0, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    };
  };

  const data = generateMockData();

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: showLegend,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            family: 'Roboto, Arial, sans-serif',
            size: 12
          }
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        titleFont: {
          size: 14,
          weight: 'bold'
        },
        bodyFont: {
          size: 13
        },
        padding: 12,
        callbacks: {
          title: function(context: any) {
            return `Дан: ${context[0].label}`;
          },
          label: function(context: any) {
            return `${context.dataset.label}: ${context.parsed.y} тикета`;
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Дан',
          font: {
            size: 14,
            weight: 'bold'
          }
        },
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.05)',
          lineWidth: 1
        },
        ticks: {
          font: {
            size: 11
          },
          maxRotation: 45,
          minRotation: 0
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Број тикета',
          font: {
            size: 14,
            weight: 'bold'
          }
        },
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.05)',
          lineWidth: 1
        },
        ticks: {
          font: {
            size: 11
          },
          callback: function(value: any) {
            return `${value}`;
          }
        },
        beginAtZero: true
      }
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false
    },
    elements: {
      point: {
        hoverRadius: 8
      }
    },
    animation: {
      duration: 1000,
      easing: 'easeInOutQuart'
    }
  };

  useEffect(() => {
    const chart = chartRef.current;
    if (chart) {
      // Custom animations or updates can be added here
    }
  }, [configuration]);

  return (
    <Box sx={{ height: height, width: '100%', position: 'relative' }}>
      <Chart
        ref={chartRef}
        type={chartType}
        data={data}
        options={options}
      />
    </Box>
  );
};

export default TicketVolumeChart; 