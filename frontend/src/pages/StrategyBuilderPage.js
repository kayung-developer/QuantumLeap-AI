// src/pages/StrategyBuilderPage.js
import React, { useState, useCallback, useRef } from 'react';
import ReactFlow, { ReactFlowProvider, addEdge, useNodesState, useEdgesState, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createBot } from '../api/apiService';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import BuilderSidebar from '../components/strategylab/BuilderSidebar';
import { FaSave } from 'react-icons/fa';

const initialNodes = [{ id: '1', type: 'trigger', position: { x: 50, y: 100 }, data: { label: 'On New Candle' } }];

const StrategyBuilderPage = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const reactFlowWrapper = useRef(null);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);

    const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback((event) => {
        event.preventDefault();
        const type = event.dataTransfer.getData('application/reactflow');
        const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
        const newNode = {
            id: `${type}-${+new Date()}`,
            type,
            position,
            data: { label: `${type} Node` },
        };
        setNodes((nds) => nds.concat(newNode));
    }, [reactFlowInstance, setNodes]);

    const createBotMutation = useMutation({
        mutationFn: createBot,
        onSuccess: () => {
            toast.success('Bot created from your visual strategy!');
            queryClient.invalidateQueries({ queryKey: ['bots'] });
            navigate('/dashboard/bots');
        },
        onError: (err) => toast.error(`Failed to create bot: ${err.response?.data?.detail || err.message}`),
    });

    const handleCreateBot = () => {
        const strategyJson = { nodes, edges };
        // This is a simplified creation form for now
        const botData = {
            name: `Visual Strategy Bot ${new Date().toLocaleTimeString()}`,
            symbol: 'BTC/USDT',
            exchange: 'binance',
            strategy_type: 'visual',
            visual_strategy_json: strategyJson,
            is_paper_trading: true, // Default to paper trading for safety
        };
        createBotMutation.mutate(botData);
    };

    return (
        <div className="flex h-full">
            <BuilderSidebar />
            <div className="flex-grow h-[85vh]" ref={reactFlowWrapper}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onInit={setReactFlowInstance}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    fitView
                >
                    <Controls />
                    <MiniMap />
                </ReactFlow>
            </div>
            <div className="absolute top-20 right-10 z-10">
                <Button onClick={handleCreateBot} isLoading={createBotMutation.isLoading}>
                    <FaSave className="mr-2" /> Create Bot From Strategy
                </Button>
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