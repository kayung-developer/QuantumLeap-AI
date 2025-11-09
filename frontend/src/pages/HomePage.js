// src/pages/HomePage.js

import React, { useState, useEffect, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';

// --- CORE: Import components that are "above the fold" and need to load instantly ---
import HeroSection from '../components/homepage/HeroSection';
import LiveMarketTicker from '../components/homepage/LiveMarketTicker';

// --- PERFORMANCE: Dynamically import components that are not visible on initial load ---
const Navbar = React.lazy(() => import('../components/layout/Navbar'));
const Footer = React.lazy(() => import('../components/layout/Footer'));
const WelcomeSlider = React.lazy(() => import('../components/homepage/WelcomeSlider'));
const WelcomeModal = React.lazy(() => import('../components/homepage/WelcomeModal'));
const ChatAssistant = React.lazy(() => import('../components/homepage/ChatAssistant'));
const FeaturesShowcase = React.lazy(() => import('../components/homepage/FeaturesShowcase'));
const HowItWorksSection = React.lazy(() => import('../components/homepage/HowItWorksSection'));
const CommunityProofSection = React.lazy(() => import('../components/homepage/CommunityProofSection'));
const PlatformTrustSection = React.lazy(() => import('../components/homepage/PlatformTrustSection'));
const TestimonialsSection = React.lazy(() => import('../components/homepage/TestimonialsSection'));
const PricingSection = React.lazy(() => import('../components/homepage/PricingSection'));
const FAQSection = React.lazy(() => import('../components/homepage/FAQSection'));
const CallToActionSection = React.lazy(() => import('../components/homepage/CallToActionSection'));




// --- OPTIMIZATION: A simple fallback UI for lazily-loaded components ---
const SectionFallback = () => <div className="w-full h-96 bg-secondary" />;
const GlobalFallback = () => null; // No fallback for global components like nav/footer


const HomePage = () => {
    // State to manage the visibility of the one-time slider and the per-session modal
    const [showSlider, setShowSlider] = useState(false);
    const [showWelcome, setShowWelcome] = useState(false);

    // --- ROBUSTNESS: Corrected and consolidated logic into a single, clean effect ---
    useEffect(() => {
        const hasVisitedEver = localStorage.getItem('hasVisitedQuantumLeap');
        const hasVisitedSession = sessionStorage.getItem('hasVisitedSession');

        if (!hasVisitedEver) {
            // If the user has never visited before, show the full-screen slider.
            setShowSlider(true);
        } else if (!hasVisitedSession) {
            // If they have visited before, but this is a new session, show the welcome modal.
            const timer = setTimeout(() => {
                setShowWelcome(true);
            }, 1500); // Delay for a smoother experience

            // Cleanup the timer if the component unmounts
            return () => clearTimeout(timer);
        }
    }, []); // Empty dependency array ensures this runs only once on mount

    const handleSliderFinish = () => {
        // Set both flags to true so neither the slider nor the modal appears again this session.
        localStorage.setItem('hasVisitedQuantumLeap', 'true');
        sessionStorage.setItem('hasVisitedSession', 'true');
        setShowSlider(false);
    };

    const handleCloseWelcome = () => {
        // Set the session flag so the modal doesn't reappear on page navigation.
        sessionStorage.setItem('hasVisitedSession', 'true');
        setShowWelcome(false);
    };

    return (
        <div className="bg-light-primary dark:bg-primary">
            <Suspense fallback={<GlobalFallback />}>
                <Navbar />
            </Suspense>

            <AnimatePresence>
                {showSlider && (
                     <Suspense fallback={<div className="fixed inset-0 bg-primary z-50" />}>
                        <WelcomeSlider onFinish={handleSliderFinish} />
                     </Suspense>
                )}
            </AnimatePresence>

            {/* The welcome modal is small, so it doesn't need lazy loading */}
            {showWelcome && <WelcomeModal onClose={handleCloseWelcome} />}

            <main>
                <HeroSection />
                <LiveMarketTicker />

                <Suspense fallback={<SectionFallback />}>
                    <HowItWorksSection />
                    <FeaturesShowcase />
                    <CommunityProofSection />
                    <PlatformTrustSection />
                    <TestimonialsSection />
                    <PricingSection />
                    <CallToActionSection />
                    <FAQSection />
                </Suspense>
            </main>

            <Suspense fallback={<GlobalFallback />}>
                <Footer />
                <ChatAssistant />
            </Suspense>
        </div>
    );
};

export default HomePage;