// src/components/strategylab/StrategySensei.js

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { interpretStrategy } from '../../api/apiService';
import Button from '../common/Button';
import Textarea from '../common/Textarea';
import Alert from '../common/Alert';
import { FaBrain, FaWandMagicSparkles } from 'react-icons/fa6';

const StrategySensei = ({ onStrategySuggested }) => {
    const [text, setText] = useState('');

    const mutation = useMutation({
        mutationFn: interpretStrategy,
        onSuccess: (data) => {
            if (data.data.strategy_name === 'error') {
                // Let the parent component know there was an error
                onStrategySuggested({ error: data.data.explanation });
            } else {
                onStrategySuggested(data.data);
            }
        },
        onError: (err) => {
            onStrategySuggested({ error: err.response?.data?.detail || 'An error occurred.' });
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        mutation.mutate(text);
    };

    return (
        <div className="bg-light-primary dark:bg-primary border border-light-border dark:border-border-color p-6 rounded-lg">
            <h3 className="text-xl font-bold text-light-heading dark:text-white mb-2 flex items-center">
                <FaBrain className="mr-3 text-accent" /> Strategy Sensei
            </h3>
            <p className="text-sm text-light-muted dark:text-light-gray mb-4">
                Describe your trading idea in plain English, and the AI will suggest a strategy configuration for you to backtest.
            </p>
            <form onSubmit={handleSubmit}>
                <Textarea
                    placeholder="e.g., 'I want to sell when the price hits the upper Bollinger Band and buy when it hits the lower one.'"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={mutation.isLoading}
                />
                <Button type="submit" className="w-full mt-4" isLoading={mutation.isLoading}>
                    <FaWandMagicSparkles className="mr-2" /> Interpret My Strategy
                </Button>
            </form>
        </div>
    );
};

export default StrategySensei;