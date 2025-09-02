# QuantumLeap AI Trader 🚀

**QuantumLeap AI Trader** is an institutional-grade, full-stack platform for building, backtesting, and deploying automated trading strategies for both **Cryptocurrency and Forex** markets. It features a powerful AI Co-Pilot, a secure custodial wallet system, and a flexible strategy engine powered by internal logic or external signals from TradingView.

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## ✨ Live Demo

**[quantumleap-frontend.onrender.com](https://quantumleap-frontend.onrender.com/)** _(Replace with your live frontend URL)_

| | |
| :--- | :--- |
| **Admin Email:** `admin@quantumleap.ai` | **Admin Password:** `supersecretpassword` |

## 📸 Screenshots & Gifs

| Dashboard Overview | AI Chat Assistant |
| :---: | :---: |
| ![Dashboard Overview](<./path_to_your_screenshot/dashboard.png>) | ![AI Chat Assistant](<./path_to_your_screenshot/chat_assistant.gif>) |
| **Bot Management** | **Strategy Marketplace** |
| ![Bot Management Page](<./path_to_your_screenshot/bots_page.png>) | ![Strategy Marketplace](<./path_to_your_screenshot/marketplace.png>) |

## 的核心功能 (Core Features)

*   **📈 Dual Asset Trading:** Seamlessly create and manage trading bots for both **Cryptocurrency** (e.g., BTC/USDT) and **Forex** (e.g., EUR/USD) markets.
*   **🤖 Advanced Trading Strategies:**
    *   Utilize pre-built strategies like MA Crossover, RSI & MACD, and Bollinger Bands.
    *   **TradingView Webhook Integration:** Trigger trades from any custom alert or Pine Script™ strategy on TradingView for unlimited flexibility.
    *   **MT4/5 Ready:** The backend is architected with a secure endpoint ready to receive trade signals from a future MT4/5 bridge/EA.
*   **🧠 AI-Powered Insights:**
    *   **AI Co-Pilot:** Get real-time analysis of any trading pair, powered by an XGBoost model and TradingView fallback for maximum uptime.
    *   **AI Chat Assistant:** A public-facing chatbot to answer user questions about features, pricing, and general inquiries.
    *   **Strategy Sensei:** An internal AI assistant for premium users to help them build trading strategies using natural language.
*   **🔒 Secure Wallet & Swap System:**
    *   **Custodial Wallets:** Securely deposit, store, and manage crypto assets.
    *   **Slippage Protection:** A production-grade "Quote & Confirm" swap system ensures users get the price they see, with timed quotes and no slippage.
*   **📊 Comprehensive Dashboard & Analytics:**
    *   Real-time P&L tracking for both paper and live trading bots.
    *   Live portfolio donut chart to visualize asset allocation.
    *   Interactive TradingView charts integrated directly into the dashboard.
*   **🛒 Strategy Marketplace:**
    *   Publish your own successful bots for others to use.
    *   Choose to share bots for free (cloneable) or on a monthly subscription basis.
*   **🔔 Real-time Notifications:** Stay updated with integrated **Telegram** alerts and live **WebSocket** messages for trade executions and bot status changes.
*   **🔑 Secure API Management:**
    *   Encrypt and manage API keys for external exchanges.
    *   Generate Platform API Keys for programmatic access to your account (e.g., for an MT4/5 bridge).
*   **👑 Full-Featured Admin Panel:** A superuser dashboard to manage users, view system statistics, impersonate users for support, and perform emergency actions.

## 🛠️ Tech Stack

| Category | Technology |
| :--- | :--- |
| **Frontend** | ![React](https://img.shields.io/badge/-React-61DAFB?logo=react&logoColor=white) ![TailwindCSS](https://img.shields.io/badge/-TailwindCSS-38B2AC?logo=tailwind-css&logoColor=white) ![React Query](https://img.shields.io/badge/-React%20Query-FF4154?logo=react-query&logoColor=white) ![Framer Motion](https://img.shields.io/badge/-Framer%20Motion-0055FF?logo=framer&logoColor=white) |
| **Backend** | ![FastAPI](https://img.shields.io/badge/-FastAPI-009688?logo=fastapi&logoColor=white) ![Python](https://img.shields.io/badge/-Python-3776AB?logo=python&logoColor=white) ![SQLAlchemy](https://img.shields.io/badge/-SQLAlchemy-D71F00?logo=sqlalchemy&logoColor=white) |
| **Database** | ![PostgreSQL](https://img.shields.io/badge/-PostgreSQL-4169E1?logo=postgresql&logoColor=white) |
| **AI/ML** | ![XGBoost](https://img.shields.io/badge/-XGBoost-0069B3) ![Pandas](https://img.shields.io/badge/-Pandas-150458?logo=pandas&logoColor=white) ![Google Gemini](https://img.shields.io/badge/-Google%20Gemini-8E75B2?logo=google&logoColor=white) |
| **Deployment**| ![Render](https://img.shields.io/badge/-Render-46E3B7?logo=render&logoColor=white) ![Docker](https://img.shields.io/badge/-Docker-2496ED?logo=docker&logoColor=white) |
| **Services** | ![Firebase](https://img.shields.io/badge/-Firebase-FFCA28?logo=firebase&logoColor=white) ![TradingView](https://img.shields.io/badge/-TradingView-131722?logo=tradingview&logoColor=blue) ![Telegram](https://img.shields.io/badge/-Telegram-2CA5E0?logo=telegram&logoColor=white) |

---

## 🚀 Getting Started: Local Development

Follow these instructions to set up and run the project on your local machine.

### Prerequisites

*   **Git:** [Download & Install Git](https://git-scm.com/downloads)
*   **Python:** Version 3.10+ ([Download Python](https://www.python.org/downloads/))
*   **Node.js:** Version 18+ (LTS recommended) ([Download Node.js](https://nodejs.org/))

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/quantumleap-ai-trader.git
cd quantumleap-ai-trader
```

### 2. Backend Setup

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```
2.  **Create and activate a virtual environment:**
    ```bash
    # For Windows
    python -m venv venv
    .\venv\Scripts\activate

    # For macOS/Linux
    python3 -m venv venv
    source venv/bin/activate
    ```
3.  **Install Python dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
4.  **Create and configure your `.env` file:**
    *   Rename the `example.env` file to `.env`.
    *   Fill in all the required variables as described in the **Environment Variables** section below. This is a critical step.

### 3. Frontend Setup

1.  **Navigate to the frontend directory:**
    ```bash
    # From the project root
    cd frontend
    ```2.  **Install Node.js dependencies:**
    ```bash
    npm install
    ```
3.  **Create your frontend `.env` file:**
    *   Create a file named `.env` in the `frontend` directory.
    *   Add the variable `REACT_APP_API_BASE_URL=http://localhost:8000/api`.

### 4. Running the Application

You need **3 terminals** running simultaneously.

*   **Terminal 1 (Backend Server):**
    ```bash
    # From the backend/ directory
    uvicorn main:app --reload
    ```
*   **Terminal 2 (Frontend App):**
    ```bash
    # From the frontend/ directory
    npm start
    ```
*   **Terminal 3 (Secure Tunnel for Webhooks):**
    ```bash
    # From the frontend/ directory
    npm run tunnel
    ```
    *This will provide a public URL. Use this URL when setting up TradingView alerts.*

---

## 🔑 Environment Variables

You must create and configure `.env` files for the application to work.

### Backend (`backend/.env`)

Copy the content below into `backend/.env` and fill in your secrets.

```env
# Database URL (For local dev, this is correct. For production, use your hosted DB URL)
DATABASE_URL="sqlite+aiosqlite:///./database.db"

# Security (GENERATE YOUR OWN long, random strings for these)
SECRET_KEY="<your_super_secret_jwt_key>"
API_ENCRYPTION_KEY="<your_32_character_url_safe_encryption_key>"

# Firebase (Path to your service account JSON file)
FIREBASE_CREDENTIALS_PATH="./firebase-credentials.json"

# AI Services
GOOGLE_GEMINI_API_KEY="<your_google_gemini_api_key>"

# Notifications
TELEGRAM_BOT_TOKEN="<your_telegram_bot_token>"

# TradingView (For data fallback & webhooks. Create a free account.)
TRADINGVIEW_USERNAME="<your_tradingview_username>"
TRADINGVIEW_PASSWORD="<your_tradingview_password>"
TRADINGVIEW_WEBHOOK_SECRET="<create_a_long_secret_phrase_for_alerts>"

# Superuser Admin Account
SUPERUSER_EMAIL="admin@yourapp.com"
SUPERUSER_PASSWORD="<a_very_strong_password>"

# Payment Gateways (Use sandbox keys for local dev)
PAYPAL_CLIENT_ID="<your_paypal_sandbox_client_id>"
PAYPAL_CLIENT_SECRET="<your_paypal_sandbox_secret_key>"
PAYPAL_API_BASE="https://api-m.sandbox.paypal.com"
PAYSTACK_SECRET_KEY="<your_paystack_test_secret_key>"

# Other Services
NEWS_API_KEY="<your_newsapi.org_key>"

# Email Configuration (For contact form, e.g., using Mailgun/SendGrid)
MAIL_USERNAME="<your_smtp_username>"
MAIL_PASSWORD="<your_smtp_password>"
MAIL_FROM="<noreply@yourapp.com>"
MAIL_TO="<your_support_email@yourapp.com>"
MAIL_SERVER="<smtp.yourprovider.com>"
MAIL_PORT=587
```

### Frontend (`frontend/.env`)

```env
REACT_APP_API_BASE_URL=http://localhost:8000/api
```

---

## ☁️ Deployment

This application is designed to be deployed on **Render** for a seamless, unified experience.

1.  **Deploy PostgreSQL on Render:** Create a new PostgreSQL instance to get your production `DATABASE_URL`.
2.  **Deploy Backend on Render:**
    *   Create a "Web Service" pointing to your GitHub repo.
    *   **Root Directory:** `backend`
    *   **Build Command:** `pip install -r requirements.txt`
    *   **Start Command:** Render will use the `Procfile`.
    *   Add all environment variables from your `.env` file into the Render dashboard. Use the "Secret File" option for your `firebase-credentials.json`.
3.  **Deploy Frontend on Render:**
    *   Create a "Static Site" pointing to your GitHub repo.
    *   **Root Directory:** `frontend`
    *   **Build Command:** `npm install && npm run build`
    *   **Publish Directory:** `build`
    *   Add the `REACT_APP_API_BASE_URL` environment variable, pointing to your live backend's URL.
4.  **Final Steps:**
    *   Update your **Firebase Authorized Domains** to include your live frontend URL.
    *   Update your **Payment Gateway** callback URLs.

##  webhook  ব্যবহার (Webhook Usage)

### TradingView Alert Setup

To trigger your bots from TradingView:

1.  Create a "TradingView Alert" bot in the QuantumLeap UI. It will provide you with a unique Webhook URL.
2.  In TradingView, create any alert.
3.  In the alert's "Notifications" tab, check "Webhook URL" and paste the provided URL.
4.  In the "Message" field, provide a JSON body to control the trade:

    **Basic Buy/Sell:**
    ```json
    {
      "secret": "<your_tradingview_webhook_secret>",
      "action": "buy"
    }
    ```

    **Advanced Trade with Dynamic Sizing:**
    ```json
    {
      "secret": "<your_tradingview_webhook_secret>",
      "action": "sell",
      "risk_percent": 1.5
    }
    ```

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
