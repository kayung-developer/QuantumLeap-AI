import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { FaProjectDiagram, FaBrain, FaChartBar, FaStore, FaRocket, FaWallet } from 'react-icons/fa';

const featureList = [
  { icon: <FaProjectDiagram />, title: "No-Code Visual Builder", description: "Design, build, and connect complex trading logic with an intuitive drag-and-drop canvas. Your ideas, automated in minutes." },
  { icon: <FaBrain />, title: "AI Strategy Co-Pilot", description: "Leverage our Optimus AI to vet your signals against market conditions, and use our GPT-powered 'Sensei' to turn plain English into a backtestable strategy." },
  { icon: <FaChartBar />, title: "Institutional-Grade Analytics", description: "Go beyond P&L. Analyze your bot's true risk-adjusted performance with Equity Curves, Drawdown Charts, Sharpe & Sortino Ratios." },
  { icon: <FaStore />, title: "Community-Driven Marketplace", description: "Clone free strategies or subscribe to premium, high-performing bots from a vibrant community of top traders and creators." },
  { icon: <FaRocket />, title: "Futures & Spot Trading", description: "Deploy bots with precision on both spot and high-leverage futures markets, enabling both long and short strategies." },
  { icon: <FaWallet />, title: "Secure & Flexible Funding", description: "Connect your own exchange accounts via encrypted API keys, or use our secure internal custodial wallet for easy deposits, swaps, and management." },
];

const FeatureCard = ({ feature, index }) => {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
    const variants = {
        hidden: { opacity: 0, y: 50 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: index * 0.1 } }
    };
    return (
        <motion.div ref={ref} variants={variants} initial="hidden" animate={inView ? "visible" : "hidden"} 
            // Background: White in light mode
            className="p-6 bg-white dark:bg-secondary border border-gray-200 dark:border-border-color rounded-xl text-left shadow-sm hover:shadow-md transition-shadow">
            <div className="text-3xl text-accent mb-4">{feature.icon}</div>
            {/* Title: Black */}
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
            {/* Description: Dark Gray */}
            <p className="text-gray-600 dark:text-light-gray leading-relaxed">{feature.description}</p>
        </motion.div>
    );
};

const FeaturesShowcase = () => {
  return (
    <section id="features" className="py-20">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-light-heading dark:text-white">The Ultimate Edge, All in One Platform</h2>
        <p className="mt-4 text-light-muted dark:text-light-gray max-w-2xl mx-auto">
          We combined the best features of professional quant platforms, exchanges, and community hubs to create a seamless trading experience.
        </p>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {featureList.map((feature, index) => <FeatureCard key={index} feature={feature} index={index} />)}
        </div>
      </div>
    </section>
  );
};

export default FeaturesShowcase;