import React from 'react';
import BaseNode from './BaseNode';

const ActionNode = ({ id, data }) => {
    return (
        <BaseNode id={id} data={data} inputs={[{ id: 'in-signal' }]}>
            <select name="action" className="nodrag w-full bg-primary p-1 rounded">
                <option>BUY</option>
                <option>SELL</option>
                <option>CLOSE</option>
            </select>
        </BaseNode>
    );
};
export default ActionNode;