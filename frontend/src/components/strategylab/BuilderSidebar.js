// src/components/strategylab/BuilderSidebar.js
import React from 'react';

const DraggableNode = ({ type, label }) => {
    const onDragStart = (event, nodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div
            className="p-3 border-2 border-dashed border-light-border dark:border-border-color rounded-md cursor-grab text-center bg-light-secondary dark:bg-secondary hover:bg-gray-200 dark:hover:bg-primary"
            onDragStart={(event) => onDragStart(event, type)}
            draggable
        >
            {label}
        </div>
    );
};

const BuilderSidebar = () => {
    return (
        <aside className="w-64 p-4 border-r border-light-border dark:border-border-color space-y-4">
            <h2 className="text-xl font-bold">Nodes</h2>

            <h3 className="font-semibold mt-4 border-b pb-1">Triggers</h3>
            <DraggableNode type="trigger" label="On New Candle" />

            <h3 className="font-semibold mt-4 border-b pb-1">Indicators</h3>
            <DraggableNode type="indicatorRSI" label="RSI" />
            <DraggableNode type="indicatorMACD" label="MACD" />

            <h3 className="font-semibold mt-4 border-b pb-1">Values</h3>
            <DraggableNode type="valueNumber" label="Number" />
            <DraggableNode type="valuePrice" label="Market Price" />

            <h3 className="font-semibold mt-4 border-b pb-1">Conditions</h3>
            <DraggableNode type="conditionCompare" label="Compare (A > B)" />
            <DraggableNode type="conditionCrossover" label="Crossover" />

            <h3 className="font-semibold mt-4 border-b pb-1">Actions</h3>
            <DraggableNode type="actionBuy" label="Generate BUY Signal" />
            <DraggableNode type="actionSell" label="Generate SELL Signal" />
        </aside>
    );
};

export default BuilderSidebar;