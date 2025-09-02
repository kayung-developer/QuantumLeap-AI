// src/pages/LoginPage.js

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Alert from '../components/common/Alert';
import { motion } from 'framer-motion';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../api/firebase';
import { FaGoogle, FaUserShield } from 'react-icons/fa';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const { login, adminLogin, googleSignIn } = useAuth();

  const handleAuthAction = async (action) => {
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await action();
      // NOTE: Navigation is now handled by the AuthContext's handleLoginSuccess function.
      // This makes the flow 100% reliable.
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'An unexpected error occurred.');
      setLoading(false); // Only stop the loader on error
    }
  };

  const handleGoogleSignIn = () => handleAuthAction(googleSignIn);

  const handleSubmit = (e) => {
    e.preventDefault();
    const action = isSuperuser ? () => adminLogin(email, password) : () => login(email, password);
    handleAuthAction(action);
  };

  const handleForgotPassword = async () => {
    if (!email) return setError("Please enter your email to reset your password.");
    setError(''); setInfo('');
    try {
      await sendPasswordResetEmail(auth, email);
      setInfo("Password reset email sent! Please check your inbox.");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-light-primary dark:bg-primary text-light-text dark:text-white flex">
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
            Welcome to <span className="text-accent">QuantumLeap AI</span>
          </h1>
          <p className="text-lg text-light-muted dark:text-light-gray max-w-sm">
            Automate your trading strategies with cutting-edge AI. Precision, speed, and intelligence at your fingertips.
          </p>
        </motion.div>
      </div>

      {/* Right Login Form Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12">
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-md w-full"
        >
          <h2 className="text-3xl font-bold text-center text-light-heading dark:text-white mb-2">
            {isSuperuser ? 'Superuser Sign In' : 'Sign In'}
          </h2>
          <p className="text-center text-light-muted dark:text-light-gray mb-6">
            {isSuperuser ? 'Access the admin dashboard' : "Don't have an account yet?"}
            {!isSuperuser && (
              <Link to="/register" className="font-medium text-accent hover:underline ml-2">
                Sign up
              </Link>
            )}
          </p>

          {error && <Alert message={error} type="error" className="mb-4" />}
          {info && <Alert message={info} type="success" className="mb-4" />}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Email Address" id="email" name="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Password" id="password" name="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />

            <div className="text-right">
              <button type="button" onClick={handleForgotPassword} className="text-sm text-accent hover:underline font-medium">
                Forgot Password?
              </button>
            </div>

            <Button type="submit" isLoading={loading} className="w-full !mt-6">
              Sign In
            </Button>

            <div className="my-4 flex items-center before:flex-1 before:border-t before:border-light-border dark:before:border-border-color after:flex-1 after:border-t after:border-light-border dark:after:border-border-color">
              <p className="mx-4 text-center text-sm text-light-muted dark:text-light-gray">OR</p>
            </div>

            <Button onClick={handleGoogleSignIn} variant="secondary" className="w-full">
              <FaGoogle className="mr-3" /> Continue with Google
            </Button>
          </form>

          <div className="text-center mt-6">
            <button
              onClick={() => setIsSuperuser(!isSuperuser)}
              className="text-sm text-light-gray hover:text-accent transition-colors flex items-center mx-auto"
            >
              <FaUserShield className="mr-2" />
              {isSuperuser ? 'Switch to User Login' : 'Superuser Login'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;