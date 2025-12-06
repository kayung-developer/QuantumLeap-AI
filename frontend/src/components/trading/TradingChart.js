import React from 'react';
import { AdvancedRealTimeChart } from 'react-ts-tradingview-widgets';
import { useTheme } from '../../contexts/ThemeContext'; // Import hook

const TradingChart = ({ symbol, exchange, assetClass }) => {
    const { theme } = useTheme(); // Get current theme

    const getTradingViewSymbol = () => {
        const cleanSymbol = symbol.replace('/', '');
        return `${exchange.toUpperCase()}:${cleanSymbol}`;
    };

    const tvSymbol = getTradingViewSymbol();
    // Map 'system' to actual preference, or default to dark if unknown
    const widgetTheme = theme === 'light' ? 'light' : 'dark';

    return (
        <div style={{ height: '600px' }} className="border border-gray-200 dark:border-border-color rounded-xl overflow-hidden">
            <AdvancedRealTimeChart
                theme={widgetTheme} // Dynamic Theme
                symbol={tvSymbol}
                interval="1" 
                timezone="Etc/UTC"
                style="1"
                locale="en"
                autosize
                key={`${tvSymbol}-${exchange}-${widgetTheme}`} // Re-render on theme change
                container_id={`tradingview_chart_${symbol.replace('/', '')}`}
            />
        </div>
    );
};

export default TradingChart;