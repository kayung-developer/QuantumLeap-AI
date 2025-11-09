// src/components/homepage/HeroSection.js

import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
// --- FIX: Corrected the import path ---
import heroImage from '../../assets/images/hero-background.png';

const HeroSection = () => {
  return (
    <div
      className="relative bg-cover bg-center text-white py-24 md:py-40"
      style={{ backgroundImage: `url(${heroImage})` }}
    >
      <div className="absolute inset-0 bg-primary bg-opacity-70 backdrop-blur-sm"></div>
      <div className="container mx-auto px-6 text-center relative z-10">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-4xl md:text-6xl font-bold mb-4"
        >
          Automate Your Trades with AI Precision
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-lg md:text-xl text-light-gray mb-8 max-w-3xl mx-auto"
        >
          QuantumLeap AI empowers you to deploy intelligent, automated trading strategies on major exchanges. Backtest, optimize, and execute with confidence.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
        >
          <Link to="/register" className="bg-accent text-white font-bold py-3 px-8 rounded-lg hover:bg-accent-dark transition-colors text-lg">
            Get Started for Free
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default HeroSection;