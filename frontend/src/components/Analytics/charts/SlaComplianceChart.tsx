import React, { useEffect, useRef } from 'react';
import { Box, Typography, Grid } from '@mui/material';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend
);

interface SlaComplianceChartProps {
  configuration: {
    chartType?: 'gauge' | 'doughnut' | 'bar';
    showTarget?: boolean;
    target?: number;
    height?: number;
  };
}

const SlaComplianceChart: React.FC<SlaComplianceChartProps> = ({ configuration }) => {
  const chartRef = useRef<ChartJS>(null);

  const {
    chartType = 'gauge',
    showTarget = true,
    target = 95,
    height = 300
  } = configuration;

  // Mock SLA compliance data
  const mockSlaData = {
    overall: 94.2,
    response: 96.1,
    resolution: 92.3,
    categories: [
      { name: 'IT Подршка', compliance: 96.5 },
      { name: 'Мрежни Проблеми', compliance: 91.8 },
      { name: 'Софтверски Проблеми', compliance: 89.2 },
      { name: 'Хардверски Проблеми', compliance: 97.1 },
      { name: 'Корисничка Подешавања', compliance: 93.7 }
    ]
  };

  const generateGaugeData = (value: number) => {
    const remaining = 100 - value;
    
    return {
      datasets: [
        {
          data: [value, remaining],
          backgroundColor: [
            value >= target ? '#4caf50' : value >= 80 ? '#ff9800' : '#f44336',
            '#e0e0e0'
          ],
          borderWidth: 0,
          cutout: '70%',
          circumference: 180,
          rotation: 270
        }
      ]
    };
  };

  const generateDoughnutData = () => {
    return {
      labels: ['Укупна усаглашеност', 'Усаглашеност одговора', 'Усаглашеност решавања'],
      datasets: [
        {
          label: 'SLA Усаглашеност (%)',
          data: [mockSlaData.overall, mockSlaData.response, mockSlaData.resolution],
          backgroundColor: [
            'rgba(33, 150, 243, 0.8)',
            'rgba(76, 175, 80, 0.8)',
            'rgba(255, 152, 0, 0.8)'
          ],
          borderColor: [
            'rgba(33, 150, 243, 1)',
            'rgba(76, 175, 80, 1)',
            'rgba(255, 152, 0, 1)'
          ],
          borderWidth: 2,
          hoverBackgroundColor: [
            'rgba(33, 150, 243, 0.9)',
            'rgba(76, 175, 80, 0.9)',
            'rgba(255, 152, 0, 0.9)'
          ]
        }
      ]
    };
  };

  const gaugeOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: false
      }
    },
    animation: {
      duration: 2000,
      easing: 'easeInOutQuart'
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            family: 'Roboto, Arial, sans-serif',
            size: 11
          }
        }
      },
      tooltip: {
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
          label: function(context: any) {
            return `${context.label}: ${context.parsed}%`;
          }
        }
      }
    },
    cutout: '60%',
    animation: {
      duration: 1500,
      easing: 'easeInOutQuart'
    }
  };

  const renderGaugeChart = () => {
    const gaugeData = generateGaugeData(mockSlaData.overall);
    
    return (
      <Box sx={{ position: 'relative', height: height }}>
        <Doughnut
          ref={chartRef}
          data={gaugeData}
          options={gaugeOptions}
        />
        
        {/* Center Text */}
        <Box
          sx={{
            position: 'absolute',
            top: '65%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center'
          }}
        >
          <Typography
            variant="h3"
            sx={{
              fontWeight: 'bold',
              color: mockSlaData.overall >= target ? '#4caf50' : mockSlaData.overall >= 80 ? '#ff9800' : '#f44336'
            }}
          >
            {mockSlaData.overall}%
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Укупна усаглашеност
          </Typography>
          {showTarget && (
            <Typography variant="caption" color="text.secondary">
              Циљ: {target}%
            </Typography>
          )}
        </Box>
      </Box>
    );
  };

  const renderDoughnutChart = () => {
    const doughnutData = generateDoughnutData();
    
    return (
      <Box sx={{ height: height }}>
        <Doughnut
          ref={chartRef}
          data={doughnutData}
          options={doughnutOptions}
        />
      </Box>
    );
  };

  const renderComplianceMetrics = () => {
    return (
      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={4}>
          <Box textAlign="center">
            <Typography
              variant="h5"
              sx={{
                color: mockSlaData.overall >= target ? '#4caf50' : '#ff9800',
                fontWeight: 'bold'
              }}
            >
              {mockSlaData.overall}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Укупно
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={4}>
          <Box textAlign="center">
            <Typography
              variant="h5"
              sx={{
                color: mockSlaData.response >= target ? '#4caf50' : '#ff9800',
                fontWeight: 'bold'
              }}
            >
              {mockSlaData.response}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Одговор
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={4}>
          <Box textAlign="center">
            <Typography
              variant="h5"
              sx={{
                color: mockSlaData.resolution >= target ? '#4caf50' : '#ff9800',
                fontWeight: 'bold'
              }}
            >
              {mockSlaData.resolution}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Решавање
            </Typography>
          </Box>
        </Grid>
      </Grid>
    );
  };

  const renderCategoryCompliance = () => {
    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Усаглашеност по категоријама:
        </Typography>
        {mockSlaData.categories.map((category, index) => (
          <Box key={index} sx={{ mb: 1 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="body2">
                {category.name}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: category.compliance >= target ? '#4caf50' : '#ff9800',
                  fontWeight: 'bold'
                }}
              >
                {category.compliance}%
              </Typography>
            </Box>
            <Box
              sx={{
                width: '100%',
                height: 4,
                backgroundColor: '#e0e0e0',
                borderRadius: 2,
                overflow: 'hidden'
              }}
            >
              <Box
                sx={{
                  width: `${category.compliance}%`,
                  height: '100%',
                  backgroundColor: category.compliance >= target ? '#4caf50' : '#ff9800',
                  transition: 'width 1s ease-in-out'
                }}
              />
            </Box>
          </Box>
        ))}
      </Box>
    );
  };

  const renderChart = () => {
    switch (chartType) {
      case 'gauge':
        return (
          <Box>
            {renderGaugeChart()}
            {renderComplianceMetrics()}
          </Box>
        );
      case 'doughnut':
        return (
          <Box>
            {renderDoughnutChart()}
            {renderCategoryCompliance()}
          </Box>
        );
      case 'bar':
        return (
          <Box>
            {renderComplianceMetrics()}
            {renderCategoryCompliance()}
          </Box>
        );
      default:
        return renderGaugeChart();
    }
  };

  return (
    <Box sx={{ height: '100%', width: '100%' }}>
      {renderChart()}
    </Box>
  );
};

export default SlaComplianceChart; 