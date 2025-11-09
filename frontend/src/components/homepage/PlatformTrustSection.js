import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { FaShieldAlt } from 'react-icons/fa';

// It's best to use official, high-quality SVG or PNG logos for these partners.
// For this example, we'll use text placeholders. In production, replace these with <img> tags.
const partners = [
    { name: "Binance", category: "Exchange Partner" },
    { name: "Firebase", category: "Authentication by Google" },
    { name: "Stripe", category: "Secure Payments" },
    { name: "BitGo", category: "Custodial Security" },
    { name: "TradingView", category: "Advanced Charting" },
    { name: "OpenAI", category: "AI & Intelligence" },
];

const PlatformTrustSection = () => {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.2 });

    const containerVariants = {
        hidden: {},
        visible: { transition: { staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, filter: 'blur(5px)' },
        visible: { opacity: 1, filter: 'blur(0px)', transition: { duration: 0.5 } }
    };

    return (
        <section className="py-20">
            <div className="container mx-auto px-4 text-center">
                <FaShieldAlt className="text-4xl text-accent mx-auto mb-4" />
                <h2 className="text-3xl md:text-4xl font-bold text-light-heading dark:text-white">
                    Enterprise-Grade Security & Reliability
                </h2>
                <p className="mt-4 text-light-muted dark:text-light-gray max-w-2xl mx-auto">
                    Your assets and data are protected by industry-leading security practices, and our platform is built on the world's most trusted technology.
                </p>

                <motion.div
                    ref={ref}
                    variants={containerVariants}
                    initial="hidden"
                    animate={inView ? "visible" : "hidden"}
                    className="mt-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 items-center"
                >
                    {partners.map((partner) => (
                        <motion.div key={partner.name} variants={itemVariants} className="grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition duration-300">
                            <p className="text-2xl font-bold text-light-muted dark:text-light-gray">{partner.name}</p>
                            {/* In production, you would use an <img> tag here:
                            <img src={`/logos/${partner.name.toLowerCase()}.svg`} alt={`${partner.name} logo`} className="h-8 mx-auto" />
                            */}
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
};

export default PlatformTrustSection;