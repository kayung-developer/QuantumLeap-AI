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
                <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
                <XAxis dataKey="date" tickFormatter={(timeStr) => new Date(timeStr).toLocaleDateString()} stroke="#8B949E" />
                <YAxis dataKey="value" tickFormatter={(value) => `$${value.toLocaleString()}`} stroke="#8B949E" domain={['dataMin', 'dataMax']} />
                <Tooltip contentStyle={{ backgroundColor: '#161B22', border: '1px solid #30363D' }} labelStyle={{ color: '#F0F6FC' }} />
                <Area type="monotone" dataKey="value" stroke="#2DD4BF" fillOpacity={1} fill="url(#colorValue)" />
            </AreaChart>
        </ResponsiveContainer>
    );
};
export default EquityCurveChart;