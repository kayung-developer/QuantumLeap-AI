// src/pages/RegisterPage.js

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { registerUser } from '../api/apiService';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Alert from '../components/common/Alert';
import { motion } from 'framer-motion';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../api/firebase';
import { FaGoogle } from 'react-icons/fa';

const RegisterPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth(); // We only need the login function here
    const navigate = useNavigate();

    const handleGoogleSignUp = async () => {
        setLoading(true);
        setError('');
        try {
            // This signs up the user in Firebase Auth on the client.
            // Our backend will create the DB entry on the first successful login.
            await signInWithPopup(auth, googleProvider);
            // The onAuthStateChanged listener in AuthContext will handle the rest
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password.length < 6) {
            return setError("Password must be at least 6 characters long.");
        }
        if (password !== confirmPassword) {
            return setError("Passwords do not match.");
        }

        setError('');
        setLoading(true);

        try {
            // Step 1: Create the user in our backend and Firebase Auth via one API call.
            await registerUser(email, password);

            // Step 2: Automatically log the new user in.
            await login(email, password);

            // The onAuthStateChanged listener will handle navigation to the dashboard.
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Failed to register.');
            setLoading(false);
        }
    };

    return (
       <div className="min-h-screen bg-light-primary dark:bg-primary text-light-text dark:text-white flex">
            {/* Left Branding Panel (Consistent with Login Page) */}
            <div className="hidden lg:flex w-1/2 bg-light-secondary dark:bg-secondary items-center justify-center p-12 border-r border-light-border dark:border-border-color">
                <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-center"
                >
                    <Link to="/">
                        <img src="/app.png" alt="QuantumLeap Logo" className="h-20 w-20 mx-auto mb-6" />
                    </Link>
                    <h1 className="text-4xl font-bold text-light-heading dark:text-white mb-4">
                        Start Your <span className="text-accent">AI Trading</span> Journey
                    </h1>
                     <p className="text-lg text-light-muted dark:text-light-gray max-w-sm">
                        Create an account to deploy autonomous bots, analyze markets, and trade smarter, not harder.
                    </p>
                </motion.div>
            </div>

            {/* Right Registration Form Panel */}
           <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12">
                <motion.div
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8 }}
                    className="max-w-md w-full"
                >
                    <h2 className="text-3xl font-bold text-center text-light-heading dark:text-white mb-2">
                        Create an Account
                    </h2>
                    <p className="text-center text-light-muted dark:text-light-gray mb-6">
                        Already have an account?
                        <Link to="/login" className="font-medium text-accent hover:underline ml-2">
                            Sign In
                        </Link>
                    </p>

                    {error && <Alert message={error} type="error" className="mb-4" />}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input label="Email Address" id="email" name="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                        <Input label="Password (min. 6 characters)" id="password" name="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                        <Input label="Confirm Password" id="confirmPassword" name="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />

                        <Button type="submit" isLoading={loading} className="w-full !mt-6">
                            Create Account
                        </Button>

                         <div className="my-4 flex items-center before:flex-1 before:border-t before:border-light-border dark:before:border-border-color after:flex-1 after:border-t after:border-light-border dark:after:border-border-color">
                            <p className="mx-4 text-center text-sm text-light-muted dark:text-light-gray">OR</p>
                            </div>
                        <Button onClick={handleGoogleSignUp} variant="secondary" className="w-full">
                            <FaGoogle className="mr-3" /> Continue with Google
                        </Button>
                    </form>

                    <p className="text-center text-xs text-light-gray mt-6 px-4">
                        By creating an account, you agree to our
                        <Link to="/terms" className="underline hover:text-accent mx-1">Terms of Service</Link>
                        and
                        <Link to="/privacy" className="underline hover:text-accent ml-1">Privacy Policy</Link>.
                    </p>
                </motion.div>
            </div>
        </div>
    );
};

export default RegisterPage;