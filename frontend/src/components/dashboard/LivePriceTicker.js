// src/components/dashboard/LivePriceTicker.js

import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { motion, AnimatePresence } from 'framer-motion';
import { FaBitcoin, FaEthereum, FaDollarSign, FaYenSign, FaPoundSign, FaEuroSign } from 'react-icons/fa';
import { SiRipple, SiBinance, SiSolana } from 'react-icons/si';
import { RiMoneyCnyBoxLine, RiCurrencyLine } from 'react-icons/ri';

const LivePriceTicker = () => {
    const wsContext = useWebSocket();
    const [isHovering, setIsHovering] = useState(false);

    const [prices, setPrices] = useState({
        // Crypto Pairs
        'BTC/USDT': { price: 0, change: 0, direction: 'neutral' }, 'ETH/USDT': { price: 0, change: 0, direction: 'neutral' },
        'BNB/USDT': { price: 0, change: 0, direction: 'neutral' }, 'SOL/USDT': { price: 0, change: 0, direction: 'neutral' },
        'XRP/USDT': { price: 0, change: 0, direction: 'neutral' }, 'DOGE/USDT': { price: 0, change: 0, direction: 'neutral' },
        'ADA/USDT': { price: 0, change: 0, direction: 'neutral' }, 'AVAX/USDT': { price: 0, change: 0, direction: 'neutral' },
        'SHIB/USDT': { price: 0, change: 0, direction: 'neutral' }, 'DOT/USDT': { price: 0, change: 0, direction: 'neutral' },
        'LINK/USDT': { price: 0, change: 0, direction: 'neutral' }, 'TRX/USDT': { price: 0, change: 0, direction: 'neutral' },
        'MATIC/USDT': { price: 0, change: 0, direction: 'neutral' }, 'LTC/USDT': { price: 0, change: 0, direction: 'neutral' },
        'ATOM/USDT': { price: 0, change: 0, direction: 'neutral' }, 'NEAR/USDT': { price: 0, change: 0, direction: 'neutral' },
        'UNI/USDT': { price: 0, change: 0, direction: 'neutral' }, 'XLM/USDT': { price: 0, change: 0, direction: 'neutral' },
        'ICP/USDT': { price: 0, change: 0, direction: 'neutral' }, 'ETC/USDT': { price: 0, change: 0, direction: 'neutral' },
        // Forex Pairs
        'EUR/USD': { price: 0, change: 0, direction: 'neutral' }, 'GBP/USD': { price: 0, change: 0, direction: 'neutral' },
        'USD/JPY': { price: 0, change: 0, direction: 'neutral' }, 'USD/CHF': { price: 0, change: 0, direction: 'neutral' },
        'AUD/USD': { price: 0, change: 0, direction: 'neutral' }, 'NZD/USD': { price: 0, change: 0, direction: 'neutral' },
        'USD/CAD': { price: 0, change: 0, direction: 'neutral' }, 'EUR/GBP': { price: 0, change: 0, direction: 'neutral' },
        'EUR/JPY': { price: 0, change: 0, direction: 'neutral' }, 'GBP/JPY': { price: 0, change: 0, direction: 'neutral' },
        'AUD/JPY': { price: 0, change: 0, direction: 'neutral' }, 'NZD/JPY': { price: 0, change: 0, direction: 'neutral' },
        'GBP/CHF': { price: 0, change: 0, direction: 'neutral' }, 'AUD/NZD': { price: 0, change: 0, direction: 'neutral' },
        'EUR/AUD': { price: 0, change: 0, direction: 'neutral' }, 'GBP/CAD': { price: 0, change: 0, direction: 'neutral' },
        'EUR/CAD': { price: 0, change: 0, direction: 'neutral' }, 'USD/MXN': { price: 0, change: 0, direction: 'neutral' },
        'USD/ZAR': { price: 0, change: 0, direction: 'neutral' }, 'USD/INR': { price: 0, change: 0, direction: 'neutral' },
    });

    useEffect(() => {
        if (wsContext?.messages) {
            const marketUpdate = wsContext.messages.find(msg => msg.type === 'market_update');
            if (marketUpdate?.data) {
                setPrices(prevPrices => {
                    const newPrices = { ...prevPrices };
                    for (const symbol in marketUpdate.data) {
                        if (newPrices[symbol]) {
                            const newPrice = marketUpdate.data[symbol].price;
                            const oldPrice = newPrices[symbol].price;
                            newPrices[symbol] = {
                                price: newPrice,
                                change: marketUpdate.data[symbol].change,
                                direction: newPrice > oldPrice ? 'up' : (newPrice < oldPrice ? 'down' : 'neutral'),
                            };
                        }
                    }
                    return newPrices;
                });
            }
        }
    }, [wsContext?.messages]);

    const getIcon = (symbol) => {
        const base = symbol.split('/')[0];
        const icons = {
            'BTC': <FaBitcoin className="text-yellow-400" />, 'ETH': <FaEthereum className="text-indigo-400" />,
            'BNB': <SiBinance className="text-yellow-500" />, 'SOL': <SiSolana className="text-purple-400" />,
            'XRP': <SiRipple className="text-blue-300" />, 'EUR': <FaEuroSign className="text-blue-500" />,
            'GBP': <FaPoundSign className="text-pink-500" />, 'USD': <FaDollarSign className="text-green-500" />,
            'JPY': <FaYenSign className="text-red-400" />, 'AUD': <RiMoneyCnyBoxLine className="text-cyan-500" />,
            'CAD': <RiMoneyCnyBoxLine className="text-red-600" />,
            'CHF': <RiCurrencyLine className="text-red-500" />,
        };
        return icons[base] || <RiCurrencyLine className="text-gray-400" />;
    };

    const formatPrice = (symbol, price) => {
        const [base, quote] = symbol.split('/');
        const isCrypto = quote === 'USDT';
        const options = {
            minimumFractionDigits: isCrypto ? 2 : 4,
            maximumFractionDigits: isCrypto ? 4 : 5
        };
        const formattedPrice = price > 0 ? price.toLocaleString(undefined, options) : '...';

        const prefixes = { 'USD': '$', 'USDT': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥' };
        return `${prefixes[quote] || ''}${formattedPrice}`;
    };

    const directionColor = {
        up: 'text-success',
        down: 'text-danger',
        neutral: 'text-light-muted dark:text-light-gray',
    };

    const tickerContent = Object.entries(prices).map(([symbol, data]) => (
        <div key={symbol} className="flex-shrink-0 flex items-center space-x-2 mx-6">
            <div className="text-xl">{getIcon(symbol)}</div>
            {/* --- THE FIX: Display the full symbol instead of just the base currency --- */}
            <span className="font-semibold text-light-text dark:text-white">{symbol}</span>
            <AnimatePresence mode="wait">
                 <motion.div
                    key={data.price}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2 }}
                    className={`font-mono text-sm ${directionColor[data.direction]}`}
                 >
                    {formatPrice(symbol, data.price)}
                 </motion.div>
            </AnimatePresence>
        </div>
    ));

    return (
        <div
            className={`w-full whitespace-nowrap cursor-pointer ${isHovering ? 'overflow-x-auto' : 'overflow-hidden'}`}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            {isHovering ? (
                <div className="flex py-2">
                    {tickerContent}
                </div>
            ) : (
                <motion.div
                    className="flex"
                    animate={{ x: ['0%', '-50%'] }}
                    transition={{
                        ease: 'linear',
                        duration: 150,
                        repeat: Infinity,
                    }}
                >
                    {tickerContent}
                    {tickerContent}
                </motion.div>
            )}
        </div>
    );
};

export default LivePriceTicker;