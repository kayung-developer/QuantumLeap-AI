// src/components/homepage/HeroSection.js

import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../common/Button';
import { motion } from 'framer-motion';
import { FaPlay } from 'react-icons/fa';
import LivePriceTicker from '../dashboard/LivePriceTicker';

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden bg-light-secondary dark:bg-secondary border-b border-light-border dark:border-border-color">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150%] h-[150%] bg-gradient-to-br from-accent/10 via-transparent to-transparent dark:from-accent/5 -z-0" />

      <div className="container mx-auto px-4 py-24 md:py-32 flex flex-col lg:flex-row items-center relative z-10">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="lg:w-1/2 text-center lg:text-left"
        >
          <h1 className="text-4xl md:text-6xl font-extrabold text-light-heading dark:text-white leading-tight tracking-tighter">
            Trade Smarter, <br /> Not Harder.
          </h1>
          <p className="mt-6 text-lg text-light-muted dark:text-light-gray max-w-xl mx-auto lg:mx-0">
            QuantumLeap is your institutional-grade platform for building, backtesting, and deploying AI-powered crypto trading bots.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
            <Link to="/register"><Button size="md" className="w-full sm:w-auto">Start Building for Free</Button></Link>
            <Button variant="secondary" size="md" className="w-full sm:w-auto">
              <FaPlay className="mr-2" /> Watch Demo
            </Button>
          </div>
          <div className="mt-12 hidden lg:block">
            <LivePriceTicker />
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="lg:w-1/2 mt-12 lg:mt-0 flex justify-center"
        >
          {/* --- THIS IS THE CORRECTED IMAGE PATH --- */}
          <img
            src={`${process.env.PUBLIC_URL}/images/hero-graphic.jpg`}
            alt="QuantumLeap AI Trading Interface"
            className="w-full max-w-lg"
          />
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;