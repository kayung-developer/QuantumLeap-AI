import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import Card from '../common/Card';
import Spinner from '../common/Spinner';

const COLORS = ['#58A6FF', '#28A745', '#FFC107', '#DC3545', '#6f42c1', '#20c997'];

const PortfolioDonutChart = ({ data, isLoading }) => {
  if (isLoading) return <div className="h-80 flex items-center justify-center"><Spinner /></div>;
  if (!data || data.length === 0) return <p>No portfolio data available.</p>;

  return (
    <Card>
      <h2 className="text-xl font-semibold text-white mb-4">Portfolio Allocation</h2>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={110}
            innerRadius={70}
            fill="#8884d8"
            dataKey="usd_value"
            nameKey="asset"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
                backgroundColor: '#161B22',
                border: '1px solid #30363D',
                borderRadius: '0.5rem'
            }}
            formatter={(value) => `$${value.toFixed(2)}`}
          />
          <Legend wrapperStyle={{ color: '#374151' }} />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
};

export default PortfolioDonutChart;