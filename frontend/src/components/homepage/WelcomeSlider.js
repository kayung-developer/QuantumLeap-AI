import React from 'react';
import { motion } from 'framer-motion';
import Slider from 'react-slick';
import { FaArrowRight, FaRobot, FaChartBar, FaShieldAlt } from 'react-icons/fa';
import Button from '../common/Button';

const WelcomeSlider = ({ onFinish }) => {
    const sliderSettings = {
        dots: true,
        infinite: false,
        speed: 500,
        slidesToShow: 1,
        slidesToScroll: 1,
        arrows: false,
    };

    const slideData = [
        { icon: <FaRobot size={80} />, title: "Automate Your Strategy", description: "Deploy autonomous trading bots that execute your strategy 24/7 without emotion." },
        { icon: <FaChartBar size={80} />, title: "Analyze & Backtest", description: "Use our Strategy Lab to test your ideas against historical data before risking a single dollar." },
        { icon: <FaShieldAlt size={80} />, title: "Trade Securely", description: "Connect your exchange via encrypted API keys. You are always in control of your funds." },
    ];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-primary z-50 flex flex-col items-center justify-center"
        >
            <div className="w-full max-w-2xl mx-auto">
                <Slider {...sliderSettings}>
                    {slideData.map((slide, index) => (
                        <div key={index} className="text-center px-8 py-16">
                            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }} className="text-accent mx-auto mb-8 inline-block">
                                {slide.icon}
                            </motion.div>
                            <h2 className="text-4xl font-bold text-white mb-4">{slide.title}</h2>
                            <p className="text-lg text-light-gray">{slide.description}</p>
                        </div>
                    ))}
                    <div className="text-center px-8 py-16">
                        <h2 className="text-4xl font-bold text-white mb-4">Join the Future of Trading</h2>
                        <p className="text-lg text-light-gray mb-8">Ready to elevate your trading game?</p>
                        <Button onClick={onFinish} className="text-xl px-10 py-4">
                            Enter Site <FaArrowRight className="ml-3" />
                        </Button>
                    </div>
                </Slider>
            </div>
        </motion.div>
    );
};

export default WelcomeSlider;