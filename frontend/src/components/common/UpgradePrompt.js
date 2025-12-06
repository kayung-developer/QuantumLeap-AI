// frontend/src/components/common/UpgradePrompt.js
import React from 'react';
import { Link } from 'react-router-dom';
import Card from './Card';
import Button from './Button';
import { FaLock } from 'react-icons/fa';

const UpgradePrompt = ({ featureName, requiredPlan }) => {
    return (
        <Card className="border-accent">
            <div className="text-center">
                <FaLock className="mx-auto text-4xl text-accent mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">{featureName} is a Premium Feature</h3>
                <p className="text-light-gray mb-4">
                    Upgrade to the {requiredPlan} plan to unlock this and many other advanced features.
                </p>
                <Link to="/dashboard/billing">
                    <Button>Upgrade Plan</Button>
                </Link>
            </div>
        </Card>
    );
};

export default UpgradePrompt;