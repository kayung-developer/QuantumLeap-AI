import React from 'react';
import BaseNode from './BaseNode';

const ActionNode = ({ id, data }) => {
    const inputClass = "nodrag w-full bg-white dark:bg-primary border border-gray-300 dark:border-border-color p-1 rounded text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-accent outline-none font-bold";

    return (
        <BaseNode id={id} data={data} inputs={[{ id: 'in-signal' }]}>
            <div className="pt-1">
                <select name="action" className={inputClass}>
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                    <option value="CLOSE">CLOSE</option>
                </select>
            </div>
        </BaseNode>
    );
};
export default ActionNode;