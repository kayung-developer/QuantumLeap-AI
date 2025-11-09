// src/pages/StrategyBuilderPage.js
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import ReactFlow, {
    ReactFlowProvider, addEdge, useNodesState, useEdgesState,
    Controls, MiniMap, Background, useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import '@reactflow/node-resizer/dist/style.css';
import { useLocation, useNavigate } from 'react-router-dom';

import { useApiMutation } from '../hooks/useApiMutation';
import { createBot, updateBot } from '../api/apiService'; // Add updateBot
import Button from '../components/common/Button';
import BuilderSidebar from '../components/strategylab/BuilderSidebar';
import { FaSave, FaProjectDiagram } from 'react-icons/fa';
import toast from 'react-hot-toast';

// Import all custom nodes
import IndicatorNode from '../components/strategylab/nodes/IndicatorNode';
import ConditionNode from '../components/strategylab/nodes/ConditionNode';
import ActionNode from '../components/strategylab/nodes/ActionNode';

const initialNodes = [{
    id: 'trigger-1', type: 'input', position: { x: 50, y: 150 },
    data: { label: 'On New Candle' }, sourcePosition: 'right',
}];

const StrategyBuilderPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const botToEdit = location.state?.bot; // Get the bot passed from the edit button

    const [nodes, setNodes, onNodesChange] = useNodesState(botToEdit?.visual_strategy_json?.nodes || initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(botToEdit?.visual_strategy_json?.edges || []);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);
    const [botName, setBotName] = useState(botToEdit?.name || `Visual Strategy ${new Date().toLocaleDateString()}`);

    const nodeTypes = useMemo(() => ({
        indicator: IndicatorNode,
        condition: ConditionNode,
        action: ActionNode,
    }), []);

    const updateNodeData = useCallback((nodeId, newData) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    node.data = { ...node.data, ...newData };
                }
                return node;
            })
        );
    }, [setNodes]);

    // Effect to add the `onChange` handler to all nodes
    useEffect(() => {
        setNodes((nds) =>
            nds.map((node) => ({
                ...node,
                data: { ...node.data, onChange: updateNodeData },
            }))
        );
    }, [updateNodeData, setNodes]);

    // Handle node selection to show in the inspector
    const onNodeClick = (event, node) => {
        setSelectedNode(node);
    };

    const onPaneClick = () => {
        setSelectedNode(null); // Deselect node when clicking on the background
    };

    const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback((event) => {
        event.preventDefault();
        const type = event.dataTransfer.getData('application/reactflow');
        if (typeof type === 'undefined' || !type) {
            return;
        }

        const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });

        // --- Create a new node with data and the onChange handler ---
        const newNode = {
            id: `${type}-${+new Date()}`,
            type,
            position,
            data: {
                label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
                // Pass the update function down to the node
                onChange: updateNodeData
            },
        };
        setNodes((nds) => nds.concat(newNode));
    }, [reactFlowInstance, setNodes, updateNodeData]);

    const createBotMutation = useApiMutation(createBot, {
        successMessage: 'Bot created from your visual strategy!',
        invalidateQueries: ['userBots'],
        onSuccess: () => {
            navigate('/dashboard/bots');
        }
    });
    const updateBotMutation = useApiMutation(updateBot, { // New mutation for editing
        successMessage: "Visual strategy updated successfully!",
        invalidateQueries: ['userBots'],
        onSuccess: () => navigate('/dashboard/bots'),
    });

    const handleSave = () => {
        if (!reactFlowInstance) return toast.error("Builder not ready.");

        const flow = reactFlowInstance.toObject();

        // --- THIS IS THE CORRECT SERIALIZATION ---
        const strategyJson = {
            nodes: flow.nodes.map(node => ({
                id: node.id,
                type: node.type,
                position: node.position,
                data: { // Only save the relevant data, not functions
                    label: node.data.label,
                    indicator: node.data.indicator,
                    param1: node.data.param1,
                    param2: node.data.param2,
                    operator: node.data.operator,
                    compareValue: node.data.compareValue,
                    action: node.data.action,
                }
            })),
            edges: flow.edges
        };

        const botData = {
            name: botName,
            symbol: botToEdit?.symbol || 'BTC/USDT', // Use existing or default
            exchange: botToEdit?.exchange || 'binance',
            asset_class: botToEdit?.asset_class || 'crypto',
            strategy_type: 'visual',
            visual_strategy_json: strategyJson,
            is_paper_trading: botToEdit?.is_paper_trading ?? true,
        };

        if (botToEdit) {
            // If editing, call the update mutation
            updateBotMutation.mutate({ botId: botToEdit.id, botData });
        } else {
            // If creating, call the create mutation
            createBotMutation.mutate(botData);
        }
    };

    return (
        <div className="flex flex-col h-full bg-primary text-white">
            <div className="flex justify-between items-center p-4 border-b border-border-color">
                <div className="flex items-center gap-4">
                    <FaProjectDiagram className="text-2xl text-accent" />
                    <input
                        type="text"
                        value={botName}
                        onChange={(e) => setBotName(e.target.value)}
                        className="bg-secondary text-xl font-bold p-1 rounded-md border border-transparent focus:border-accent focus:outline-none"
                    />
                </div>
                <Button onClick={handleSave} isLoading={createBotMutation.isLoading || updateBotMutation.isLoading}>
                    <FaSave className="mr-2" /> {botToEdit ? 'Save Changes' : 'Create Bot'}
                </Button>
            </div>
            <div className="flex flex-grow min-h-0">
                <BuilderSidebar selectedNode={selectedNode} updateNodeData={updateNodeData} />
                <div className="flex-grow h-full">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onNodeClick={onNodeClick}
                        onPaneClick={onPaneClick}
                        onConnect={onConnect}
                        onInit={setReactFlowInstance}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        nodeTypes={nodeTypes}
                        fitView
                    >
                        <Controls />
                        <MiniMap />
                        <Background variant="dots" gap={12} size={1} />
                    </ReactFlow>
                </div>
            </div>
        </div>
    );
};

const StrategyBuilderProvider = () => (
    <ReactFlowProvider>
        <StrategyBuilderPage />
    </ReactFlowProvider>
);
export default StrategyBuilderProvider;