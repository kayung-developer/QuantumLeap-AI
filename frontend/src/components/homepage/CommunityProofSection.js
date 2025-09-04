// src/components/homepage/CommunityProofSection.js

import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useQuery } from '@tanstack/react-query';
import { fetchCommunityStats } from '../../api/apiService';
import { FaUsers, FaArrowRight } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import Button from '../common/Button';
import Spinner from '../common/Spinner';

// A placeholder component for when data is loading
const StatCardSkeleton = () => (
    <div className="bg-light-primary dark:bg-primary p-8 rounded-lg border border-light-border dark:border-border-color animate-pulse">
        <div className="h-10 w-10 bg-gray-200 dark:bg-border-color rounded-full mx-auto mb-4"></div>
        <div className="h-12 w-3/4 bg-gray-200 dark:bg-border-color rounded-md mx-auto"></div>
        <div className="h-4 w-1/2 bg-gray-200 dark:bg-border-color rounded-md mx-auto mt-2"></div>
    </div>
);

const CommunityProofSection = () => {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.2 });

    const { data: communityData, isLoading } = useQuery({
        queryKey: ['communityStats'],
        queryFn: fetchCommunityStats,
        staleTime: 1000 * 60 * 5, // Cache data for 5 minutes
        refetchOnWindowFocus: false,
    });

    const stats = communityData?.data;

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.2 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, scale: 0.9 },
        visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 100 } }
    };

    return (
        <section className="bg-light-secondary dark:bg-secondary py-20">
            <div className="container mx-auto px-4">
                <div className="text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-light-heading dark:text-white">Join a Thriving Community of Traders</h2>
                    <p className="mt-4 text-light-muted dark:text-light-gray max-w-2xl mx-auto">
                        You're not just getting a tool, you're joining an ecosystem. Learn from, share with, and build alongside thousands of other automated traders.
                    </p>
                </div>

                <motion.div
                    ref={ref}
                    variants={containerVariants}
                    initial="hidden"
                    animate={inView ? "visible" : "hidden"}
                    className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8"
                >
                    {isLoading ? (
                        <>
                            <StatCardSkeleton />
                            <StatCardSkeleton />
                            <StatCardSkeleton />
                        </>
                    ) : (
                        <>
                            <motion.div variants={itemVariants} className="bg-light-primary dark:bg-primary p-8 rounded-lg text-center border border-light-border dark:border-border-color">
                                <FaUsers className="text-4xl text-accent mx-auto mb-4" />
                                <p className="text-5xl font-extrabold text-light-heading dark:text-white">
                                    {stats?.total_users.toLocaleString() || '15,000+'}
                                </p>
                                <p className="text-light-muted dark:text-light-gray mt-1">Traders on Platform</p>
                            </motion.div>

                            <motion.div variants={itemVariants} className="bg-light-primary dark:bg-primary p-8 rounded-lg text-center border border-light-border dark:border-border-color">
                                <div className="text-4xl text-accent mx-auto mb-4 font-mono font-bold">&lt;/&gt;</div>
                                <p className="text-5xl font-extrabold text-light-heading dark:text-white">
                                    {stats?.bots_created.toLocaleString() || '40,000+'}
                                </p>
                                <p className="text-light-muted dark:text-light-gray mt-1">Bots Created & Backtested</p>
                            </motion.div>

                            <motion.div variants={itemVariants} className="bg-light-primary dark:bg-primary p-8 rounded-lg border border-light-border dark:border-border-color">
                                 <h3 className="text-xl font-bold text-light-heading dark:text-white text-center mb-4">Live Marketplace Leaders</h3>
                                 <div className="space-y-3">
                                    {stats?.top_strategies.map(strategy => (
                                        <div key={strategy.name} className="flex justify-between items-center bg-light-secondary dark:bg-secondary p-3 rounded">
                                            <div>
                                                <p className="font-semibold text-light-text dark:text-white truncate">{strategy.name}</p>
                                                <p className="text-xs text-light-muted dark:text-light-gray">by {strategy.owner_name}</p>
                                            </div>
                                            <p className="font-mono font-bold text-success">+{strategy.pnl.toFixed(2)}%</p>
                                        </div>
                                    ))}
                                 </div>
                            </motion.div>
                        </>
                    )}
                </motion.div>

                <div className="text-center mt-12">
                    <Link to="/marketplace">
                        <Button variant="secondary">
                            Explore the Marketplace <FaArrowRight className="ml-2" />
                        </Button>
                    </Link>
                </div>
            </div>
        </section>
    );
};

export default CommunityProofSection;