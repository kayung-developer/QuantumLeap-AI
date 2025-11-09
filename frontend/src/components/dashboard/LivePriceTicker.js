// src/components/dashboard/LivePriceTicker.js

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useMarketData } from '../../contexts/MarketDataContext'; // <-- 1. Use the correct, robust context
import { FaBitcoin, FaEthereum, FaDollarSign, FaYenSign, FaPoundSign, FaEuroSign } from 'react-icons/fa';
import { SiRipple, SiBinance, SiSolana } from 'react-icons/si';

// --- Reusable Icon Logic ---
const getIcon = (symbol) => {
    const base = symbol.split('/')[0];
    const icons = {
        'BTC': <FaBitcoin className="text-yellow-400" />, 'ETH': <FaEthereum className="text-indigo-400" />,
        'BNB': <SiBinance className="text-yellow-500" />, 'SOL': <SiSolana className="text-purple-400" />,
        'XRP': <SiRipple className="text-blue-300" />, 'EUR': <FaEuroSign className="text-blue-500" />,
        'GBP': <FaPoundSign className="text-pink-500" />, 'USD': <FaDollarSign className="text-green-500" />,
        'JPY': <FaYenSign className="text-red-400" />,
    };
    return icons[base] || <FaDollarSign className="text-gray-400" />;
};

// --- Reusable Formatting Logic ---
const formatPrice = (symbol, price) => {
    // ... (This function is good, no changes needed)
    const quote = symbol.split('/')[1];
    const isCrypto = ['USDT', 'BUSD', 'USDC'].includes(quote);
    const options = {
        minimumFractionDigits: isCrypto ? 2 : 4,
        maximumFractionDigits: isCrypto ? 4 : 5,
    };
    if (!price || price === 0) return '...';

    const formattedPrice = price.toLocaleString('en-US', options);
    const prefixes = { 'USD': '$', 'USDT': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥' };
    return `${prefixes[quote] || ''}${formattedPrice}`;
};

const TickerItem = React.memo(({ symbol, data }) => {
    if (!data) return null; // Add a guard clause
    const isUp = data.change >= 0;
    const color = isUp ? 'text-success' : 'text-danger';

    return (
        <div className="flex-shrink-0 flex items-center space-x-3 mx-6">
            <div className="text-xl">{getIcon(symbol)}</div>
            <div>
                 <span className="font-semibold text-sm text-light-text dark:text-white">{symbol}</span>
                 <p className={`font-mono text-sm ${color}`}>
                    {formatPrice(symbol, data.price)}
                 </p>
            </div>
        </div>
    );
});

// --- THIS IS THE FULLY CORRECTED COMPONENT ---
const LivePriceTicker = () => {
    const [isHovering, setIsHovering] = useState(false);

    // 2. Get data and health status from the correct context.
    const marketDataContext = useMarketData();

    // 3. Gracefully handle the case where the context is not yet available.
    if (!marketDataContext) {
        return <div className="text-sm text-yellow-500 font-semibold px-4">Connecting...</div>;
    }
    const { marketData, healthStatus } = marketDataContext;

    // 4. Convert the marketData OBJECT into an ARRAY. This is the core fix.
    const marketDataArray = Object.entries(marketData || {});

    // 5. Handle all edge cases gracefully.
    if (healthStatus?.status !== 'OPERATIONAL') {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-sm text-yellow-500 font-semibold px-4">Market Data Feed Offline</p>
            </div>
        );
    }
    if (marketDataArray.length === 0) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-sm text-light-muted dark:text-light-gray animate-pulse">Awaiting market data...</p>
            </div>
        );
    }

    // Map over the now-correct array.
    const tickerContent = marketDataArray.map(([symbol, data]) => (
        <TickerItem key={symbol} symbol={symbol} data={data} />
    ));

    return (
        <div className="w-full bg-light-secondary dark:bg-secondary border-y border-light-border dark:border-border-color h-12 flex items-center overflow-hidden">
            <div
                className="whitespace-nowrap cursor-pointer w-full"
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
            >
                <motion.div
                    className="flex"
                    animate={{ x: ['0%', '-50%'] }}
                    transition={{
                        ease: 'linear',
                        duration: 60, // Slower, more professional speed
                        repeat: Infinity,
                    }}
                    style={{
                        // Pause animation on hover
                        animationPlayState: isHovering ? 'paused' : 'running'
                    }}
                >
                    {/* Duplicate content for seamless infinite scroll */}
                    {tickerContent}
                    {tickerContent}
                </motion.div>
            </div>
        </div>
    );
};

export default LivePriceTicker;