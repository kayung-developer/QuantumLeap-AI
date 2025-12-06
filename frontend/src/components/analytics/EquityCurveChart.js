import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const EquityCurveChart = ({ data }) => {
    return (
        <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2DD4BF" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#2DD4BF" stopOpacity={0}/>
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" strokeOpacity={0.5} />
                <XAxis dataKey="date" tickFormatter={(timeStr) => new Date(timeStr).toLocaleDateString()} stroke="#4B5563" fontSize={12} tick={{fill: '#4B5563'}} />
                <YAxis dataKey="value" tickFormatter={(value) => `$${value.toLocaleString()}`} stroke="#4B5563" domain={['dataMin', 'dataMax']} fontSize={12} tick={{fill: '#4B5563'}} />
                
                {/* Tooltip: Custom style to handle light/dark mode via inline styles */}
                <Tooltip 
                    contentStyle={{ 
                        backgroundColor: 'var(--tw-bg-opacity, #1F2937)', // Fallback to dark if var missing
                        color: '#F3F4F6',
                        border: 'none',
                        borderRadius: '0.5rem',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }} 
                    itemStyle={{ color: '#F3F4F6' }}
                    labelStyle={{ color: '#9CA3AF', marginBottom: '0.25rem' }}
                />
                <Area type="monotone" dataKey="value" stroke="#2DD4BF" fillOpacity={1} fill="url(#colorValue)" />
            </AreaChart>
        </ResponsiveContainer>
    );
};
export default EquityCurveChart;