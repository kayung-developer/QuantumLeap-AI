import React from 'react';
import BaseNode from './BaseNode';

const ConditionNode = ({ id, data }) => {
    const inputClass = "nodrag w-full bg-white dark:bg-primary border border-gray-300 dark:border-border-color p-1 rounded text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-accent outline-none";

    return (
        <BaseNode id={id} data={data} inputs={[{ id: 'in-value' }]} outputs={[{ id: 'out-signal' }]}>
            <div className="space-y-2">
                <select name="operator" className={inputClass} defaultValue=">">
                    <option value=">">Greater Than</option>
                    <option value="<">Less Than</option>
                    <option value="=">Equals</option>
                </select>
                <input 
                    type="number" 
                    name="compareValue" 
                    placeholder="Value" 
                    className={inputClass} 
                />
            </div>
        </BaseNode>
    );
};
export default ConditionNode;