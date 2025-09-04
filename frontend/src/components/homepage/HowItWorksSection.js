import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { FaMousePointer, FaCog, FaRocket } from 'react-icons/fa';

const steps = [
    { icon: <FaMousePointer/>, title: "1. Build or Clone", description: "Use our no-code Visual Builder to design your unique strategy, or clone a proven one from the Marketplace." },
    { icon: <FaCog/>, title: "2. Backtest & Optimize", description: "Validate your strategy against years of historical data in our Strategy Lab. Optimize parameters to find the perfect configuration." },
    { icon: <FaRocket/>, title: "3. Deploy & Monitor", description: "Launch your bot on spot or futures markets with a single click. Monitor its performance in real-time from web or mobile." },
];

const HowItWorksSection = () => {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.2 });
    const containerVariants = {
        hidden: {},
        visible: { transition: { staggerChildren: 0.2 } }
    };
    const itemVariants = {
        hidden: { opacity: 0, y: 50 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
    };

    return (
        <section className="bg-light-secondary dark:bg-secondary py-20">
            <div className="container mx-auto px-4 text-center">
                <h2 className="text-3xl md:text-4xl font-bold text-light-heading dark:text-white">Launch Your First Bot in 3 Simple Steps</h2>
                <motion.div ref={ref} variants={containerVariants} initial="hidden" animate={inView ? "visible" : "hidden"} className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
                    {steps.map((step, index) => (
                        <motion.div key={index} variants={itemVariants} className="p-6">
                            <div className="flex items-center justify-center h-20 w-20 mx-auto rounded-full bg-accent/10 border-2 border-accent text-accent text-4xl mb-6">
                                {step.icon}
                            </div>
                            <h3 className="text-xl font-bold text-light-heading dark:text-white mb-2">{step.title}</h3>
                            <p className="text-light-muted dark:text-light-gray">{step.description}</p>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
};

export default HowItWorksSection;