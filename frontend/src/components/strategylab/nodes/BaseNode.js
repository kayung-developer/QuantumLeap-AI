import React from 'react';
import { Handle, Position } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';

const BaseNode = ({ id, data, children, inputs = [], outputs = [] }) => {
    return (
        <>
            <NodeResizer minWidth={180} minHeight={100} />
            <div className="bg-secondary border-2 border-border-color rounded-lg shadow-lg w-full h-full p-3 flex flex-col">
                <div className="text-center font-bold text-white pb-2 border-b border-border-color flex items-center justify-center space-x-2">
                {data.icon}
                <span>{data.label}</span>
                </div>
                <div className="flex-grow p-2 text-sm text-light-gray">
                    {children}
                </div>
                {inputs.map((handle, index) => (
                    <Handle
                        key={handle.id}
                        type="target"
                        position={Position.Left}
                        id={handle.id}
                        style={{ top: `${(index + 1) * 30}px` }}
                    />
                ))}
                {outputs.map((handle, index) => (
                    <Handle
                        key={handle.id}
                        type="source"
                        position={Position.Right}
                        id={handle.id}
                        style={{ top: `${(index + 1) * 30}px` }}
                    />
                ))}
            </div>
        </>
    );
};

export default BaseNode;