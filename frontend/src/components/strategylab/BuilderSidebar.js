import React from 'react';
import { FaPlus, FaMousePointer, FaRulerHorizontal, FaCode, FaBolt } from 'react-icons/fa';

// This component now receives the selected node's data
const NodeInspector = ({ selectedNode, updateNodeData }) => {
    if (!selectedNode) {
        return <div className="p-4 text-sm text-light-gray">Select a node to see its properties.</div>;
    }

    const handleChange = (e) => {
        updateNodeData(selectedNode.id, { ...selectedNode.data, [e.target.name]: e.target.value });
    };

    const renderParams = () => {
        switch (selectedNode.type) {
            case 'indicator':
                return (
                    <>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 mt-3">Indicator Type</label>
                        <select name="indicator" value={selectedNode.data.indicator || ''} onChange={handleChange} className="nodrag w-full bg-white dark:bg-primary border border-gray-300 dark:border-border-color p-2 rounded text-gray-900 dark:text-white focus:ring-2 focus:ring-accent outline-none text-sm">
                            <option>RSI</option><option>EMA</option><option>MACD</option>
                        </select>
                        <label className="mt-2">Param 1</label>
                        <input type="number" name="param1" value={selectedNode.data.param1 || ''} onChange={handleChange} className="nodrag w-full bg-white dark:bg-primary border border-gray-300 dark:border-border-color p-2 rounded text-gray-900 dark:text-white focus:ring-2 focus:ring-accent outline-none text-sm" />
                    </>
                );
            case 'condition':
                return (
                    <>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 mt-3">Operator</label>
                        <select name="operator" value={selectedNode.data.operator || ''} onChange={handleChange} className="nodrag w-full bg-white dark:bg-primary border border-gray-300 dark:border-border-color p-2 rounded text-gray-900 dark:text-white focus:ring-2 focus:ring-accent outline-none text-sm">
                            <option value=">">Greater Than</option><option value="<">Less Than</option>
                        </select>
                        <label className="mt-2">Compare Value</label>
                        <input type="number" name="compareValue" value={selectedNode.data.compareValue || ''} onChange={handleChange} className="nodrag w-full bg-white dark:bg-primary border border-gray-300 dark:border-border-color p-2 rounded text-gray-900 dark:text-white focus:ring-2 focus:ring-accent outline-none text-sm" />
                    </>
                );
            case 'action':
                 return (
                    <>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 mt-3">Action Type</label>
                        <select name="action" value={selectedNode.data.action || ''} onChange={handleChange} className="nodrag w-full bg-white dark:bg-primary border border-gray-300 dark:border-border-color p-2 rounded text-gray-900 dark:text-white focus:ring-2 focus:ring-accent outline-none text-sm">
                            <option>BUY</option><option>SELL</option><option>CLOSE</option>
                        </select>
                    </>
                 );
            default:
                return <p>This node has no configurable properties.</p>;
        }
    };

    return (
        <div className="p-4 space-y-2">
            <h3 className="text-lg font-bold border-b border-border-color pb-2 mb-2">Properties</h3>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 mt-3">Node Label</label>
            <input type="text" name="label" value={selectedNode.data.label} onChange={handleChange} className="nodrag w-full bg-white dark:bg-primary border border-gray-300 dark:border-border-color p-2 rounded text-gray-900 dark:text-white focus:ring-2 focus:ring-accent outline-none text-sm" />
            {renderParams()}
        </div>
    );
};

const BuilderSidebar = ({ selectedNode, updateNodeData }) => {
    const onDragStart = (event, nodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    const nodeTypes = [
        { type: 'indicator', label: 'Indicator', icon: <FaRulerHorizontal /> },
        { type: 'condition', label: 'Condition', icon: <FaCode /> },
        { type: 'action', label: 'Action', icon: <FaBolt /> },
    ];

    return (
        <aside className="w-80 bg-white dark:bg-secondary p-4 border-r border-gray-200 dark:border-border-color flex flex-col h-full overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Toolbox</h2>
            <div className="space-y-3 mb-6">
                {nodeTypes.map((node) => (
                    <div
                        key={node.type}
                        onDragStart={(event) => onDragStart(event, node.type)}
                        draggable
                        className="p-3 bg-gray-50 dark:bg-primary border border-gray-200 dark:border-border-color rounded-lg cursor-grab flex items-center space-x-3 hover:border-accent transition-colors shadow-sm text-gray-700 dark:text-gray-200"
                    >
                        {node.icon}
                        <span className="font-medium">{node.label}</span>
                    </div>
                ))}
            </div>

            <div className="flex-grow border-t border-gray-200 dark:border-border-color pt-4">
                <NodeInspector selectedNode={selectedNode} updateNodeData={updateNodeData} />
            </div>
        </aside>
    );
};

export default BuilderSidebar;