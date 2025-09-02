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
                <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
                <XAxis dataKey="date" tickFormatter={(timeStr) => new Date(timeStr).toLocaleDateString()} stroke="#8B949E" />
                <YAxis tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} stroke="#8B949E" />
                <Tooltip formatter={(value) => `${(value * 100).toFixed(2)}%`} contentStyle={{ backgroundColor: '#161B22', border: '1px solid #30363D' }} />
                <Area type="monotone" dataKey="value" stroke="#F87171" fillOpacity={1} fill="url(#colorDrawdown)" />
            </AreaChart>
        </ResponsiveContainer>
    );
};
export default DrawdownChart;