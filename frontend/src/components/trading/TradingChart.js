// src/components/trading/TradingChart.js

import React from 'react';
import { AdvancedRealTimeChart } from 'react-ts-tradingview-widgets';

const TradingChart = ({ symbol, exchange, assetClass }) => {

    // Function to format the symbol for TradingView, which requires a prefix for reliability.
    const getTradingViewSymbol = () => {
        const cleanSymbol = symbol.replace('/', '');
        // For both Forex and Crypto on major exchanges, prefixing is the most robust method.
        // TradingView will automatically handle pairs like EURUSD when prefixed with a supported broker.
        return `${exchange.toUpperCase()}:${cleanSymbol}`;
    };

    const tvSymbol = getTradingViewSymbol();

    return (
        <div style={{ height: '600px' }}>
            <AdvancedRealTimeChart
                theme="dark"
                symbol={tvSymbol}
                interval="1" // 1 minute candles
                timezone="Etc/UTC"
                style="1"
                locale="en"
                autosize
                // Adding a key ensures the widget re-initializes when the symbol or exchange changes.
                key={`${tvSymbol}-${exchange}`}
                container_id={`tradingview_chart_${symbol.replace('/', '')}`}
            />
        </div>
    );
};

export default TradingChart;