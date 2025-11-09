// src/components/dashboard/StatCard.js

import React from 'react';
import Card from '../common/Card';
import Spinner from '../common/Spinner';

const StatCard = ({ title, value, icon, change, changeType, isLoading }) => {
  return (
    <Card className="p-4">
      <div className="flex items-center">
        <div className="p-3 bg-light-secondary dark:bg-primary rounded-lg mr-4">
            {icon}
        </div>
        <div>
          <p className="text-sm text-light-muted dark:text-light-gray">{title}</p>
          <div className="flex items-baseline space-x-2">
            <p className="text-2xl font-bold text-light-heading dark:text-white">
              {isLoading ? <Spinner size="sm" /> : value}
            </p>
            {change && !isLoading && (
              <span className={`text-xs font-semibold ${changeType === 'positive' ? 'text-success' : 'text-danger'}`}>
                {change}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default StatCard;