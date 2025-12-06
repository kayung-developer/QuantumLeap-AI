import React from 'react';
import { Handle, Position } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';

const BaseNode = ({ id, data, children, inputs = [], outputs = [] }) => {
    return (
        <>
            <NodeResizer minWidth={180} minHeight={100} />
            <div className={`
                bg-white dark:bg-secondary 
                border-2 border-gray-300 dark:border-border-color 
                rounded-lg shadow-md w-full h-full p-3 flex flex-col
                hover:border-accent transition-colors
            `}>
                <div className="text-center font-bold text-gray-900 dark:text-white pb-2 border-b border-gray-100 dark:border-border-color flex items-center justify-center space-x-2">
                    {data.icon}
                    <span>{data.label}</span>
                </div>
                <div className="flex-grow p-2 text-sm text-gray-700 dark:text-light-gray font-medium">
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