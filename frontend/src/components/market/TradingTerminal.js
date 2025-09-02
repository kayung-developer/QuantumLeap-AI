// src/components/market/TradingTerminal.js

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { placeManualOrder, getOpenOrders } from '../../api/apiService';
import Input from '../common/Input';
import Button from '../common/Button';
import Spinner from '../common/Spinner';
import toast from 'react-hot-toast';
import Card from '../common/Card';

const OrderEntryPanel = ({ exchange, symbol, assetClass }) => {
    const queryClient = useQueryClient();
    const [side, setSide] = useState('buy');
    const [type, setType] = useState('limit');
    const [orderData, setOrderData] = useState({ amount: '', price: '', stop_price: '' });

    const mutation = useMutation({
        mutationFn: placeManualOrder,
        onSuccess: () => {
            toast.success('Order placed successfully!');
            queryClient.invalidateQueries({ queryKey: ['openOrders', exchange, symbol] });
            setOrderData({ amount: '', price: '', stop_price: '' });
        },
        onError: (err) => toast.error(`Order failed: ${err.response?.data?.detail || err.message}`),
    });

    const handleInputChange = (e) => setOrderData({ ...orderData, [e.target.name]: e.target.value });

    const handleSubmit = (e) => {
        e.preventDefault();
        mutation.mutate({
            exchange, symbol, side, type,
            asset_class: assetClass,
            amount: parseFloat(orderData.amount),
            price: parseFloat(orderData.price),
            stop_price: parseFloat(orderData.stop_price),
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
                <Button type="button" onClick={() => setSide('buy')} className={`w-full ${side === 'buy' ? '!bg-success' : 'bg-secondary'}`}>Buy</Button>
                <Button type="button" onClick={() => setSide('sell')} className={`w-full ${side === 'sell' ? '!bg-danger' : 'bg-secondary'}`}>Sell</Button>
            </div>
            <Input label="Price (USDT)" name="price" type="number" step="any" value={orderData.price} onChange={handleInputChange} required />
            <Input label={`Amount (${symbol.split('/')[0]})`} name="amount" type="number" step="any" value={orderData.amount} onChange={handleInputChange} required />

            <div className="text-sm text-light-gray">Total: ${(parseFloat(orderData.amount) * parseFloat(orderData.price) || 0).toFixed(2)}</div>

            <Button type="submit" isLoading={mutation.isLoading} className={`w-full ${side === 'buy' ? 'bg-success' : 'bg-danger'}`}>
                {side.charAt(0).toUpperCase() + side.slice(1)} {symbol.split('/')[0]}
            </Button>
        </form>
    );
};

const OpenOrdersPanel = ({ exchange, symbol }) => {
    const { data: orders, isLoading } = useQuery({
        queryKey: ['openOrders', exchange, symbol],
        queryFn: () => getOpenOrders(exchange, symbol),
        refetchInterval: 10000,
    });

    if (isLoading) return <div className="flex justify-center p-4"><Spinner /></div>;

    return (
        <div className="space-y-2 max-h-64 overflow-y-auto">
            {orders?.data.length === 0 && <p className="text-sm text-light-gray text-center p-4">No open orders for this symbol.</p>}
            {orders?.data.map(order => (
                <div key={order.id} className="text-xs p-2 bg-primary rounded">
                    <div className="flex justify-between font-semibold">
                        <span className={order.side === 'buy' ? 'text-success' : 'text-danger'}>{order.side.toUpperCase()} {order.symbol}</span>
                        <span>{new Date(order.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex justify-between text-light-gray">
                        <span>Amount: {order.amount}</span>
                        <span>Price: ${order.price}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};


const TradingTerminal = ({ symbol, exchange, assetClass }) => {
    return (
        <Card>
            <h2 className="text-xl font-semibold text-white mb-4">Trading Terminal</h2>
            <div className="space-y-6">
                <OrderEntryPanel symbol={symbol} exchange={exchange} assetClass={assetClass} />
                <div className="border-t border-border-color pt-4">
                    <h3 className="text-lg font-semibold text-white mb-2">Open Orders</h3>
                    <OpenOrdersPanel symbol={symbol} exchange={exchange} />
                </div>
            </div>
        </Card>
    );
};

export default TradingTerminal;