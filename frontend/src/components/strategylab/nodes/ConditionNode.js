import React from 'react';
import BaseNode from './BaseNode';

const ConditionNode = ({ id, data }) => {
    return (
        <BaseNode id={id} data={data} inputs={[{ id: 'in-value' }]} outputs={[{ id: 'out-signal' }]}>
            <div className="space-y-2">
                <select name="operator" className="nodrag w-full bg-primary p-1 rounded">
                    <option value=">">Is Greater Than</option>
                    <option value="<">Is Less Than</option>
                </select>
                <input type="number" name="compareValue" placeholder="Value (e.g., 30)" className="nodrag w-full bg-primary p-1 rounded" />
            </div>
        </BaseNode>
    );
};
export default ConditionNode;