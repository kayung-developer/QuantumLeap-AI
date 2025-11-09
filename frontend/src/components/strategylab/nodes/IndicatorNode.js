import React from 'react';
import BaseNode from './BaseNode';

// --- ROBUST CONFIGURATION FOR INDICATORS ---
// This object defines all available indicators and the parameters they need.
const INDICATOR_CONFIG = {
    RSI: { params: [{ name: 'param1', placeholder: 'Period (e.g., 14)' }] },
    EMA: { params: [{ name: 'param1', placeholder: 'Period (e.g., 50)' }] },
    MACD: {
        params: [
            { name: 'param1', placeholder: 'Fast Period (e.g., 12)' },
            { name: 'param2', placeholder: 'Slow Period (e.g., 26)' },
            { name: 'param3', placeholder: 'Signal Period (e.g., 9)' }
        ]
    },
    Bollinger_Bands: {
        params: [
            { name: 'param1', placeholder: 'Period (e.g., 20)' },
            { name: 'param2', placeholder: 'Std. Dev. (e.g., 2.0)' }
        ]
    },
    SuperTrend: {
        params: [
            { name: 'param1', placeholder: 'ATR Period (e.g., 10)' },
            { name: 'param2', placeholder: 'Multiplier (e.g., 3.0)' }
        ]
    },
    ADX: { params: [{ name: 'param1', placeholder: 'Period (e.g., 14)' }] },
};

const INDICATOR_OPTIONS = Object.keys(INDICATOR_CONFIG);

const IndicatorNode = ({ id, data }) => {
    // This handler is passed from the parent (StrategyBuilderPage)
    const handleDataChange = (field, value) => {
        data.onChange(id, { ...data, [field]: value });
    };

    const handleIndicatorChange = (e) => {
        // When the indicator type changes, reset all parameters
        const newData = { indicator: e.target.value, param1: '', param2: '', param3: '' };
        data.onChange(id, { ...data, ...newData });
    };

    const selectedIndicator = data.indicator || 'RSI';
    const paramsForIndicator = INDICATOR_CONFIG[selectedIndicator]?.params || [];

    return (
        <BaseNode id={id} data={data} outputs={[{ id: 'out-value' }]}>
            <div className="space-y-2">
                <label className="text-xs text-gray-400">Indicator</label>
                <select
                    name="indicator"
                    value={selectedIndicator}
                    onChange={handleIndicatorChange}
                    className="nodrag w-full bg-primary p-1 rounded"
                >
                    {INDICATOR_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt.replace(/_/g, ' ')}</option>
                    ))}
                </select>

                {/* --- DYNAMIC PARAMETER INPUTS --- */}
                {/* This block now automatically renders the correct number of inputs */}
                {paramsForIndicator.map((param, index) => (
                    <div key={param.name}>
                        <label className="text-xs text-gray-400">{param.placeholder.split(' ')[0]}</label>
                        <input
                            type="number"
                            name={param.name}
                            placeholder={param.placeholder}
                            value={data[param.name] || ''}
                            onChange={(e) => handleDataChange(e.target.name, e.target.value)}
                            className="nodrag w-full bg-primary p-1 rounded"
                        />
                    </div>
                ))}
            </div>
        </BaseNode>
    );
};

export default IndicatorNode;