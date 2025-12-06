// src/components/analytics/DrawdownChart.js

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const DrawdownChart = ({ data }) => {
    return (
        <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                     <linearGradient id="colorDrawdown" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F87171" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#F87171" stopOpacity={0}/>
                    </linearGradient>
                </defs>
                
                {/* Grid: Lighter gray (#E5E7EB) for clean look on white background */}
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" strokeOpacity={0.5} />
                
                {/* XAxis: Dark Gray (#4B5563) text and lines */}
                <XAxis 
                    dataKey="date" 
                    tickFormatter={(timeStr) => new Date(timeStr).toLocaleDateString()} 
                    stroke="#4B5563" 
                    fontSize={12} 
                    tick={{fill: '#4B5563'}} 
                />
                
                {/* YAxis: Dark Gray (#4B5563) with Percentage Formatter */}
                <YAxis 
                    tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} 
                    stroke="#4B5563" 
                    fontSize={12} 
                    tick={{fill: '#4B5563'}} 
                />
                
                {/* Tooltip: Forced Dark styling for high contrast pop-over */}
                <Tooltip 
                    formatter={(value) => `${(value * 100).toFixed(2)}%`} 
                    contentStyle={{ 
                        backgroundColor: '#1F2937', // Dark Gray
                        color: '#F3F4F6',           // White Text
                        border: 'none',
                        borderRadius: '0.5rem',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }} 
                    itemStyle={{ color: '#F87171' }} // Light Red for the value
                    labelStyle={{ color: '#9CA3AF', marginBottom: '0.25rem' }}
                />
                
                <Area type="monotone" dataKey="value" stroke="#F87171" fillOpacity={1} fill="url(#colorDrawdown)" />
            </AreaChart>
        </ResponsiveContainer>
    );
};
export default DrawdownChart;