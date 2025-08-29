<div align="center">
  <img src="https://raw.githubusercontent.com/M-S-HYPER/quantum-leap-ai-trader-assets/main/banner.png" alt="QuantumLeap AI Trader Banner" width="800"/>
  <h1>QuantumLeap AI Trader</h1>
  <p><strong>An enterprise-grade, AI-powered algorithmic trading platform.</strong></p>
  <p>Automate strategies, build with no-code, analyze performance, and manage your portfolio with institutional-grade tools.</p>
  
  <p>
    <img src="https://img.shields.io/badge/Python-3.10%2B-blue?style=for-the-badge&logo=python" alt="Python Version">
    <img src="https://img.shields.io/badge/FastAPI-Production--Ready-green?style=for-the-badge&logo=fastapi" alt="FastAPI">
    <img src="https://img.shields.io/badge/React-18-blueviolet?style=for-the-badge&logo=react" alt="React">
    <img src="https://img.shields.io/badge/React_Native-Expo-black?style=for-the-badge&logo=react" alt="React Native">
    <img src="https://img.shields.io/badge/License-MIT-lightgrey?style=for-the-badge" alt="License">
  </p>
</div>

---

**QuantumLeap AI Trader** is a full-stack, enterprise-ready application designed to provide a comprehensive and robust platform for algorithmic cryptocurrency trading. It combines a powerful **FastAPI backend** with a sleek, responsive **React frontend** and a companion **React Native mobile app**, offering a seamless experience from strategy creation to live deployment.

This project was architected not just as a tool, but as a production-grade showcase of modern software development, integrating everything from real-time data streams and ML models to secure payments, custodial wallet management, and community-driven features.

## 🚀 The QuantumLeap Edge: Why This Platform Excels

*   **Intelligence over Automation:** Goes beyond simple bots. With **Optimus AI Mode**, the platform uses a pre-trained XGBoost model to vet trading signals against broader market conditions, preventing bad entries in volatile markets.
*   **Democratized Strategy Creation:** The **Visual Strategy Builder** provides a no-code, drag-and-drop interface, empowering non-technical traders to build, backtest, and deploy complex strategies with ease.
*   **Professional-Grade Risk & Analytics:** Control capital with advanced position sizing models (Fixed Fractional, ATR Volatility) and gain deep insights with a dedicated analytics suite, including equity curves, drawdown charts, and metrics like the Sharpe & Sortino Ratios.
*   **Complete Trading Ecosystem:** Analyze charts with TradingView, get AI-powered insights from the "Strategy Sensei" (GPT-4), manage a custodial wallet, and execute manual trades directly from an integrated terminal.
*   **Community-Powered Marketplace:** New users can subscribe to profitable, proven strategies from top traders. Creators are incentivized to build and share, creating a powerful growth loop.
*   **Cross-Platform Accessibility:** Manage your portfolio and monitor bots on the web or on the go with the fully-featured React Native mobile application.

## ✨ Core Features

| Feature | Status | Description |
| :--- | :--- | :--- |
| **🤖 Algorithmic Bots** | ✅ **Implemented** | Deploy bots for both **Spot** and **Futures** markets. |
| **🎨 Visual Strategy Builder** | ✅ **Implemented** | A no-code, drag-and-drop canvas for creating custom strategies. |
| **🧠 Optimus AI & Strategy Sensei** | ✅ **Implemented** | ML model for signal verification and GPT-powered assistant for strategy interpretation. |
| **📈 Advanced Analytics** | ✅ **Implemented** | Per-bot analytics with Equity Curves, Drawdown Charts, Sharpe/Sortino Ratios. |
| **🌐 Marketplace & Subscriptions** | ✅ **Implemented** | Creators can sell monthly access to premium strategies; users can subscribe. |
| **💰 Custodial Wallet System** | ✅ **Implemented** | Full wallet functionality for deposits, swaps, and withdrawals. |
| **📱 React Native Mobile App** | ✅ **Implemented** | A complete mobile companion for iOS and Android. |
| **🖥️ Integrated Trading Terminal**| ✅ **Implemented** | Place manual market and limit orders directly from the market analysis page. |
| **🔔 Real-time Notifications** | ✅ **Implemented** | Instant alerts via WebSockets and Telegram. |
| **🔐 Superuser Admin Panel** | ✅ **Implemented** | A full admin dashboard to manage users, monitor system health, and trigger controls. |

## 🛠️ Tech Stack

-   **Backend:** FastAPI, Python 3.10, SQLAlchemy (Async)
-   **Frontend (Web):** React 18, React Router, Tailwind CSS, React Query, Recharts, React Flow
-   **Frontend (Mobile):** React Native (Expo), React Navigation, Redux Toolkit
-   **Database:** PostgreSQL (recommended)
-   **AI/ML:** XGBoost, Scikit-learn, Pandas-TA, NLTK, OpenAI GPT-4 API
-   **Authentication:** Firebase Auth (for users), JWT (for backend sessions)
-   **Real-time:** WebSockets (FastAPI), Telegram Bot API
-   **Deployment:** Docker, Nginx (configuration examples can be added)

## ⚙️ Getting Started: Local Setup

### Prerequisites
*   Python 3.10+, Node.js 16+, Docker (optional but recommended)
*   A Firebase project for authentication.
*   API keys for services listed in `.env.example` (OpenAI, payment gateways, etc.).
*   A configured VPN is **highly recommended** to avoid network blocks from ISPs.

### 1. Backend Setup
```bash
# Navigate to the backend directory
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create your .env file from the example and fill in your keys
cp .env.example .env
nano .env # or use any text editor

# Train the AI model (requires a working network connection)
python train_model.py

# Run the backend server
uvicorn main:app --reload
```

### 2. Frontend (Web) Setup
```bash
# Navigate to the frontend directory from the root
cd frontend

# Install dependencies
npm install

# Create your .env file and add your Firebase client config
cp .env.example .env
nano .env

# Run the frontend development server
npm start
```

### 3. Frontend (Mobile) Setup
```bash
# Navigate to the mobile directory from the root
cd QuantumLeapMobile

# Install dependencies
npm install

# IMPORTANT: Update the backend IP address in src/api/axiosInstance.js
# Replace 'YOUR_BACKEND_IP' with your computer's local IP address (e.g., 192.168.1.100)

# Run the mobile app using Expo Go
npx expo start
```

## 🗺️ Advanced Future Roadmap

This platform is built for continuous evolution. The following roadmap outlines the next steps to solidify its position as a market leader.

| Phase | Feature | Description | Impact |
| :--- | :--- | :--- | :--- |
| **Platform Intelligence** | **Multi-Timeframe Analysis** | Upgrade the Optimus AI to analyze daily and weekly trends before approving trades on lower timeframes (e.g., 15m, 1h). | **Very High** |
| | **Dynamic Hedging Module** | For the custodial wallet, build a service that automatically hedges user positions on an omnibus exchange account to manage platform risk. | **Critical (for Live Custodial)** |
| | **AI Portfolio Optimizer** | A new "meta-bot" that uses ML to analyze a user's entire portfolio and bot collection, suggesting allocation adjustments to maximize risk-adjusted returns. | **Very High** |
| **User Experience** | **Live Paper Trading** | Upgrade paper trading to use a live data feed instead of historical data, providing a more realistic simulation experience. | **High** |
| | **Advanced Chart Trading** | Allow users to place orders, adjust TP/SL, and define grid bot ranges by clicking and dragging directly on the TradingView chart. | **High** |
| **Ecosystem & Growth** | **Social Trading / Copy Trading** | Allow users to automatically copy the trades of top-performing bots from the marketplace with allocated capital and risk limits. | **Very High** |
| | **Terminal for Multiple Exchanges** | Expand the Trading Terminal to connect to and trade across multiple user-connected exchanges from a single interface. | **High**|
| | **Decentralized Strategy Vaults (DeFi)** | Explore integrating with DeFi protocols to allow users to tokenize their strategies as NFTs or deposit them into secure, on-chain vaults. | **Innovative** |

## 🙌 Contributing

Contributions are the lifeblood of innovation. If you have a suggestion or a feature you'd like to build, please fork the repository and create a pull request.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---
<div align="center">
  <p>Built with passion by <strong>Slogan Technologies LLC</strong></p>
</div>
