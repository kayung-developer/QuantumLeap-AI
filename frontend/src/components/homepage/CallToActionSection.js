import React from 'react';
import { Link } from 'react-router-dom';
import { FaArrowRight } from 'react-icons/fa';
import Section from '../common/Section';
import Button from '../common/Button';

const CallToActionSection = () => {
    return (
        <Section>
            <div className="text-center max-w-3xl mx-auto">
                <h2 className="text-4xl font-bold mb-4">Ready to Revolutionize Your Trading?</h2>
                <p className="text-light-gray text-lg mb-8">Stop trading on emotion and start leveraging the power of AI. Join thousands of traders who are automating their success.</p>
                <Link to="/register">
                    <Button variant="primary" className="text-xl px-10 py-4">
                        Sign Up Now <FaArrowRight className="ml-3" />
                    </Button>
                </Link>
            </div>
        </Section>
    );
};

export default CallToActionSection;