# QuantumLeap AI Trader - Backend
# main.py
#
# This monolithic file contains the entire backend logic for the application,
# including the FastAPI server, database models, API endpoints, trading logic,
# AI/ML integrations, and payment processing.
# --- Core Libraries ---
# ==============================================================================
# 1. STANDARD PYTHON LIBRARIES
# ==============================================================================
import abc
import asyncio
import base64
import datetime
import hashlib
import hmac
import itertools
import json
import logging
import os
import random
import secrets
import smtplib
import time
from abc import ABC, abstractmethod
from contextlib import asynccontextmanager
from decimal import Decimal, getcontext, InvalidOperation
from collections import defaultdict
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from enum import Enum as PythonEnum
from sqlite3 import IntegrityError
from typing import Annotated, Any, AsyncGenerator, Dict, List, Literal, Optional
from uuid import UUID as PythonUUID
from uuid import uuid4

import nltk
import xgboost as xgb

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
# ==============================================================================
# 2. FASTAPI & WEB STACK
# ==============================================================================
from fastapi import (APIRouter, BackgroundTasks, Body, Depends, FastAPI, Header,
                     HTTPException, Query, Request, WebSocket,
                     WebSocketDisconnect, status, UploadFile, File)
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer
from pydantic import (BaseModel, ConfigDict, EmailStr, Field, field_validator,  model_validator )


# ==============================================================================
# 3. DATABASE (SQLALCHEMY)
# ==============================================================================
from sqlalchemy import (Boolean, Column, DateTime, Float, ForeignKey, Integer,
                        Numeric, String, Text, UUID, and_)
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.future import select
from sqlalchemy.orm import (declarative_base, relationship, selectinload,
                            sessionmaker)
from sqlalchemy.sql import func

# ==============================================================================
# 4. SECURITY & AUTHENTICATION
# ==============================================================================
import firebase_admin
import pyotp
import qrcode
from cryptography.fernet import Fernet
from firebase_admin import auth, credentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from dotenv import load_dotenv
load_dotenv() # Explicitly load the .env file
from pydantic_settings import BaseSettings
# ==============================================================================
# 5. TRADING, DATA ANALYSIS & AI/ML
# ==============================================================================
import ccxt.async_support as ccxt
import google.generativeai as genai
import joblib
import numpy as np
import pandas as pd
import MetaTrader5 as mt5
import threading
from asyncio import Lock
# ==============================================================================
# 6. THIRD-PARTY SERVICES & UTILITIES
# ==============================================================================
import aiohttp
import cloudinary
import cloudinary.uploader
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy.sql.functions import user
from telegram import Update, User as TelegramUser
from telegram.error import InvalidToken
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes
from tradingview_ta import TA_Handler, Interval
from celery_worker import celery_app
from tasks import run_optimization_task, run_single_backtest_task, send_email_task, send_telegram_notification_task
from celery.result import AsyncResult
try:
    import onnxruntime as ort
    ai_models_available = True
except ImportError:
    ai_models_available = False
    ort = None

# ==============================================================================
# 1. CONFIGURATION
# ==============================================================================

getcontext().prec = 28  # Set precision for Decimal calculations
# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- NLTK Data Check and Download ---
REQUIRED_NLTK_PACKAGES = {
    "vader_lexicon": "sentiment/vader_lexicon.zip",
    "punkt": "tokenizers/punkt.zip"
}

for package_id, package_path in REQUIRED_NLTK_PACKAGES.items():
    try:
        nltk.data.find(package_path)
        logger.info(f"NLTK package '{package_id}' is already installed.")
    except LookupError:
        logger.info(f"NLTK package '{package_id}' not found. Downloading...")
        try:
            # nltk.download(package_id, quiet=True)
            logger.info(f"Successfully downloaded NLTK package: '{package_id}'.")
        except Exception as e:
            logger.error(f"Failed to download NLTK package '{package_id}': {e}")


class Settings(BaseSettings):
    # --- Core Secrets (MUST be set in Render) ---
    DATABASE_URL: str
    SECRET_KEY: str
    API_ENCRYPTION_KEY: str

    # --- Firebase Configuration ---
    FIREBASE_CREDS_B64: str

    # --- API Keys & Secrets ---
    PAYPAL_CLIENT_ID: str
    PAYPAL_CLIENT_SECRET: str
    PAYSTACK_SECRET_KEY: str
    FLUTTERWAVE_SECRET_KEY: str
    NEWS_API_KEY: str
    BITGO_API_KEY: str
    GOOGLE_GEMINI_API_KEY: str
    TELEGRAM_BOT_TOKEN: str
    TRADINGVIEW_WEBHOOK_SECRET: str
    BITGO_WEBHOOK_SECRET: str
    TRADINGVIEW_USERNAME: str
    TRADINGVIEW_PASSWORD: str

    # --- Superuser Credentials (MUST be set in Render) ---
    SUPERUSER_EMAIL: EmailStr
    SUPERUSER_PASSWORD: str

    # --- Application Configuration (MUST be set in Render) ---
    BASE_URL: str
    PLATFORM_USER_ID: str
    TELEGRAM_ADMIN_CHAT_ID: str

    # --- Custodial Service Config ---
    BITGO_API_BASE_URL: str
    BITGO_WALLET_ID_BTC: str
    BITGO_WALLET_ID_ETH: str

    # --- Email Configuration ---
    MAIL_USERNAME: str
    MAIL_PASSWORD: str
    MAIL_FROM: EmailStr
    MAIL_TO: EmailStr
    MAIL_SERVER: str
    MAIL_PORT: int

    # --- Static Defaults (Safe to keep in code) ---
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    PAYPAL_API_BASE: str = "https://api-m.sandbox.paypal.com"

    CLOUDINARY_CLOUD_NAME: str
    CLOUDINARY_API_KEY: str
    CLOUDINARY_API_SECRET: str

    # --- Optional Keys (Can be omitted from environment) ---
    BINANCE_API_KEY: Optional[str] = None
    BINANCE_API_SECRET: Optional[str] = None
    # --- Local Dev Fallback (Not needed in Render) ---
    FIREBASE_CREDENTIALS_PATH: Optional[str] = None


    class Config:
        env_file = ".env"

settings = Settings()



# ==============================================================================
# 2. AI/ML MODEL LOADING
# ==============================================================================
onnx_session = None
scaler = None

def load_ai_models():
    """
    Loads the ONNX model and scaler for the AI strategy during application startup.
    This function now correctly uses the 'global' keyword and the correct variable name.
    """
    # --- THE FIX: Declare that we are modifying the global variables ---
    global onnx_session, scaler, ai_models_available

    # --- THE FIX: Use the correct variable name 'ai_models_available' ---
    if not ai_models_available:
        logger.warning("onnxruntime is not installed. All AI-based strategies will be disabled.")
        return

    try:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        # Assuming your AI models are in a /models subfolder
        onnx_path = os.path.join(current_dir, 'models', 'lgbm_signal_model.onnx')
        scaler_path = os.path.join(current_dir, 'models', 'scaler.pkl')

        if os.path.exists(onnx_path) and os.path.exists(scaler_path):
            onnx_session = ort.InferenceSession(onnx_path)
            scaler = joblib.load(scaler_path)
            logger.info("AI/ML models for AiEnhancedSignalStrategy loaded successfully.")
        else:
            logger.warning("AI/ML model files not found in the /models directory. AiEnhancedSignalStrategy will be disabled.")
            ai_models_available = False # Update global state if files are missing
    except Exception as e:
        logger.error(f"Could not load AI/ML models due to an error: {e}", exc_info=True)
        ai_models_available = False # Update global state on error


# ==============================================================================
# 2. CORE INFRASTRUCTURE INITIALIZATION
# ==============================================================================
limiter = Limiter(key_func=get_remote_address)
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
try:
    SUPERUSER_PASSWORD_HASH = pwd_context.hash(settings.SUPERUSER_PASSWORD)
    logger.info("Superuser password hash created successfully.")
except Exception as e:
    logger.critical(f"!!! FAILED TO HASH SUPERUSER PASSWORD: {e}. Superuser login will fail. !!!")
    SUPERUSER_PASSWORD_HASH = None
fernet = Fernet(settings.API_ENCRYPTION_KEY.encode())
engine = create_async_engine(settings.DATABASE_URL)
async_session_maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

try:
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True
    )
    logger.info("Cloudinary SDK configured successfully.")
except Exception as e:
    logger.error(f"FATAL: Failed to configure Cloudinary SDK: {e}", exc_info=True)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session

# Robust Firebase Initialization
try:
    logger.info("Initializing Firebase Admin SDK...")
    firebase_creds_b64 = settings.FIREBASE_CREDS_B64

    if firebase_creds_b64:
        logger.info("Found FIREBASE_CREDS_B64 env var. Decoding for production.")
        decoded_creds = base64.b64decode(firebase_creds_b64)
        cred_dict = json.loads(decoded_creds)
        cred = credentials.Certificate(cred_dict)
    elif settings.FIREBASE_CREDENTIALS_PATH:
        logger.warning("FIREBASE_CREDS_B64 not found. Using local file path for Firebase credentials.")
        cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
    else:
        raise ValueError("Firebase credentials not found. Set either FIREBASE_CREDS_B64 or FIREBASE_CREDENTIALS_PATH.")

    firebase_admin.initialize_app(cred)
    logger.info("Firebase Admin SDK initialized successfully.")
except Exception as e:
    logger.error("FATAL: Failed to initialize Firebase Admin SDK. Authentication will fail.", exc_info=True)
    # This error is critical. We re-raise it to prevent the app from starting in a broken state.
    raise e


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Dict[str, Any]] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        # Initialize with no symbol being viewed.
        self.active_connections[user_id] = {"websocket": websocket, "viewing_symbol": None}
        logger.info(f"User {user_id} connected via WebSocket.")

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.info(f"User {user_id} disconnected from WebSocket.")

    # NEW METHOD: Called by the frontend to subscribe to a chart's data.
    def subscribe_to_symbol(self, user_id: str, symbol: str):
        if user_id in self.active_connections:
            self.active_connections[user_id]["viewing_symbol"] = symbol.upper()
            logger.info(f"User {user_id} is now viewing symbol: {symbol.upper()}")

    # NEW METHOD: Called by the frontend when the user navigates away from the chart.
    def unsubscribe_from_symbol(self, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id]["viewing_symbol"] = None
            logger.info(f"User {user_id} stopped viewing a symbol.")

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            websocket = self.active_connections[user_id]["websocket"]
            try:
                await websocket.send_json(message)
            except WebSocketDisconnect:
                self.disconnect(user_id)
            except Exception as e:
                logger.error(f"Error sending message to user {user_id}: {e}")

    async def broadcast(self, message: dict):
        # This is for global announcements
        disconnected_users = []
        # Create a list of connections to iterate over to avoid issues with dict size changes
        connections = list(self.active_connections.items())
        for user_id, connection in connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected_users.append(user_id)

        for user_id in disconnected_users:
            self.disconnect(user_id)

    async def broadcast_to_symbol_viewers(self, symbol: str, message: dict):
        """Broadcasts a message only to users currently viewing the specified symbol."""
        # This is a deep copy to avoid race conditions if the dict is modified during iteration.
        connections = list(self.active_connections.items())

        for user_id, connection_data in connections:
            if connection_data["viewing_symbol"] == symbol.upper():
                await self.send_personal_message(message, user_id)


websocket_manager = ConnectionManager()


# ==============================================================================
# 3. DATABASE MODELS (SQLAlchemy ORM) - V2 (Custodial Ledger Syst
# ==============================================================================

# --- NEW: Enum for supported exchanges, including MT4/5 ---
class ExchangeName(str, PythonEnum):
    BINANCE = "binance"
    BYBIT = "bybit"
    KUCOIN = "kucoin"
    OKX = "okx"
    MT4 = "mt4"
    MT5 = "mt5"

class MarketDataStatus(str, PythonEnum):
    OPERATIONAL = "OPERATIONAL"  # Data is flowing successfully.
    DEGRADED = "DEGRADED"      # The system is running on a fallback (e.g., TradingView).
    OUTAGE = "OUTAGE"          # All primary and fallback sources have failed.
MARKET_DATA_HEALTH: Dict[str, str] = {"status": MarketDataStatus.OUTAGE.value, "source": "Initializing..."}

class PositionSizingStrategy(str, PythonEnum):
    FIXED_AMOUNT = "fixed_amount"
    FIXED_FRACTIONAL = "fixed_fractional"
    ATR_VOLATILITY_TARGET = "atr_volatility_target"


class SubscriptionPlan(str, PythonEnum):
    BASIC = "basic"
    PREMIUM = "premium"
    ULTIMATE = "ultimate"


class UserRole(str, PythonEnum):
    USER = "user"
    SUPERUSER = "superuser"


# --- NEW: Transaction Model (Immutable Log) ---
class TransactionType(str, PythonEnum):
    DEPOSIT = "DEPOSIT"
    WITHDRAWAL = "WITHDRAWAL"
    SWAP = "SWAP"
    TRADE = "TRADE"
    FEE = "FEE"
    SUBSCRIPTION = "SUBSCRIPTION"


# --- NEW: Bot Trading Mode ---
class BotMode(str, PythonEnum): CUSTODIAL = "custodial"; NON_CUSTODIAL = "non_custodial"


class TransactionStatus(str, PythonEnum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class StrategyType(str, PythonEnum):
    PREBUILT = "prebuilt"
    VISUAL = "visual"


class BotPublishType(str, PythonEnum):
    PRIVATE = "private"
    PUBLIC_FREE = "public_free"
    SUBSCRIPTION = "subscription"


class SubscriptionStatus(str, PythonEnum):
    ACTIVE = "active"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class OrderSide(str, PythonEnum):
    BUY = "buy"
    SELL = "sell"

class PublishType(str, PythonEnum):
    PRIVATE = "private"
    PUBLIC_FREE = "public_free"
    SUBSCRIPTION = "subscription"

class OrderType(str, PythonEnum):
    MARKET = "market"
    LIMIT = "limit"
    STOP_LIMIT = "stop_limit"


# --- NEW: Market Regime Service ---
class MarketRegime(str, PythonEnum):
    BULLISH = "BULLISH"
    BEARISH = "BEARISH"
    SIDEWAYS = "SIDEWAYS"


class MarketType(str, PythonEnum):
    SPOT = "spot"
    FUTURE = "future"


class OptimizationStatus(str, PythonEnum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class AssetClass(str, PythonEnum):
    CRYPTO = "crypto"
    FOREX = "forex"


class NotificationType(str, PythonEnum):
    NEW_USER = "new_user"
    BOT_ERROR = "bot_error"
    PAYMENT_SUCCESS = "payment_success"
    PAYMENT_FAILURE = "payment_failure"
    INFO = "info"

class UserProfile(Base):
    __tablename__ = "user_profiles"
    user_id = Column(String, ForeignKey("users.id"), primary_key=True)

    first_name = Column(String(50))
    last_name = Column(String(50))
    # URL to the profile picture, hosted on a service like Cloudinary or S3
    profile_picture_url = Column(String(255), nullable=True)
    country = Column(String(100), nullable=True)
    phone_number = Column(String(20), nullable=True)

    # Establish the one-to-one relationship
    user = relationship("User", back_populates="profile")


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    role = Column(String(10), default=UserRole.USER.value, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    subscription_plan = Column(String(10), default=SubscriptionPlan.BASIC.value)
    subscription_expires_at = Column(DateTime(timezone=True), nullable=True)
    # --- NEW: Telegram Chat ID for notifications ---
    telegram_chat_id = Column(String, nullable=True, unique=True)

    token_version = Column(Integer, nullable=False, default=0)
    is_otp_enabled = Column(Boolean, default=False, nullable=False)
    otp_secret_encrypted = Column(String, nullable=True)
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    api_keys = relationship("UserAPIKey", back_populates="user", cascade="all, delete-orphan")
    trading_bots = relationship("TradingBot", back_populates="owner", cascade="all, delete-orphan")
    trade_logs = relationship("TradeLog", back_populates="user", cascade="all, delete-orphan")
    wallets = relationship("Wallet", back_populates="owner", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    withdrawal_accounts = relationship("WithdrawalAccount", back_populates="user", cascade="all, delete-orphan")

    def is_subscription_active(self):
        # --- FIX: Refined subscription logic from final review ---
        if self.role == UserRole.SUPERUSER.value:
            return True

        if self.subscription_plan == SubscriptionPlan.BASIC.value:
            return self.subscription_expires_at is None or self.subscription_expires_at > datetime.datetime.now(
                datetime.timezone.utc)

        if self.subscription_expires_at and self.subscription_expires_at > datetime.datetime.now(datetime.timezone.utc):
            return True

        return False


# --- NEW: Wallet Model ---
class Wallet(Base):
    __tablename__ = "wallets"
    # A user has one wallet row for each asset they hold.
    user_id = Column(String, ForeignKey("users.id"), primary_key=True)
    asset = Column(String(10), primary_key=True)  # e.g., 'BTC', 'USDT', 'USD', 'NGN'
    # Use Numeric for precision to avoid floating-point errors.
    # Precision=28, Scale=18 is suitable for most crypto assets.
    balance = Column(Numeric(28, 18), nullable=False, default=0)
    owner = relationship("User", back_populates="wallets")


class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(UUID, primary_key=True, default=uuid4)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    type = Column(String(20), nullable=False)  # From TransactionType enum
    status = Column(String(20), nullable=False, default=TransactionStatus.COMPLETED.value)
    asset = Column(String(10), nullable=False)
    amount = Column(Numeric(28, 18), nullable=False)  # Can be positive (credit) or negative (debit)
    # Context for the transaction
    related_asset = Column(String(10), nullable=True)  # For swaps/trades, the other asset
    related_amount = Column(Numeric(28, 18), nullable=True)
    exchange_rate = Column(Numeric(28, 18), nullable=True)
    fee = Column(Numeric(28, 18), nullable=True, default=0)
    notes = Column(Text, nullable=True)  # e.g., withdrawal address, deposit hash
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    user = relationship("User", back_populates="transactions")


# --- NEW: Withdrawal Account Model ---
class WithdrawalAccount(Base):
    __tablename__ = "withdrawal_accounts"
    id = Column(UUID, primary_key=True, default=uuid4)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    currency = Column(String(10), nullable=False)  # e.g., 'NGN', 'USD'
    account_details_encrypted = Column(Text, nullable=False)  # Encrypted JSON of bank details
    user = relationship("User", back_populates="withdrawal_accounts")


class TradingBot(Base):
    __tablename__ = "trading_bots"
    id = Column(UUID, primary_key=True, default=uuid4)
    name = Column(String, nullable=False)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    strategy_name = Column(String, nullable=True)
    strategy_params = Column(Text, nullable=True)
    symbol = Column(String, nullable=False)
    exchange = Column(String, nullable=False)  # Will now store values from ExchangeName enum
    is_active = Column(Boolean, default=False)
    is_paper_trading = Column(Boolean, default=False)
    use_dynamic_sizing = Column(Boolean, default=False)  # NEW COLUMN
    mode = Column(String, default=BotMode.NON_CUSTODIAL.value, nullable=False)
    market_regime_filter_enabled = Column(Boolean, default=False)
    # --- NEW: Fields for Advanced Order Management ---
    take_profit_percentage = Column(Float, nullable=True)
    stop_loss_percentage = Column(Float, nullable=True)
    # --- NEW: Fields to track the state of an active position ---
    active_position_id = Column(String, nullable=True, unique=True)  # The ID of the entry trade/order
    active_position_entry_price = Column(Float, nullable=True)
    active_position_amount = Column(Float, nullable=True)
    active_exit_order_id = Column(String, nullable=True)  # The ID of the linked OCO or SL/TP order
    # --- NEW: Field for Optimus Mode ---
    optimus_enabled = Column(Boolean, default=False)
    # --- NEW: Fields for Advanced Position Sizing ---
    sizing_strategy = Column(String, default=PositionSizingStrategy.FIXED_AMOUNT.value)
    sizing_params = Column(Text, nullable=True)  # JSON string for params like {"risk_percentage": 1.5}
    # --- NEW: Fields for Strategy Marketplace ---
    is_public = Column(Boolean, default=False, index=True)
    description = Column(Text, nullable=True)
    # --- NEW: Fields for Marketplace Subscriptions ---
    publish_type = Column(String, default=BotPublishType.PRIVATE.value, nullable=False)
    price_usd_monthly = Column(Float, nullable=True)
    # This will store a JSON snapshot of the latest backtest results
    # for quick loading in the marketplace, avoiding re-calculation on every view.
    backtest_results_cache = Column(Text, nullable=True)
    clone_count = Column(Integer, default=0)
    # --- NEW: Fields for Real P&L Tracking ---
    live_pnl_usd = Column(Float, default=0.0)
    paper_pnl_usd = Column(Float, default=0.0)
    # --- NEW: Fields for Visual Strategy Builder ---
    strategy_type = Column(String, default=StrategyType.PREBUILT.value, nullable=False)
    # This will store the JSON graph from the frontend builder
    visual_strategy_json = Column(Text, nullable=True)
    # --- NEW: Field for cached performance analytics ---
    performance_analytics_cache = Column(Text, nullable=True)
    # --- NEW: Fields for Futures Trading ---
    market_type = Column(String, default=MarketType.SPOT.value, nullable=False)
    leverage = Column(Integer, default=1, nullable=False)
    asset_class = Column(String, default=AssetClass.CRYPTO.value, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    payments = relationship("Payment", back_populates="strategy_bot", foreign_keys="Payment.strategy_bot_id")
    webhook_id = Column(String, unique=True, index=True, nullable=True)
    owner = relationship("User", back_populates="trading_bots")


class UserAPIKey(Base):
    __tablename__ = "user_api_keys"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    exchange = Column(String, nullable=False)
    api_key_encrypted = Column(String, nullable=False)
    secret_key_encrypted = Column(String, nullable=False)
    asset_class = Column(String, default=AssetClass.CRYPTO.value, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    user = relationship("User", back_populates="api_keys")
    __table_args__ = ({"sqlite_autoincrement": True} if "sqlite" in settings.DATABASE_URL else {})


class TradeLog(Base):
    __tablename__ = "trade_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    bot_id = Column(UUID, ForeignKey("trading_bots.id"), nullable=True)
    exchange = Column(String, nullable=False)
    symbol = Column(String, nullable=False)
    order_id = Column(String, unique=True, index=True)
    side = Column(String, nullable=False)
    type = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    price = Column(Float, nullable=False)
    cost = Column(Float, nullable=False)
    timestamp = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    is_paper_trade = Column(Boolean, default=False, nullable=False)
    user = relationship("User", back_populates="trade_logs")


class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    reference = Column(String, unique=True, index=True, nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String, nullable=False)
    gateway = Column(String, nullable=False)
    status = Column(String, default="pending", nullable=False)
    plan_purchased = Column(String(50), nullable=False)
    strategy_bot_id = Column(UUID, ForeignKey("trading_bots.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    strategy_bot = relationship("TradingBot", back_populates="payments", foreign_keys=[strategy_bot_id])


class PlatformAPIKey(Base):
    __tablename__ = "platform_api_keys"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    key_prefix = Column(String(11), unique=True, nullable=False)
    key_hash = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

class StrategySubscription(Base):
    __tablename__ = "strategy_subscriptions"
    id = Column(UUID, primary_key=True, default=uuid4)
    subscriber_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    strategy_bot_id = Column(UUID, ForeignKey("trading_bots.id"), nullable=False, index=True)
    status = Column(String, default=SubscriptionStatus.ACTIVE.value, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    payment_id = Column(Integer, ForeignKey("payments.id"), nullable=False)
    subscriber = relationship("User")
    strategy_bot = relationship("TradingBot")

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(UUID, primary_key=True, default=uuid4)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    type = Column(String(50), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class MT5Credentials(Base):
    __tablename__ = "mt5_credentials"
    id = Column(Integer, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), unique=True, nullable=False)
    account_number = Column(String, nullable=False)
    password_encrypted = Column(String, nullable=False)
    server = Column(String, nullable=False)

    user = relationship("User")


class SerialNumber(Base):
    __tablename__ = "serial_numbers"
    id = Column(Integer, primary_key=True)
    serial_key = Column(String, unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)
    # When activated, we store a hash of the machine ID to lock the key to that machine.
    machine_id_hash = Column(String, nullable=True, unique=True) 
    activated_at = Column(DateTime(timezone=True), nullable=True)
    created_by_user_id = Column(String, ForeignKey("users.id")) # Link to the superuser who created it
# ==============================================================================
# 4. PYDANTIC SCHEMAS (Data Transfer Objects)
# ==============================================================================

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


class TokenData(BaseModel):
    uid: str | None = None
    role: UserRole | None = None
    ver: int | None = None


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class TwoFactorChallenge(BaseModel):
    message: str
    two_factor_token: str

class UserProfileSchema(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    profile_picture_url: Optional[str] = None
    country: Optional[str] = None
    phone_number: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class UserSchema(BaseModel):
    id: str
    email: EmailStr
    role: UserRole
    subscription_plan: SubscriptionPlan
    subscription_expires_at: Optional[datetime.datetime] = None
    telegram_chat_id: Optional[str] = None
    is_otp_enabled: bool
    model_config = ConfigDict(from_attributes=True)


# This schema will be used to show the user's full details
class FullUserSchema(UserSchema):
    profile: Optional[UserProfileSchema] = None


class UserProfileUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=2, max_length=50)
    last_name: Optional[str] = Field(None, min_length=2, max_length=50)
    country: Optional[str] = Field(None, max_length=100)
    phone_number: Optional[str] = Field(None, max_length=20)


class SuperuserLoginSchema(BaseModel):
    email: EmailStr
    password: str


class APIKeyCreate(BaseModel):
    exchange: str
    api_key: str
    secret_key: str
    asset_class: AssetClass = AssetClass.CRYPTO


class APIKeySchema(BaseModel):
    id: int
    exchange: str
    api_key_masked: str
    asset_class: AssetClass
    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)


# Schema for showing the key ONCE upon creation
class PlatformAPIKeyCreateResponse(BaseModel):
    id: int
    key_prefix: str
    full_key: str  # This is only ever sent once
    created_at: datetime.datetime
    message: str = "This is your API key. Please store it securely as you will not be able to see it again."


class TradingBotCreate(BaseModel):
    name: str
    symbol: str

    # --- FIX 1: Provide a default value ---
    # We default to 'binance' as it's the most common. The frontend can override this.
    exchange: ExchangeName = ExchangeName.BINANCE

    # --- FIX 2: Provide a default value ---
    # Most trades will be crypto.
    asset_class: AssetClass = AssetClass.CRYPTO

    strategy_type: StrategyType = StrategyType.PREBUILT
    market_type: MarketType = MarketType.SPOT
    is_paper_trading: bool = True

    # --- FIX 3: Make strategy-specific fields optional ---
    # A bot can't be both prebuilt and visual at the same time.
    strategy_name: Optional[str] = None
    strategy_params: Optional[Dict[str, Any]] = None
    visual_strategy_json: Optional[Dict[str, Any]] = None

    take_profit_percentage: Optional[float] = Field(None, gt=0)
    stop_loss_percentage: Optional[float] = Field(None, gt=0)
    leverage: int = Field(1, gt=0, le=125)
    market_regime_filter_enabled: bool = False
    optimus_enabled: bool = False

    @model_validator(mode='after')
    def check_strategy_fields(self) -> 'TradingBotCreate':
        if self.strategy_type == StrategyType.PREBUILT and not self.strategy_name:
            raise ValueError('A `strategy_name` is required for prebuilt strategies.')
        if self.strategy_type == StrategyType.VISUAL and self.visual_strategy_json is None:
            raise ValueError('`visual_strategy_json` is required for visual strategies.')
        return self

class SuperuserLoginRequest(BaseModel):
    email: EmailStr
    password: str

class TradingBotSchema(BaseModel):
    id: PythonUUID
    name: str
    owner_id: str
    strategy_name: Optional[str] = None
    strategy_params: Optional[Dict[str, Any]] = None
    symbol: str
    exchange: str
    is_active: bool
    is_paper_trading: bool
    market_regime_filter_enabled: bool
    created_at: datetime.datetime
    asset_class: AssetClass
    take_profit_percentage: Optional[float] = None
    stop_loss_percentage: Optional[float] = None
    optimus_enabled: bool
    strategy_type: StrategyType
    visual_strategy_json: Optional[Dict[str, Any]] = None
    live_pnl_usd: float
    paper_pnl_usd: float
    is_public: bool
    description: Optional[str] = None
    backtest_results_cache: Optional[Dict[str, Any]] = None
    market_type: MarketType
    leverage: int

    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)

    # ================================================================= #
    # =========== THIS IS THE ONLY PART CAUSING THE CRASH ============= #
    # By replacing this, we guarantee the fix. The validator below is  #
    # 100% compliant with Pydantic V2.                                  #
    # ================================================================= #
    @field_validator('strategy_params', 'visual_strategy_json', 'backtest_results_cache', mode='before')
    @classmethod
    def parse_json_strings(cls, v: Any) -> Optional[Dict]:
        if isinstance(v, str):
            if not v: return None
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return None
        return v


class PlatformAPIKeySchema(BaseModel):
    """
    Schema for safely returning Platform API Key information to the frontend.
    It intentionally omits the sensitive key_hash.
    """
    id: int
    user_id: str
    key_prefix: str
    is_active: bool

    # --- THE FIX ---
    # This tells Pydantic to read data from the attributes of the SQLAlchemy model.
    model_config = ConfigDict(from_attributes=True)

# --- NEW: Telegram Schemas ---
class TelegramLinkResponse(BaseModel):
    link_code: str
    bot_username: str  # e.g., @YourTraderBot


# --- NEW: Strategy Optimization Schemas ---
class StrategyOptimizationRequest(BaseModel):
    strategy_name: str
    parameter_ranges: Dict[str, List[Any]]  # e.g., {"short_window": [10, 20], "long_window": [50, 100]}
    symbol: str
    exchange: str
    start_date: str
    end_date: str


class OptimizationTaskResponse(BaseModel):
    task_id: str
    message: str


class OptimizationResult(BaseModel):
    params: Dict[str, Any]
    metrics: Dict[str, Any]


class OptimizationStatusResponse(BaseModel):
    task_id: str
    status: OptimizationStatus
    progress: float  # 0.0 to 1.0
    results: Optional[List[OptimizationResult]] = None
    error: Optional[str] = None


class TradeLogSchema(BaseModel):
    id: int
    bot_id: Optional[PythonUUID] = None  # Use the standard Python UUID type
    exchange: str
    symbol: str
    order_id: str
    side: str
    type: str
    amount: float
    price: float
    cost: float
    timestamp: datetime.datetime
    is_paper_trade: bool
    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)


class PaymentRequest(BaseModel):
    plan: SubscriptionPlan


class PaymentInitResponse(BaseModel):
    payment_url: str
    reference: str
    gateway: str


class BacktestRequest(BaseModel):
    strategy_name: str
    strategy_params: Dict[str, Any]
    symbol: str
    exchange: str
    start_date: str
    end_date: str


class WalletSchema(BaseModel):
    asset: str
    balance: Decimal
    model_config = ConfigDict(from_attributes=True)


class SwapRequest(BaseModel):
    from_asset: str
    to_asset: str
    amount: Decimal  # Amount of the `from_asset` to swap

    @field_validator('amount')
    def amount_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError('Amount must be positive')
        return v


class SwapQuoteResponse(BaseModel):
    quote_id: str
    user_id: str
    from_asset: str
    to_asset: str
    amount_in: Decimal
    amount_out: Decimal
    rate: Decimal
    fee: Decimal
    expires_at: datetime.datetime


class SwapExecuteRequest(BaseModel):
    quote_id: str


class SwapExecuteResponse(BaseModel):
    transaction_id: PythonUUID
    from_asset: str
    to_asset: str
    amount_debited: Decimal
    amount_credited: Decimal


class TransactionSchema(BaseModel):
    id: PythonUUID
    type: TransactionType
    status: TransactionStatus
    asset: str
    amount: Decimal
    related_asset: Optional[str] = None
    related_amount: Optional[Decimal] = None
    fee: Optional[Decimal] = None
    notes: Optional[str] = None
    created_at: datetime.datetime
    model_config = ConfigDict(from_attributes=True)


class DepositAddressResponse(BaseModel):
    asset: str;
    address: str;
    memo: Optional[str] = None;
    blockchain: str


class WithdrawalAccountCreate(BaseModel):
    currency: str;
    account_details: Dict[str, str]


class WithdrawalAccountSchema(BaseModel):
    id: PythonUUID;
    currency: str;
    account_details_masked: Dict[str, str]
    model_config = ConfigDict(from_attributes=True)


class WithdrawalRequest(BaseModel):
    account_id: PythonUUID;
    amount: Decimal

    @field_validator('amount')
    def amount_must_be_positive(cls, v):
        if v <= 0: raise ValueError('Amount must be positive'); return v


class WithdrawalResponse(BaseModel):
    transaction_id: PythonUUID;
    status: str;
    message: str


# --- Pydantic Schemas for Analysis ---
class StrategyComparisonRequest(BaseModel):
    symbol: str
    exchange: str
    start_date: str  # YYYY-MM-DD
    end_date: str  # YYYY-MM-DD


class BacktestResultSchema(BaseModel):
    strategy: str
    params: dict
    total_return_pct: float
    sharpe_ratio: float
    max_drawdown_pct: float
    total_trades: int
    final_portfolio_value: float


class PublicStrategyAuthorSchema(BaseModel):
    # A minimal schema to show the author without exposing sensitive details
    first_name: Optional[str] = "Anonymous"
    profile_picture_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PublicStrategySchema(BaseModel):
    # This is the main schema for a card in the marketplace
    id: PythonUUID
    name: str
    description: Optional[str] = None
    strategy_name: str
    symbol: str
    backtest_results_cache: Optional[Dict[str, Any]] = None
    clone_count: int
    owner: PublicStrategyAuthorSchema  # Nested schema for the author
    publish_type: BotPublishType
    price_usd_monthly: Optional[float] = None

    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)

    @field_validator('backtest_results_cache', mode='before')
    @classmethod
    def parse_backtest_cache(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return {}
        return v


class SingleBacktestRequest(BaseModel):
    strategy_name: str
    params: Dict[str, Any]
    symbol: str
    exchange: str
    start_date: str
    end_date: str


class PublicBotPerformanceSchema(BaseModel):
    # Bot Details
    name: str
    description: Optional[str] = None
    strategy_name: str
    symbol: str

    # Performance Stats from Cache
    backtest_results_cache: Optional[Dict[str, Any]] = None

    # Live Trade History
    trade_logs: List[TradeLogSchema]  # We can reuse the existing TradeLogSchema

    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)

    @field_validator('backtest_results_cache', mode='before')
    @classmethod
    def parse_backtest_cache(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return {}
        return v


class ManualOrderCreate(BaseModel):
    exchange: str
    symbol: str
    side: OrderSide
    type: OrderType
    amount: float = Field(..., gt=0)
    price: Optional[float] = Field(None, gt=0)  # Required for LIMIT and STOP_LIMIT
    stop_price: Optional[float] = Field(None, gt=0)  # Required for STOP_LIMIT
    asset_class: AssetClass

    @model_validator(mode='after')
    def check_price_for_limit_order(self) -> 'ManualOrderCreate':
        """
        Ensures that if the order type is 'limit', a price is provided.
        """
        if self.order_type == OrderType.LIMIT and self.price is None:
            raise ValueError('Price is required for limit orders.')
        return self


class OpenOrderSchema(BaseModel):
    id: str
    symbol: str
    side: str
    type: str
    amount: float
    price: float
    filled: float
    status: str
    timestamp: datetime.datetime

    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)


class ContactFormRequest(BaseModel):
    name: str = Field(..., max_length=100)
    email: EmailStr
    message: str = Field(..., max_length=5000)


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str
    role: UserRole = UserRole.USER
    subscription_plan: SubscriptionPlan = SubscriptionPlan.BASIC


class AdminUserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[UserRole] = None
    subscription_plan: Optional[SubscriptionPlan] = None


class TopStrategySchema(BaseModel):
    name: str
    owner_name: Optional[str] = Field("Anonymous", alias='owner.profile.first_name')
    # Use paper_pnl for consistency, as live bots might have negative PNL
    pnl: float = Field(0.0, alias='paper_pnl_usd')

    class Config:
        from_attributes = True
        populate_by_name = True


class CommunityStatsSchema(BaseModel):
    total_users: int
    bots_created: int
    top_strategies: List[TopStrategySchema]


class TickerSchema(BaseModel):
    price: float
    change: float


class MarketTickerResponseSchema(BaseModel):
    data: Dict[str, TickerSchema]


class BotPublishRequest(BaseModel):
    publish_type: BotPublishType
    description: Optional[str] = Field(None, max_length=500)
    backtest_results: Dict[str, Any]
    price_usd_monthly: Optional[float] = Field(None, gt=0)

    @model_validator(mode='after')
    def check_price_for_subscription(self) -> 'BotPublishRequest':
        """
        Ensures that if the publish type is 'subscription', a price is provided.
        """
        if self.publish_type == PublishType.SUBSCRIPTION and self.price_usd_monthly is None:
            raise ValueError('A price is required for subscription-based strategies.')
        return self


class StrategySubscriptionSchema(BaseModel):
    id: PythonUUID
    strategy_bot_id: PythonUUID
    status: SubscriptionStatus
    expires_at: datetime.datetime
    strategy_bot_name: str = Field(..., alias='strategy_bot.name')
    strategy_bot_symbol: str = Field(..., alias='strategy_bot.symbol')

    class Config:
        from_attributes = True
        populate_by_name = True  # Allows using aliases like 'strategy_bot.name'


class WebhookPayload(BaseModel):
    """Pydantic model for validating the incoming TradingView alert payload."""
    secret: str
    action: str = Field(..., pattern="^(buy|sell|close_long|close_short|close_all)$")
    # Optional: Allow TradingView to specify the trade size in the alert
    size_usd: Optional[float] = Field(None, gt=0)


# --- NEW: Pydantic Schema for incoming MT4/5 signals ---
class MT5TradeSignal(BaseModel):
    bot_id: PythonUUID
    symbol: str
    action: str  # Should be "buy" or "sell"
    price: float
    volume: float
    order_id: str  # The unique order ID from the MT4/5 terminal

class TwoFactorSetupResponse(BaseModel):
    otp_secret: str; otp_uri: str; qr_code_svg: str

class TwoFactorVerificationRequest(BaseModel):
    token: str

class TwoFactorLoginRequest(BaseModel):
    two_factor_token: str; token: str


class ChatRequest(BaseModel):
    message: str = Field(..., max_length=1000)
    history: Optional[List[Dict[str, str]]] = []



class NotificationSchema(BaseModel):
    id: PythonUUID
    type: NotificationType
    message: str
    is_read: bool
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class MT5CredentialsCreate(BaseModel):
    account_number: int
    password: str
    server: str

class MT5CredentialsSchema(BaseModel):
    id: int
    account_number: int
    server: str
    model_config = ConfigDict(from_attributes=True)


class SerialNumberSchema(BaseModel):
    id: int
    serial_key: str
    is_active: bool
    machine_id_hash: Optional[str] = None
    activated_at: Optional[datetime.datetime] = None

    model_config = ConfigDict(from_attributes=True)


class SerialNumberActivateRequest(BaseModel):
    serial_key: str = Field(..., description="The full serial key provided to the user.")
    machine_id: str = Field(..., description="A unique hardware identifier from the user's machine.")

# ==============================================================================
# 5. SECURITY & AUTHENTICATION UTILITIES
# ==============================================================================

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/token")


def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.now(datetime.timezone.utc) + expires_delta
    else:
        expire = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    expires = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = data.copy()
    to_encode.update({"exp": expires})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: AsyncSession = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = await db.get(User, user_id)
    if user is None:
        raise credentials_exception

    if not user.is_subscription_active():
        if user.subscription_plan != SubscriptionPlan.BASIC.value:
            # Only deactivate bots if the plan is not basic (which might have different rules)
            bots_to_deactivate_result = await db.execute(
                select(TradingBot).where(TradingBot.owner_id == user.id, TradingBot.is_active == True))
            bots_to_deactivate = bots_to_deactivate_result.scalars().all()
            for bot in bots_to_deactivate:
                bot.is_active = False
                logger.info(f"Deactivating bot {bot.id} for user {user.id} due to expired subscription.")
            await db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your subscription has expired. Please renew to continue using the service."
        )
    return user



async def get_current_superuser(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    if current_user.role != UserRole.SUPERUSER.value:
        raise HTTPException(status_code=403, detail="The user doesn't have enough privileges")
    return current_user


def require_plan(required_plans: List[SubscriptionPlan]):
    async def _require_plan(current_user: User = Depends(get_current_user)):
        if current_user.role == UserRole.SUPERUSER.value:
            return
        if current_user.subscription_plan not in [p.value for p in required_plans]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This feature requires one of the following plans: {[p.value for p in required_plans]}. Your current plan is {current_user.subscription_plan}."
            )

    return _require_plan


require_premium_plan = require_plan([SubscriptionPlan.PREMIUM, SubscriptionPlan.ULTIMATE])
require_ultimate_plan = require_plan([SubscriptionPlan.ULTIMATE])


# --- NEW: Security dependency to authenticate requests from external platforms like MT4/5 ---
async def get_user_from_platform_api_key(authorization: str = Header(...), db: AsyncSession = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing Platform API Key",
        headers={"WWW-Authenticate": "Bearer"},
    )
    scheme, _, token = authorization.partition(' ')
    if scheme.lower() != 'bearer' or not token:
        raise credentials_exception

    try:
        prefix = "ql_" + token.split('_')[1]
    except IndexError:
        raise credentials_exception

    key_entry = await db.scalar(
        select(PlatformAPIKey).where(PlatformAPIKey.key_prefix == prefix, PlatformAPIKey.is_active == True))
    if not key_entry or not pwd_context.verify(token, key_entry.key_hash):
        raise credentials_exception

    user = await db.get(User, key_entry.user_id)
    if not user:
        raise credentials_exception
    return user

app_state = {}
# ==============================================================================
# 7. TRADING STRATEGY LOGIC & IMPLEMENTATION (PORTED FROM strategies.py)
# ==============================================================================
def create_ml_features(df: pd.DataFrame) -> pd.DataFrame:
    """Helper function to create features for the AI model."""
    df_copy = df.copy()
    df_copy.ta.rsi(length=14, append=True, col_names=('feature_rsi',))
    atr = df_copy.ta.atr(length=14)
    bbands = df_copy.ta.bbands(length=20)
    macd = df_copy.ta.macd()

    df_copy = pd.concat([df_copy, macd], axis=1)
    df_copy['feature_atr_norm'] = atr / df_copy['close']
    df_copy['feature_bb_width'] = (bbands['BBU_20_2.0'] - bbands['BBL_20_2.0']) / bbands['BBM_20_2.0']
    feature_cols = [col for col in df_copy.columns if 'feature_' in col or 'MACD_' in col]
    valid_feature_cols = [col for col in feature_cols if col in df_copy.columns]
    return df_copy[valid_feature_cols].dropna().reset_index(drop=True)


# --- Base Strategy Class ---
class TradingSignal:
    def __init__(self, action: Literal["BUY", "SELL", "HOLD", "CLOSE"], confidence: float = 1.0, reason: str = ""):
        self.action = action;
        self.confidence = confidence;
        self.reason = reason


class AbstractStrategy(abc.ABC):
    def __init__(self, strategy_id: int, symbol: str, timeframe: str, parameters: Dict[str, Any],
                 state: Dict[str, Any]):
        self.strategy_id = strategy_id;
        self.symbol = symbol;
        self.timeframe = timeframe;
        self.parameters = parameters;
        self.state = state
        self.ohlcv = None

    def update_data(self, ohlcv: pd.DataFrame): self.ohlcv = ohlcv

    @abc.abstractmethod
    def generate_signal(self) -> TradingSignal: pass

    def get_state(self) -> Dict[str, Any]: return self.state

    @staticmethod
    @abc.abstractmethod
    def get_parameter_schema() -> BaseModel: pass



# ==============================================================================
# PARAMETER SCHEMAS (using Pydantic for validation and defaults)
# ==============================================================================

class BaseStrategyParams(BaseModel):
    """Base parameters shared by all strategies for consistent risk management."""
    risk_percent: float = Field(1.0, ge=0.1, le=5.0, description="Risk per trade as a percentage of account equity.")
    atr_sl_multiplier: float = Field(2.0, ge=0.5, description="Multiplier for ATR to set the stop loss distance.")
    max_volume_per_trade: float = Field(5.0, ge=0.01, description="Absolute maximum lot size allowed for any single trade.")
    rr_ratio: float = Field(1.5, ge=0.5, le=10.0, description="Risk/Reward ratio for setting the Take Profit.")

class EmaCrossAtrParams(BaseModel):
    long_period: int = Field(50, gt=10, le=200);
    atr_period: int = Field(14, gt=5, le=50);
    atr_multiplier: float = Field(0.5, ge=0.1, le=5.0)


class EmaCrossAtrStrategy(AbstractStrategy):
    @staticmethod
    def get_parameter_schema() -> BaseModel: return EmaCrossAtrParams

    def generate_signal(self) -> TradingSignal:
        """Generates a signal for the live trade loop using the last few bars."""
        # For live trading, we only need a small slice of data
        df_slice = self.ohlcv.tail(self.parameters['long_period'] + 5).copy()
        df_with_signal = self._generate_signals_vectorized(df_slice, self.parameters)
        signal = df_with_signal['signal'].iloc[-1]
        action = "BUY" if signal == 1 else "SELL" if signal == -1 else "HOLD"
        return TradingSignal(action)

    @staticmethod
    def _generate_signals_vectorized(df: pd.DataFrame, p: dict) -> pd.DataFrame:
        """Generates signals for an entire DataFrame (for backtesting)."""
        df_out = df.copy()
        df_out['ema_long'] = df_out['close'].ewm(span=p['long_period'], adjust=False).mean()
        # A fixed fast period is more stable for pure vectorization
        fast_period = int(p['long_period'] / 2)
        df_out['ema_fast'] = df_out['close'].ewm(span=fast_period, adjust=False).mean()

        crossover = (df_out['ema_fast'] > df_out['ema_long']) & \
                    (df_out['ema_fast'].shift(1) <= df_out['ema_long'].shift(1))
        crossunder = (df_out['ema_fast'] < df_out['ema_long']) & \
                     (df_out['ema_fast'].shift(1) >= df_out['ema_long'].shift(1))

        df_out['signal'] = np.where(crossover, 1, np.where(crossunder, -1, 0))
        return df_out


class SmcOrderBlockFvgParams(BaseModel):
    atr_multiplier: float = Field(2.5, gt=1.0, description="Multiplier for ATR to define a strong 'impulse' candle.")
    risk_percent: float = Field(1.0, ge=0.1, le=5.0)
    atr_sl_multiplier: float = Field(1.5, ge=0.5)


class SmcOrderBlockFvgStrategy(AbstractStrategy):
    @staticmethod
    def get_parameter_schema() -> BaseModel:
        return SmcOrderBlockFvgParams

    def generate_signal(self) -> TradingSignal:
        """
        Generates a single signal for the live trade loop. This logic is inherently iterative.
        """
        df = self.ohlcv.copy()
        p = self.parameters

        # Calculate True Range (TR)
        high_low = df['high'] - df['low']
        high_prev_close = (df['high'] - df['close'].shift()).abs()
        low_prev_close = (df['low'] - df['close'].shift()).abs()

        tr = pd.concat([high_low, high_prev_close, low_prev_close], axis=1).max(axis=1)

        # Calculate Average True Range (ATR) using Exponential Moving Average
        atr_col_name = f"ATRr_14"
        df[atr_col_name] = tr.ewm(alpha=1 / 14, adjust=False).mean()

        df['impulse'] = (df['high'] - df['low']) > (df[atr_col_name] * p['atr_multiplier'])

        unmitigated_zones = []
        # Iterate backwards from the second to last candle
        for i in range(len(df) - 2, 2, -1):
            # Bullish FVG
            if df['low'].iloc[i] > df['high'].iloc[i - 2]:
                fvg_top, fvg_bottom = df['low'].iloc[i], df['high'].iloc[i - 2]
                if not (df['low'].iloc[i + 1:].min() <= fvg_top):
                    unmitigated_zones.append({'type': 'demand', 'top': fvg_top, 'bottom': fvg_bottom, 'reason': 'FVG'})
            # Bearish FVG
            elif df['high'].iloc[i] < df['low'].iloc[i - 2]:
                fvg_top, fvg_bottom = df['low'].iloc[i - 2], df['high'].iloc[i]
                if not (df['high'].iloc[i + 1:].max() >= fvg_bottom):
                    unmitigated_zones.append({'type': 'supply', 'top': fvg_top, 'bottom': fvg_bottom, 'reason': 'FVG'})
            # Bullish Order Block
            if df['impulse'].iloc[i] and df['close'].iloc[i] > df['open'].iloc[i]:
                ob_candle = df.iloc[i - 1]
                if ob_candle['close'] < ob_candle['open']:
                    ob_top, ob_bottom = ob_candle['high'], ob_candle['low']
                    if not (df['low'].iloc[i + 1:].min() <= ob_top):
                        unmitigated_zones.append(
                            {'type': 'demand', 'top': ob_top, 'bottom': ob_bottom, 'reason': 'Order Block'})
            # Bearish Order Block
            if df['impulse'].iloc[i] and df['close'].iloc[i] < df['open'].iloc[i]:
                ob_candle = df.iloc[i - 1]
                if ob_candle['close'] > ob_candle['open']:
                    ob_top, ob_bottom = ob_candle['high'], ob_candle['low']
                    if not (df['high'].iloc[i + 1:].max() >= ob_bottom):
                        unmitigated_zones.append(
                            {'type': 'supply', 'top': ob_top, 'bottom': ob_bottom, 'reason': 'Order Block'})

        if not unmitigated_zones:
            return TradingSignal("HOLD")

        latest_zone = unmitigated_zones[0]
        current_price = df['close'].iloc[-1]

        if latest_zone['type'] == 'demand' and latest_zone['bottom'] <= current_price <= latest_zone['top']:
            return TradingSignal("BUY", reason=f"Entering Demand Zone ({latest_zone['reason']})")

        if latest_zone['type'] == 'supply' and latest_zone['bottom'] <= current_price <= latest_zone['top']:
            return TradingSignal("SELL", reason=f"Entering Supply Zone ({latest_zone['reason']})")

        return TradingSignal("HOLD")

    @staticmethod
    def _generate_signals_vectorized(df: pd.DataFrame, p: dict) -> pd.DataFrame:
        # This is a hybrid approach for backtesting complex pattern-based strategies
        df_out = df.copy()
        signals = [0] * len(df_out)
        temp_strategy = SmcOrderBlockFvgStrategy(0, "", "", p, {})
        # This loop is slow but necessary for pattern-based logic in a backtest
        for i in range(200, len(df_out)):
            # On each iteration, pass an expanding slice of the DataFrame
            temp_strategy.update_data(df_out.iloc[0:i])
            signal_obj = temp_strategy.generate_signal()
            if signal_obj.action == "BUY":
                signals[i] = 1
            elif signal_obj.action == "SELL":
                signals[i] = -1
        df_out['signal'] = signals
        return df_out


class RsiBbMeanReversionParams(BaseModel):
    rsi_period: int = Field(14, gt=5, le=50);
    bb_period: int = Field(20, gt=10, le=100);
    bb_std_dev: float = Field(2.0, gt=0.5, le=5.0)
    oversold: int = Field(30, gt=0, lt=50);
    overbought: int = Field(70, gt=50, lt=100)


class RsiBbMeanReversionStrategy(AbstractStrategy):
    @staticmethod
    def get_parameter_schema() -> BaseModel: return RsiBbMeanReversionParams

    def generate_signal(self) -> TradingSignal:
        df_slice = self.ohlcv.tail(self.parameters['bb_period'] + 5).copy()
        df_with_signal = self._generate_signals_vectorized(df_slice, self.parameters)
        signal = df_with_signal['signal'].iloc[-1]
        action = "BUY" if signal == 1 else "SELL" if signal == -1 else "HOLD"
        return TradingSignal(action)

    @staticmethod
    def _generate_signals_vectorized(df: pd.DataFrame, p: dict) -> pd.DataFrame:
        df_out = df.copy()
        df_out.ta.rsi(length=p['rsi_period'], append=True)
        df_out.ta.bbands(length=p['bb_period'], std=p['bb_std_dev'], append=True)

        rsi_col = f"RSI_{p['rsi_period']}"
        bbl_col = f"BBL_{p['bb_period']}_{p['bb_std_dev']}"
        bbu_col = f"BBU_{p['bb_period']}_{p['bb_std_dev']}"

        buy_cond = (df_out[rsi_col] < p['oversold']) & (df_out['close'] <= df_out[bbl_col])
        sell_cond = (df_out[rsi_col] > p['overbought']) & (df_out['close'] >= df_out[bbu_col])

        df_out['signal'] = np.where(buy_cond, 1, np.where(sell_cond, -1, 0))
        return df_out


class SuperTrendAdxParams(BaseModel):
    st_period: int = Field(10, gt=3, description="Lookback period for the SuperTrend ATR calculation.")
    st_multiplier: float = Field(3.0, gt=0.5, description="Multiplier for the ATR to define the SuperTrend bands.")
    adx_period: int = Field(14, gt=5, description="Lookback period for the ADX.")
    adx_threshold: int = Field(25, gt=10, description="ADX must be above this value to confirm a trend.")
    risk_percent: float = Field(1.0, ge=0.1, le=5.0)
    atr_sl_multiplier: float = Field(2.0, ge=0.5)


class SuperTrendAdxStrategy(AbstractStrategy):
    @staticmethod
    def get_parameter_schema() -> BaseModel: return SuperTrendAdxParams

    def generate_signal(self) -> TradingSignal:
        df_slice = self.ohlcv.tail(self.parameters['st_period'] + self.parameters['adx_period']).copy()
        df_with_signal = self._generate_signals_vectorized(df_slice, self.parameters)
        signal = df_with_signal['signal'].iloc[-1]
        action = "BUY" if signal == 1 else "SELL" if signal == -1 else "CLOSE" if signal == 2 else "HOLD"
        return TradingSignal(action)

    @staticmethod
    def _generate_signals_vectorized(df: pd.DataFrame, p: dict) -> pd.DataFrame:
        df_out = df.copy()
        df_out.ta.supertrend(length=p['st_period'], multiplier=p['st_multiplier'], append=True)
        df_out.ta.adx(length=p['adx_period'], append=True)

        st_dir_col = next(
            (col for col in df_out.columns if col.startswith(f"SUPERTd_{p['st_period']}_{p['st_multiplier']}")), None)
        adx_col = next((col for col in df_out.columns if col.startswith('ADX_')), None)
        if not st_dir_col or not adx_col: raise KeyError("Could not find SuperTrend/ADX columns.")

        trending = df_out[adx_col] > p['adx_threshold']
        buy_flip = (df_out[st_dir_col] == 1) & (df_out[st_dir_col].shift(1) == -1)
        sell_flip = (df_out[st_dir_col] == -1) & (df_out[st_dir_col].shift(1) == 1)

        # Signal 1 for Buy, -1 for Sell, 2 for an exit signal (trend flip), 0 for Hold
        df_out['signal'] = np.where(trending & buy_flip, 1,
                                    np.where(trending & sell_flip, -1, np.where(buy_flip | sell_flip, 2, 0)))
        return df_out


class IchimokuBreakoutParams(BaseModel):
    tenkan_period: int = Field(9, gt=1)
    kijun_period: int = Field(26, gt=1)
    senkou_period: int = Field(52, gt=1)
    chikou_period: int = Field(26, gt=1)  # Add Chikou for confirmation
    risk_percent: float = Field(1.0, ge=0.1, le=5.0)
    atr_sl_multiplier: float = Field(2.5, ge=0.5)


class IchimokuBreakoutStrategy(AbstractStrategy):
    @staticmethod
    def get_parameter_schema() -> BaseModel: return IchimokuBreakoutParams

    def generate_signal(self) -> TradingSignal:
        df_slice = self.ohlcv.tail(self.parameters['senkou_period'] + self.parameters['chikou_period']).copy()
        df_with_signal = self._generate_signals_vectorized(df_slice, self.parameters)
        signal = df_with_signal['signal'].iloc[-1]
        action = "BUY" if signal == 1 else "SELL" if signal == -1 else "HOLD"
        return TradingSignal(action)

    @staticmethod
    def _generate_signals_vectorized(df: pd.DataFrame, p: dict) -> pd.DataFrame:
        df_out = df.copy()
        ichimoku_df, _ = df_out.ta.ichimoku(tenkan=p['tenkan_period'], kijun=p['kijun_period'],
                                            senkou=p['senkou_period'], chikou=p['chikou_period'])
        df_out = df_out.join(ichimoku_df)

        isa_col = next((col for col in df_out.columns if col.startswith('ISA_')), None)
        isb_col = next((col for col in df_out.columns if col.startswith('ISB_')), None)
        ics_col = next((col for col in df_out.columns if col.startswith('ICS_')), None)
        if not all([isa_col, isb_col, ics_col]): raise KeyError("Could not find Ichimoku columns.")

        cloud_top = df_out[[isa_col, isb_col]].max(axis=1)
        cloud_bottom = df_out[[isa_col, isb_col]].min(axis=1)

        price_breakout_up = (df_out['close'].shift(1) <= cloud_top.shift(1)) & (df_out['close'] > cloud_top)
        chikou_confirm_up = df_out[ics_col] > cloud_top
        cloud_confirm_up = df_out[isa_col] > df_out[isb_col]
        buy_cond = price_breakout_up & chikou_confirm_up & cloud_confirm_up

        price_breakout_down = (df_out['close'].shift(1) >= cloud_bottom.shift(1)) & (df_out['close'] < cloud_bottom)
        chikou_confirm_down = df_out[ics_col] < cloud_bottom
        cloud_confirm_down = df_out[isa_col] < df_out[isb_col]
        sell_cond = price_breakout_down & chikou_confirm_down & cloud_confirm_down

        df_out['signal'] = np.where(buy_cond, 1, np.where(sell_cond, -1, 0))
        return df_out


# Overall Best Strategy: because of this analysis on all strategies (comparison)
class OptimizerPortfolioParams(BaseModel):
    # User selects which strategies to include in the portfolio
    strategy_pool: List[Literal[
        "EmaCrossAtr", "RsiBbMeanReversion", "MacdAdxTrend", "VolatilitySqueeze",
        "AiEnhancedSignal", "SmcOrderBlockFvg", "SuperTrendAdx", "IchimokuBreakout"
    ]]
    trend_filter_period: int = Field(200, gt=50,
                                     description="EMA period to determine the overall market regime (trend).")
    min_confluence: int = Field(1, ge=1, le=5,
                                description="The minimum number of strategies that must agree for a signal to be considered.")
    risk_percent: float = Field(0.5, ge=0.1, le=5.0, description="Risk for trades executed by the optimizer.")
    atr_sl_multiplier: float = Field(2.0, ge=0.5)


class OptimizerPortfolioStrategy(AbstractStrategy):
    @staticmethod
    def get_parameter_schema() -> BaseModel:
        return OptimizerPortfolioParams

    def generate_signal(self) -> TradingSignal:
        """Generates a single signal for the live trade loop."""
        # For live trading, the original iterative approach is more robust for complex patterns.
        # This part of the code is correct and does not need to change.
        # ... (The full implementation of the original, iterative `generate_signal` method goes here)
        p = self.parameters
        all_signals = []
        ohlcv_copy = self.ohlcv.copy()
        for strategy_name in p['strategy_pool']:
            StrategyClass = STRATEGY_REGISTRY.get(strategy_name)
            if not StrategyClass or StrategyClass == OptimizerPortfolioStrategy: continue
            sub_strategy_params = StrategyClass.get_parameter_schema()().model_dump()
            sub_strategy = StrategyClass(self.strategy_id, self.symbol, self.timeframe, sub_strategy_params, {})
            sub_strategy.update_data(ohlcv_copy)
            signal = sub_strategy.generate_signal()
            if signal.action in ["BUY", "SELL"]: all_signals.append(signal)
        if not all_signals: return TradingSignal("HOLD")
        master_df = self.ohlcv.copy()
        # --- MODIFIED LINE: Replaced pta.ema with pandas equivalent ---
        master_df['long_ema'] = master_df['close'].ewm(span=p.get('trend_filter_period', 200), adjust=False).mean()
        market_is_uptrend = master_df['close'].iloc[-1] > master_df['long_ema'].iloc[-1]
        market_is_downtrend = master_df['close'].iloc[-1] < master_df['long_ema'].iloc[-1]
        buy_signals = [s for s in all_signals if s.action == "BUY"]
        sell_signals = [s for s in all_signals if s.action == "SELL"]
        final_signal = "HOLD"
        final_reason = ""
        highest_score = 0
        if len(buy_signals) >= p['min_confluence']:
            score = 0
            score += len(buy_signals) * 10
            if market_is_uptrend:
                score += 20
            elif market_is_downtrend:
                score -= 10
            if score > highest_score: highest_score = score; final_signal = "BUY"; final_reason = f"Optimizer Signal (Score: {score:.0f})"
        if len(sell_signals) >= p['min_confluence']:
            score = 0
            score += len(sell_signals) * 10
            if market_is_downtrend:
                score += 20
            elif market_is_uptrend:
                score -= 10
            if score > highest_score: final_signal = "SELL"; final_reason = f"Optimizer Signal (Score: {score:.0f})"
        return TradingSignal(final_signal, reason=final_reason)

    @staticmethod
    def _generate_signals_vectorized(df: pd.DataFrame, p: dict) -> pd.DataFrame:
        """
        Generates signals for the ENTIRE DataFrame for backtesting.
        This is the DEFINITIVE, self-contained, and robust implementation using pure pandas.
        """
        df_out = df.copy()

        # --- 1. Define all possible sub-strategy logic vectorially inside this function ---

        def calc_ema_cross(df: pd.DataFrame, params: dict) -> pd.Series:
            long_period = params.get('long_period', 50)
            fast_period = int(long_period / 2)
            ema_long = df['close'].ewm(span=long_period, adjust=False).mean()
            ema_fast = df['close'].ewm(span=fast_period, adjust=False).mean()
            crossover = (ema_fast > ema_long) & (ema_fast.shift(1) <= ema_long.shift(1))
            crossunder = (ema_fast < ema_long) & (ema_fast.shift(1) >= ema_long.shift(1))
            return pd.Series(np.where(crossover, 1, np.where(crossunder, -1, 0)), index=df.index)

        def calc_rsi_bb_reversion(df: pd.DataFrame, params: dict) -> pd.Series:
            # RSI Calculation
            rsi_period = params.get('rsi_period', 14)
            delta = df['close'].diff(1)
            gain = delta.where(delta > 0, 0).fillna(0)
            loss = -delta.where(delta < 0, 0).fillna(0)
            avg_gain = gain.ewm(com=rsi_period - 1, min_periods=rsi_period).mean()
            avg_loss = loss.ewm(com=rsi_period - 1, min_periods=rsi_period).mean()
            rs = avg_gain / avg_loss
            rsi = 100 - (100 / (1 + rs))
            rsi = rsi.replace([np.inf, -np.inf], 100).fillna(50)  # Fill initial NaNs with neutral 50

            # Bollinger Bands Calculation
            bb_period = params.get('bb_period', 20)
            bb_std_dev = params.get('bb_std_dev', 2.0)
            middle_band = df['close'].rolling(window=bb_period).mean()
            std_dev = df['close'].rolling(window=bb_period).std()
            bbl = middle_band - (std_dev * bb_std_dev)
            bbu = middle_band + (std_dev * bb_std_dev)

            buy_cond = (rsi < params.get('oversold', 30)) & (df['close'] <= bbl)
            sell_cond = (rsi > params.get('overbought', 70)) & (df['close'] >= bbu)
            return pd.Series(np.where(buy_cond, 1, np.where(sell_cond, -1, 0)), index=df.index)

        def calc_macd_adx_trend(df: pd.DataFrame, params: dict) -> pd.Series:
            # MACD Calculation
            ema_fast = df['close'].ewm(span=params.get('macd_fast', 12), adjust=False).mean()
            ema_slow = df['close'].ewm(span=params.get('macd_slow', 26), adjust=False).mean()
            macd_line = ema_fast - ema_slow
            macds_line = macd_line.ewm(span=params.get('macd_signal', 9), adjust=False).mean()

            # ADX Calculation
            adx_period = params.get('adx_period', 14)
            high, low, close = df['high'], df['low'], df['close']
            tr = pd.concat([high - low, abs(high - close.shift(1)), abs(low - close.shift(1))], axis=1).max(axis=1)
            atr = tr.ewm(com=adx_period - 1, min_periods=adx_period).mean()

            dm_plus = ((high - high.shift(1)) > (low.shift(1) - low)) * (high - high.shift(1))
            dm_minus = ((low.shift(1) - low) > (high - high.shift(1))) * (low.shift(1) - low)
            dm_plus[dm_plus < 0] = 0
            dm_minus[dm_minus < 0] = 0

            s_dm_plus = dm_plus.ewm(com=adx_period - 1, min_periods=adx_period).mean()
            s_dm_minus = dm_minus.ewm(com=adx_period - 1, min_periods=adx_period).mean()

            with np.errstate(divide='ignore', invalid='ignore'):
                di_plus = 100 * (s_dm_plus / atr)
                di_minus = 100 * (s_dm_minus / atr)
                dx = 100 * (abs(di_plus - di_minus) / (di_plus + di_minus))
            adx = dx.ewm(com=adx_period - 1, min_periods=adx_period).mean().fillna(0)

            trending = adx > params.get('adx_threshold', 25)
            crossover = (macd_line > macds_line) & (macd_line.shift(1) <= macds_line.shift(1))
            crossunder = (macd_line < macds_line) & (macd_line.shift(1) >= macds_line.shift(1))

            buy_cond = trending & crossover
            sell_cond = trending & crossunder
            return pd.Series(np.where(buy_cond, 1, np.where(sell_cond, -1, 0)), index=df.index)

        def calc_volatility_squeeze(df: pd.DataFrame, params: dict) -> pd.Series:
            # Bollinger Bands
            bb_period = params.get('bb_period', 20)
            bb_middle = df['close'].rolling(window=bb_period).mean()
            bb_std_dev = df['close'].rolling(window=bb_period).std()
            bbl = bb_middle - (bb_std_dev * params.get('bb_std', 2.0))
            bbu = bb_middle + (bb_std_dev * params.get('bb_std', 2.0))

            # Keltner Channels
            kc_period = params.get('kc_period', 20)
            kc_ema = df['close'].ewm(span=kc_period, adjust=False).mean()
            tr = pd.concat(
                [df['high'] - df['low'], abs(df['high'] - df['close'].shift(1)), abs(df['low'] - df['close'].shift(1))],
                axis=1).max(axis=1)
            atr = tr.ewm(span=kc_period, adjust=False).mean()
            kcu = kc_ema + (atr * params.get('kc_atr_mult', 1.5))
            kcl = kc_ema - (atr * params.get('kc_atr_mult', 1.5))

            squeeze_on = (bbl > kcl) & (bbu < kcu)
            squeeze_release = ~squeeze_on & squeeze_on.shift(1)
            buy_cond = squeeze_release & (df['close'] > bbu)
            sell_cond = squeeze_release & (df['close'] < bbl)
            return pd.Series(np.where(buy_cond, 1, np.where(sell_cond, -1, 0)), index=df.index)

        def calc_supertrend_adx(df: pd.DataFrame, params: dict) -> pd.Series:
            # Note: A correct SuperTrend calculation is iterative. This implementation uses a loop
            # to match the logic of standard libraries, as a pure vector approach is often inaccurate.
            st_period = params.get('st_period', 10)
            st_multiplier = params.get('st_multiplier', 3.0)
            high, low, close = df['high'], df['low'], df['close']

            tr = pd.concat([high - low, abs(high - close.shift(1)), abs(low - close.shift(1))], axis=1).max(axis=1)
            atr = tr.ewm(com=st_period - 1, min_periods=st_period).mean()

            hl2 = (high + low) / 2
            upper_band = hl2 + (st_multiplier * atr)
            lower_band = hl2 - (st_multiplier * atr)

            st_direction = pd.Series(1, index=df.index)
            for i in range(1, len(df)):
                if close.iloc[i - 1] > upper_band.iloc[i - 1]:
                    st_direction.iloc[i] = 1
                elif close.iloc[i - 1] < lower_band.iloc[i - 1]:
                    st_direction.iloc[i] = -1
                else:
                    st_direction.iloc[i] = st_direction.iloc[i - 1]
                    if st_direction.iloc[i] == 1 and lower_band.iloc[i] < lower_band.iloc[i - 1]:
                        lower_band.iloc[i] = lower_band.iloc[i - 1]
                    if st_direction.iloc[i] == -1 and upper_band.iloc[i] > upper_band.iloc[i - 1]:
                        upper_band.iloc[i] = upper_band.iloc[i - 1]

            # Re-use ADX logic
            adx_period = params.get('adx_period', 14)
            tr_adx = pd.concat([high - low, abs(high - close.shift(1)), abs(low - close.shift(1))], axis=1).max(axis=1)
            atr_adx = tr_adx.ewm(com=adx_period - 1, min_periods=adx_period).mean()
            dm_plus = ((high - high.shift(1)) > (low.shift(1) - low)) * (high - high.shift(1))
            dm_minus = ((low.shift(1) - low) > (high - high.shift(1))) * (low.shift(1) - low)
            dm_plus[dm_plus < 0] = 0
            dm_minus[dm_minus < 0] = 0
            s_dm_plus = dm_plus.ewm(com=adx_period - 1, min_periods=adx_period).mean()
            s_dm_minus = dm_minus.ewm(com=adx_period - 1, min_periods=adx_period).mean()
            with np.errstate(divide='ignore', invalid='ignore'):
                di_plus = 100 * (s_dm_plus / atr_adx)
                di_minus = 100 * (s_dm_minus / atr_adx)
                dx = 100 * (abs(di_plus - di_minus) / (di_plus + di_minus))
            adx = dx.ewm(com=adx_period - 1, min_periods=adx_period).mean().fillna(0)

            trending = adx > params.get('adx_threshold', 25)
            buy_flip = (st_direction == 1) & (st_direction.shift(1) == -1)
            sell_flip = (st_direction == -1) & (st_direction.shift(1) == 1)
            return pd.Series(np.where(trending & buy_flip, 1, np.where(trending & sell_flip, -1, 0)), index=df.index)

        def calc_ichimoku_breakout(df: pd.DataFrame, params: dict) -> pd.Series:
            high, low, close = df['high'], df['low'], df['close']
            tenkan_period = params.get('tenkan_period', 9)
            kijun_period = params.get('kijun_period', 26)
            senkou_period = params.get('senkou_period', 52)
            chikou_period = params.get('chikou_period', 26)

            tenkan_sen = (high.rolling(window=tenkan_period).max() + low.rolling(window=tenkan_period).min()) / 2
            kijun_sen = (high.rolling(window=kijun_period).max() + low.rolling(window=kijun_period).min()) / 2
            chikou_span = close.shift(-chikou_period)
            senkou_span_a = ((tenkan_sen + kijun_sen) / 2).shift(kijun_period)
            senkou_span_b = (
                        (high.rolling(window=senkou_period).max() + low.rolling(window=senkou_period).min()) / 2).shift(
                kijun_period)

            cloud_top = pd.concat([senkou_span_a, senkou_span_b], axis=1).max(axis=1)
            cloud_bottom = pd.concat([senkou_span_a, senkou_span_b], axis=1).min(axis=1)

            price_breakout_up = (df['close'].shift(1) <= cloud_top.shift(1)) & (df['close'] > cloud_top)
            chikou_confirm_up = chikou_span > cloud_top
            cloud_confirm_up = senkou_span_a > senkou_span_b
            buy_cond = price_breakout_up & chikou_confirm_up & cloud_confirm_up

            price_breakout_down = (df['close'].shift(1) >= cloud_bottom.shift(1)) & (df['close'] < cloud_bottom)
            chikou_confirm_down = chikou_span < cloud_bottom
            cloud_confirm_down = senkou_span_a < senkou_span_b
            sell_cond = price_breakout_down & chikou_confirm_down & cloud_confirm_down
            return pd.Series(np.where(buy_cond, 1, np.where(sell_cond, -1, 0)), index=df.index)

        strategy_calculators = {
            "EmaCrossAtr": calc_ema_cross,
            "RsiBbMeanReversion": calc_rsi_bb_reversion,
            "MacdAdxTrend": calc_macd_adx_trend,
            "VolatilitySqueeze": calc_volatility_squeeze,
            "SuperTrendAdx": calc_supertrend_adx,
            "IchimokuBreakout": calc_ichimoku_breakout
        }

        # ==============================================================================
        # 2. GENERATE SIGNAL COLUMNS FOR EACH SUB-STRATEGY IN THE POOL
        # ==============================================================================
        signals_df = pd.DataFrame(index=df_out.index)
        for strategy_name in p.get('strategy_pool', []):
            calculator = strategy_calculators.get(strategy_name)
            if calculator:
                try:
                    StrategyClass = STRATEGY_REGISTRY.get(strategy_name)
                    sub_params = StrategyClass.get_parameter_schema()().model_dump()
                    signals_df[f'signal_{strategy_name}'] = calculator(df_out, sub_params)
                except Exception as e:
                    logger.warning(
                        f"[Optimizer Backtest] Sub-strategy '{strategy_name}' failed during vectorization: {e}")

        if signals_df.empty:
            df_out['signal'] = 0
            df_out['reason'] = ""
            return df_out

        # ==============================================================================
        # 3. APPLY THE OPTIMIZER'S SCORING LOGIC (VECTORIZED)
        # ==============================================================================
        trend_period = p.get('trend_filter_period', 200)
        # --- MODIFIED LINE: Replaced pta.ema with pandas equivalent ---
        df_out['long_ema'] = df_out['close'].ewm(span=trend_period, adjust=False).mean()

        market_is_uptrend = df_out['close'] > df_out['long_ema']
        market_is_downtrend = df_out['close'] < df_out['long_ema']

        buy_signals_count = (signals_df == 1).sum(axis=1)
        sell_signals_count = (signals_df == -1).sum(axis=1)

        buy_score = (buy_signals_count * 10) + np.where(market_is_uptrend, 20, np.where(market_is_downtrend, -10, 0))
        sell_score = (sell_signals_count * 10) + np.where(market_is_downtrend, 20, np.where(market_is_uptrend, -10, 0))

        buy_cond = (buy_score > sell_score) & (buy_score > 0) & (buy_signals_count >= p['min_confluence'])
        sell_cond = (sell_score > buy_score) & (sell_score > 0) & (sell_signals_count >= p['min_confluence'])

        df_out['signal'] = np.where(buy_cond, 1, np.where(sell_cond, -1, 0))

        df_out['reason'] = np.where(
            buy_cond,
            "Optimizer BUY (Score: " + buy_score.round().astype(str) + ", Confluence: " + buy_signals_count.astype(
                str) + ")",
            np.where(sell_cond, "Optimizer SELL (Score: " + sell_score.round().astype(
                str) + ", Confluence: " + sell_signals_count.astype(str) + ")", "")
        )

        return df_out


class MacdAdxTrendParams(BaseModel):
    macd_fast: int = Field(12, gt=5);
    macd_slow: int = Field(26, gt=15);
    macd_signal: int = Field(9, gt=4)
    adx_period: int = Field(14, gt=5);
    adx_threshold: int = Field(25, gt=10, lt=50)


class MacdAdxTrendStrategy(AbstractStrategy):
    @staticmethod
    def get_parameter_schema() -> BaseModel: return MacdAdxTrendParams

    def generate_signal(self) -> TradingSignal:
        df_slice = self.ohlcv.tail(self.parameters['macd_slow'] + self.parameters['adx_period']).copy()
        df_with_signal = self._generate_signals_vectorized(df_slice, self.parameters)
        signal = df_with_signal['signal'].iloc[-1]
        action = "BUY" if signal == 1 else "SELL" if signal == -1 else "HOLD"
        return TradingSignal(action)

    @staticmethod
    def _generate_signals_vectorized(df: pd.DataFrame, p: dict) -> pd.DataFrame:
        df_out = df.copy()
        df_out.ta.macd(fast=p['macd_fast'], slow=p['macd_slow'], signal=p['macd_signal'], append=True)
        df_out.ta.adx(length=p['adx_period'], append=True)

        macd_col = next((col for col in df_out.columns if col.startswith('MACD_')), None)
        macds_col = next((col for col in df_out.columns if col.startswith('MACDs_')), None)
        adx_col = next((col for col in df_out.columns if col.startswith('ADX_')), None)
        if not all([macd_col, macds_col, adx_col]): raise KeyError("Could not find MACD/ADX columns.")

        trending = df_out[adx_col] > p['adx_threshold']
        crossover = (df_out[macd_col] > df_out[macds_col]) & (df_out[macd_col].shift(1) <= df_out[macds_col].shift(1))
        crossunder = (df_out[macd_col] < df_out[macds_col]) & (df_out[macd_col].shift(1) >= df_out[macds_col].shift(1))

        df_out['signal'] = np.where(trending & crossover, 1, np.where(trending & crossunder, -1, 0))
        return df_out


class VolatilitySqueezeParams(BaseModel):
    bb_period: int = Field(20, gt=10);
    bb_std: float = Field(2.0, gt=0.5);
    kc_period: int = Field(20, gt=10);
    kc_atr_mult: float = Field(1.5, gt=0.5)


class VolatilitySqueezeStrategy(AbstractStrategy):
    @staticmethod
    def get_parameter_schema() -> BaseModel: return VolatilitySqueezeParams

    def generate_signal(self) -> TradingSignal:
        df_slice = self.ohlcv.tail(self.parameters['bb_period'] + 5).copy()
        df_with_signal = self._generate_signals_vectorized(df_slice, self.parameters)
        signal = df_with_signal['signal'].iloc[-1]
        action = "BUY" if signal == 1 else "SELL" if signal == -1 else "HOLD"
        return TradingSignal(action)

    @staticmethod
    def _generate_signals_vectorized(df: pd.DataFrame, p: dict) -> pd.DataFrame:
        df_out = df.copy()
        df_out.ta.bbands(length=p['bb_period'], std=p['bb_std'], append=True)
        df_out.ta.kc(length=p['kc_period'], scalar=p['kc_atr_mult'], append=True)

        bbu_col = next((col for col in df_out.columns if col.startswith(f"BBU_{p['bb_period']}")), None)
        bbl_col = next((col for col in df_out.columns if col.startswith(f"BBL_{p['bb_period']}")), None)
        kcu_col = next((col for col in df_out.columns if col.startswith(f"KCUe_{p['kc_period']}")), None)
        kcl_col = next((col for col in df_out.columns if col.startswith(f"KCLe_{p['kc_period']}")), None)
        if not all([bbu_col, bbl_col, kcu_col, kcl_col]): raise KeyError("Could not find BBands/KC columns.")

        squeeze_on = (df_out[bbl_col] > df_out[kcl_col]) & (df_out[bbu_col] < df_out[kcu_col])
        squeeze_release = (squeeze_on == False) & (squeeze_on.shift(1) == True)

        buy_cond = squeeze_release & (df_out['close'] > df_out[bbu_col])
        sell_cond = squeeze_release & (df_out['close'] < df_out[bbl_col])

        df_out['signal'] = np.where(buy_cond, 1, np.where(sell_cond, -1, 0))
        return df_out


class AiEnhancedSignalParams(BaseModel):
    confidence_threshold: float = Field(0.65, ge=0.5, le=1.0)


class AiEnhancedSignalStrategy(AbstractStrategy):
    @staticmethod
    def get_parameter_schema() -> BaseModel:
        return AiEnhancedSignalParams

    def generate_signal(self) -> TradingSignal:
        """
        Generates a trading signal based on a hybrid approach of a basic EMA crossover
        and an AI model confirmation.
        """
        onnx_sess, scaler = app_state.get("onnx_session"), app_state.get("scaler")
        if not onnx_sess or not scaler:
            return TradingSignal("HOLD")

        # Calculate EMAs using pandas built-in functions, assuming 'close' price
        self.ohlcv['ema_fast'] = self.ohlcv['close'].ewm(span=10, adjust=False).mean()
        self.ohlcv['ema_long'] = self.ohlcv['close'].ewm(span=30, adjust=False).mean()

        base_signal = "HOLD"
        # Check for EMA crossover
        if self.ohlcv['ema_fast'].iloc[-1] > self.ohlcv['ema_long'].iloc[-1] and self.ohlcv['ema_fast'].iloc[-2] <= \
                self.ohlcv['ema_long'].iloc[-2]:
            base_signal = "BUY"
        elif self.ohlcv['ema_fast'].iloc[-1] < self.ohlcv['ema_long'].iloc[-1] and self.ohlcv['ema_fast'].iloc[-2] >= \
                self.ohlcv['ema_long'].iloc[-2]:
            base_signal = "SELL"

        if base_signal == "HOLD":
            return TradingSignal("HOLD")

        # AI Model Confirmation
        features_df = create_ml_features(self.ohlcv.copy()).drop(columns=['target'], errors='ignore')
        if features_df.empty:
            return TradingSignal("HOLD")

        scaled_features = scaler.transform(features_df)
        latest_features = scaled_features[-1].reshape(1, -1).astype(np.float32)

        input_name = onnx_sess.get_inputs()[0].name
        pred_onnx = onnx_sess.run(None, {input_name: latest_features})

        # Assuming the second output of the model contains the prediction probabilities
        prediction_probs = pred_onnx[1][0]

        prob_sell, prob_buy = prediction_probs['0'], prediction_probs['1']

        if base_signal == "BUY" and prob_buy > self.parameters['confidence_threshold']:
            return TradingSignal("BUY", confidence=prob_buy, reason=f"AI Confirmed Buy (Prob: {prob_buy:.2f})")

        if base_signal == "SELL" and prob_sell > self.parameters['confidence_threshold']:
            return TradingSignal("SELL", confidence=prob_sell, reason=f"AI Confirmed Sell (Prob: {prob_sell:.2f})")

        return TradingSignal("HOLD")

    @staticmethod
    def _generate_signals_vectorized(df: pd.DataFrame, p: dict) -> pd.DataFrame:
        """
        Note: This method is not truly vectorized. It simulates the signal generation
        iteratively, which is suitable for backtesting this specific strategy.
        """
        df_out = df.copy()
        signals = [0] * len(df_out)
        temp_strategy = AiEnhancedSignalStrategy(0, "", "", p, {})

        # Start from a point where there is enough data for indicators
        for i in range(200, len(df_out)):
            # Update the strategy with data up to the current point
            temp_strategy.update_data(df_out.iloc[0:i])
            signal_obj = temp_strategy.generate_signal()

            if signal_obj.action == "BUY":
                signals[i] = 1
            elif signal_obj.action == "SELL":
                signals[i] = -1

        df_out['signal'] = signals
        return df_out

STRATEGY_REGISTRY = {
    "Adaptive EMA Crossover": EmaCrossAtrStrategy,
    "RSI & Bollinger Reversion": RsiBbMeanReversionStrategy,
    "MACD Trend w/ ADX Filter": MacdAdxTrendStrategy,
    "Volatility Squeeze": VolatilitySqueezeStrategy,
    "SuperTrend w/ ADX Filter": SuperTrendAdxStrategy,
    "Ichimoku Cloud Breakout": IchimokuBreakoutStrategy,
    "Smart Money Concept (SMC)": SmcOrderBlockFvgStrategy,
    "AI Signal Confirmation": AiEnhancedSignalStrategy,
    "Optimizer Portfolio": OptimizerPortfolioStrategy,
}

PARAM_SCHEMA_REGISTRY = {
    "Adaptive EMA Crossover": EmaCrossAtrParams,
    "RSI & Bollinger Reversion": RsiBbMeanReversionParams,
    "MACD Trend w/ ADX Filter": MacdAdxTrendParams,
    "Volatility Squeeze": VolatilitySqueezeParams,
    "SuperTrend w/ ADX Filter": SuperTrendAdxParams,
    "Ichimoku Cloud Breakout": IchimokuBreakoutParams,
    "Smart Money Concept (SMC)": SmcOrderBlockFvgParams,
    "AI Signal Confirmation": AiEnhancedSignalParams,
    "Optimizer Portfolio": OptimizerPortfolioParams,
}


# ==============================================================================
# 6. BUSINESS LOGIC & SERVICES
# ==============================================================================
def mask_account_details(details: Dict[str, str]) -> Dict[str, str]:
    masked = details.copy()
    if "account_number" in masked and len(masked["account_number"]) > 4:
        num = masked["account_number"]
        masked["account_number"] = f"{num[:2]}****{num[-4:]}"
    return masked


class InsufficientFundsError(Exception): pass


class UserService:
    def verify_password(self, plain_password, hashed_password):
        return pwd_context.verify(plain_password, hashed_password)

    def get_password_hash(self, password):
        return pwd_context.hash(password)

    def encrypt_api_key(self, key: str) -> str:
        return fernet.encrypt(key.encode()).decode()

    def decrypt_api_key(self, encrypted_key: str) -> str:
        return fernet.decrypt(encrypted_key.encode()).decode()

    def encrypt_data(self, data: str) -> str:
        return fernet.encrypt(data.encode()).decode()

    # AND RENAME THIS ONE
    def decrypt_data(self, encrypted_data: str) -> str:
        return fernet.decrypt(encrypted_data.encode()).decode()

user_service = UserService()


class TaskStore:
    def __init__(self):
        self._tasks = {}
        self._lock = threading.Lock()  # Use a thread-safe lock for Gunicorn workers

    def get_task(self, task_id: str):
        with self._lock:
            return self._tasks.get(task_id)

    def set_task(self, task_id: str, data: Dict):
        with self._lock:
            self._tasks[task_id] = data

    def update_task_progress(self, task_id: str, progress: float):
        with self._lock:
            if task_id in self._tasks:
                self._tasks[task_id]['progress'] = progress

    def complete_task(self, task_id: str, results: List, status: OptimizationStatus):
        with self._lock:
            if task_id in self._tasks:
                self._tasks[task_id]['status'] = status
                self._tasks[task_id]['results'] = results
                self._tasks[task_id]['progress'] = 1.0

    def fail_task(self, task_id: str, error: str):
        with self._lock:
            if task_id in self._tasks:
                self._tasks[task_id]['status'] = OptimizationStatus.FAILED
                self._tasks[task_id]['error'] = error
                self._tasks[task_id]['progress'] = 1.0


# Instantiate it globally
task_store = TaskStore()

# --- 1. The Abstract Base Class (The "Interface") ---
class BrokerClient(ABC):
    @abstractmethod
    async def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int) -> List[List]:
        pass

    @abstractmethod
    async def create_market_order(self, symbol: str, side: str, amount: float, params: Dict = {}):
        pass

    # --- NEW ABSTRACT METHOD ---
    @abstractmethod
    async def fetch_balance(self) -> Dict:
        pass

    @abstractmethod
    async def close(self):
        pass

# --- 2. The CCXT Adapter ---
class CcxtClient(BrokerClient):
    def __init__(self, ccxt_instance: ccxt.Exchange):
        self._client = ccxt_instance

    async def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int) -> List[List]:
        return await self._client.fetch_ohlcv(symbol, timeframe, limit=limit)

    async def create_market_order(self, symbol: str, side: str, amount: float, params: Dict = {}):
        return await self._client.create_market_order(symbol, side, amount, params)

    async def fetch_balance(self) -> Dict:
        return await self._client.fetch_balance()

    async def close(self):
        await self._client.close()



class Mt5Client(BrokerClient):
    def __init__(self, login: int, password: str, server: str):
        self._login = login
        self._password = password
        self._server = server
        self._is_connected = False
        # We don't connect here, we connect on-demand.

    def _connect(self):
        """Synchronous, blocking connection logic."""
        if self._is_connected:
            return True
        if not mt5.initialize():
            logger.error(f"MT5 initialize() failed: {mt5.last_error()}")
            return False
        if not mt5.login(login=self._login, password=self._password, server=self._server):
            logger.error(f"MT5 login failed for {self._login}: {mt5.last_error()}")
            mt5.shutdown()
            return False
        self._is_connected = True
        return True

    # --- This is the new method we will call from the portfolio helper ---
    def get_account_summary(self) -> Dict:
        """Connects, fetches account info, and immediately disconnects."""
        if not self._connect():
            return {"status": "error", "message": "Failed to connect to MT5."}

        info = mt5.account_info()
        if info:
            return {
                "status": "success",
                "details": {
                    "currency": info.currency,
                    "balance": info.balance,
                    "equity": info.equity
                }
            }
        return {"status": "error", "message": "Failed to retrieve account info."}

    # The other abstract methods need to be implemented for the adapter to be complete
    async def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int) -> List[List]:
        # Implementation for fetching OHLCV from MT5
        pass

    async def create_market_order(self, symbol: str, side: str, amount: float, params: Dict = {}):
        # Implementation for creating orders
        pass

    async def close(self):
        """Closes the connection if it's open."""
        if self._is_connected:
            await asyncio.to_thread(mt5.shutdown)
            self._is_connected = False

# --- NEW: A dedicated client for fetching data from TradingView as a fallback ---
class TradingViewClient:
    def __init__(self):
        self.forex_pairs = {
            'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'NZD/USD',
            'USD/CAD', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'NZD/JPY',
            'GBP/CHF', 'AUD/NZD', 'EUR/AUD', 'GBP/CAD', 'EUR/CAD', 'USD/MXN',
            'USD/ZAR', 'USD/INR'
        }
        self._session = aiohttp.ClientSession()

    def _format_symbol_for_tv(self, symbol: str) -> dict:
        clean_symbol = symbol.replace('/', '')
        # Correctly identify Forex vs. Crypto
        is_forex = symbol.upper() in self.forex_pairs
        screener = "forex" if is_forex else "crypto"
        # For crypto, we'll use Binance as a reliable source on TradingView
        exchange = "FX_IDC" if is_forex else "BINANCE"

        return {"symbol": clean_symbol, "screener": screener, "exchange": exchange}

    async def get_analysis_for_ml(self, symbol: str) -> Optional[Dict]:
        try:
            tv_config = self._format_symbol_for_tv(symbol)

            # --- THIS IS THE FIX ---
            # The 'requests_session' argument is removed.
            handler = TA_Handler(
                symbol=tv_config["symbol"],
                screener=tv_config["screener"],
                exchange=tv_config["exchange"],
                interval=Interval.INTERVAL_1_HOUR,
            )
            # ------------------------

            analysis = await asyncio.to_thread(handler.get_analysis)
            return analysis
        except Exception as e:
            logger.warning(f"TradingView analysis fetch failed for {symbol}: {e}")
            return None

    async def _fetch_single_ticker(self, symbol: str) -> Optional[Dict]:
        try:
            tv_config = self._format_symbol_for_tv(symbol)

            # --- THIS IS THE FIX ---
            # The 'requests_session' argument is removed here as well.
            handler = TA_Handler(
                symbol=tv_config["symbol"],
                screener=tv_config["screener"],
                exchange=tv_config["exchange"],
                interval=Interval.INTERVAL_1_DAY,
            )
            # ------------------------

            analysis = await asyncio.to_thread(handler.get_analysis)
            if analysis and 'close' in analysis.indicators:
                price = analysis.indicators['close']
                prev_close = analysis.indicators.get('open', price)
                change = ((price - prev_close) / prev_close) * 100 if prev_close != 0 else 0
                return {"last": price, "percentage": change}
            return None
        except Exception as e:
            logger.warning(f"TradingView ticker fetch failed for symbol {symbol}: {e}")
            return None

    async def fetch_tickers(self, symbols: List[str]) -> Dict[str, Dict]:
        # This function doesn't need to change, as it calls the fixed helper above.
        tasks = [self._fetch_single_ticker(s) for s in symbols]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        tickers = {symbols[i]: res for i, res in enumerate(results) if isinstance(res, dict)}
        return tickers

    async def close_session(self):
        # This method is no longer needed as we are not managing the session.
        # It's safe to keep it as a no-op (no operation) for compatibility.
        pass



class InsufficientFundsError(Exception):
    """Custom exception for wallet operations."""
    pass


class ExchangeManager:
    def __init__(self):
        self._public_clients: Dict[str, ccxt.Exchange] = {}
        self._public_lock = asyncio.Lock()
        self.public_data_providers = ['binance', 'kucoin', 'bybit', 'okx']
        
        
    async def get_public_client(self, exchange_name: str) -> ccxt.Exchange:
        async with self._public_lock:
            if exchange_name not in self._public_clients:
                try:
                    exchange_class = getattr(ccxt, exchange_name)
                    # --- ROBUST CONFIGURATION ---
                    client = exchange_class({
                        'options': {
                            'defaultType': 'spot', # Explicitly use SPOT markets
                        },
                        'timeout': 30000,  # 30-second timeout
                        'enableRateLimit': True,
                    })
                    self._public_clients[exchange_name] = client
                except Exception as e:
                    logger.error(f"Failed to create public client for {exchange_name}: {e}")
                    raise ValueError(f"Exchange {exchange_name} not found or failed to init.")
            return self._public_clients[exchange_name]

    async def get_fault_tolerant_public_client(self) -> Optional[ccxt.Exchange]:
        """
        Iterates through providers to find a responsive one using a lightweight connection test.
        Returns a NEW, single-use client that MUST be closed by the caller.
        """
        for provider in self.public_data_providers:
            exchange = None
            try:
                logger.info(f"Attempting to connect to public data source: {provider}")
                exchange_class = getattr(ccxt, provider)
                exchange = exchange_class({
                    'options': {'defaultType': 'spot'},
                    'timeout': 30000,
                    'enableRateLimit': True,
                })

                # Use a more lightweight and universal connection test than load_markets()
                await exchange.fetch_time()
                
                logger.info(f"Successfully connected to {provider}. Using this provider.")
                return exchange # Return the new, working client
            except Exception as e:
                error_type = type(e).__name__
                logger.warning(f"Failed to connect to {provider} ({error_type}): {str(e)[:150]}. Trying next provider.")
                if exchange:
                    await exchange.close() # Clean up the failed client
                continue
        
        logger.error("!!! CRITICAL: Could not connect to any public data provider.")
        return None

    async def get_private_client(self, user_id: str, exchange_name: str, asset_class: AssetClass,
                                 market_type: MarketType) -> Optional[BrokerClient]:
        """
        Securely creates a new, authenticated client instance for a specific user.
        This is the corrected, robust version.
        """
        private_client_instance = None  # Initialize to None at the start
        try:
            async with async_session_maker() as db:
                api_key_entry = await db.scalar(
                    select(UserAPIKey).where(
                        UserAPIKey.user_id == user_id,
                        UserAPIKey.exchange == exchange_name,
                        UserAPIKey.asset_class == asset_class.value
                    )
                )
                if not api_key_entry:
                    logger.warning(f"No {asset_class.value} API keys found for user {user_id} on {exchange_name}.")
                    return None

                api_key = user_service.decrypt_data(api_key_entry.api_key_encrypted)
                secret_key = user_service.decrypt_data(api_key_entry.secret_key_encrypted)

            exchange_class = getattr(ccxt, exchange_name)

            # --- THIS IS THE FIX ---
            # The 'market_type' parameter is now correctly passed into the function
            # and used to configure the client.
            client_config = {
                'apiKey': api_key,
                'secret': secret_key,
                'enableRateLimit': True,
                'timeout': 20000,
                'options': {
                    'defaultType': market_type.value
                }
            }

            private_client_instance = exchange_class(client_config)

            # Load markets to verify the connection and keys are valid.
            await private_client_instance.load_markets()

            return CcxtClient(private_client_instance)

        except (ccxt.AuthenticationError, ccxt.InvalidNonce) as e:
            logger.error(f"Authentication failed for user {user_id} on {exchange_name}: {e}")
            if private_client_instance:
                await private_client_instance.close()
            return None
        except Exception as e:
            # This block now safely handles the client instance
            if private_client_instance:
                await private_client_instance.close()
            logger.error(f"Failed to create private client for {exchange_name} for user {user_id}: {e}", exc_info=True)
            return None

    async def close_all_public(self):
        logger.info("Public clients are now short-lived and closed individually.")
        pass
exchange_manager = ExchangeManager()  # New global instance


class WalletService:
    async def get_or_create_wallet(self, db: AsyncSession, user_id: str, asset: str) -> Wallet:
        """Retrieves a user's wallet for a specific asset, creating it if it doesn't exist."""
        wallet = await db.get(Wallet, (user_id, asset))
        if not wallet:
            wallet = Wallet(user_id=user_id, asset=asset, balance=Decimal(0))
            db.add(wallet)
            await db.flush()  # Make it available in the session without committing
        return wallet

    async def get_balance(self, db: AsyncSession, user_id: str, asset: str) -> Decimal:
        wallet = await self.get_or_create_wallet(db, user_id, asset)
        return wallet.balance

    async def _update_balance(
            self,
            db: AsyncSession,
            user_id: str,
            asset: str,
            amount: Decimal,
            tx_type: TransactionType,
            notes: Optional[str] = None,
            related_asset: Optional[str] = None,
            related_amount: Optional[Decimal] = None,
            exchange_rate: Optional[Decimal] = None,
            fee: Optional[Decimal] = Decimal(0)
    ) -> Transaction:
        """
        Core atomic function to update a wallet's balance and log the transaction.
        Amount should be positive for credits and negative for debits.
        """
        wallet = await self.get_or_create_wallet(db, user_id, asset)

        # Robust check for debits
        if amount < 0 and wallet.balance < abs(amount):
            raise InsufficientFundsError(
                f"Insufficient funds in {asset} wallet. Required: {abs(amount)}, Available: {wallet.balance}")

        wallet.balance += amount

        # Create an immutable transaction log
        transaction = Transaction(
            user_id=user_id,
            type=tx_type.value,
            asset=asset,
            amount=amount,
            notes=notes,
            related_asset=related_asset,
            related_amount=related_amount,
            exchange_rate=exchange_rate,
            fee=fee
        )
        db.add(transaction)
        return transaction
# Instantiate the service
wallet_service = WalletService()


class EmailService:
    def __init__(self, settings: Settings):
        self.settings = settings
        # Basic validation to ensure email sending can even be attempted
        self.is_configured = all([
            settings.MAIL_SERVER,
            settings.MAIL_PORT,
            settings.MAIL_USERNAME,
            settings.MAIL_PASSWORD,
            settings.MAIL_FROM
        ])
        if not self.is_configured:
            logger.warning("Email service is not configured. MAIL_* environment variables are missing.")

    async def send_email(self, recipient: str, subject: str, body: str):
        """
        Connects to the SMTP server and sends a plain text email.
        This is an async function suitable for being called from Celery tasks or API endpoints.
        """
        if not self.is_configured:
            logger.error("Cannot send email: Email service is not configured.")
            # In a real system, you might raise an exception or just return
            return

        msg = MIMEMultipart()
        msg['From'] = self.settings.MAIL_FROM
        msg['To'] = recipient
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))

        try:
            # smtplib is synchronous, so we run it in a thread to be non-blocking
            def _send():
                server = smtplib.SMTP(self.settings.MAIL_SERVER, self.settings.MAIL_PORT)
                server.starttls()  # Secure the connection
                server.login(self.settings.MAIL_USERNAME, self.settings.MAIL_PASSWORD)
                text = msg.as_string()
                server.sendmail(self.settings.MAIL_FROM, recipient, text)
                server.quit()

            await asyncio.to_thread(_send)
            logger.info(f"Email sent successfully to {recipient} with subject '{subject}'")

        except Exception as e:
            logger.error(f"!!! CRITICAL: Failed to send email to {recipient}: {e}", exc_info=True)
            # Re-raise the exception so the Celery task can be marked as failed and retried.
            raise


# Instantiate the service globally
email_service = EmailService(settings)



class SwapService:
    SWAP_FEE_PERCENT = Decimal("0.002")  # 0.2% swap fee
    QUOTE_VALIDITY_SECONDS = 20  # Quotes are firm for 20 seconds

    def __init__(self):
        # In-memory storage for quotes. For multi-server production, use Redis.
        self.quotes: Dict[str, SwapQuoteResponse] = {}

    async def get_swap_rate(self, from_asset: str, to_asset: str) -> Decimal:
        if from_asset == to_asset: return Decimal(1)
        symbol = f"{from_asset}/{to_asset}" if to_asset == "USDT" else f"{to_asset}/{from_asset}"
        try:
            exchange = await exchange_manager.get_fault_tolerant_public_client()
            if not exchange:
                raise HTTPException(status_code=503, detail="Market data providers unavailable.")
            ticker = await exchange.fetch_ticker(symbol)
            price = Decimal(str(ticker['last']))
            return Decimal(1) / price if to_asset == "USDT" else price
        except Exception as e:
            logger.error(f"Could not get swap rate for {from_asset}->{to_asset}: {e}")
            raise HTTPException(status_code=503, detail="Liquidity provider unavailable.")

    async def get_swap_quote(self, user_id: str, req: SwapRequest) -> SwapQuoteResponse:
        """
        Provides a firm, timed quote for a swap and stores it for execution.
        """
        rate = await self.get_swap_rate(req.from_asset, req.to_asset)
        amount_out_gross = req.amount * rate
        fee = amount_out_gross * self.SWAP_FEE_PERCENT
        amount_out_net = amount_out_gross - fee

        quote_id = f"qt_{secrets.token_urlsafe(16)}"
        expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
            seconds=self.QUOTE_VALIDITY_SECONDS)

        quote = SwapQuoteResponse(
            quote_id=quote_id,
            user_id=user_id,
            from_asset=req.from_asset,
            to_asset=req.to_asset,
            amount_in=req.amount,
            amount_out=amount_out_net,
            rate=rate,
            fee=fee,
            expires_at=expires_at
        )

        # Store the quote in memory
        self.quotes[quote_id] = quote

        return quote

    async def execute_swap(self, db: AsyncSession, user_id: str, req: SwapExecuteRequest) -> SwapExecuteResponse:
        """
        Executes a swap in a single, atomic database transaction using a validated quote.
        """
        quote_id = req.quote_id

        # 1. Validate the quote
        quote = self.quotes.get(quote_id)
        if not quote:
            raise HTTPException(status_code=404, detail="Quote not found. It may have expired.")

        if quote.user_id != user_id:
            raise HTTPException(status_code=403, detail="This quote does not belong to the current user.")

        if datetime.datetime.now(datetime.timezone.utc) > quote.expires_at:
            # Clean up expired quote
            del self.quotes[quote_id]
            raise HTTPException(status_code=400, detail="Quote has expired. Please get a new quote.")

        # 2. Once validated, remove the quote to prevent re-use (idempotency)
        validated_quote = self.quotes.pop(quote_id)

        # 3. Execute the atomic ledger transaction using the locked-in quote values
        async with db.begin():
            try:
                # Debit the "from" asset
                await wallet_service._update_balance(
                    db, user_id, validated_quote.from_asset, -validated_quote.amount_in,
                    TransactionType.SWAP, notes=f"Swap to {validated_quote.to_asset}"
                )

                # Credit the "to" asset
                tx = await wallet_service._update_balance(
                    db, user_id, validated_quote.to_asset, validated_quote.amount_out,
                    TransactionType.SWAP,
                    notes=f"Swap from {validated_quote.from_asset}",
                    related_asset=validated_quote.from_asset, related_amount=-validated_quote.amount_in,
                    exchange_rate=validated_quote.rate, fee=validated_quote.fee
                )

                # In a real system, you would credit fees to a platform-owned wallet
                # await wallet_service._update_balance(...)

            except InsufficientFundsError as e:
                # If the user's balance changed after getting the quote, this will catch it.
                raise HTTPException(status_code=400, detail=str(e))
            except Exception as e:
                logger.error(f"Critical error during swap execution for user {user_id}: {e}")
                raise HTTPException(status_code=500, detail="An internal error occurred during the swap.")

        return SwapExecuteResponse(
            transaction_id=tx.id,
            from_asset=validated_quote.from_asset, to_asset=validated_quote.to_asset,
            amount_debited=validated_quote.amount_in, amount_credited=validated_quote.amount_out
        )


# Instantiate the service
swap_service = SwapService()


class SubscriptionService:
    async def create_subscription(self, db: AsyncSession, user_id: str, bot_id: PythonUUID, payment: Payment):
        """Creates a new subscription record after a successful payment."""
        new_sub = StrategySubscription(
            subscriber_id=user_id,
            strategy_bot_id=bot_id,
            payment_id=payment.id,
            expires_at=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=30)
        )
        db.add(new_sub)
        await db.commit()
        logger.info(f"User {user_id} successfully subscribed to strategy {bot_id}.")

    async def has_active_subscription(self, db: AsyncSession, user_id: str, bot_id: PythonUUID) -> bool:
        """Checks if a user has an active, non-expired subscription to a strategy."""
        sub = await db.scalar(
            select(StrategySubscription).where(
                StrategySubscription.subscriber_id == user_id,
                StrategySubscription.strategy_bot_id == bot_id,
                StrategySubscription.status == SubscriptionStatus.ACTIVE.value,
                StrategySubscription.expires_at > datetime.datetime.now(datetime.timezone.utc)
            )
        )
        return sub is not None


subscription_service = SubscriptionService()


class PaystackService:
    def __init__(self, settings: Settings):
        self.secret_key = settings.PAYSTACK_SECRET_KEY
        self.base_url = "https://api.paystack.co"
        self.headers = {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json"
        }

    async def initiate_payout(self, transaction_id: PythonUUID, amount: Decimal, recipient_details: Dict[str, str]):
        """
        Initiates a payout to a user's bank account via Paystack.
        This is a 100% real implementation.
        """
        # Step 1: Create a Transfer Recipient on Paystack
        # This is required before you can send money.
        recipient_payload = {
            "type": "nuban",  # Assuming Nigerian bank account, change as needed
            "name": recipient_details.get("account_name"),
            "account_number": recipient_details.get("account_number"),
            "bank_code": recipient_details.get("bank_code"),  # User must provide this
            "currency": "NGN"  # Change as needed
        }

        async with aiohttp.ClientSession(headers=self.headers) as session:
            try:
                # Create the recipient
                async with session.post(f"{self.base_url}/transferrecipient", json=recipient_payload) as resp:
                    if resp.status != 201:
                        error_data = await resp.json()
                        raise HTTPException(status_code=400, detail=f"Paystack Error: {error_data['message']}")
                    recipient_data = await resp.json()
                    recipient_code = recipient_data['data']['recipient_code']

                # Step 2: Initiate the Transfer using the recipient code
                # Paystack amount is in kobo (lowest currency unit)
                amount_in_kobo = int(amount * 100)
                transfer_payload = {
                    "source": "balance",
                    "amount": amount_in_kobo,
                    "recipient": recipient_code,
                    "reason": f"QuantumLeap Withdrawal ID: {transaction_id}"
                }

                async with session.post(f"{self.base_url}/transfer", json=transfer_payload) as transfer_resp:
                    if transfer_resp.status != 200:
                        error_data = await transfer_resp.json()
                        raise HTTPException(status_code=400, detail=f"Paystack Payout Error: {error_data['message']}")

                    # Payout initiated successfully
                    payout_data = await transfer_resp.json()
                    logger.info(
                        f"Successfully initiated Paystack payout for tx {transaction_id}. Paystack ref: {payout_data['data']['transfer_code']}")

            except Exception as e:
                logger.error(f"Paystack payout failed for tx {transaction_id}: {e}")
                # In a real system, you would have a retry mechanism or alert the finance team.
                # For now, we raise an HTTP exception to inform the user of the failure.
                raise HTTPException(status_code=503, detail="Withdrawal service provider is currently unavailable.")


# Instantiate the service
paystack_service = PaystackService(settings)


# --- NEW: Telegram Service ---
class TelegramService:
    def __init__(self, token: str):
        self.application = ApplicationBuilder().token(token).build()
        self.linking_codes: Dict[str, str] = {}  # {code: user_id}
        # --- NEW: Add a property to store the bot's info ---
        self.bot_info: Optional[TelegramUser] = None

    # --- NEW: Method to fetch bot info at startup ---
    async def initialize_bot_info(self):
        """Fetches the bot's user info. Called once at startup."""
        if not self.application:
            logger.warning("Telegram bot token not provided. Telegram features will be disabled.")
            return
        try:
            logger.info("Fetching Telegram bot information...")
            self.bot_info = await self.application.bot.get_me()
            logger.info(f"Telegram bot initialized: {self.bot_info.full_name} (@{self.bot_info.username})")
        except InvalidToken:
            logger.critical("!!! CRITICAL: The provided TELEGRAM_BOT_TOKEN is invalid. Telegram features will not work.")
            self.application = None
        except Exception as e:
            logger.error(f"Failed to fetch Telegram bot info: {e}")
            self.application = None

    # --- NEW: A safe getter method for the username ---
    def get_bot_username(self) -> str:
        """
        Safely returns the bot's username from the cached info.
        Returns a placeholder if the information could not be fetched.
        """
        if self.bot_info and self.bot_info.username:
            return f"@{self.bot_info.username}"
        # Fallback in case initialization failed
        return "@quantumleapaibot"

    def setup_handlers(self):
        """Sets up the command handlers for the bot."""
        if not self.application: return
        self.application.add_handler(CommandHandler("start", self.start_command))
        self.application.add_handler(CommandHandler("status", self.status_command))
        logger.info("Telegram bot command handlers set up.")

    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not update.message or not update.effective_chat:
            return

        args = context.args
        if args:
            code = args[0]
            user_id = self.linking_codes.get(code)
            if user_id:
                async with async_session_maker() as db:
                    user = await db.get(User, user_id)
                    if user:
                        user.telegram_chat_id = str(update.effective_chat.id)
                        await db.commit()
                        del self.linking_codes[code]
                        await update.message.reply_text(
                            "✅ Success! Your Telegram account is now linked. You will receive trading notifications here.")
                        return
        await update.message.reply_text(
            "Welcome to QuantumLeap AI Trader! To link your account, generate a code from the web dashboard and send it like this: /start YOUR_CODE")

    async def status_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not update.message or not update.effective_chat:
            return
        chat_id = str(update.effective_chat.id)
        async with async_session_maker() as db:
            user = await db.scalar(select(User).where(User.telegram_chat_id == chat_id))
            if not user:
                await update.message.reply_text(
                    "Your account is not linked. Please use /start with a code from the dashboard.")
                return

            bots = await db.scalars(select(TradingBot).where(TradingBot.owner_id == user.id))
            active_bots = [b for b in bots.all() if b.is_active]

            if not active_bots:
                await update.message.reply_text("You have no active trading bots.")
                return

            message = "🤖 Your Active Bots:\n\n"
            for bot in active_bots:
                message += f"🔹 *{bot.name}*\n  - Symbol: `{bot.symbol}`\n  - Strategy: `{bot.strategy_name}`\n\n"
            await update.message.reply_text(message, parse_mode='Markdown')

    def generate_linking_code(self, user_id: str) -> str:
        code = secrets.token_hex(8)
        self.linking_codes[code] = user_id
        # Optional: Add a TTL for the code
        return code

    async def send_message(self, chat_id: str, text: str):
        if not self.application: return
        try:
            # Use MarkdownV2 for better formatting options
            await self.application.bot.send_message(chat_id=chat_id, text=text, parse_mode='MarkdownV2')
        except Exception as e:
            logger.error(f"Failed to send Telegram message to {chat_id}: {e}")

    async def notify_user(self, user_id: str, message: str):
        async with async_session_maker() as db:
            user = await db.get(User, user_id)
            if user and user.telegram_chat_id:
                await self.send_message(user.telegram_chat_id, message)

    async def run_polling(self):
        """
        The main polling loop. This is a long-running, blocking operation
        that MUST be run as a background task.
        """
        if not self.application:
            return  # Do nothing if the bot is not configured

        logger.info("Telegram bot polling is starting...")
        try:
            # These are the blocking parts
            await self.application.initialize()
            await self.application.start()
            await self.application.updater.start_polling()

            # Keep the task alive. In reality, the line above blocks forever.
            # This is a fallback to prevent the task from exiting if start_polling ever changes.
            while not self.application.updater.is_idle:
                await asyncio.sleep(1)

        except asyncio.CancelledError:
            logger.info("Telegram polling task is being cancelled.")
        finally:
            # Ensure a graceful shutdown
            if self.application and self.application.updater and self.application.updater.is_running:
                await self.application.updater.stop()
            if self.application and self.application.running:
                await self.application.stop()
                await self.application.shutdown()
            logger.info("Telegram bot polling has stopped.")

    async def stop_polling(self):
        if self.application.updater and self.application.updater.is_running:
            await self.application.updater.stop()
        await self.application.stop()
        await self.application.shutdown()
        logger.info("Telegram bot polling stopped.")

# Instantiate the service globally
telegram_service = TelegramService(settings.TELEGRAM_BOT_TOKEN)






class MarketRegimeService:
    def __init__(self):
        self.regime_cache: Dict[str, MarketRegime] = {}
        self._lock = asyncio.Lock()

    async def update_regime(self, symbol: str = "BTC/USDT"):
        try:
            exchange = await exchange_manager.get_fault_tolerant_public_client()
            if not exchange: return
            ohlcv = await exchange.fetch_ohlcv(symbol, '1d', limit=201)
            if not ohlcv or len(ohlcv) < 201: return
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['ma_200'] = df['close'].rolling(window=200).mean()
            df['ma_50'] = df['close'].rolling(window=50).mean()
            latest = df.iloc[-1]
            new_regime = MarketRegime.SIDEWAYS
            if latest['close'] > latest['ma_200'] and latest['ma_50'] > latest['ma_200']:
                new_regime = MarketRegime.BULLISH
            elif latest['close'] < latest['ma_200'] and latest['ma_50'] < latest['ma_200']:
                new_regime = MarketRegime.BEARISH
            async with self._lock:
                self.regime_cache['default'] = new_regime
            logger.info(f"Market regime updated: {new_regime.value}")
        except Exception as e:
            logger.error(f"Failed to update market regime: {e}")

    def get_regime(self) -> MarketRegime:
        return self.regime_cache.get('default', MarketRegime.SIDEWAYS)

    async def run_analysis_loop(self):
        while True:
            await self.update_regime()
            await asyncio.sleep(60 * 15)


market_regime_service = MarketRegimeService()


class TradingService:
    async def get_exchange_client(self, exchange_name: str, api_key: str, secret_key: str) -> Optional[ccxt.Exchange]:
        exchange_class = getattr(ccxt, exchange_name, None)
        if not exchange_class:
            logger.error(f"Exchange {exchange_name} not supported by CCXT.")
            return None
        exchange = exchange_class({'apiKey': api_key, 'secret': secret_key, 'enableRateLimit': True})
        return exchange

    async def fetch_realtime_price(self, exchange_name: str, symbol: str) -> Optional[float]:
        """Fetches the latest price using the shared public exchange client."""
        try:
            # --- FIX: Correct call to fault-tolerant client ---
            exchange = await exchange_manager.get_fault_tolerant_public_client()
            if not exchange: return None
            ticker = await exchange.fetch_ticker(symbol)
            return ticker['last']
        except Exception as e:
            logger.error(f"Error fetching price for {symbol} on any exchange: {e}")
            return None

    # --- RENAMED & OVERHAULED: This is the new core sizing engine ---
    async def get_position_size(self, user: User, bot: TradingBot, exchange: ccxt.Exchange) -> Decimal:
        strategy = bot.sizing_strategy
        params = json.loads(bot.sizing_params) if bot.sizing_params else {}

        if strategy == PositionSizingStrategy.FIXED_AMOUNT.value:
            # --- FIX: Must await the now-async function ---
            return await self._size_fixed_amount(user, bot, params, exchange)
        elif strategy == PositionSizingStrategy.FIXED_FRACTIONAL.value:
            return await self._size_fixed_fractional(user, bot, params, exchange)
        elif strategy == PositionSizingStrategy.ATR_VOLATILITY_TARGET.value:
            return await self._size_atr_volatility(user, bot, params, exchange)
        else:
            logger.warning(f"Unknown sizing strategy '{strategy}'. Defaulting to fixed amount.")
            return await self._size_fixed_amount(user, bot, params, exchange)

    # --- NEW: Sizing Model Implementations ---
    async def _size_fixed_amount(self, user: User, bot: TradingBot, params: Dict, exchange: ccxt.Exchange) -> Decimal:
        investment_usd = Decimal(
            str(params.get("amount_usd"))) if "amount_usd" in params else self.get_dynamic_investment_usd(user)
        try:
            ticker = await exchange.fetch_ticker(bot.symbol)
            price = Decimal(str(ticker['last']))
            return investment_usd / price if price > 0 else Decimal(0)
        except Exception as e:
            logger.error(f"Failed to fetch price for fixed amount sizing: {e}")
            return Decimal(0)

    async def _size_fixed_fractional(self, user: User, bot: TradingBot, params: Dict,
                                     exchange: ccxt.Exchange) -> Decimal:
        """Sizes position to risk a fixed percentage of the total account value."""
        risk_percentage = Decimal(str(params.get("risk_percentage", 1.0))) / 100  # Default to 1% risk
        if not bot.stop_loss_percentage:
            logger.warning(f"Fixed Fractional sizing requires a Stop Loss. Bot {bot.id} has none. Aborting trade.")
            return Decimal(0)

        try:
            balance = await exchange.fetch_balance()
            quote_currency = bot.symbol.split('/')[1]
            total_value_quote = Decimal(str(balance['total'][quote_currency]))

            risk_amount_quote = total_value_quote * risk_percentage

            ticker = await exchange.fetch_ticker(bot.symbol)
            price = Decimal(str(ticker['last']))

            # How much do we lose per unit of the base asset if SL is hit?
            stop_loss_decimal = Decimal(str(bot.stop_loss_percentage)) / 100
            loss_per_unit = price * stop_loss_decimal

            if loss_per_unit <= 0: return Decimal(0)

            # Position size = (Total Amount to Risk) / (Loss per Unit)
            position_size_base = risk_amount_quote / loss_per_unit
            return position_size_base

        except Exception as e:
            logger.error(f"Failed to calculate Fixed Fractional size: {e}")
            return Decimal(0)

    async def _size_atr_volatility(self, user: User, bot: TradingBot, params: Dict, exchange: ccxt.Exchange) -> Decimal:
        """Sizes position based on market volatility (ATR)."""
        risk_percentage = Decimal(str(params.get("risk_percentage", 1.0))) / 100

        try:
            # Fetch recent candles to calculate ATR
            ohlcv = await exchange.fetch_ohlcv(bot.symbol, '1h', limit=20)
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['tr'] = np.maximum(df['high'] - df['low'],
                                  np.maximum(abs(df['high'] - df['close'].shift()),
                                             abs(df['low'] - df['close'].shift())))
            atr = df['tr'].rolling(window=14).mean().iloc[-1]

            if atr <= 0:
                logger.warning(f"ATR is zero for {bot.symbol}, cannot calculate size.")
                return Decimal(0)

            balance = await exchange.fetch_balance()
            quote_currency = bot.symbol.split('/')[1]
            total_value_quote = Decimal(str(balance['total'][quote_currency]))

            risk_amount_quote = total_value_quote * risk_percentage

            # Position size = (Total Amount to Risk) / (Volatility per Unit)
            position_size_base = risk_amount_quote / Decimal(str(atr))
            return position_size_base

        except Exception as e:
            logger.error(f"Failed to calculate ATR Volatility size: {e}")
            return Decimal(0)

    def get_dynamic_investment_usd(self, user: User) -> Decimal:
        """
        Determines the fixed USD amount a bot should trade based on the user's subscription plan.
        This is used for paper trading and as a fallback for real trading.
        """
        base_investment_usd = Decimal("11.00")  # Base trade size

        plan_multipliers = {
            SubscriptionPlan.BASIC.value: Decimal("1.0"),  # # Basic (Live Trading): 1.0 * $11 = $11 trade sizes
            SubscriptionPlan.PREMIUM.value: Decimal("1.0"),  # # Premium (Live Trading): 1.0 * $11 = $11 trade siz
            SubscriptionPlan.ULTIMATE.value: Decimal("4.5454545454545455"),
            # Ultimate (Live Trading): ~4.545 * $11 = ~$50 trade size
        }
        # Superusers get a larger default size for testing purposes.
        if user.role == UserRole.SUPERUSER.value:
            return Decimal("100.00")

        multiplier = plan_multipliers.get(user.subscription_plan, Decimal("1.0"))
        return base_investment_usd * multiplier

    async def place_order_internal(
            self,
            user: User,
            bot: TradingBot,
            side: str,
            amount_to_trade_base: Decimal,
            price: Decimal
    ):
        """Executes a trade on the internal custodial ledger system."""
        base_asset, quote_asset = bot.symbol.split('/')
        cost_quote = amount_to_trade_base * price

        async with async_session_maker() as db:
            async with db.begin():  # Atomic transaction
                try:
                    if side == 'buy':
                        # Debit Quote Asset (e.g., USDT)
                        await wallet_service._update_balance(db, user.id, quote_asset, -cost_quote,
                                                             TransactionType.TRADE, notes=f"Bot Trade BUY {bot.symbol}")
                        # Credit Base Asset (e.g., BTC)
                        await wallet_service._update_balance(db, user.id, base_asset, amount_to_trade_base,
                                                             TransactionType.TRADE, notes=f"Bot Trade BUY {bot.symbol}")
                    elif side == 'sell':
                        # Debit Base Asset (e.g., BTC)
                        await wallet_service._update_balance(db, user.id, base_asset, -amount_to_trade_base,
                                                             TransactionType.TRADE,
                                                             notes=f"Bot Trade SELL {bot.symbol}")
                        # Credit Quote Asset (e.g., USDT)
                        await wallet_service._update_balance(db, user.id, quote_asset, cost_quote,
                                                             TransactionType.TRADE,
                                                             notes=f"Bot Trade SELL {bot.symbol}")
                        # Notify user of successful trade
                    msg = f"✅ *Internal Trade Executed*\nBot: `{bot.name}`\n{side.upper()} `{amount_to_trade_base:.6f}` `{base_asset}` at `~${price:.2f}`"
                    send_telegram_notification_task.delay(user_id=user.id, message=msg)
                    # In production, the platform must now hedge this exposure on its omnibus account.
                    # This would be a call to a separate hedging service.
                except InsufficientFundsError as e:
                    await websocket_manager.send_personal_message(
                        {"type": "error", "bot_id": str(bot.id), "message": f"Order Failed: {e}"}, user.id)

                    err_msg = f"Order Failed for bot '{bot.name}': {e}"
                    await websocket_manager.send_personal_message(
                        {"type": "error", "bot_id": str(bot.id), "message": err_msg}, user.id)
                    await telegram_service.notify_user(user.id,
                                                       f"🛑 Bot `{bot.name}` stopped due to insufficient funds.")
                    bot_to_update = await db.get(TradingBot, bot.id)
                    if bot_to_update: bot_to_update.is_active = False
                except Exception as e:
                    logger.error(f"Critical error during internal trade for bot {bot.id}: {e}")
                    raise HTTPException(status_code=500, detail="Internal trading engine error.")

    async def place_order_external(
            self,
            db: AsyncSession,
            user: User,
            bot: TradingBot,
            side: str,
            amount_to_trade: Decimal,
            price: Decimal,
            exchange: ccxt.Exchange,  # The authenticated exchange client is passed in
            order_type: str = 'limit'
    ):
        """
        Executes a trade on a user's external exchange account (non-custodial).
        This is a fully robust implementation.
        """
        try:
            ticker = await exchange.fetch_ticker(bot.symbol)
            if side == 'buy':
                limit_price = Decimal(str(ticker.get('ask', price)))
                order = await exchange.create_order(bot.symbol, order_type, side, float(amount_to_trade),
                                                    float(limit_price))
            elif side == 'sell':
                limit_price = Decimal(str(ticker.get('bid', price)))
                order = await exchange.create_order(bot.symbol, order_type, side, float(amount_to_trade),
                                                    float(limit_price))

            # Log the successful external trade
            trade = TradeLog(
                user_id=user.id, bot_id=bot.id, exchange=bot.exchange, symbol=bot.symbol,
                order_id=order['id'], side=order['side'], type=order['type'],
                amount=order.get('filled', order.get('amount')),
                price=order.get('average', order.get('price', limit_price)),
                cost=order.get('cost'), is_paper_trade=False,
                timestamp=datetime.datetime.fromtimestamp(order['timestamp'] / 1000, tz=datetime.timezone.utc)
            )
            db.add(trade)
            await db.commit()
            await websocket_manager.send_personal_message({"type": "trade_executed", "bot_id": str(bot.id),
                                                           "details": TradeLogSchema.from_orm(trade).model_dump()},
                                                          user.id)
            logger.info(f"External trade executed for bot {bot.id}: Order ID {order['id']}")

        except (ccxt.InsufficientFunds, ccxt.InvalidOrder, ValueError) as e:
            await websocket_manager.send_personal_message(
                {"type": "error", "bot_id": str(bot.id), "message": f"Order Failed on {bot.exchange}: {e}"}, user.id)
            bot.is_active = False;
            db.add(bot);
            await db.commit()
        except ccxt.NetworkError as e:
            await websocket_manager.send_personal_message({"type": "bot_log", "bot_id": str(bot.id),
                                                           "message": "A temporary network error occurred. Will retry."},
                                                          user.id)
        except Exception as e:
            logger.error(f"Unexpected external trading error for bot {bot.id}: {e}", exc_info=True)
            bot.is_active = False;
            db.add(bot);
            await db.commit()

    async def update_bot_pnl(self, db: AsyncSession, bot_id: PythonUUID):
        """Calculates and updates the P&L for a specific bot."""
        logs_result = await db.execute(
            select(TradeLog).where(TradeLog.bot_id == bot_id)
        )
        logs = logs_result.scalars().all()

        live_pnl = 0.0
        paper_pnl = 0.0

        for log in logs:
            # Sells are positive (income), buys are negative (expense)
            pnl_impact = log.cost if log.side == 'sell' else -log.cost
            if log.is_paper_trade:
                paper_pnl += pnl_impact
            else:
                live_pnl += pnl_impact

        bot = await db.get(TradingBot, bot_id)
        if bot:
            bot.live_pnl_usd = live_pnl
            bot.paper_pnl_usd = paper_pnl
            await db.commit()
            logger.info(f"Updated PNL for bot {bot_id}: Live=${live_pnl:.2f}, Paper=${paper_pnl:.2f}")


trading_service = TradingService()


class MT5GatewayService:
    def __init__(self):
        self._is_connected = False
        self._lock = asyncio.Lock()
        # --- THIS IS THE KEY CHANGE ---
        # This will store the last successful credentials.
        self._connection_info: Dict[str, Any] = {}
        logger.info("MT5 Gateway Service initialized.")

    async def _run_in_thread(self, func, *args, **kwargs):
        return await asyncio.to_thread(func, *args, **kwargs)

    async def connect_and_login(self, login: int, password: str, server: str) -> bool:
        """
        Establishes a connection. This is now the ONLY public method to change the connection state.
        """
        async with self._lock:
            # If already connected, disconnect first to ensure a fresh login
            if self._is_connected:
                await self._run_in_thread(mt5.shutdown)
                self._is_connected = False

            def _connect():
                if not mt5.initialize():
                    logger.error(f"MT5 initialize() failed: {mt5.last_error()}")
                    mt5.shutdown()
                    return False
                if not mt5.login(login=login, password=password, server=server):
                    logger.error(f"MT5 login failed for account {login}: {mt5.last_error()}")
                    mt5.shutdown()
                    return False
                return True

            success = await self._run_in_thread(_connect)

            if success:
                self._is_connected = True
                # Persist the successful credentials for automatic reconnection
                self._connection_info = {"login": login, "password": password, "server": server}
                logger.info(f"MT5 Gateway successfully connected and logged into account {login}.")
            else:
                self._is_connected = False
                self._connection_info = {}  # Clear credentials on failure

            return success

    async def shutdown(self):
        async with self._lock:
            if self._is_connected:
                await self._run_in_thread(mt5.shutdown)
                self._is_connected = False
                # We keep _connection_info so it can reconnect later if needed
                logger.info("MT5 Gateway connection has been shut down.")

    async def _ensure_connection(self):
        """
        A robust internal method to check and silently re-establish a connection if lost.
        This is the core of the stability fix.
        """
        # First, do a quick, non-blocking check
        if self._is_connected and await self._run_in_thread(mt5.terminal_info):
            return  # Connection is healthy

        # If the check fails or we are not connected, acquire the lock and perform a full reconnect.
        async with self._lock:
            # Double-check inside the lock to prevent race conditions
            if self._is_connected and await self._run_in_thread(mt5.terminal_info):
                return

            logger.warning("MT5 connection is down or unresponsive. Attempting to reconnect...")
            if not self._connection_info:
                raise ConnectionError(
                    "MT5 Gateway has no credentials to use for reconnection. Please connect on the Integrations page.")

            # Attempt to reconnect using the stored credentials
            reconnect_success = await self.connect_and_login(
                login=self._connection_info["login"],
                password=self._connection_info["password"],
                server=self._connection_info["server"]
            )

            if not reconnect_success:
                raise ConnectionError("Failed to re-establish connection with the MT5 terminal.")

    async def execute_trade(self, symbol: str, action: str, volume: float, price: float, sl_pips: int,
                            tp_pips: int) -> Dict:
        """
        A high-level function to execute a trade. It handles connection checks
        and translates the trade request into a native MT5 order.
        """
        async with self._lock:
            await self._ensure_connection()

            def _execute():
                # 1. Get the correct symbol name for the broker
                symbol_info = mt5.symbol_info(symbol)
                if symbol_info is None:
                    return {"status": "error", "message": f"Symbol {symbol} not found on MT5 server."}

                point = symbol_info.point
                ask_price = symbol_info.ask
                bid_price = symbol_info.bid

                # 2. Determine order type and price
                trade_type = mt5.ORDER_TYPE_BUY if action.lower() == 'buy' else mt5.ORDER_TYPE_SELL
                trade_price = ask_price if action.lower() == 'buy' else bid_price

                # 3. Calculate Stop Loss and Take Profit levels
                sl_price = trade_price - (sl_pips * point) if action.lower() == 'buy' else trade_price + (
                            sl_pips * point)
                tp_price = trade_price + (tp_pips * point) if action.lower() == 'buy' else trade_price - (
                            tp_pips * point)

                # 4. Construct the order request dictionary
                request = {
                    "action": mt5.TRADE_ACTION_DEAL,
                    "symbol": symbol_info.name,
                    "volume": volume,
                    "type": trade_type,
                    "price": trade_price,
                    "sl": sl_price,
                    "tp": tp_price,
                    "deviation": 10,  # Slippage tolerance in points
                    "magic": 234001,  # Magic number to identify trades from our bot
                    "comment": "QuantumLeap AI",
                    "type_time": mt5.ORDER_TIME_GTC,
                    "type_filling": mt5.ORDER_FILLING_FOK,  # Or FILLING_IOC
                }

                # 5. Send the order and process the result
                result = mt5.order_send(request)
                if result is None:
                    return {"status": "error", "message": "order_send() failed, no result returned."}

                if result.retcode == mt5.TRADE_RETCODE_DONE:
                    return {
                        "status": "success",
                        "message": "Trade executed successfully.",
                        "order_id": result.order,
                        "deal_id": result.deal
                    }
                else:
                    return {
                        "status": "error",
                        "message": f"Order failed: {result.comment}",
                        "retcode": result.retcode
                    }

            # Run the blocking trade execution in a thread
            return await self._run_in_thread(_execute)

    async def fetch_historical_data(self, symbol: str, timeframe: str, start_date: datetime.datetime,
                                    end_date: datetime.datetime) -> Optional[pd.DataFrame]:
        """
        A robust method to fetch a large chunk of historical OHLCV data directly
        from the connected MT5 terminal.
        """
        async with self._lock:
            await self._ensure_connection()

            def _fetch():
                # 1. Map our standard timeframe string to the MT5 TIMEFRAME enum
                timeframe_map = {
                    '1m': mt5.TIMEFRAME_M1, '5m': mt5.TIMEFRAME_M5, '15m': mt5.TIMEFRAME_M15,
                    '1h': mt5.TIMEFRAME_H1, '4h': mt5.TIMEFRAME_H4, '1d': mt5.TIMEFRAME_D1,
                }
                mt5_timeframe = timeframe_map.get(timeframe)
                if mt5_timeframe is None:
                    raise ValueError(f"Timeframe '{timeframe}' is not supported by the MT5 Gateway.")

                # 2. Fetch the rates (OHLCV data)
                rates = mt5.copy_rates_range(symbol, mt5_timeframe, start_date, end_date)

                if rates is None or len(rates) == 0:
                    logger.warning(f"MT5 returned no historical data for {symbol} in the given range.")
                    return None

                # 3. Convert the numpy array of rates into a pandas DataFrame
                df = pd.DataFrame(rates)
                # Convert the 'time' column from seconds to a datetime object
                df['timestamp'] = pd.to_datetime(df['time'], unit='s')
                df.drop('time', axis=1, inplace=True)

                # Rename columns to match the CCXT standard for seamless integration
                df.rename(columns={
                    'open': 'open', 'high': 'high', 'low': 'low',
                    'close': 'close', 'tick_volume': 'volume'
                }, inplace=True)

                return df[['timestamp', 'open', 'high', 'low', 'close', 'volume']]

            return await self._run_in_thread(_fetch)

    async def get_account_summary(self) -> Optional[Dict[str, Any]]:
        """
        Fetches key account metrics like balance, equity, and currency
        from the connected MT5 terminal.
        Returns None if not connected or if the fetch fails.
        """
        # Do a quick, non-locking check first. If not connected, don't even try.
        if not self._is_connected:
            return None

        async with self._lock:
            # We don't need a full _ensure_connection here, as we can fail gracefully.
            # Just check the current state.
            if not self._is_connected:
                return None

            def _fetch_summary():
                account_info = mt5.account_info()
                if account_info:
                    return {
                        "balance": Decimal(str(account_info.balance)),
                        "equity": Decimal(str(account_info.equity)),
                        "currency": account_info.currency,  # e.g., "JPY", "USD"
                        "profit": Decimal(str(account_info.profit)),
                    }
                return None

            return await self._run_in_thread(_fetch_summary)
# Instantiate the gateway service globally
mt5_gateway_service = MT5GatewayService()

# --- NEW CLASS: MarketDataStreamer ---
# This service manages live data streams from exchanges.
class MarketDataStreamer:
    def __init__(self):
        self._streams: Dict[str, asyncio.Task] = {}
        # A pub/sub system: subscribers is a dictionary where keys are symbols
        # and values are lists of asyncio.Queues for each bot listening to that symbol.
        self._subscribers: Dict[str, List[asyncio.Queue]] = defaultdict(list)
        self._session = aiohttp.ClientSession()

    async def subscribe(self, symbol: str, exchange: str) -> asyncio.Queue:
        """A bot calls this to subscribe to a symbol's live data feed."""
        queue = asyncio.Queue()
        stream_key = f"{exchange}:{symbol}".lower()
        self._subscribers[stream_key].append(queue)

        # If this is the first subscriber for this stream, start the WebSocket connection.
        if stream_key not in self._streams:
            logger.info(f"Starting new market stream for {stream_key}")
            self._streams[stream_key] = asyncio.create_task(self._stream_market_data(stream_key))

        return queue

    async def unsubscribe(self, queue: asyncio.Queue, symbol: str, exchange: str):
        """A bot calls this when it stops."""
        stream_key = f"{exchange}:{symbol}".lower()
        if queue in self._subscribers[stream_key]:
            self._subscribers[stream_key].remove(queue)

        # If there are no more subscribers, close the WebSocket connection.
        if not self._subscribers[stream_key]:
            logger.info(f"Closing market stream for {stream_key} due to no subscribers.")
            if stream_key in self._streams:
                self._streams[stream_key].cancel()
                del self._streams[stream_key]

    async def _stream_market_data(self, stream_key: str):
        """The core coroutine that connects to an exchange's WebSocket and pushes data."""
        exchange_name, symbol = stream_key.split(':')
        ws_symbol = symbol.replace('/', '').lower()
        url = f"wss://stream.binance.com:9443/ws/{ws_symbol}@kline_1m"

        while True:
            try:
                async with self._session.ws_connect(url) as ws:
                    logger.info(f"Successfully connected to WebSocket for {stream_key}")
                    async for msg in ws:
                        if msg.type == aiohttp.WSMsgType.TEXT:
                            data = json.loads(msg.data)
                            if 'k' in data:
                                kline = data['k']
                                if kline['x']:
                                    # Publish to bot queues
                                    for queue in self._subscribers[stream_key]:
                                        await queue.put(kline)

                                    # --- ROBUST UI STREAMING ---
                                    # Create the payload for the UI.
                                    chart_update_payload = {
                                        "type": "market_data_update",
                                        "symbol": symbol.upper(),
                                        "kline": {
                                            "time": kline['t'] // 1000,
                                            "open": float(kline['o']),
                                            "high": float(kline['h']),
                                            "low": float(kline['l']),
                                            "close": float(kline['c'])
                                        }
                                    }
                                    # Broadcast ONLY to users viewing this specific symbol.
                                    await websocket_manager.broadcast_to_symbol_viewers(symbol, chart_update_payload)
            except Exception as e:
                logger.error(f"WebSocket error for {stream_key}: {e}. Reconnecting in 10 seconds...")
                await asyncio.sleep(10)

    async def close(self):
        """Gracefully close all connections on shutdown."""
        for task in self._streams.values():
            task.cancel()
        await self._session.close()


# Instantiate the streamer globally
market_streamer = MarketDataStreamer()


class SMCAnalyzer:
    def find_swing_highs_lows(self, df: pd.DataFrame, window: int = 5) -> pd.DataFrame:
        """Identifies swing highs and lows, a prerequisite for BOS/CHoCH."""
        df['is_swing_high'] = (df['high'] >= df['high'].rolling(window, center=True, min_periods=1).max())
        df['is_swing_low'] = (df['low'] <= df['low'].rolling(window, center=True, min_periods=1).min())
        return df

    def find_bos_choch(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Identifies Break of Structure (BOS) and Change of Character (CHoCH).
        This is a sophisticated logic that tracks the state of the trend.
        """
        df = self.find_swing_highs_lows(df)
        swing_highs = df[df['is_swing_high']]['high']
        swing_lows = df[df['is_swing_low']]['low']

        last_swing_high = None
        last_swing_low = None
        trend = 0  # 1 for bullish, -1 for bearish

        df['bos'] = 0
        df['choch'] = 0

        for i in range(1, len(df)):
            # Determine the most recent swing points
            if df.loc[i, 'is_swing_high']:
                last_swing_high = df.loc[i, 'high']
            if df.loc[i, 'is_swing_low']:
                last_swing_low = df.loc[i, 'low']

            if last_swing_high is None or last_swing_low is None:
                continue

            # Bullish Trend Logic
            if trend >= 0:
                # Break of Structure (new higher high)
                if df.loc[i, 'high'] > last_swing_high:
                    df.loc[i, 'bos'] = 1  # Bullish BOS
                    last_swing_high = df.loc[i, 'high']  # Update the peak
                    trend = 1

                # Change of Character (new lower low)
                elif df.loc[i, 'low'] < last_swing_low:
                    df.loc[i, 'choch'] = -1  # Bearish CHoCH
                    last_swing_low = df.loc[i, 'low']  # Update the trough
                    trend = -1

            # Bearish Trend Logic
            elif trend == -1:
                # Break of Structure (new lower low)
                if df.loc[i, 'low'] < last_swing_low:
                    df.loc[i, 'bos'] = -1  # Bearish BOS
                    last_swing_low = df.loc[i, 'low']
                    trend = -1

                # Change of Character (new higher high)
                elif df.loc[i, 'high'] > last_swing_high:
                    df.loc[i, 'choch'] = 1  # Bullish CHoCH
                    last_swing_high = df.loc[i, 'high']
                    trend = 1

        return df

    def find_order_blocks(self, df: pd.DataFrame) -> pd.DataFrame:
        """Identifies potential bullish and bearish order blocks."""
        df['bullish_ob'] = 0.0
        df['bearish_ob'] = 0.0

        # A bullish order block is the last down-candle before a strong up-move.
        # A bearish order block is the last up-candle before a strong down-move.
        for i in range(1, len(df)):
            # Potential Bullish OB: down-candle
            if df.loc[i, 'close'] < df.loc[i, 'open']:
                # Followed by a strong up-move (engulfing or large body)
                if i + 1 < len(df) and df.loc[i + 1, 'close'] > df.loc[i - 1, 'high']:
                    df.loc[i, 'bullish_ob'] = df.loc[i, 'low']

            # Potential Bearish OB: up-candle
            if df.loc[i, 'close'] > df.loc[i, 'open']:
                # Followed by a strong down-move
                if i + 1 < len(df) and df.loc[i + 1, 'low'] < df.loc[i - 1, 'low']:
                    df.loc[i, 'bearish_ob'] = df.loc[i, 'high']

        # Forward-fill to keep the order block level valid until it's mitigated
        df['bullish_ob'] = df['bullish_ob'].replace(0, np.nan).ffill()
        df['bearish_ob'] = df['bearish_ob'].replace(0, np.nan).ffill()

        return df


class MLService:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.features = None
        # --- NEW: Define the absolute base path to the directory containing main.py ---
        self.BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        self._load_model_artifacts()

    def _load_model_artifacts(self):
        """
        Loads the pre-trained XGBoost model, scaler, and feature list from disk
        using robust, absolute file paths.
        """
        # --- THIS IS THE FIX ---
        # The `ai_models_available` check from strategies.py is the true source of truth.
        if not ai_models_available:
            logger.warning("Optimus AI features disabled because onnxruntime is not available or failed to load.")
            self.model = self.scaler = self.features = None
            return

        try:
            logger.info("Loading Optimus AI model artifacts...")

            # Construct absolute paths to each model file, assuming they are in a /models subfolder
            # relative to the location of the main.py file.
            base_dir = os.path.dirname(os.path.abspath(__file__))
            model_path = os.path.join(base_dir, 'models', 'lgbm_signal_model.onnx')
            scaler_path = os.path.join(base_dir, 'models', 'scaler.pkl')
            features_path = os.path.join(base_dir, 'models', 'features.pkl')

            if not all(os.path.exists(p) for p in [model_path, scaler_path, features_path]):
                raise FileNotFoundError("One or more model artifact files are missing from the app/models/ directory.")

            self.model = ort.InferenceSession(model_path)
            self.scaler = joblib.load(scaler_path)
            self.features = joblib.load(features_path)

            logger.info("Optimus AI model artifacts loaded successfully.")

        except FileNotFoundError as e:
            logger.error(f"!!! CRITICAL: Could not load Optimus AI model artifacts. {e}")
            self.model = self.scaler = self.features = None
        except Exception as e:
            logger.error(f"!!! CRITICAL: An error occurred while loading model artifacts: {e}", exc_info=True)
            self.model = self.scaler = self.features = None

    def analyze_market_conditions(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Analyzes market data using the trained XGBoost model to produce a
        market condition score and actionable insights.
        """
        if self.model is None or self.scaler is None or self.features is None:
            return {"score": 0, "summary": "AI Model Offline", "prediction": "N/A", "indicators": {}}

        # 1. Engineer the same features as during training
        # We need to ensure the input df has enough data
        if len(df) < 200:  # EMA(200) needs about 200 periods
            return {"score": 0, "summary": "Insufficient Data", "prediction": "N/A", "indicators": {}}

        df.ta.rsi(length=14, append=True)
        df.ta.macd(fast=12, slow=26, signal=9, append=True)
        df.ta.bbands(length=20, std=2, append=True)
        df.ta.atr(length=14, append=True)
        df.ta.ema(length=50, append=True)
        df.ta.ema(length=200, append=True)
        df.dropna(inplace=True)

        if df.empty:
            return {"score": 0, "summary": "Insufficient Data", "prediction": "N/A", "indicators": {}}

        # 2. Get the latest row of features and scale them
        latest_features = df[self.features].iloc[-1:].copy()
        latest_features_scaled = self.scaler.transform(latest_features)

        # 3. Make a prediction
        # The model outputs the probability of the positive class (1 = Buy)
        buy_probability = self.model.predict(xgb.DMatrix(latest_features_scaled))[0]

        # 4. Convert probability to our Optimus Score and Summary
        # We map the probability [0, 1] to a score [-1, 1]
        optimus_score = (buy_probability - 0.5) * 2

        summary = "Neutral"
        if optimus_score > 0.6:
            summary = "Strongly Bullish"
        elif optimus_score > 0.2:
            summary = "Mildly Bullish"
        elif optimus_score < -0.6:
            summary = "Strongly Bearish"
        elif optimus_score < -0.2:
            summary = "Mildly Bearish"

        # 5. Get some human-readable indicator values for the Co-Pilot UI
        indicators = {
            "RSI (14)": round(latest_features['RSI_14'].iloc[0], 2),
            "MACD Line": round(latest_features['MACD_12_26_9'].iloc[0], 2),
            "Volatility (ATRP)": f"{(latest_features['ATRr_14'].iloc[0]).round(2)}%",  # pandas-ta names ATRP as ATRr
        }

        return {
            "score": round(optimus_score, 2),
            "summary": summary,
            "prediction": f"{(buy_probability * 100):.1f}% Bullish",
            "indicators": indicators
        }

    async def get_market_sentiment(self, query: str) -> dict:
        async with aiohttp.ClientSession() as session:
            url = f"https://newsapi.org/v2/everything?q={query}&apiKey={settings.NEWS_API_KEY}&language=en&sortBy=publishedAt&pageSize=20"
            try:
                async with session.get(url) as response:
                    if response.status != 200:
                        logger.error(f"NewsAPI error: {await response.text()}")
                        return {"compound": 0, "source": "newsapi", "status": "error"}
                    data = await response.json()
                    articles = data.get('articles', [])
                    if not articles: return {"compound": 0, "source": "newsapi", "status": "no_articles"}
                    sentiment_scores = []
                    for article in articles:
                        text_to_analyze = (article['title'] or "") + " " + (article['description'] or "")
                        if text_to_analyze.strip():
                            score = self.sentiment_analyzer.polarity_scores(text_to_analyze)
                            sentiment_scores.append(score['compound'])
                    if not sentiment_scores: return {"compound": 0, "source": "newsapi", "status": "no_content"}
                    average_score = sum(sentiment_scores) / len(sentiment_scores)
                    return {"compound": average_score, "source": "newsapi", "status": "success"}
            except Exception as e:
                logger.error(f"Error fetching sentiment: {e}")
                return {"compound": 0, "source": "newsapi", "status": "exception"}

    def analyze_market_conditions_from_tv(self, tv_analysis: Dict) -> Dict[str, Any]:
        """
        Intelligently maps a pre-computed analysis from TradingView into our standard
        Co-Pilot response format. This ensures UI consistency.
        """
        if not tv_analysis or "summary" not in tv_analysis:
            return {"score": 0, "summary": "Data Unavailable", "prediction": "N/A", "indicators": {}}

        # 1. Map TradingView's recommendation to our summary
        tv_summary = tv_analysis["summary"]
        summary_map = {
            "STRONG_BUY": "Strongly Bullish",
            "BUY": "Mildly Bullish",
            "NEUTRAL": "Neutral",
            "SELL": "Mildly Bearish",
            "STRONG_SELL": "Strongly Bearish"
        }
        summary = summary_map.get(tv_summary["RECOMMENDATION"], "Neutral")

        # 2. Convert the summary into a numerical score for consistency
        score_map = {
            "Strongly Bullish": 0.8, "Mildly Bullish": 0.4,
            "Neutral": 0.0,
            "Mildly Bearish": -0.4, "Strongly Bearish": -0.8
        }
        score = score_map.get(summary, 0.0)

        # 3. Extract key indicator values directly from the TradingView analysis
        indicators = {
            "RSI (14)": round(tv_analysis["indicators"].get("RSI", 0), 2),
            "MACD Level": round(tv_analysis["indicators"].get("MACD.macd", 0), 2),
            "Volatility": tv_analysis["indicators"].get("Volatility.D", "N/A")  # Daily volatility
        }

        # 4. Create a user-friendly prediction string
        buy_signals = tv_summary.get("BUY", 0)
        sell_signals = tv_summary.get("SELL", 0)
        total_signals = buy_signals + sell_signals + tv_summary.get("NEUTRAL", 0)
        bullish_prob = (buy_signals / total_signals) * 100 if total_signals > 0 else 50

        return {
            "score": score,
            "summary": summary,
            "prediction": f"{bullish_prob:.1f}% Bullish (via TV)",
            "indicators": indicators
        }


ml_service = MLService()


class LLMService:
    def __init__(self, api_key: Optional[str]):
        self.model = None  # Start with the model as None
        self.request_timestamps = []
        self.rate_limit_lock = Lock()
        self.REQUESTS_PER_MINUTE = 2  # The known limit for the free tier

        # --- ROBUSTNESS FIX 1: Check for API Key at startup ---
        if not api_key:
            logger.error(
                "!!! CRITICAL: GOOGLE_GEMINI_API_KEY is not set. Strategy Sensei and all LLM features will be disabled.")
            return  # Exit the constructor early if no key is provided

        try:
            logger.info("Configuring Google Gemini API...")
            genai.configure(api_key=api_key)

            # --- NEW: Persona 1 - The General Assistant for the public homepage ---
            self.GENERAL_ASSISTANT_PROMPT = """
                    You are a friendly and helpful AI assistant for the QuantumLeap AI trading platform.
                    Your primary goal is to answer user questions about the platform's features, pricing, and capabilities.
                    You should be encouraging and guide potential users to sign up or contact support for more complex issues.
                    NEVER give financial advice. If asked about earnings, explain that results depend on strategy and market conditions.

                    Available Subscription Plans:
                    - Basic: Free. 1 Bot Limit, Spot Trading, Backtesting, Custodial Wallet.
                    - Premium: $29.99/mo. 5 Bots, AI Suggestions (Sensei), Market Sentiment Analysis.
                    - Ultimate: $79.99/mo. 20 Bots, Visual Strategy Builder, Futures Trading, Platform API Access.

                    Keep your answers concise and clear (2-4 sentences).
                    """

            # --- NEW: Persona 2 - The Specialist for the internal strategy builder ---
            self.STRATEGY_SENSEI_PROMPT = """
                    You are "Strategy Sensei", an expert AI assistant for the QuantumLeap trading platform. 
                    Your role is to be a friendly and helpful guide who helps logged-in users build a trading strategy.
                    Your primary goal is to guide the user towards a configuration that can be represented by a specific JSON format. You only recognize four core strategies: "MA_Cross", "Bollinger_Bands", "RSI_MACD_Crossover", and "Smart_Money_Concepts".
                    If the user's request is clear, respond with a confirmation and the final JSON object inside a markdown code block.
                    If the user's request is ambiguous, you MUST ask clarifying questions to guide them towards one of the four strategies.
                    NEVER refuse a request. Your tone is that of a patient, expert teacher.
                    The final JSON format is: {"strategy_name": "STRATEGY_NAME", "params": {...}, "explanation": "..."}
                    """

            self.model = genai.GenerativeModel(model_name='gemini-2.5-pro')

            logger.info("Google Gemini model 'gemini-1.5-pro' loaded successfully.")

        except Exception as e:
            # --- ROBUSTNESS FIX 2: Catch specific authentication errors ---
            # This provides a much clearer log message if the key is bad or the API is disabled.
            logger.error(
                f"!!! CRITICAL: Failed to initialize Google Gemini model. LLM features will be disabled. Error: {e}",
                exc_info=True)
            self.model = None  # Ensure model is None on failure

    async def _rate_limit_wait(self):
        """A robust, async-safe rate limiter."""
        async with self.rate_limit_lock:
            while True:
                now = time.time()
                # Remove all timestamps older than 60 seconds
                self.request_timestamps = [ts for ts in self.request_timestamps if now - ts < 60]

                if len(self.request_timestamps) < self.REQUESTS_PER_MINUTE:
                    self.request_timestamps.append(now)
                    return  # We are within the limit, proceed

                # We are at the limit, calculate how long to wait
                oldest_request_time = self.request_timestamps[0]
                wait_time = 60 - (now - oldest_request_time)
                logger.warning(f"Gemini rate limit approaching. Waiting for {wait_time:.2f} seconds.")
                await asyncio.sleep(wait_time)

    async def _get_response(self, system_prompt: str, user_text: str, history: List[Dict[str, str]]) -> str:
        # --- ROBUSTNESS FIX 3: Check if the model was loaded successfully ---
        if self.model is None:
            logger.error("Attempted to use LLMService, but the model is not available.")
            raise ConnectionError("The AI assistant is currently unavailable due to a configuration error.")

        await self._rate_limit_wait()

        messages_for_api = [{"role": "user", "parts": [system_prompt]}, {"role": "model", "parts": ["Understood. I am ready to assist."]}]
        for message in history:
            role = "user" if message["role"] == "user" else "model"
            messages_for_api.append({'role': role, 'parts': [message["content"]]})
        messages_for_api.append({'role': 'user', 'parts': [user_text]})

        try:
            response = await self.model.generate_content_async(messages_for_api, request_options={'timeout': 60})
            return response.text
        except Exception as e:
            logger.error(f"Error communicating with Google Gemini API: {e}", exc_info=True)
            raise

    async def get_general_assistant_response(self, user_text: str, history: List[Dict[str, str]]) -> str:
        return await self._get_response(self.GENERAL_ASSISTANT_PROMPT, user_text, history)

    async def get_sensei_response(self, user_text: str, history: List[Dict[str, str]]) -> str:
        return await self._get_response(self.STRATEGY_SENSEI_PROMPT, user_text, history)

# Update the instantiation
llm_service = LLMService(api_key=settings.GOOGLE_GEMINI_API_KEY)


class PerformanceAnalyticsService:
    async def update_analytics_for_bot(self, db: AsyncSession, bot_id: PythonUUID):
        """
        Fetches all trades for a bot, calculates advanced performance metrics,
        and saves them to the bot's cache field.
        """
        logs_result = await db.execute(
            select(TradeLog).where(TradeLog.bot_id == bot_id).order_by(TradeLog.timestamp.asc())
        )
        trade_logs = logs_result.scalars().all()

        bot = await db.get(TradingBot, bot_id)
        if not bot: return

        # Segregate logs by paper/live trading
        paper_logs = [log for log in trade_logs if log.is_paper_trade]
        live_logs = [log for log in trade_logs if not log.is_paper_trade]

        analytics = {
            "paper": self.calculate_metrics(paper_logs),
            "live": self.calculate_metrics(live_logs),
        }

        bot.performance_analytics_cache = json.dumps(analytics)
        await db.commit()
        logger.info(f"Updated performance analytics for bot {bot_id}")

    def calculate_metrics(self, trade_logs: List[TradeLog]) -> Dict[str, Any]:
        """Performs the core financial calculations."""
        if len(trade_logs) < 2:
            return {"error": "Insufficient trade data for analysis."}

        trades_df = pd.DataFrame([{
            'timestamp': log.timestamp,
            'pnl': log.cost if log.side == 'sell' else -log.cost
        } for log in trade_logs])

        trades_df.set_index('timestamp', inplace=True)

        # 1. Equity Curve
        initial_capital = 10000  # Assume a starting capital for consistent comparison
        trades_df['equity'] = initial_capital + trades_df['pnl'].cumsum()

        equity_curve_data = trades_df['equity'].reset_index().rename(
            columns={'timestamp': 'date', 'equity': 'value'}).to_dict('records')
        for item in equity_curve_data: item['date'] = item['date'].isoformat()

        # 2. Daily Returns
        daily_returns = trades_df['equity'].resample('D').last().pct_change().dropna()
        if daily_returns.empty: return {"error": "Not enough data for daily return calculation."}

        # 3. Sharpe Ratio (annualized)
        sharpe_ratio = (daily_returns.mean() / daily_returns.std()) * np.sqrt(365) if daily_returns.std() != 0 else 0.0

        # 4. Sortino Ratio (annualized)
        downside_returns = daily_returns[daily_returns < 0]
        downside_std = downside_returns.std()
        sortino_ratio = (daily_returns.mean() / downside_std) * np.sqrt(365) if downside_std != 0 else 0.0

        # 5. Max Drawdown
        cumulative_returns = (1 + daily_returns).cumprod()
        running_max = cumulative_returns.expanding().max()
        drawdown = (cumulative_returns - running_max) / running_max
        max_drawdown = drawdown.min()

        drawdown_curve_data = drawdown.reset_index().rename(columns={'timestamp': 'date', 0: 'value'}).to_dict(
            'records')
        for item in drawdown_curve_data: item['date'] = item['date'].isoformat()

        # 6. Calmar Ratio
        annualized_return = daily_returns.mean() * 365
        calmar_ratio = annualized_return / abs(max_drawdown) if max_drawdown != 0 else 0.0

        return {
            "total_pnl": trades_df['pnl'].sum(),
            "sharpe_ratio": float(sharpe_ratio),
            "sortino_ratio": float(sortino_ratio),
            "calmar_ratio": float(calmar_ratio),
            "max_drawdown": float(max_drawdown),
            "equity_curve": equity_curve_data,
            "drawdown_curve": drawdown_curve_data
        }


performance_analytics_service = PerformanceAnalyticsService()


class CustodialServiceError(Exception):
    """Custom exception for custodial service interactions."""
    pass


class CustodialService:
    def __init__(self, settings: Settings):
        self.api_key = settings.BITGO_API_KEY
        self.base_url = settings.BITGO_API_BASE_URL
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        self.wallet_map = {
            "BTC": settings.BITGO_WALLET_ID_BTC,
            "ETH": settings.BITGO_WALLET_ID_ETH,
            "USDT": settings.BITGO_WALLET_ID_ETH  # Assuming USDT is an ERC20 token on the Ethereum wallet
        }
        self.webhook_secret = settings.BITGO_WEBHOOK_SECRET

    # --- NEW: Real implementation of signature verification ---
    def verify_signature(self, body: bytes, signature_header: Optional[str]) -> bool:
        """Verifies the HMAC-SHA256 signature from the custodial provider."""
        if not signature_header or not self.webhook_secret:
            logger.warning("Webhook received without signature or secret is not configured.")
            return False

        try:
            # The signature is typically a hash of the raw request body
            hasher = hmac.new(self.webhook_secret.encode(), body, hashlib.sha256)
            expected_signature = hasher.hexdigest()

            # Use hmac.compare_digest for timing-attack-resistant comparison
            return hmac.compare_digest(expected_signature, signature_header)
        except Exception as e:
            logger.error(f"Error during webhook signature verification: {e}")
            return False

    async def _make_request(self, method: str, endpoint: str, payload: Optional[Dict] = None) -> Dict:
        """A robust helper method for making authenticated API calls to BitGo."""
        url = f"{self.base_url}{endpoint}"
        async with aiohttp.ClientSession(headers=self.headers) as session:
            try:
                async with session.request(method, url, json=payload) as response:
                    response_data = await response.json()
                    if not 200 <= response.status < 300:
                        error_message = response_data.get("error", "Unknown BitGo API error")
                        logger.error(f"BitGo API Error ({response.status}) on {endpoint}: {error_message}")
                        raise CustodialServiceError(f"Custodial provider error: {error_message}")
                    return response_data
            except aiohttp.ClientConnectorError as e:
                logger.error(f"BitGo connection error: {e}")
                raise CustodialServiceError("Could not connect to custodial provider.")
            except Exception as e:
                logger.error(f"An unexpected error occurred during BitGo request: {e}", exc_info=True)
                raise CustodialServiceError("An unexpected internal error occurred with the custodial provider.")

    async def generate_new_address(self, user_id: str, asset: str) -> Dict:
        """
        Generates a new, unique deposit address for a user and a specific asset.
        This is a 100% real implementation using the BitGo API.
        """
        coin = self._get_coin_identifier(asset)
        wallet_id = self.wallet_map.get(asset)

        if not wallet_id:
            raise CustodialServiceError(f"No wallet configured for asset {asset}")

        endpoint = f"/api/v2/{coin}/wallet/{wallet_id}/address"

        # We label the address with the user's ID for internal tracking.
        # This is a crucial step for associating incoming deposits.
        payload = {
            "label": f"user_deposit_{user_id}"
        }

        try:
            # This is the actual API call to the custodial provider.
            address_data = await self._make_request("POST", endpoint, payload)

            # The webhook for this address must be configured in the BitGo UI.
            # BitGo will call our `/deposit/webhook/crypto` when funds arrive.

            return address_data
        except CustodialServiceError:
            # Re-raise the exception to be handled by the API endpoint.
            raise

    def _get_coin_identifier(self, asset: str) -> str:
        """Maps our internal asset names to BitGo's coin identifiers."""
        # For BitGo's testnet, prefixes are often used.
        prefix = "t" if "test" in self.base_url else ""

        asset_map = {
            "BTC": f"{prefix}btc",
            "ETH": f"{prefix}eth",
            "USDT": f"{prefix}eth"  # ERC20 USDT is on the ETH blockchain
        }

        identifier = asset_map.get(asset.upper())
        if not identifier:
            raise ValueError(f"Asset {asset} is not supported by the custodial service.")
        return identifier


# Instantiate the service globally
custodial_service = CustodialService(settings)


# --- NEW CLASS: StrategyAnalysisService ---
class StrategyAnalysisService:
    smc_analyzer = SMCAnalyzer()  # Add analyzer instance here too
    # --- NEW: Task storage for async optimization ---
    optimization_tasks: Dict[str, Dict[str, Any]] = {}

    async def backtest_strategy(self, strategy_name: str, params: dict, symbol: str, exchange_name: str,
                                start_date: str, end_date: str) -> Dict[str, Any]:
        """
        A robust, multi-venue backtester. It can fetch data from either CCXT exchanges
        or a connected MT5 terminal and run the same strategy logic on either dataset.
        """
        logger.info(
            f"Starting backtest for {strategy_name} on {symbol} ({exchange_name}) from {start_date} to {end_date}")
        df = None
        start_dt = datetime.datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        end_dt = datetime.datetime.fromisoformat(end_date.replace('Z', '+00:00'))

        # --- 1. DATA FETCHING: Route to the correct data source ---
        if exchange_name in [ExchangeName.MT4.value, ExchangeName.MT5.value]:
            # --- MT5 Data Path ---
            try:
                df = await mt5_gateway_service.fetch_historical_data(symbol, '1d', start_dt, end_dt)
                if df is None or df.empty:
                    raise ValueError(f"MT5 Gateway returned no data for {symbol}.")
                logger.info(f"Successfully fetched {len(df)} records from MT5 Gateway.")
            except ConnectionError as e:
                raise HTTPException(status_code=503, detail=f"MT5 Gateway is not connected: {e}")
            except Exception as e:
                logger.error(f"Failed to fetch MT5 historical data: {e}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"An error occurred while fetching data from MT5: {e}")

        else:
            # --- CCXT Data Path (existing logic) ---
            exchange = None
            try:
                exchange = await exchange_manager.get_fault_tolerant_public_client()
                if not exchange: raise HTTPException(503, "Market data providers unavailable.")

                since = exchange.parse8601(f"{start_date}T00:00:00Z")
                all_ohlcv = []
                while since < exchange.parse8601(f"{end_date}T23:59:59Z"):
                    ohlcv = await exchange.fetch_ohlcv(symbol, '1d', since, 1000)
                    if not ohlcv: break
                    all_ohlcv.extend(ohlcv)
                    since = ohlcv[-1][0] + 86400000

                if not all_ohlcv: raise ValueError("CCXT exchange returned no data.")

                df_ccxt = pd.DataFrame(all_ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
                df_ccxt['timestamp'] = pd.to_datetime(df_ccxt['timestamp'], unit='ms')
                df = df_ccxt
                logger.info(f"Successfully fetched {len(df)} records from CCXT ({exchange.id}).")

            except Exception as e:
                logger.error(f"Failed to fetch CCXT historical data: {e}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"An error occurred while fetching data from CCXT: {e}")
            finally:
                if exchange: await exchange.close()

        if df is None or df.empty:
            raise HTTPException(status_code=404,
                                detail="Could not fetch any historical data for the specified parameters.")
        # --- 3. Generate Trading Signals ---
        signals = self._generate_signals(strategy_name, df.copy(), params)

        # --- 4. Simulate Trades and Calculate KPIs ---
        initial_capital = 10000.0
        capital = initial_capital
        position = 0.0
        trades = []
        portfolio_values = []

        for i in range(len(signals)):
            current_capital = capital + (position * signals.iloc[i]['close'])
            portfolio_values.append(current_capital)

            if signals.iloc[i]['signal'] == 1 and capital > 10:
                investment = capital * 0.95
                position += investment / signals.iloc[i]['close']
                capital -= investment
                trades.append({'date': signals.iloc[i]['timestamp'], 'type': 'buy'})
            elif signals.iloc[i]['signal'] == -1 and position > 0:
                capital += position * signals.iloc[i]['close']
                trades.append({'date': signals.iloc[i]['timestamp'], 'type': 'sell'})
                position = 0.0

        if not portfolio_values:
            return {"error": "No trading activity or portfolio data to analyze."}

        # --- 5. Calculate Final Metrics ---
        final_portfolio_value = portfolio_values[-1]
        total_return_pct = ((final_portfolio_value - initial_capital) / initial_capital) * 100

        portfolio_df = pd.DataFrame(portfolio_values, index=signals.index, columns=['value'])
        portfolio_df['returns'] = portfolio_df['value'].pct_change().fillna(0)

        buy_and_hold_return_pct = ((signals.iloc[-1]['close'] - signals.iloc[0]['close']) / signals.iloc[0][
            'close']) * 100

        std_dev_returns = portfolio_df['returns'].std()
        sharpe_ratio = (portfolio_df['returns'].mean() / std_dev_returns) * np.sqrt(365) if std_dev_returns > 0 else 0.0

        downside_returns = portfolio_df['returns'][portfolio_df['returns'] < 0]
        downside_std = downside_returns.std()
        sortino_ratio = (portfolio_df['returns'].mean() / downside_std) * np.sqrt(
            365) if downside_std > 0 and downside_std is not np.nan else 0.0

        cumulative_returns = (1 + portfolio_df['returns']).cumprod()
        peak = cumulative_returns.expanding(min_periods=1).max()
        drawdown = (cumulative_returns - peak) / peak
        max_drawdown_pct = drawdown.min() * 100 if not drawdown.empty else 0.0

        logger.info(f"Backtest completed for {strategy_name}. Return: {total_return_pct:.2f}%")

        return {
            "strategy": strategy_name,
            "params": params,
            "total_return_pct": total_return_pct,
            "buy_and_hold_return_pct": buy_and_hold_return_pct,
            "sharpe_ratio": sharpe_ratio,
            "sortino_ratio": sortino_ratio,
            "max_drawdown_pct": max_drawdown_pct,
            "total_trades": len(trades),
            "final_portfolio_value": final_portfolio_value,
        }

    def _generate_signals(self, strategy_name: str, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        """
        A comprehensive signal generation engine for backtesting.
        This method contains the vectorized logic for ALL pre-built strategies.
        """
        # Ensure a 'signal' column exists with a default of 0 (hold)
        df['signal'] = 0
        df['reason'] = ""  # Add a column for human-readable reasons

        # --- Instantiate the correct strategy class ---
        # This is a robust pattern that reuses the logic from your live bots.
        StrategyClass = STRATEGY_REGISTRY.get(strategy_name)
        if not StrategyClass:
            logger.warning(
                f"Backtester received unknown strategy name: '{strategy_name}'. No signals will be generated.")
            return df

        # --- Use the strategy's vectorized signal generation method ---
        # This is the core of the refactor. We call the same logic the live bots use.
        try:
            # We need to validate the params against the strategy's specific schema
            ParamSchema = PARAM_SCHEMA_REGISTRY.get(strategy_name)
            if ParamSchema:
                validated_params = ParamSchema(**params).model_dump()
            else:
                validated_params = BaseStrategyParams(**params).model_dump()

            # The static method `_generate_signals_vectorized` is called directly.
            # This is much cleaner and avoids instantiating the class unnecessarily for backtesting.
            df_with_signals = StrategyClass._generate_signals_vectorized(df.copy(), validated_params)

            # The strategy returns a DataFrame that includes 'signal' and 'reason' columns.
            # We merge these back into our main DataFrame.
            df['signal'] = df_with_signals['signal']
            df['reason'] = df_with_signals['reason']

        except NotImplementedError:
            # This handles complex strategies like SMC that use an iterative approach
            logger.info(f"Using iterative backtest for complex strategy: {strategy_name}")
            temp_strategy = StrategyClass(params)
            signals = [0] * len(df)
            for i in range(200, len(df)):  # Start after a warmup period
                signal_obj = temp_strategy.generate_signal(df.iloc[0:i])
                if signal_obj.action == "BUY":
                    signals[i] = 1
                elif signal_obj.action == "SELL":
                    signals[i] = -1
            df['signal'] = signals

        except Exception as e:
            logger.error(f"Error generating signals for '{strategy_name}' during backtest: {e}", exc_info=True)
            # Ensure the signal column remains neutral if an error occurs
            df['signal'] = 0

        return df

    async def run_optimization_task(self, task_id: str, user_id: str, request: StrategyOptimizationRequest):
        """
        A robust, asynchronous task runner that provides REAL-TIME progress updates via WebSockets.
        """
        task_store.set_task(task_id, {
            "status": OptimizationStatus.RUNNING,
            "progress": 0.0,
            "results": None,
            "error": None
        })

        param_names = request.parameter_ranges.keys()
        param_values = request.parameter_ranges.values()
        param_combinations = list(itertools.product(*param_values))
        total_runs = len(param_combinations)

        logger.info(
            f"Starting optimization task {task_id} for '{request.strategy_name}' with {total_runs} combinations.")

        results = []
        try:
            for i, combo in enumerate(param_combinations):
                params = dict(zip(param_names, combo))

                try:
                    metrics = await self.backtest_strategy(
                        strategy_name=request.strategy_name,
                        params=params,
                        symbol=request.symbol,
                        exchange_name=request.exchange,
                        start_date=request.start_date,
                        end_date=request.end_date
                    )
                    results.append(OptimizationResult(params=params, metrics=metrics))
                except Exception as e:
                    logger.warning(f"A single backtest run failed within optimization task {task_id}: {e}")

                # --- THIS IS THE REAL-TIME FIX ---
                # After each run, update the shared store and push an update to the user.
                progress = (i + 1) / total_runs
                task_store.update_task_progress(task_id, progress)
                await websocket_manager.send_personal_message({
                    "type": "optimization_progress",
                    "task_id": task_id,
                    "progress": progress
                }, user_id)

            results.sort(key=lambda x: x.metrics.get('sharpe_ratio', -np.inf), reverse=True)
            task_store.complete_task(task_id, results, OptimizationStatus.COMPLETED)
            logger.info(f"Optimization task {task_id} completed successfully.")

        except Exception as e:
            logger.error(f"Optimization task {task_id} failed critically: {e}", exc_info=True)
            task_store.fail_task(task_id, str(e))

        # --- FINAL WEBSOCKET NOTIFICATION ---
        final_status = task_store.get_task(task_id)
        await websocket_manager.send_personal_message({
            "type": "optimization_complete",
            "task_id": task_id,
            "status": final_status['status'],
            "results": final_status.get('results'),
            "error": final_status.get('error')
        }, user_id)


strategy_analysis_service = StrategyAnalysisService()


class VisualStrategyInterpreter:
    def __init__(self, strategy_json: Dict, df: pd.DataFrame):
        self.nodes = {node['id']: node for node in strategy_json.get('nodes', [])}
        self.edges = strategy_json.get('edges', [])
        self.df = df  # The historical or live market data
        self.memo = {}  # Memoization cache to avoid re-calculating indicators

    def evaluate(self) -> str:
        """Evaluates the entire graph and returns 'buy', 'sell', or 'hold'."""
        try:
            # Find the "trigger" node, which is the entry point
            trigger_node = next((n for n in self.nodes.values() if n['type'] == 'trigger'), None)
            if not trigger_node:
                return 'hold'

            # Start the recursive evaluation from the trigger node
            return self._evaluate_node(trigger_node['id'])
        except Exception as e:
            logger.error(f"Visual strategy evaluation failed: {e}", exc_info=True)
            return 'hold'

    def _evaluate_node(self, node_id: str) -> Any:
        """Recursively evaluates a node and its children."""
        if node_id in self.memo:
            return self.memo[node_id]

        node = self.nodes.get(node_id)
        if not node:
            raise ValueError(f"Node {node_id} not found in graph")

        node_type = node['type']
        result = None

        # --- Node Evaluation Logic ---
        if node_type == 'trigger':
            result = True  # Triggers the downstream evaluation
        elif node_type == 'indicatorRSI':
            length = node['data'].get('length', 14)
            self.df.ta.rsi(length=length, append=True)
            result = self.df[f'RSI_{length}'].iloc[-1]
        elif node_type == 'indicatorMACD':
            # This node outputs a dictionary of values
            fast = node['data'].get('fast', 12)
            slow = node['data'].get('slow', 26)
            signal = node['data'].get('signal', 9)
            macd = self.df.ta.macd(fast=fast, slow=slow, signal=signal, append=True)
            result = {
                'macd': macd[f'MACD_{fast}_{slow}_{signal}'].iloc[-1],
                'histogram': macd[f'MACDh_{fast}_{slow}_{signal}'].iloc[-1],
                'signal': macd[f'MACDs_{fast}_{slow}_{signal}'].iloc[-1]
            }
        elif node_type == 'valueNumber':
            result = float(node['data'].get('value', 0))
        elif node_type == 'valuePrice':
            result = self.df[node['data'].get('priceType', 'close')].iloc[-1]
        elif node_type == 'conditionCompare':
            input_a = self._get_input_value(node_id, 'inputA')
            input_b = self._get_input_value(node_id, 'inputB')
            operator = node['data'].get('operator', '>')
            if operator == '>':
                result = input_a > input_b
            elif operator == '<':
                result = input_a < input_b
            elif operator == '=':
                result = input_a == input_b

            # ... add more operators as needed
        elif node_type == 'conditionCrossover':
            series_a = self._get_input_value(node_id, 'inputA_series')  # Expects full pandas Series
            series_b = self._get_input_value(node_id, 'inputB_series')  # Expects full pandas Series
            result = series_a.iloc[-2] < series_b.iloc[-2] and series_a.iloc[-1] > series_b.iloc[-1]
        elif node_type == 'actionBuy':
            input_signal = self._get_input_value(node_id, 'inputSignal')
            if input_signal: return 'buy'
        elif node_type == 'actionSell':
            input_signal = self._get_input_value(node_id, 'inputSignal')
            if input_signal: return 'sell'

        # --- Propagate result to children ---
        if result is None:
            self.memo[node_id] = 'hold'
            return 'hold'

        self.memo[node_id] = result

        # If the node is an action node, we stop here.
        if node_type in ['actionBuy', 'actionSell']:
            return result

        # Find the next node connected to this one's output
        next_edge = next((edge for edge in self.edges if edge['source'] == node_id), None)
        if next_edge:
            return self._evaluate_node(next_edge['target'])

        return 'hold'  # If it's the end of a branch with no action

    def _get_input_value(self, node_id: str, handle_id: str) -> Any:
        """Finds the node connected to a specific input handle and returns its evaluated value."""
        edge = next((e for e in self.edges if e['target'] == node_id and e['targetHandle'] == handle_id), None)
        if not edge:
            # Handle cases where an input is not connected (e.g., use a default value from the node data)
            return self.nodes[node_id]['data'].get(handle_id, 0)

        # This is where the magic happens: we recursively call evaluate on the source node
        return self._evaluate_node(edge['source'])


class StrategyService:
    def __init__(self):
        """
        The constructor that initializes the service. It's crucial that this
        method exists and defines the 'strategies' dictionary.
        """
        # This dictionary maps the strategy names (from the DB/frontend)
        # to the actual Python methods that run them.
        self.strategies = {
            # --- Standard Indicator-Based Strategies ---
            "RSI_MACD_Crossover": self.run_rsi_macd_crossover_strategy,
            "MA_Cross": self.run_ma_cross_strategy,
            "Bollinger_Bands": self.run_bollinger_bands_strategy,

            # --- Advanced Price Action Strategy ---
            "Smart_Money_Concepts": self.run_smc_strategy,

            # --- Specialized, Non-Streaming Strategy ---
            "Grid_Trading": self.run_grid_trading_strategy,

            # --- NEW: Advanced Pre-Built Strategies ---
            "Volatility_Squeeze": self.run_volatility_squeeze_strategy,
            "SuperTrend_ADX_Filter": self.run_supertrend_adx_strategy,
            "Ichimoku_Cloud_Breakout": self.run_ichimoku_breakout_strategy,

            # --- NEW: AI-Powered & Meta Strategies ---
            "AI_Signal_Confirmation": self.run_ai_enhanced_strategy,
            "Optimizer_Portfolio": self.run_optimizer_portfolio_strategy,

            # --- NEW: Externally Driven Strategies ---
            "TradingView_Alert": self.run_webhook_strategy,
            "Visual_Strategy_Builder": self.run_visual_strategy,
        }

        # Helper classes and state management attributes
        self.smc_analyzer = SMCAnalyzer()
        self.running_bot_tasks: Dict[PythonUUID, asyncio.Task] = {}
        self.bot_contexts: Dict[PythonUUID, Dict] = {}
        self._bot_locks = defaultdict(asyncio.Lock)

    async def _get_authenticated_client(self, user_id: str, exchange_name: str) -> Optional[ccxt.Exchange]:
        """
        Securely fetches, decrypts, and creates an authenticated ccxt client for a user.
        """
        async with async_session_maker() as db:
            api_key_entry = await db.scalar(
                select(UserAPIKey).where(UserAPIKey.user_id == user_id, UserAPIKey.exchange == exchange_name)
            )
            if not api_key_entry:
                logger.warning(f"No API keys found for user {user_id} on exchange {exchange_name}.")
                return None
            try:
                # Assuming user_service.decrypt_data exists from our earlier setup
                api_key = user_service.decrypt_data(api_key_entry.api_key_encrypted)
                secret_key = user_service.decrypt_data(api_key_entry.secret_key_encrypted)

                exchange_class = getattr(ccxt, exchange_name)
                client = exchange_class({'apiKey': api_key, 'secret': secret_key})
                return client
            except Exception as e:
                logger.error(f"Failed to create authenticated client for user {user_id} on {exchange_name}: {e}")
                return None

    def _parse_webhook_data(self, alert_body: Dict[str, Any]) -> Optional[str]:
        """
        Parses the incoming TradingView alert body to determine the intended action.
        """
        action = alert_body.get("action", "").lower()
        if action in ["buy", "sell", "close"]:
            return action

        raw_message = str(alert_body).lower()
        if any(keyword in raw_message for keyword in ["buy", "long"]):
            return "buy"
        if any(keyword in raw_message for keyword in ["sell", "short", "close", "exit"]):
            return "sell"
        return None

    async def start_bot(self, db: AsyncSession, user: User, bot: TradingBot, background_tasks: BackgroundTasks):
        """
        Robustly starts a trading bot, handling different strategy types and preventing race conditions.
        """
        async with self._bot_locks[bot.id]:
            current_bot = await db.get(TradingBot, bot.id)
            if not current_bot or current_bot.is_active or current_bot.id in self.running_bot_tasks:
                logger.warning(f"Bot {bot.id} start request ignored (already running or invalid).")
                return

            await telegram_service.notify_user(user.id, f"▶️ Attempting to start bot `{current_bot.name}`...")

            try:
                # --- ROBUSTNESS FIX: Handle MT4/5 bots explicitly ---
                if current_bot.exchange in [ExchangeName.MT4.value, ExchangeName.MT5.value]:
                    current_bot.is_active = True
                    await db.commit()
                    await telegram_service.notify_user(user.id,
                                                       f"🚀 Bot `{current_bot.name}` is now active. Ensure your MT5 Gateway is connected.")
                    await websocket_manager.send_personal_message(
                        {"type": "bot_status", "bot_id": str(current_bot.id), "status": "started"}, user.id)
                    logger.info(f"Activated MT5 bot {current_bot.id}.")
                    return  # IMPORTANT: Exit the function to prevent starting internal processes.

                # --- Logic for Webhook-driven Bots ---
                if current_bot.strategy_name == "TradingView_Alert":
                    if not current_bot.webhook_id:
                        current_bot.webhook_id = f"tv_{secrets.token_urlsafe(16)}"

                    current_bot.is_active = True
                    await db.commit()

                    webhook_url = f"{settings.BASE_URL}/api/bots/webhook/{current_bot.webhook_id}"
                    setup_message = (
                        f"🚀 Bot `{current_bot.name}` is now active and listening for TradingView alerts.\n\n"
                        f"1. **Webhook URL:**\n`{webhook_url}`\n\n"
                        f"2. **Message Body:**\n`{{\"secret\": \"{settings.TRADINGVIEW_WEBHOOK_SECRET}\", \"action\": \"buy\"}}`\n\n"
                        f"Paste the URL into your TradingView alert's 'Webhook URL' field and the message body into the 'Message' field."
                    )
                    await telegram_service.notify_user(user.id, setup_message)
                    await websocket_manager.send_personal_message(
                        {"type": "bot_status", "bot_id": str(current_bot.id), "status": "started",
                         "webhook_url": webhook_url}, user.id
                    )
                    logger.info(f"Activated TradingView webhook bot {current_bot.id}.")
                    return

                # --- Logic for Internally-driven Strategies (MA Cross, RSI, etc.) ---
                strategy_func = self.strategies.get(current_bot.strategy_name)
                if not strategy_func:
                    raise ValueError(f"Strategy '{current_bot.strategy_name}' not found.")

                if current_bot.strategy_name == "Grid_Trading":
                    task = asyncio.create_task(self.run_grid_trading_strategy(user, current_bot))
                else:
                    data_queue = await market_streamer.subscribe(current_bot.symbol, current_bot.exchange)
                    self.bot_contexts[current_bot.id] = {"queue": data_queue}
                    task = asyncio.create_task(strategy_func(user, current_bot, data_queue, background_tasks))

                self.running_bot_tasks[current_bot.id] = task
                current_bot.is_active = True
                await db.commit()

                await websocket_manager.send_personal_message(
                    {"type": "bot_status", "bot_id": str(current_bot.id), "status": "started"}, user.id)
                logger.info(f"Started internal strategy bot {current_bot.id} ({current_bot.name}).")
                await telegram_service.notify_user(user.id,
                                                   f"🚀 Bot `{current_bot.name}` has been successfully started.")

            except Exception as e:
                logger.error(f"Failed to start bot {bot.id}: {e}", exc_info=True)
                # Rollback state on failure
                bot.is_active = False
                await db.commit()
                await telegram_service.notify_user(user.id,
                                                   f"🛑 Bot `{bot.name}` failed to start: An internal error occurred.")
                await websocket_manager.send_personal_message(
                    {"type": "error", "message": f"Failed to start bot '{bot.name}': {e}"}, user.id)

    async def stop_bot(self, db: AsyncSession, bot: TradingBot):
        """
        Robustly stops a trading bot, cancelling its tasks and cleaning up all associated resources.
        """
        async with self._bot_locks[bot.id]:
            current_bot = await db.get(TradingBot, bot.id)
            if not current_bot or not current_bot.is_active:
                logger.warning(f"Bot {bot.id} is already stopped or does not exist. Stop request ignored.")
                return

            logger.info(f"Attempting to stop bot {current_bot.id} ({current_bot.name})...")

            # --- Stop and clean up internal strategy tasks ---
            task = self.running_bot_tasks.pop(current_bot.id, None)
            if task:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass  # Expected
                logger.info(f"Bot task {current_bot.id} cancelled successfully.")

            # --- Clean up resources like market data subscriptions ---
            if current_bot.id in self.bot_contexts:
                context = self.bot_contexts.pop(current_bot.id)
                if queue := context.get("queue"):
                    await market_streamer.unsubscribe(queue, current_bot.symbol, current_bot.exchange)
                    logger.info(f"Unsubscribed bot {current_bot.id} from market stream.")

            # --- For all bots (including webhook and MT4/5), mark as inactive in the database ---
            current_bot.is_active = False
            await db.commit()

            await websocket_manager.send_personal_message(
                {"type": "bot_status", "bot_id": str(current_bot.id), "status": "stopped"}, current_bot.owner_id)
            await telegram_service.notify_user(current_bot.owner_id, f"🛑 Bot `{current_bot.name}` has been stopped.")
            logger.info(f"Successfully stopped and cleaned up bot {current_bot.id}.")

    async def run_webhook_strategy(self, user: User, bot: TradingBot, request: Request,
                                   background_tasks: BackgroundTasks):
        """
        Securely processes an incoming TradingView alert, parses advanced parameters,
        and executes a trade with dynamic position sizing.
        """
        try:
            alert_body = await request.json()
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON body in webhook.")

        # 1. Security Verification (remains the same)
        if not hmac.compare_digest(alert_body.get("secret", ""), settings.TRADINGVIEW_WEBHOOK_SECRET):
            raise HTTPException(status_code=403, detail="Invalid secret.")

        # 2. Parse Action (remains the same)
        action = self._parse_webhook_data(alert_body)
        if not action:
            return {"status": "ignored_no_action"}

        # --- NEW: 3. Parse Advanced Sizing Parameters from Webhook ---
        # These values from the alert will OVERRIDE the bot's database settings for this trade.
        sizing_overrides = {
            "strategy": None,
            "params": {}
        }
        if "risk_percent" in alert_body:
            sizing_overrides["strategy"] = PositionSizingStrategy.FIXED_FRACTIONAL
            sizing_overrides["params"]["risk_percentage"] = float(alert_body["risk_percent"])
        elif "position_size_usd" in alert_body:
            sizing_overrides["strategy"] = PositionSizingStrategy.FIXED_AMOUNT
            sizing_overrides["params"]["amount_usd"] = float(alert_body["position_size_usd"])

        # 4. Acquire lock and execute trade
        async with self._bot_locks[bot.id]:
            async with async_session_maker() as db:
                current_bot = await db.get(TradingBot, bot.id)
                if not current_bot or not current_bot.is_active:
                    return {"status": "ignored_inactive"}

                logger.info(
                    f"Executing action '{action}' for bot {bot.id} from webhook with overrides: {sizing_overrides}")

                placeholder_price = Decimal("0")

                # --- MODIFIED: Pass the new sizing_overrides to the execution helper ---
                await self.execute_bot_trade(db, user, current_bot, action, placeholder_price, background_tasks,
                                             sizing_overrides)

        return {"status": "ok", "action": action}

    # --- HELPER METHOD for executing trades ---
    async def execute_bot_trade(self, db: AsyncSession, user: User, bot: TradingBot, signal: str, price: Decimal,
                                background_tasks: BackgroundTasks):
        """
        A centralized, robust helper to handle trade execution for any bot.
        This function acts as an orchestrator, validating signals and routing to the correct
        execution logic based on the bot's configuration.
        """
        # 1. Validate Signal against Current State
        in_position = bot.active_position_entry_price is not None
        if signal.lower() == 'buy' and in_position:
            logger.info(f"Bot {bot.id} received 'buy' signal but is already in a position. Ignoring.")
            return
        if signal.lower() == 'sell' and not in_position:
            logger.info(f"Bot {bot.id} received 'sell' signal but is not in a position. Ignoring.")
            return

        # 2. Apply Pre-Trade Risk Filters
        if bot.market_regime_filter_enabled and signal == 'buy':
            regime = market_regime_service.get_regime(bot.symbol)
            if regime != MarketRegime.BULLISH:
                log_msg = f"Trade '{signal}' for bot '{bot.name}' skipped due to unfavorable market regime ({regime.value})."
                await websocket_manager.send_personal_message(
                    {"type": "bot_log", "bot_id": str(bot.id), "message": log_msg}, user.id)
                return

        base_asset, _ = bot.symbol.split('/')

        # 3. Handle Paper Trading
        if bot.is_paper_trading:
            investment_usd = trading_service.get_dynamic_investment_usd(user)
            amount_base = investment_usd / price if price > 0 else Decimal(0)
            if amount_base <= 0: return

            trade = TradeLog(user_id=user.id, bot_id=bot.id, exchange="paper", symbol=bot.symbol,
                             order_id=f"paper-{uuid4()}", side=signal, type='market', amount=float(amount_base),
                             price=float(price), cost=float(investment_usd), is_paper_trade=True)
            db.add(trade)
            await db.commit()

            msg = f"📄 *Paper Trade Executed*\nBot: `{bot.name}`\n{signal.upper()} `{amount_base:.6f}` at `~${price:.2f}`"
            send_telegram_notification_task.delay(user_id=user.id, message=msg)
            return

        # 4. Handle Live Trading
        try:
            # --- ROUTE 1: MT5 Trading via Gateway ---
            if bot.exchange in [ExchangeName.MT4.value, ExchangeName.MT5.value]:
                # Sizing for MT5 is often in lots. Let's use a simplified risk-based approach.
                # A proper implementation would fetch account equity via the gateway.
                # For now, we'll risk a small fixed USD amount.
                risk_amount_usd = Decimal("5.0")  # Risk $10 per trade
                amount_in_lots = risk_amount_usd / 10000  # Simplified lot calculation

                result = await mt5_gateway_service.execute_trade(
                    symbol=bot.symbol,
                    action=signal,
                    volume=float(amount_in_lots),
                    price=float(price),
                    sl_pips=500,  # Example: 50 pips
                    tp_pips=1000  # Example: 100 pips
                )

                if result["status"] == "error":
                    raise ConnectionAbortedError(f"MT5 Trade Failed: {result['message']}")
                else:
                    msg = f"✅ *MT5 Trade Executed via Gateway*\nBot: `{bot.name}`\n{signal.upper()} `{amount_in_lots:.2f}` lots of `{bot.symbol}`"
                    send_telegram_notification_task.delay(user_id=user.id, message=msg)

            # --- ROUTE 2: CCXT Non-Custodial (External Exchange) ---
            elif bot.mode == BotMode.NON_CUSTODIAL.value:
                private_client = await exchange_manager.get_private_client(user.id, bot.exchange,
                                                                           AssetClass(bot.asset_class))
                if not private_client:
                    raise ConnectionError(f"Could not connect to {bot.exchange}. Check API keys.")

                amount_to_trade = await trading_service.get_position_size(user, bot, private_client)
                if amount_to_trade <= 0:
                    logger.warning(f"Skipping trade for bot {bot.id}: Position size is zero or less.")
                    return

                if bot.market_type == MarketType.SPOT.value:
                    if signal == 'buy':
                        await self._execute_spot_entry(db, user, bot, price, private_client, background_tasks)
                    elif signal == 'sell':
                        await self._execute_spot_exit(db, user, bot, price, private_client, background_tasks)
                else:  # Futures
                    await self._execute_future_trade(db, user, bot, signal, price, private_client, background_tasks)

            # --- ROUTE 3: Custodial (Internal Ledger) ---
            elif bot.mode == BotMode.CUSTODIAL.value:
                # Sizing for internal ledger based on wallet balance
                quote_asset = bot.symbol.split('/')[1]
                quote_balance = await wallet_service.get_balance(db, user.id, quote_asset)
                amount_to_risk = quote_balance * Decimal("0.1")  # Risk 10% of quote balance
                amount_base = amount_to_risk / price if price > 0 else Decimal(0)
                if amount_base <= 0: return

                await trading_service.place_order_internal(user, bot, signal, amount_base, price)

        except Exception as e:
            error_msg = f"Trade execution failed for bot '{bot.name}': {str(e)[:150]}"
            logger.error(error_msg, exc_info=True)
            await telegram_service.notify_user(user.id, f"🛑 {error_msg}")
            bot.is_active = False
            await db.commit()

    async def _execute_spot_entry(self, db: AsyncSession, user: User, bot: TradingBot, price: Decimal,
                                  client: BrokerClient, background_tasks: BackgroundTasks):
        base_asset, _ = bot.symbol.split('/')
        amount_to_trade = await trading_service.get_position_size(user, bot, client)
        if amount_to_trade <= 0: return
        entry_order = await client.create_market_buy_order(bot.symbol, float(amount_to_trade))
        await asyncio.sleep(5)
        filled_order = await client.fetch_order(entry_order['id'], bot.symbol)
        entry_price = float(filled_order['average'])
        amount_filled = float(filled_order['filled'])
        bot.active_position_id = filled_order['id']
        bot.active_position_entry_price = entry_price
        bot.active_position_amount = amount_filled
        await db.commit()
        msg = f"✅ *Spot Position Opened*\nBot: `{bot.name}`\nBUY `{amount_filled:.6f}` `{base_asset}` @ `~${entry_price:.2f}`"
        send_telegram_notification_task.delay(user_id=user.id, message=msg)
        if bot.take_profit_percentage and bot.stop_loss_percentage:
            tp_price = entry_price * (1 + bot.take_profit_percentage / 100)
            sl_price = entry_price * (1 - bot.stop_loss_percentage / 100)
            params = {'stopPrice': sl_price}
            exit_order = await client.create_order(symbol=bot.symbol, type='oco', side='sell', amount=amount_filled,
                                                   price=tp_price, params=params)
            bot.active_exit_order_id = exit_order['id']
            await db.commit()
            tp_sl_msg = f"🛡️ Bot `{bot.name}`: TP set at `${tp_price:.2f}` and SL at `${sl_price:.2f}`."
            await telegram_service.notify_user(user.id, tp_sl_msg)

    async def _execute_spot_exit(self, db: AsyncSession, user: User, bot: TradingBot, price: Decimal,
                                 client: BrokerClient, background_tasks: BackgroundTasks):
        if bot.active_exit_order_id:
            try:
                await client.cancel_order(bot.active_exit_order_id, bot.symbol)
            except Exception:
                logger.warning(f"Could not cancel OCO order {bot.active_exit_order_id}.")
        await client.create_market_sell_order(bot.symbol, bot.active_position_amount)
        entry_price = bot.active_position_entry_price
        bot.active_position_id = None
        bot.active_position_entry_price = None
        bot.active_position_amount = None
        bot.active_exit_order_id = None
        await db.commit()
        background_tasks.add_task(trading_service.update_bot_pnl, db, bot.id)
        pnl_percent = ((float(price) - entry_price) / entry_price) * 100
        result_emoji = "🎉" if pnl_percent >= 0 else "🔻"
        exit_msg = f"{result_emoji} *Spot Position Closed*\nBot: `{bot.name}` exited {bot.symbol}. Est. PNL: **{pnl_percent:+.2f}%**"
        await telegram_service.notify_user(user.id, exit_msg)

    async def _execute_future_trade(self, db: AsyncSession, user: User, bot: TradingBot, signal: str, price: Decimal,
                                    client: BrokerClient, background_tasks: BackgroundTasks):
        try:
            await client.set_leverage(bot.leverage, bot.symbol)
        except Exception as e:
            logger.warning(f"Could not set leverage for {bot.symbol}: {e}")

        positions = await client.fetch_positions([bot.symbol])
        current_position = next((p for p in positions if p.get('symbol') == bot.symbol and p.get('contracts', 0) != 0),
                                None)

        amount_to_trade = await trading_service.get_position_size(user, bot, client)
        if amount_to_trade <= 0: return

        if current_position:
            side = 'sell' if current_position['side'] == 'long' else 'buy'
            amount = float(current_position['contracts'])
            params = {'reduceOnly': True}
            logger.info(f"CLOSING {current_position['side']} position for bot {bot.id} with a {side} order.")
            await client.create_order(bot.symbol, 'market', side, amount, params=params)
            bot.active_position_entry_price = None
            await db.commit()
            background_tasks.add_task(trading_service.update_bot_pnl, db, bot.id)
            pnl_percent = ((float(price) - float(current_position['entryPrice'])) / float(
                current_position['entryPrice'])) * 100
            if current_position['side'] == 'short': pnl_percent *= -1
            result_emoji = "🎉" if pnl_percent >= 0 else "🔻"
            await telegram_service.notify_user(user.id,
                                               f"{result_emoji} *Futures Position Closed*\nBot: `{bot.name}`. Est. PNL: **{pnl_percent:+.2f}%**")
        else:
            side = 'buy' if signal == 'buy' else 'sell'
            position_type = "LONG" if side == 'buy' else "SHORT"
            logger.info(f"OPENING {position_type} position for bot {bot.id}.")
            order = await client.create_market_order(bot.symbol, side, float(amount_to_trade))
            await asyncio.sleep(2)  # Give time for position to register
            positions_after = await client.fetch_positions([bot.symbol])
            new_position = next(
                (p for p in positions_after if p.get('symbol') == bot.symbol and p.get('contracts', 0) != 0), None)
            if new_position:
                bot.active_position_entry_price = float(new_position['entryPrice'])
                await db.commit()
            await telegram_service.notify_user(user.id,
                                               f"🚀 *Futures Position Opened*\nBot: `{bot.name}` ({position_type} @ {bot.leverage}x).")  # --- NEW: The runner for all visual strategies ---


    async def run_visual_strategy(self, user: User, bot: TradingBot, data_queue: asyncio.Queue,
                                  background_tasks: BackgroundTasks):
        from collections import deque
        historical_candles = deque(maxlen=250)  # Use a larger buffer for visual strategies

        try:
            # Hydration
            client = await exchange_manager.get_private_client(user.id, bot.exchange, AssetClass(bot.asset_class))
            if not client: raise ConnectionError("Could not create private client for hydration.")

            initial_ohlcv = await client.fetch_ohlcv(bot.symbol, '1m', 250)
            await client.close()
            for t, o, h, l, c, v in initial_ohlcv:
                historical_candles.append({'timestamp': t, 'open': o, 'high': h, 'low': l, 'close': c, 'volume': v})
        except Exception as e:
            logger.error(f"Failed to hydrate visual bot {bot.id}: {e}")
            async with async_session_maker() as db:
                await self.stop_bot(db, bot)
            return

        try:
            while True:
                kline = await data_queue.get()
                candle = {'timestamp': kline['t'], 'open': float(kline['o']), 'high': float(kline['h']),
                          'low': float(kline['l']), 'close': float(kline['c']), 'volume': float(kline['v'])}
                historical_candles.append(candle)
                if len(historical_candles) < 200: continue

                df = pd.DataFrame(list(historical_candles))

                # --- Instantiate and run the interpreter ---
                interpreter = VisualStrategyInterpreter(json.loads(bot.visual_strategy_json), df)
                signal = interpreter.evaluate()  # This will be 'buy', 'sell', or 'hold'

                if signal in ['buy', 'sell']:
                    async with async_session_maker() as db:
                        current_bot = await db.get(TradingBot, bot.id)
                        if not current_bot or not current_bot.is_active: break
                        await self.execute_bot_trade(db, user, current_bot, signal, Decimal(str(kline['c'])),
                                                     background_tasks)

        except asyncio.CancelledError:
            logger.info(f"Visual bot {bot.id} task was cancelled.")
        except Exception as e:
            logger.error(f"Critical error in visual bot {bot.id}: {e}", exc_info=True)
            async with async_session_maker() as db:
                await self.stop_bot(db, bot)

    # --- STRATEGY 1: RSI & MACD Crossover ---
    async def run_rsi_macd_crossover_strategy(self, user: User, bot: TradingBot, data_queue: asyncio.Queue,
                                              background_tasks: BackgroundTasks):
        params = json.loads(bot.strategy_params)
        rsi_period = params.get('rsi_period', 14)
        rsi_overbought = params.get('rsi_overbought', 70)
        rsi_oversold = params.get('rsi_oversold', 30)
        macd_fast, macd_slow, macd_signal = params.get('macd_fast', 12), params.get('macd_slow', 26), params.get(
            'macd_signal', 9)

        from collections import deque
        required_history = macd_slow + macd_signal + 5
        historical_closes = deque(maxlen=required_history)
        previous_macd_hist_state = 0

        # --- Hydration Logic (remains the same) ---
        try:
            client = await exchange_manager.get_private_client(user.id, bot.exchange, AssetClass(bot.asset_class))
            if not client: raise ConnectionError("Could not create private client for hydration.")

            initial_ohlcv = await client.fetch_ohlcv(bot.symbol, '1m', required_history)
            await client.close()
            for candle in initial_ohlcv: historical_closes.append(float(candle[4]))
            if len(historical_closes) == required_history:
                series = pd.Series(list(historical_closes))
                ema_fast = series.ewm(span=macd_fast, adjust=False).mean()
                ema_slow = series.ewm(span=macd_slow, adjust=False).mean()
                macd = ema_fast - ema_slow
                signal = macd.ewm(span=macd_signal, adjust=False).mean()
                previous_macd_hist_state = 1 if (macd - signal).iloc[-1] > 0 else -1
            logger.info(f"Bot {bot.id} (RSI/MACD) hydrated with {len(historical_closes)} data points.")
        except Exception as e:
            logger.error(f"Failed to hydrate bot {bot.id} (RSI/MACD): {e}", exc_info=True)
            async with async_session_maker() as db:
                await self.stop_bot(db, bot)
            return

        # --- Main Strategy Loop ---
        try:
            while True:
                kline = await data_queue.get()
                close_price = float(kline['c'])
                historical_closes.append(close_price)
                if len(historical_closes) < required_history: continue

                # Indicator Calculations (remain the same)
                close_series = pd.Series(list(historical_closes))
                delta = close_series.diff()
                gain = (delta.where(delta > 0, 0)).rolling(window=rsi_period).mean().iloc[-1]
                loss = (-delta.where(delta < 0, 0)).rolling(window=rsi_period).mean().iloc[-1]
                current_rsi = 100 - (100 / (1 + (gain / loss if loss != 0 else float('inf'))))
                ema_fast = close_series.ewm(span=macd_fast, adjust=False).mean()
                ema_slow = close_series.ewm(span=macd_slow, adjust=False).mean()
                macd = ema_fast - ema_slow
                signal = macd.ewm(span=macd_signal, adjust=False).mean()
                current_macd_hist_state = 1 if (macd - signal).iloc[-1] > 0 else -1

                buy_signal = current_rsi < rsi_oversold and current_macd_hist_state == 1 and previous_macd_hist_state == -1
                sell_signal = current_rsi > rsi_overbought and current_macd_hist_state == -1 and previous_macd_hist_state == 1
                previous_macd_hist_state = current_macd_hist_state

                # --- NEW: DB-driven state management ---
                async with async_session_maker() as db:
                    current_bot = await db.get(TradingBot, bot.id)
                    if not current_bot or not current_bot.is_active: break
                    in_position = current_bot.active_position_entry_price is not None

                    if buy_signal and not in_position:
                        # --- OPTIMUS MODE CHECK ---
                        if current_bot.optimus_enabled:
                            df = pd.DataFrame(list(historical_closes), columns=['close'])
                            df['open'] = df['close'];
                            df['high'] = df['close'];
                            df['low'] = df['close']  # Mock OHLC
                            conditions = ml_service.analyze_market_conditions(df)
                            logger.info(
                                f"Optimus Check for Bot {bot.id}: Score={conditions['score']}, Summary='{conditions['summary']}'")
                            if conditions['score'] < 0.1:  # Bullish threshold
                                log_msg = f"Optimus Mode vetoed BUY signal. Conditions not favorable (Score: {conditions['score']})."
                                await websocket_manager.send_personal_message(
                                    {"type": "bot_log", "bot_id": str(bot.id), "message": log_msg}, user.id)
                                continue  # Skip trade

                        await self.execute_bot_trade(db, user, current_bot, 'buy', Decimal(str(kline['c'])),
                                                     background_tasks)

                    elif sell_signal and in_position:
                        await self.execute_bot_trade(db, user, current_bot, 'sell', Decimal(str(kline['c'])),
                                                     background_tasks)
                previous_macd_hist_state = current_macd_hist_state
        except asyncio.CancelledError:
            logger.info(f"RSI/MACD bot {bot.id} task was cancelled.")
        except Exception as e:
            logger.error(f"Critical error in RSI/MACD bot {bot.id}: {e}", exc_info=True)
            async with async_session_maker() as db:
                await self.stop_bot(db, bot)

    async def hydrate_client(self, user: User, bot: TradingBot) -> Optional[BrokerClient]:
        """A robust helper to create a private client for bot hydration."""
        client = await exchange_manager.get_private_client(user.id, bot.exchange, AssetClass(bot.asset_class))
        if not client:
            # This specific error message will be propagated to the user.
            raise ConnectionError(f"Bot '{bot.name}' stopped: No valid API keys found for the '{bot.exchange}' exchange. Please add them in your settings.")
        return client

    # --- STRATEGY 2: Moving Average Crossover ---
    async def run_ma_cross_strategy(self, user: User, bot: TradingBot, data_queue: asyncio.Queue,
                                    background_tasks: BackgroundTasks):
        params = json.loads(bot.strategy_params)
        short_window, long_window = params.get('short_window', 50), params.get('long_window', 200)
        from collections import deque
        historical_closes = deque(maxlen=long_window + 5)
        previous_ma_state = 0

        # --- Hydration Logic (remains the same) ---
        try:
            client = await exchange_manager.get_private_client(user.id, bot.exchange, AssetClass(bot.asset_class))
            if not client: raise ConnectionError("Could not create private client for hydration.")

            initial_ohlcv = await client.fetch_ohlcv(bot.symbol, '1m', long_window + 10)
            await client.close()
            for candle in initial_ohlcv: historical_closes.append(float(candle[4]))
            if len(historical_closes) >= long_window:
                series = pd.Series(list(historical_closes))
                short_ma = series.rolling(window=short_window).mean().iloc[-1]
                long_ma = series.rolling(window=long_window).mean().iloc[-1]
                previous_ma_state = 1 if short_ma > long_ma else -1
            logger.info(f"Bot {bot.id} (MA Cross) hydrated with {len(historical_closes)} data points.")
        except Exception as e:
            logger.error(f"Failed to hydrate bot {bot.id} (MA Cross): {e}", exc_info=True)
            async with async_session_maker() as db:
                await self.stop_bot(db, bot)
            return

        # --- Main Strategy Loop ---
        try:
            while True:
                kline = await data_queue.get()
                close_price = float(kline['c'])
                historical_closes.append(close_price)
                if len(historical_closes) < long_window: continue

                series = pd.Series(list(historical_closes))
                current_short_ma = series.rolling(window=short_window).mean().iloc[-1]
                current_long_ma = series.rolling(window=long_window).mean().iloc[-1]
                current_ma_state = 1 if current_short_ma > current_long_ma else -1

                buy_signal = current_ma_state == 1 and previous_ma_state == -1
                sell_signal = current_ma_state == -1 and previous_ma_state == 1
                previous_ma_state = current_ma_state

                # --- NEW: DB-driven state management ---
                async with async_session_maker() as db:
                    current_bot = await db.get(TradingBot, bot.id)
                    if not current_bot or not current_bot.is_active: break
                    in_position = current_bot.active_position_entry_price is not None

                    if buy_signal and not in_position:
                        # --- OPTIMUS MODE CHECK ---
                        if current_bot.optimus_enabled:
                            df = pd.DataFrame(list(historical_closes), columns=['close'])
                            df['open'] = df['close'];
                            df['high'] = df['close'];
                            df['low'] = df['close']  # Mock OHLC
                            conditions = ml_service.analyze_market_conditions(df)
                            logger.info(
                                f"Optimus Check for Bot {bot.id}: Score={conditions['score']}, Summary='{conditions['summary']}'")
                            if conditions['score'] < 0.1:  # Bullish threshold
                                log_msg = f"Optimus Mode vetoed BUY signal. Conditions not favorable (Score: {conditions['score']})."
                                await websocket_manager.send_personal_message(
                                    {"type": "bot_log", "bot_id": str(bot.id), "message": log_msg}, user.id)
                                continue  # Skip trade

                        await self.execute_bot_trade(db, user, current_bot, 'buy', Decimal(str(kline['c'])),
                                                     background_tasks)

                    elif sell_signal and in_position:
                        await self.execute_bot_trade(db, user, current_bot, 'sell', Decimal(str(kline['c'])),
                                                     background_tasks)

        except asyncio.CancelledError:
            logger.info(f"MA Cross bot {bot.id} task was cancelled.")
        except Exception as e:
            logger.error(f"Critical error in MA Cross bot {bot.id}: {e}", exc_info=True)
            async with async_session_maker() as db:
                await self.stop_bot(db, bot)

    # --- STRATEGY 3: Bollinger Bands ---

    async def run_bollinger_bands_strategy(self, user: User, bot: TradingBot, data_queue: asyncio.Queue,
                                           background_tasks: BackgroundTasks):
        params = json.loads(bot.strategy_params)
        window, std_dev = params.get('window', 20), params.get('std_dev', 2.0)
        from collections import deque
        historical_closes = deque(maxlen=window + 5)

        # --- Hydration Logic (remains the same) ---
        try:
            client = await exchange_manager.get_private_client(user.id, bot.exchange, AssetClass(bot.asset_class))
            if not client: raise ConnectionError("Could not create private client for hydration.")

            initial_ohlcv = await client.fetch_ohlcv(bot.symbol, '1m', window + 10)
            await client.close()
            for candle in initial_ohlcv: historical_closes.append(float(candle[4]))
            logger.info(f"Bot {bot.id} (Bollinger Bands) hydrated with {len(historical_closes)} data points.")
        except Exception as e:
            logger.error(f"Failed to hydrate bot {bot.id} (Bollinger Bands): {e}", exc_info=True)
            async with async_session_maker() as db:
                await self.stop_bot(db, bot)
            return

        # --- Main Strategy Loop ---
        try:
            while True:
                kline = await data_queue.get()
                close_price = float(kline['c'])
                historical_closes.append(close_price)
                if len(historical_closes) < window: continue

                series = pd.Series(list(historical_closes))
                sma = series.rolling(window=window).mean().iloc[-1]
                std = series.rolling(window=window).std().iloc[-1]
                upper_band, lower_band = sma + (std * std_dev), sma - (std * std_dev)

                buy_signal = close_price <= lower_band
                sell_signal = close_price >= upper_band

                # --- NEW: DB-driven state management ---
                async with async_session_maker() as db:
                    current_bot = await db.get(TradingBot, bot.id)
                    if not current_bot or not current_bot.is_active: break
                    in_position = current_bot.active_position_entry_price is not None

                    if buy_signal and not in_position:
                        # --- OPTIMUS MODE CHECK ---
                        if current_bot.optimus_enabled:
                            df = pd.DataFrame(list(historical_closes), columns=['close'])
                            df['open'] = df['close'];
                            df['high'] = df['close'];
                            df['low'] = df['close']  # Mock OHLC
                            conditions = ml_service.analyze_market_conditions(df)
                            logger.info(
                                f"Optimus Check for Bot {bot.id}: Score={conditions['score']}, Summary='{conditions['summary']}'")
                            if conditions['score'] < 0.1:  # Bullish threshold
                                log_msg = f"Optimus Mode vetoed BUY signal. Conditions not favorable (Score: {conditions['score']})."
                                await websocket_manager.send_personal_message(
                                    {"type": "bot_log", "bot_id": str(bot.id), "message": log_msg}, user.id)
                                continue  # Skip trade

                        await self.execute_bot_trade(db, user, current_bot, 'buy', Decimal(str(kline['c'])),
                                                     background_tasks)

                    elif sell_signal and in_position:
                        # For mean reversion, we can also use the middle band (SMA) as an exit signal
                        await self.execute_bot_trade(db, user, current_bot, 'sell', Decimal(str(kline['c'])),
                                                     background_tasks)

        except asyncio.CancelledError:
            logger.info(f"Bollinger Bands bot {bot.id} task was cancelled.")
        except Exception as e:
            logger.error(f"Critical error in Bollinger Bands bot {bot.id}: {e}", exc_info=True)
            async with async_session_maker() as db:
                await self.stop_bot(db, bot)

    # --- STRATEGY 4: Smart Money Concepts ---
    async def run_smc_strategy(self, user: User, bot: TradingBot, data_queue: asyncio.Queue,
                               background_tasks: BackgroundTasks):
        from collections import deque
        historical_candles = deque(maxlen=200)

        # --- Hydration Logic (remains the same) ---
        try:
            client = await exchange_manager.get_private_client(user.id, bot.exchange, AssetClass(bot.asset_class))
            if not client: raise ConnectionError("Could not create private client for hydration.")

            initial_ohlcv = await client.fetch_ohlcv(bot.symbol, '1m', 200)
            await client.close()
            for t, o, h, l, c, v in initial_ohlcv:
                historical_candles.append({'timestamp': t, 'open': o, 'high': h, 'low': l, 'close': c, 'volume': v})
            logger.info(f"Bot {bot.id} (SMC) hydrated with {len(historical_candles)} data points.")
        except Exception as e:
            logger.error(f"Failed to hydrate bot {bot.id} (SMC): {e}", exc_info=True)
            async with async_session_maker() as db:
                await self.stop_bot(db, bot)
            return

        # --- Main Strategy Loop ---
        try:
            while True:
                kline = await data_queue.get()
                candle = {'timestamp': kline['t'], 'open': float(kline['o']), 'high': float(kline['h']),
                          'low': float(kline['l']), 'close': float(kline['c']), 'volume': float(kline['v'])}
                historical_candles.append(candle)
                if len(historical_candles) < 50: continue  # Need enough data for analysis

                df = pd.DataFrame(list(historical_candles))
                df = self.smc_analyzer.find_bos_choch(df)
                df = self.smc_analyzer.find_order_blocks(df)
                latest = df.iloc[-1]

                # --- NEW: DB-driven state management ---
                async with async_session_maker() as db:
                    current_bot = await db.get(TradingBot, bot.id)
                    if not current_bot or not current_bot.is_active: break
                    in_position = current_bot.active_position_entry_price is not None

                    # Note: SMC strategy doesn't need an explicit exit signal from indicators.
                    # The exit is handled by the TP/SL set by execute_bot_trade.
                    # We just need to find entry signals.
                    if not in_position:
                        bullish_choch = (df['choch'] == 1).rolling(10).sum().iloc[-1] > 0
                        buy_signal = bullish_choch and latest['close'] <= latest['bullish_ob'] and latest[
                            'bullish_ob'] > 0

                        if buy_signal:
                            # --- OPTIMUS MODE CHECK ---
                            if current_bot.optimus_enabled:
                                # We already have the full OHLCV df for SMC
                                conditions = ml_service.analyze_market_conditions(df)
                                logger.info(
                                    f"Optimus Check for Bot {bot.id}: Score={conditions['score']}, Summary='{conditions['summary']}'")
                                if conditions['score'] < 0.1:  # Bullish threshold
                                    log_msg = f"Optimus Mode vetoed BUY signal. Conditions not favorable (Score: {conditions['score']})."
                                    await websocket_manager.send_personal_message(
                                        {"type": "bot_log", "bot_id": str(bot.id), "message": log_msg}, user.id)
                                    continue  # Skip trade

                            await self.execute_bot_trade(db, user, current_bot, 'buy', Decimal(str(kline['c'])),
                                                         background_tasks)

        except asyncio.CancelledError:
            logger.info(f"SMC bot {bot.id} task was cancelled.")
        except Exception as e:
            logger.error(f"Critical error in SMC bot {bot.id}: {e}", exc_info=True)
            async with async_session_maker() as db:
                await self.stop_bot(db, bot)

    # --- STRATEGY 5: Grid Trading ---
    async def run_grid_trading_strategy(self, user: User, bot: TradingBot):
        # NOTE: This strategy does not use the data_queue as it polls orders directly.
        params = json.loads(bot.strategy_params)
        upper_price, lower_price = Decimal(str(params.get('upper_price'))), Decimal(str(params.get('lower_price')))
        num_grids, trade_amount_base = int(params.get('num_grids', 10)), Decimal(str(params.get('trade_amount_base')))
        if not all([upper_price, lower_price, num_grids, trade_amount_base]):
            async with async_session_maker() as db: await self.stop_bot(db, bot); return

        grid_lines = [Decimal(x) for x in np.linspace(float(lower_price), float(upper_price), num_grids)]
        grid_step = (upper_price - lower_price) / Decimal(num_grids - 1)
        private_exchange = None

        try:
            broker_adapter = await exchange_manager.get_private_client(user.id, bot.exchange, AssetClass.CRYPTO)
            if not isinstance(broker_adapter, CcxtClient):
                raise ConnectionError("Grid trading is only supported on CCXT-compatible exchanges.")

            private_exchange = broker_adapter._client  # Get the raw ccxt instance
            if not private_exchange: raise ConnectionError("Could not create authenticated client.")

            live_orders = {}
            await private_exchange.cancel_all_orders(bot.symbol)
            ticker = await private_exchange.fetch_ticker(bot.symbol)
            current_price = Decimal(str(ticker['last']))

            for price in grid_lines:
                side = 'buy' if price < current_price else 'sell'
                order = await private_exchange.create_limit_order(bot.symbol, side, float(trade_amount_base),
                                                                  float(price))
                live_orders[order['id']] = order
                await asyncio.sleep(0.2)

            while True:
                await asyncio.sleep(30)
                open_orders = await private_exchange.fetch_open_orders(bot.symbol)
                open_order_ids = {o['id'] for o in open_orders}
                filled_order_ids = set(live_orders.keys()) - open_order_ids

                for order_id in filled_order_ids:
                    filled_order = live_orders.pop(order_id)
                    filled_price = Decimal(str(filled_order['price']))
                    new_side = 'sell' if filled_order['side'] == 'buy' else 'buy'
                    new_price = filled_price + grid_step if new_side == 'sell' else filled_price - grid_step
                    if lower_price <= new_price <= upper_price:
                        new_order = await private_exchange.create_limit_order(bot.symbol, new_side,
                                                                              float(trade_amount_base),
                                                                              float(new_price))
                        live_orders[new_order['id']] = new_order
        except asyncio.CancelledError:
            logger.info(f"Grid bot {bot.id} task was cancelled.")
        except Exception as e:
            logger.error(f"Critical error in Grid bot {bot.id}: {e}", exc_info=True)
        finally:
            if private_exchange:
                try:
                    await private_exchange.cancel_all_orders(bot.symbol)
                except Exception as e:
                    logger.error(f"Could not cancel grid orders on exit for bot {bot.id}: {e}")
                await private_exchange.close()

    async def run_volatility_squeeze_strategy(self, user: User, bot: TradingBot, data_queue: asyncio.Queue,
                                              background_tasks: BackgroundTasks):
        """
        A robust implementation of the TTM Squeeze / Volatility Squeeze strategy.
        - Detects when Bollinger Bands move inside Keltner Channels (the "squeeze").
        - Triggers a trade when price breaks out after the squeeze is released.
        """
        # --- 1. PARAMETER AND STATE INITIALIZATION ---
        params = json.loads(bot.strategy_params)
        bb_period = params.get('bb_period', 20)
        bb_std = params.get('bb_std', 2.0)
        kc_period = params.get('kc_period', 20)
        kc_atr_mult = params.get('kc_atr_mult', 1.5)

        from collections import deque
        # Keltner Channel needs ATR, which needs High and Low prices.
        # So we store full candle dictionaries.
        required_history = max(bb_period, kc_period) + 5
        historical_candles = deque(maxlen=required_history)

        # State machine variables
        in_squeeze = False

        # --- 2. INITIAL DATA HYDRATION ---
        try:
            client = await exchange_manager.get_private_client(user.id, bot.exchange, AssetClass(bot.asset_class))
            if not client: raise ConnectionError("Could not create private client for hydration.")
            initial_ohlcv = await client.fetch_ohlcv(bot.symbol, '1m', limit=required_history)
            await client.close()
            for t, o, h, l, c, v in initial_ohlcv:
                historical_candles.append({'timestamp': t, 'open': o, 'high': h, 'low': l, 'close': c, 'volume': v})
            logger.info(f"Bot {bot.id} (Volatility Squeeze) hydrated with {len(historical_candles)} data points.")
        except Exception as e:
            logger.error(f"Failed to hydrate bot {bot.id}: {e}", exc_info=True)
            async with async_session_maker() as db:
                await self.stop_bot(db, bot)
            return

        # --- 3. MAIN EVENT LOOP ---
        try:
            while True:
                kline = await data_queue.get()
                candle = {'timestamp': kline['t'], 'open': float(kline['o']), 'high': float(kline['h']),
                          'low': float(kline['l']), 'close': float(kline['c']), 'volume': float(kline['v'])}
                historical_candles.append(candle)
                if len(historical_candles) < required_history: continue

                df = pd.DataFrame(list(historical_candles))

                # --- Live Indicator Calculation ---
                bbands = df.ta.bbands(length=bb_period, std=bb_std, append=True)
                kc = df.ta.kc(length=kc_period, scalar=kc_atr_mult, append=True)

                latest = df.iloc[-1]

                # --- Signal Detection (State Machine Logic) ---
                squeeze_is_on = latest[f'BBL_{bb_period}_{bb_std}'] > latest[f'KCL_{kc_period}_{kc_atr_mult}'] and \
                                latest[f'BBU_{bb_period}_{bb_std}'] < latest[f'KCU_{kc_period}_{kc_atr_mult}']

                # A "squeeze release" happens on the first candle it's NOT in a squeeze after being in one.
                squeeze_released = not squeeze_is_on and in_squeeze

                buy_signal = squeeze_released and latest['close'] > latest[f'BBU_{bb_period}_{bb_std}']
                sell_signal = squeeze_released and latest['close'] < latest[f'BBL_{bb_period}_{bb_std}']

                # Update the state for the next iteration
                in_squeeze = squeeze_is_on

                # --- 4. TRADE EXECUTION ---
                async with async_session_maker() as db:
                    current_bot = await db.get(TradingBot, bot.id)
                    if not current_bot or not current_bot.is_active: break
                    is_in_position = current_bot.active_position_entry_price is not None

                    if buy_signal and not is_in_position:
                        await self.execute_bot_trade(db, user, current_bot, 'buy', Decimal(str(candle['close'])),
                                                     background_tasks)

                    # For this strategy, we'll assume the exit is handled by the bot's global SL/TP
                    # A more complex version could exit when price returns to the middle band.

        except asyncio.CancelledError:
            logger.info(f"Volatility Squeeze bot {bot.id} task was cancelled.")
        except Exception as e:
            logger.error(f"Critical error in Volatility Squeeze bot {bot.id}: {e}", exc_info=True)
            async with async_session_maker() as db:
                await self.stop_bot(db, bot)

    async def run_supertrend_adx_strategy(self, user: User, bot: TradingBot, data_queue: asyncio.Queue,
                                          background_tasks: BackgroundTasks):
        """
        A robust implementation of a SuperTrend strategy filtered by the ADX indicator.
        - Enters a trade only when SuperTrend flips direction AND ADX is above a threshold, confirming a strong trend.
        - Exits a position if SuperTrend flips to the opposite direction.
        """
        # --- 1. PARAMETER AND STATE INITIALIZATION ---
        params = json.loads(bot.strategy_params)
        st_period = params.get('st_period', 12)
        st_multiplier = params.get('st_multiplier', 3.0)
        adx_period = params.get('adx_period', 14)
        adx_threshold = params.get('adx_threshold', 25)

        from collections import deque
        required_history = max(st_period, adx_period) + 10
        historical_candles = deque(maxlen=required_history)

        # --- 2. INITIAL DATA HYDRATION ---
        try:
            client = await exchange_manager.get_private_client(user.id, bot.exchange, AssetClass(bot.asset_class))
            if not client: raise ConnectionError("Could not create private client for hydration.")
            initial_ohlcv = await client.fetch_ohlcv(bot.symbol, '1m', limit=required_history)
            await client.close()
            for t, o, h, l, c, v in initial_ohlcv:
                historical_candles.append({'timestamp': t, 'open': o, 'high': h, 'low': l, 'close': c, 'volume': v})
            logger.info(f"Bot {bot.id} (SuperTrend/ADX) hydrated with {len(historical_candles)} data points.")
        except Exception as e:
            logger.error(f"Failed to hydrate bot {bot.id}: {e}", exc_info=True)
            async with async_session_maker() as db:
                await self.stop_bot(db, bot)
            return

        # --- 3. MAIN EVENT LOOP ---
        try:
            while True:
                kline = await data_queue.get()
                candle = {'timestamp': kline['t'], 'open': float(kline['o']), 'high': float(kline['h']),
                          'low': float(kline['l']), 'close': float(kline['c']), 'volume': float(kline['v'])}
                historical_candles.append(candle)
                if len(historical_candles) < required_history: continue

                df = pd.DataFrame(list(historical_candles))

                # --- Live Indicator Calculation ---
                df.ta.supertrend(length=st_period, multiplier=st_multiplier, append=True)
                df.ta.adx(length=adx_period, append=True)

                latest = df.iloc[-1]
                prev = df.iloc[-2]

                # --- Signal Detection (State Machine Logic) ---
                is_trending = latest[f'ADX_{adx_period}'] > adx_threshold

                # Buy signal: SuperTrend flips from bearish (-1) to bullish (1) AND the market is trending
                buy_flip = latest[f'SUPERTd_{st_period}_{st_multiplier}'] == 1 and prev[
                    f'SUPERTd_{st_period}_{st_multiplier}'] == -1
                buy_signal = buy_flip and is_trending

                # Sell signal: SuperTrend flips from bullish (1) to bearish (-1) AND the market is trending
                sell_flip = latest[f'SUPERTd_{st_period}_{st_multiplier}'] == -1 and prev[
                    f'SUPERTd_{st_period}_{st_multiplier}'] == 1
                sell_signal = sell_flip and is_trending

                # --- 4. TRADE EXECUTION ---
                async with async_session_maker() as db:
                    current_bot = await db.get(TradingBot, bot.id)
                    if not current_bot or not current_bot.is_active: break
                    in_position = current_bot.active_position_entry_price is not None

                    if buy_signal and not in_position:
                        await self.execute_bot_trade(db, user, current_bot, 'buy', Decimal(str(candle['close'])),
                                                     background_tasks)

                    elif sell_signal and in_position:
                        # The SuperTrend flip is a natural exit signal for this strategy
                        await self.execute_bot_trade(db, user, current_bot, 'sell', Decimal(str(candle['close'])),
                                                     background_tasks)

        except asyncio.CancelledError:
            logger.info(f"SuperTrend/ADX bot {bot.id} task was cancelled.")
        except Exception as e:
            logger.error(f"Critical error in SuperTrend/ADX bot {bot.id}: {e}", exc_info=True)
            async with async_session_maker() as db:
                await self.stop_bot(db, bot)

    async def run_ichimoku_breakout_strategy(self, user: User, bot: TradingBot, data_queue: asyncio.Queue,
                                             background_tasks: BackgroundTasks):
        """
        A robust implementation of the Ichimoku Cloud (Kumo) Breakout strategy.
        - Enters a trade when price closes above/below the cloud, with confirmation from other Ichimoku components.
        """
        # --- 1. PARAMETER AND STATE INITIALIZATION ---
        params = json.loads(bot.strategy_params)
        tenkan_period = params.get('tenkan_period', 9)
        kijun_period = params.get('kijun_period', 26)
        senkou_period = params.get('senkou_period', 52)

        from collections import deque
        # Ichimoku requires a significant lookback period because its components are shifted.
        required_history = senkou_period + kijun_period + 5
        historical_candles = deque(maxlen=required_history)

        # --- 2. INITIAL DATA HYDRATION ---
        try:
            client = await exchange_manager.get_private_client(user.id, bot.exchange, AssetClass(bot.asset_class))
            if not client: raise ConnectionError("Could not create private client for hydration.")
            initial_ohlcv = await client.fetch_ohlcv(bot.symbol, '1m', limit=required_history)
            await client.close()
            for t, o, h, l, c, v in initial_ohlcv:
                historical_candles.append({'timestamp': t, 'open': o, 'high': h, 'low': l, 'close': c, 'volume': v})
            logger.info(f"Bot {bot.id} (Ichimoku) hydrated with {len(historical_candles)} data points.")
        except Exception as e:
            logger.error(f"Failed to hydrate bot {bot.id}: {e}", exc_info=True)
            async with async_session_maker() as db:
                await self.stop_bot(db, bot)
            return

        # --- 3. MAIN EVENT LOOP ---
        try:
            while True:
                kline = await data_queue.get()
                candle = {'timestamp': kline['t'], 'open': float(kline['o']), 'high': float(kline['h']),
                          'low': float(kline['l']), 'close': float(kline['c']), 'volume': float(kline['v'])}
                historical_candles.append(candle)
                if len(historical_candles) < required_history: continue

                df = pd.DataFrame(list(historical_candles))

                # --- Live Indicator Calculation ---
                df.ta.ichimoku(tenkan=tenkan_period, kijun=kijun_period, senkou=senkou_period, append=True)

                latest = df.iloc[-1]
                prev = df.iloc[-2]

                # --- Signal Detection (State Machine Logic) ---
                # Bullish Kumo Breakout conditions
                price_above_cloud = latest['close'] > max(latest[f'ISA_{tenkan_period}'], latest[f'ISB_{kijun_period}'])
                was_in_or_below_cloud = prev['close'] <= max(prev[f'ISA_{tenkan_period}'], prev[f'ISB_{kijun_period}'])
                bullish_breakout = price_above_cloud and was_in_or_below_cloud

                # Bearish Kumo Breakout conditions
                price_below_cloud = latest['close'] < min(latest[f'ISA_{tenkan_period}'], latest[f'ISB_{kijun_period}'])
                was_in_or_above_cloud = prev['close'] >= min(prev[f'ISA_{tenkan_period}'], prev[f'ISB_{kijun_period}'])
                bearish_breakout = price_below_cloud and was_in_or_above_cloud

                # --- 4. TRADE EXECUTION ---
                async with async_session_maker() as db:
                    current_bot = await db.get(TradingBot, bot.id)
                    if not current_bot or not current_bot.is_active: break
                    in_position = current_bot.active_position_entry_price is not None

                    if bullish_breakout and not in_position:
                        await self.execute_bot_trade(db, user, current_bot, 'buy', Decimal(str(candle['close'])),
                                                     background_tasks)

                    elif bearish_breakout and in_position:
                        await self.execute_bot_trade(db, user, current_bot, 'sell', Decimal(str(candle['close'])),
                                                     background_tasks)

        except asyncio.CancelledError:
            logger.info(f"Ichimoku bot {bot.id} task was cancelled.")
        except Exception as e:
            logger.error(f"Critical error in Ichimoku bot {bot.id}: {e}", exc_info=True)
            async with async_session_maker() as db:
                await self.stop_bot(db, bot)

    async def run_ai_enhanced_strategy(self, user: User, bot: TradingBot, data_queue: asyncio.Queue,
                                       background_tasks: BackgroundTasks):
        """
        A robust "meta-strategy" that uses a base indicator signal and confirms it
        with the pre-trained 'Optimus' AI model before executing a trade.
        """
        # --- 1. PARAMETER AND STATE INITIALIZATION ---
        params = json.loads(bot.strategy_params)
        fast_ema_period = params.get('fast_ema', 10)
        slow_ema_period = params.get('slow_ema', 30)
        # The AI model's confidence threshold for confirming a trade
        confidence_threshold = params.get('confidence_threshold', 0.1)  # Score from -1 to 1

        from collections import deque
        # The AI model needs ~200 periods to generate all its features
        required_history = 200
        historical_candles = deque(maxlen=required_history)
        previous_ma_state = 0

        # --- 2. INITIAL DATA HYDRATION ---
        try:
            client = await exchange_manager.get_private_client(user.id, bot.exchange, AssetClass(bot.asset_class))
            if not client: raise ConnectionError("Could not create private client for hydration.")
            initial_ohlcv = await client.fetch_ohlcv(bot.symbol, '1m', limit=required_history)
            await client.close()
            for t, o, h, l, c, v in initial_ohlcv:
                historical_candles.append({'timestamp': t, 'open': o, 'high': h, 'low': l, 'close': c, 'volume': v})
            logger.info(f"Bot {bot.id} (AI Enhanced) hydrated with {len(historical_candles)} data points.")
        except Exception as e:
            logger.error(f"Failed to hydrate bot {bot.id}: {e}", exc_info=True)
            async with async_session_maker() as db:
                await self.stop_bot(db, bot)
            return

        # --- 3. MAIN EVENT LOOP ---
        try:
            while True:
                kline = await data_queue.get()
                candle = {'timestamp': kline['t'], 'open': float(kline['o']), 'high': float(kline['h']),
                          'low': float(kline['l']), 'close': float(kline['c']), 'volume': float(kline['v'])}
                historical_candles.append(candle)
                if len(historical_candles) < required_history: continue

                df = pd.DataFrame(list(historical_candles))

                # --- Live Indicator Calculation ---
                df['ema_fast'] = df['close'].ewm(span=fast_ema_period, adjust=False).mean()
                df['ema_slow'] = df['close'].ewm(span=slow_ema_period, adjust=False).mean()

                latest = df.iloc[-1]
                prev = df.iloc[-2]

                # --- Base Signal Detection ---
                base_buy_signal = latest['ema_fast'] > latest['ema_slow'] and prev['ema_fast'] <= prev['ema_slow']
                base_sell_signal = latest['ema_fast'] < latest['ema_slow'] and prev['ema_fast'] >= prev['ema_slow']

                if not base_buy_signal and not base_sell_signal:
                    continue  # No base signal, no need to run the AI model

                # --- 4. AI CONFIRMATION ---
                async with async_session_maker() as db:
                    current_bot = await db.get(TradingBot, bot.id)
                    if not current_bot or not current_bot.is_active: break
                    in_position = current_bot.active_position_entry_price is not None

                    if (base_buy_signal and not in_position) or (base_sell_signal and in_position):
                        await websocket_manager.send_personal_message({"type": "bot_log", "bot_id": str(bot.id),
                                                                       "message": "Base signal detected. Querying Optimus AI for confirmation..."},
                                                                      user.id)

                        # Run the heavy AI analysis
                        ai_conditions = ml_service.analyze_market_conditions(df)
                        ai_score = ai_conditions.get("score", 0)

                        log_msg = f"Optimus AI Result: Score={ai_score}, Summary='{ai_conditions.get('summary', 'N/A')}'"
                        await websocket_manager.send_personal_message(
                            {"type": "bot_log", "bot_id": str(bot.id), "message": log_msg}, user.id)

                        # --- 5. TRADE EXECUTION ---
                        if base_buy_signal and not in_position and ai_score > confidence_threshold:
                            await websocket_manager.send_personal_message({"type": "bot_log", "bot_id": str(bot.id),
                                                                           "message": "AI Confirmed BUY. Executing trade..."},
                                                                          user.id)
                            await self.execute_bot_trade(db, user, current_bot, 'buy', Decimal(str(candle['close'])),
                                                         background_tasks)

                        elif base_sell_signal and in_position and ai_score < -confidence_threshold:
                            await websocket_manager.send_personal_message({"type": "bot_log", "bot_id": str(bot.id),
                                                                           "message": "AI Confirmed SELL. Executing trade..."},
                                                                          user.id)
                            await self.execute_bot_trade(db, user, current_bot, 'sell', Decimal(str(candle['close'])),
                                                         background_tasks)

                        else:
                            await websocket_manager.send_personal_message({"type": "bot_log", "bot_id": str(bot.id),
                                                                           "message": "AI Vetoed Trade. Signal not strong enough."},
                                                                          user.id)

        except asyncio.CancelledError:
            logger.info(f"AI Enhanced bot {bot.id} task was cancelled.")
        except Exception as e:
            logger.error(f"Critical error in AI Enhanced bot {bot.id}: {e}", exc_info=True)
            async with async_session_maker() as db:
                await self.stop_bot(db, bot)

    async def run_optimizer_portfolio_strategy(self, user: User, bot: TradingBot, data_queue: asyncio.Queue,
                                               background_tasks: BackgroundTasks):
        """
        An advanced "meta-strategy" that runs a portfolio of other strategies,
        looks for signal confluence, and filters by market trend.
        """
        # --- 1. PARAMETER AND STATE INITIALIZATION ---
        params = json.loads(bot.strategy_params)
        # The user defines which strategies to include in the portfolio
        strategy_pool_names = params.get('strategy_pool', ["RSI_MACD_Crossover", "MA_Cross"])
        min_confluence = params.get('min_confluence', 2)  # How many strategies must agree
        trend_filter_period = params.get('trend_filter_period', 200)

        from collections import deque
        required_history = 250  # A large buffer to accommodate all sub-strategies
        historical_candles = deque(maxlen=required_history)

        # Instantiate the sub-strategy classes
        sub_strategies = []
        for name in strategy_pool_names:
            StrategyClass = STRATEGY_REGISTRY.get(name)
            if StrategyClass and name != "Optimizer_Portfolio":  # Prevent recursion
                # Use default parameters for the sub-strategies
                sub_strategies.append(StrategyClass({}))

        # --- 2. INITIAL DATA HYDRATION ---
        try:
            client = await exchange_manager.get_private_client(user.id, bot.exchange, AssetClass(bot.asset_class))
            if not client: raise ConnectionError("Could not create private client for hydration.")
            initial_ohlcv = await client.fetch_ohlcv(bot.symbol, '1m', limit=required_history)
            await client.close()
            for t, o, h, l, c, v in initial_ohlcv:
                historical_candles.append({'timestamp': t, 'open': o, 'high': h, 'low': l, 'close': c, 'volume': v})
            logger.info(f"Bot {bot.id} (Optimizer) hydrated with {len(historical_candles)} data points.")
        except Exception as e:
            logger.error(f"Failed to hydrate bot {bot.id}: {e}", exc_info=True)
            async with async_session_maker() as db:
                await self.stop_bot(db, bot)
            return

        # --- 3. MAIN EVENT LOOP ---
        try:
            while True:
                kline = await data_queue.get()
                candle = {'timestamp': kline['t'], 'open': float(kline['o']), 'high': float(kline['h']),
                          'low': float(kline['l']), 'close': float(kline['c']), 'volume': float(kline['v'])}
                historical_candles.append(candle)
                if len(historical_candles) < required_history: continue

                df = pd.DataFrame(list(historical_candles))

                # --- Run all sub-strategies to get their signals ---
                buy_signals = 0
                sell_signals = 0
                reasons = []

                for sub_strategy in sub_strategies:
                    # We pass a copy of the dataframe to prevent side effects
                    signal_obj = sub_strategy.generate_signal(df.copy())
                    if signal_obj.action == "BUY":
                        buy_signals += 1
                        reasons.append(signal_obj.reason)
                    elif signal_obj.action == "SELL":
                        sell_signals += 1
                        reasons.append(signal_obj.reason)

                # --- Trend Filter ---
                long_ema = df['close'].ewm(span=trend_filter_period, adjust=False).mean().iloc[-1]
                is_uptrend = candle['close'] > long_ema

                # --- Confluence and Decision Logic ---
                final_buy_signal = buy_signals >= min_confluence and is_uptrend
                final_sell_signal = sell_signals >= min_confluence and not is_uptrend

                log_msg = f"Optimizer Check: BUY Signals={buy_signals}, SELL Signals={sell_signals}, Trend={'UP' if is_uptrend else 'DOWN'}"
                await websocket_manager.send_personal_message(
                    {"type": "bot_log", "bot_id": str(bot.id), "message": log_msg}, user.id)

                # --- 4. TRADE EXECUTION ---
                async with async_session_maker() as db:
                    current_bot = await db.get(TradingBot, bot.id)
                    if not current_bot or not current_bot.is_active: break
                    in_position = current_bot.active_position_entry_price is not None

                    if final_buy_signal and not in_position:
                        reason_str = ", ".join(reasons)
                        await websocket_manager.send_personal_message({"type": "bot_log", "bot_id": str(bot.id),
                                                                       "message": f"Optimizer BUY Signal (Confluence: {buy_signals}). Reasons: {reason_str}. Executing..."},
                                                                      user.id)
                        await self.execute_bot_trade(db, user, current_bot, 'buy', Decimal(str(candle['close'])),
                                                     background_tasks)

                    elif final_sell_signal and in_position:
                        reason_str = ", ".join(reasons)
                        await websocket_manager.send_personal_message({"type": "bot_log", "bot_id": str(bot.id),
                                                                       "message": f"Optimizer SELL Signal (Confluence: {sell_signals}). Reasons: {reason_str}. Executing..."},
                                                                      user.id)
                        await self.execute_bot_trade(db, user, current_bot, 'sell', Decimal(str(candle['close'])),
                                                     background_tasks)

        except asyncio.CancelledError:
            logger.info(f"Optimizer bot {bot.id} task was cancelled.")
        except Exception as e:
            logger.error(f"Critical error in Optimizer bot {bot.id}: {e}", exc_info=True)
            async with async_session_maker() as db:
                await self.stop_bot(db, bot)



strategy_service = StrategyService()




# --- THIS IS THE COMPLETE, ROBUST, AND UPDATED BACKGROUND TASK ---
async def broadcast_market_data():
    """
    A highly resilient background task that fetches market data.
    It tries primary CCXT sources first, then falls back to TradingView
    if all CCXT sources fail, ensuring maximum uptime for market data.
    all_symbols = [
        'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT',
        'ADA/USDT', 'AVAX/USDT', 'SHIB/USDT', 'DOT/USDT', 'LINK/USDT', 'TRX/USDT',
        'MATIC/USDT', 'LTC/USDT', 'ATOM/USDT', 'NEAR/USDT', 'UNI/USDT', 'XLM/USDT',
        'ICP/USDT', 'ETC/USDT', 'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF',
        'AUD/USD', 'NZD/USD', 'USD/CAD', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY',
        'AUD/JPY', 'NZD/JPY', 'GBP/CHF', 'AUD/NZD', 'EUR/AUD', 'GBP/CAD',
        'EUR/CAD', 'USD/MXN', 'USD/ZAR', 'USD/INR'
    ]
    """

    all_symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'EUR/USD', 'GBP/USD']  # A smaller, more focused list

    while True:
        global MARKET_DATA_HEALTH
        market_data = {}
        source = "N/A"

        # --- Primary Method: CCXT ---
        exchange = await exchange_manager.get_fault_tolerant_public_client()

        if exchange:
            source = exchange.id
            try:
                await exchange.load_markets(params={'type': 'spot'})
                available_symbols = [s for s in all_symbols if s in exchange.symbols]
                if available_symbols:
                    fetched_tickers = await exchange.fetch_tickers(available_symbols)
                    for symbol, data in fetched_tickers.items():
                        if data and data.get('last') is not None and data.get('percentage') is not None:
                            market_data[symbol] = {"price": data['last'], "change": data['percentage']}
                MARKET_DATA_HEALTH = {"status": MarketDataStatus.OPERATIONAL.value, "source": source}
            except Exception as e:
                logger.error(f"CCXT data fetch from {source} failed: {e}")
                market_data = {}  # Clear partial data on failure
            finally:
                await exchange.close()

        # --- Fallback Method: TradingView ---
        # If the primary CCXT method failed to get any data, try the fallback.
        if not market_data:
            logger.warning("All primary CCXT providers failed. Falling back to TradingView for market ticker.")
            source = "TradingView"
            try:
                # We can use the global tv_client instance from app.state
                # This assumes the lifespan manager is running on the main app instance.
                # A better way is to pass `app` or use a global.
                # For this monolithic file, we'll assume access to a global or context.
                # Let's create a temporary instance for robustness in this background task.
                tv_client_temp = TradingViewClient()
                fetched_tickers = await tv_client_temp.fetch_tickers(all_symbols)
                await tv_client_temp.close_session()

                for symbol, data in fetched_tickers.items():
                    if data and data.get('last') is not None and data.get('percentage') is not None:
                        market_data[symbol] = {"price": data['last'], "change": data['percentage']}

                if market_data:
                    MARKET_DATA_HEALTH = {"status": MarketDataStatus.DEGRADED.value, "source": source}
                else:
                    MARK_DATA_HEALTH = {"status": MarketDataStatus.OUTAGE.value, "source": "All Sources Failed"}

            except Exception as e:
                logger.error(f"TradingView fallback also failed: {e}")
                MARKET_DATA_HEALTH = {"status": MarketDataStatus.OUTAGE.value, "source": "All Sources Failed"}

        # --- Broadcast whatever data we managed to get ---
        if market_data:
            await websocket_manager.broadcast({"type": "market_update", "data": market_data})

        await asyncio.sleep(30)  # Increase sleep interval to reduce spam on failing networks


class NotificationService:
    async def create_notification(
        self,
        db: AsyncSession,
        type: NotificationType,
        message: str,
        user_id: Optional[str] = None
    ):
        """
        Creates and saves a new system notification. This is the central point
        for all notification generation in the application.
        """
        try:
            notification = Notification(
                type=type.value,
                message=message,
                user_id=user_id
            )
            db.add(notification)
            # The commit will be handled by the calling function's transaction
            await db.flush()
            logger.info(f"Created notification: '{type.value}' - '{message}'")
        except Exception as e:
            # We log the error but don't raise an exception. A failed notification
            # should never cause the parent operation (like a payment) to fail.
            logger.error(f"Failed to create notification: {e}", exc_info=True)

# --- Instantiate the service globally ---
notification_service = NotificationService()
# ==============================================================================
# 7. FASTAPI LIFESPAN MANAGER & APP SETUP
# ==============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ==================================================================
    # APPLICATION STARTUP LOGIC
    # ==================================================================
    logger.info("QuantumLeap AI Trader Starting Up...")
    load_ai_models()
    

    # --- 1. Initialize Database and Create Superuser ---
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


    async with async_session_maker() as session:
        result = await session.execute(select(User).where(User.email == settings.SUPERUSER_EMAIL))
        if result.scalar_one_or_none() is None:
            superuser = User(
                id=f"superuser-{uuid4()}",
                email=settings.SUPERUSER_EMAIL,
                role=UserRole.SUPERUSER.value,
                subscription_plan=SubscriptionPlan.ULTIMATE.value,
                subscription_expires_at=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
                    days=365 * 100)
            )
            session.add(superuser)
            await session.commit()
            logger.info("Superuser created.")

        app.state.tv_client = TradingViewClient()
    # --- 2. Start Core Background Services ---
        # Initialize bot info FIRST, so the username is available for API calls.
        await telegram_service.initialize_bot_info()
        # Set up the command handlers.
        telegram_service.setup_handlers()

        # --- 3. Start All Background Services ---
        logger.info("Starting background services...")
        # Store all background tasks on app.state for graceful shutdown.
        # The `run_polling` method is now correctly run as a background task.
        app.state.telegram_task = asyncio.create_task(telegram_service.run_polling())
        app.state.market_regime_task = asyncio.create_task(market_regime_service.run_analysis_loop())
        app.state.broadcast_task = asyncio.create_task(broadcast_market_data())
        logger.info("All background services have been started.")

    # --- 3. Restart Any Active Trading Bots ---
    logger.info("Checking for active bots to restart...")
    async with async_session_maker() as session:
        active_bots_result = await session.execute(select(TradingBot).where(TradingBot.is_active == True))
        active_bots = active_bots_result.scalars().all()

        for bot in active_bots:
            user = await session.get(User, bot.owner_id)
            if user and user.is_subscription_active():
                logger.info(f"Restarting active bot {bot.id} for user {user.id} on server startup.")
                await strategy_service.start_bot(session, user, bot, BackgroundTasks())
            else:
                bot.is_active = False
                await session.commit()
                logger.warning(f"Deactivated bot {bot.id} on startup due to inactive user or expired subscription.")

    # --- Application is now running ---
    yield
    # ==================================================================

    # ==================================================================
    # APPLICATION SHUTDOWN LOGIC
    # ==================================================================
    logger.info("QuantumLeap AI Trader Shutting Down...")
    logger.info("Closing TradingView client session...")
    await app.state.tv_client.close_session()

    # --- ROBUST SHUTDOWN LOGIC ---
    # Check if the tasks exist on app.state before trying to cancel them.
    tasks_to_cancel = []
    # Safely get tasks from app.state, avoiding AttributeErrors
    if hasattr(app.state, 'telegram_task'):
        tasks_to_cancel.append(app.state.telegram_task)
    if hasattr(app.state, 'market_regime_task'):
        tasks_to_cancel.append(app.state.market_regime_task)
    if hasattr(app.state, 'broadcast_task'):
        tasks_to_cancel.append(app.state.broadcast_task)
    if hasattr(app.state, 'mt5_listener_task'):
        tasks_to_cancel.append(app.state.mt5_listener_task)

    logger.info("Cancelling background service tasks...")
    for task in tasks_to_cancel:
        if not task.done():
            task.cancel()

    bot_tasks = list(strategy_service.running_bot_tasks.values())
    for task in bot_tasks:
        if not task.done():
            task.cancel()

    # Gather all tasks to allow them to finish cancelling
    all_tasks = tasks_to_cancel + bot_tasks
    if all_tasks:
        await asyncio.gather(*all_tasks, return_exceptions=True)
    logger.info("All application tasks have been cancelled.")

    # --- 3. Close External Connections Gracefully ---
    logger.info("Closing external connections...")
    await mt5_gateway_service.shutdown()  # Ensure this is called
    await exchange_manager.close_all_public()
    await market_streamer.close()
    await engine.dispose()
    logger.info("All external connections closed. Shutdown complete.")

origins = [
    "http://localhost:3000",
    "https://quantumleap-ai.vercel.app", # Replace with your actual custom domain
]
app = FastAPI(title="QuantumLeap AI Trader",
              description="A Real-Time AI Trading System with Bot Automation and Market Analysis.", version="1.0.0",
              lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"],
                   allow_headers=["*"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

auth_router = APIRouter(prefix="/api/auth", tags=["Authentication"])
users_router = APIRouter(prefix="/api/users", tags=["Users"])
bots_router = APIRouter(prefix="/api/bots", tags=["Trading Bots"])
market_router = APIRouter(prefix="/api/market", tags=["Market Data & AI"])
payments_router = APIRouter(prefix="/api/payments", tags=["Payments & Subscriptions"])
superuser_router = APIRouter(prefix="/api/superuser", tags=["Superuser"], dependencies=[Depends(get_current_superuser)])
wallet_router = APIRouter(prefix="/api/wallet", tags=["Wallet & Swapping"])
strategies_router = APIRouter(prefix="/api/strategies", tags=["Strategy Marketplace"])
public_router = APIRouter(prefix="/api/public", tags=["Public API"])
trading_router = APIRouter(prefix="/api/trading", tags=["Live Trading"])
integrations_router = APIRouter(prefix="/api/integrations", tags=["Integrations"])


# ==============================================================================
# 8. API ENDPOINTS
# ==============================================================================


# --- Balance and History Endpoints ---

@wallet_router.get("/balances", response_model=List[WalletSchema])
async def get_wallet_balances(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Retrieves all non-zero wallet balances for the current user."""
    result = await db.execute(
        select(Wallet).where(Wallet.user_id == current_user.id, Wallet.balance > 0)
    )
    return result.scalars().all()


@wallet_router.get("/transactions", response_model=List[TransactionSchema])
async def get_transactions_history(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Retrieves the user's 100 most recent transactions."""
    result = await db.execute(
        select(Transaction)
        .where(Transaction.user_id == current_user.id)
        .order_by(Transaction.created_at.desc())
        .limit(100)
    )
    return result.scalars().all()


# --- Swapping Endpoints ---

@wallet_router.post("/swap/quote", response_model=SwapQuoteResponse)
async def get_swap_quote(
        request: SwapRequest,
        current_user: User = Depends(get_current_user)
):
    """Provides a firm quote for a potential swap, valid for 30 seconds."""
    return await swap_service.get_swap_quote(request)


@wallet_router.post("/swap/execute", response_model=SwapExecuteResponse)
async def execute_swap(
        request: SwapRequest,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Executes a swap based on the provided assets and amount."""
    return await swap_service.execute_swap(db, current_user.id, request)


# --- Deposit Endpoints ---

@wallet_router.get("/deposit/address/{asset}", response_model=DepositAddressResponse)
async def get_deposit_address(
        asset: str,
        current_user: User = Depends(get_current_user)
):
    """
    Generates and returns a unique deposit address for a given crypto asset
    by calling the production custodial wallet provider (BitGo).
    """
    asset = asset.upper()
    try:
        # This is the call to the real, production-ready service.
        # No more mock logic.
        address_data = await custodial_service.generate_new_address(
            user_id=current_user.id,
            asset=asset
        )

        # Parse the real response from the BitGo API
        # The structure of `address_data` will depend on the provider,
        # but for BitGo, it's typically straightforward.
        blockchain_map = {
            "BTC": "Bitcoin",
            "ETH": "Ethereum (ERC20)",
            "USDT": "Ethereum (ERC20)"
        }

        return DepositAddressResponse(
            asset=asset,
            address=address_data.get("address"),
            # Some blockchains (like XRP, XLM) use memos/tags. BitGo's response
            # would include this if applicable for the wallet type.
            memo=address_data.get("memo"),
            blockchain=blockchain_map.get(asset, "Unknown")
        )

    except CustodialServiceError as e:
        # If the call to BitGo fails, return a user-friendly service unavailable error.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )
    except ValueError as e:
        # Handles cases where the asset is not supported
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@wallet_router.post("/deposit/webhook/crypto")
async def crypto_deposit_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    A webhook endpoint for a custodial service to call when a deposit is confirmed.
    This MUST be secured, e.g., via IP whitelisting or signature verification.
    """
    # --- Production Security: Verify the webhook source ---
    signature = request.headers.get("X-Custodial-Signature")
    body = await request.body()
    if not custodial_service.verify_signature(body, signature):
        raise HTTPException(status_code=403, detail="Invalid signature")

    data = await request.json()
    user_id = data.get("user_id")
    asset = data.get("asset")
    amount = Decimal(str(data.get("amount")))
    tx_hash = data.get("tx_hash")

    if not all([user_id, asset, amount, tx_hash]):
        raise HTTPException(status_code=400, detail="Missing required data in webhook payload.")

    async with db.begin():
        await wallet_service._update_balance(
            db, user_id, asset, amount,
            TransactionType.DEPOSIT,
            notes=f"Crypto deposit confirmed. TxHash: {tx_hash}"
        )

    await websocket_manager.send_personal_message({
        "type": "deposit_completed",
        "asset": asset,
        "amount": str(amount)
    }, user_id)

    return {"status": "ok"}


# --- Withdrawal Endpoints ---

@wallet_router.post("/withdrawal/accounts", response_model=WithdrawalAccountSchema, status_code=201)
async def add_withdrawal_account(
        account_data: WithdrawalAccountCreate,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Securely saves a user's bank account details for fiat withdrawals."""
    encrypted_details = user_service.encrypt_api_key(json.dumps(account_data.account_details))

    new_account = WithdrawalAccount(
        user_id=current_user.id,
        currency=account_data.currency.upper(),
        account_details_encrypted=encrypted_details
    )
    db.add(new_account)
    await db.commit()
    await db.refresh(new_account)

    return WithdrawalAccountSchema(
        id=new_account.id,
        currency=new_account.currency,
        account_details_masked=mask_account_details(account_data.account_details)
    )


@wallet_router.get("/withdrawal/accounts", response_model=List[WithdrawalAccountSchema])
async def get_withdrawal_accounts(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Retrieves all of the user's saved withdrawal accounts."""
    result = await db.execute(
        select(WithdrawalAccount).where(WithdrawalAccount.user_id == current_user.id)
    )
    accounts = result.scalars().all()

    response = []
    for acc in accounts:
        try:
            decrypted_details = json.loads(user_service.decrypt_api_key(acc.account_details_encrypted))
            response.append(WithdrawalAccountSchema(
                id=acc.id,
                currency=acc.currency,
                account_details_masked=mask_account_details(decrypted_details)
            ))
        except Exception:
            # Handle cases where decryption might fail
            continue
    return response


@wallet_router.delete("/withdrawal/accounts/{account_id}", status_code=204)
async def delete_withdrawal_account(
        account_id: PythonUUID,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Deletes a saved withdrawal account."""
    account = await db.get(WithdrawalAccount, account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Account not found.")

    await db.delete(account)
    await db.commit()
    return


@wallet_router.post("/withdrawal/request", response_model=WithdrawalResponse)
async def request_withdrawal(
        request: WithdrawalRequest,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    account = await db.get(WithdrawalAccount, request.account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Withdrawal account not found.")

    asset_to_withdraw = account.currency

    # CORRECTLY DEFINE account_details by decrypting it
    account_details = json.loads(user_service.decrypt_api_key(account.account_details_encrypted))

    async with db.begin():
        try:
            tx = Transaction(
                user_id=current_user.id, type=TransactionType.WITHDRAWAL.value,
                status=TransactionStatus.PENDING.value, asset=asset_to_withdraw,
                amount=-request.amount,
                notes=f"Withdrawal request to account ...{mask_account_details(account_details).get('account_number', '****')[-4:]}"
            )
            db.add(tx)

            wallet = await wallet_service.get_or_create_wallet(db, current_user.id, asset_to_withdraw)
            if wallet.balance < request.amount:
                raise InsufficientFundsError(f"Insufficient funds in {asset_to_withdraw} wallet.")
            wallet.balance -= request.amount

            # --- CORRECTED CALL to the new paystack_service ---
            await paystack_service.initiate_payout(
                transaction_id=tx.id,
                amount=request.amount,
                recipient_details=account_details
            )

        except InsufficientFundsError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            logger.error(f"Error initiating withdrawal for user {current_user.id}: {e}")
            # Re-raise exceptions from the paystack service
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=500, detail="An internal error occurred while processing your withdrawal.")

    return WithdrawalResponse(
        transaction_id=tx.id,
        status=TransactionStatus.PENDING.value,
        message="Withdrawal request received and is being processed."
    )


@wallet_router.post("/swap/quote", response_model=SwapQuoteResponse)
async def get_swap_quote_endpoint(
        request: SwapRequest,
        current_user: User = Depends(get_current_user)
):
    return await swap_service.get_swap_quote(current_user.id, request)


@wallet_router.post("/swap/execute", response_model=SwapExecuteResponse)
async def execute_swap_endpoint(
        request: SwapExecuteRequest,  # Changed to the new request model
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    return await swap_service.execute_swap(db, current_user.id, request)


@auth_router.post("/register")
async def register_user(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    try:
        firebase_user = auth.create_user(email=user_data.email, password=user_data.password)
        new_user = User(id=firebase_user.uid, email=firebase_user.email, role=UserRole.USER.value,
                        subscription_plan=SubscriptionPlan.BASIC.value)
        db.add(new_user)
        await notification_service.create_notification(
            db,
            type=NotificationType.NEW_USER,
            message=f"New user signed up: {user_data.email}",
            user_id=new_user.id
        )

        await db.commit()  # Commit the notification along with the new user
        await db.refresh(new_user)
        user_dict = UserSchema.from_orm(new_user).model_dump()

        return JSONResponse(
            status_code=status.HTTP_201_CREATED,
            content={
                "message": "User registered successfully.",
                "user": jsonable_encoder(user_dict)
            }
        )

    except auth.EmailAlreadyExistsError:
        # This is where the frontend is getting the "auth/invalid-credential" message from.
        # Let's return a more helpful message.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The email is already registered."
        )
    except Exception as e:
        logger.error(f"Error during user registration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during registration: {str(e)}"
        )


@auth_router.post("/token")
async def login_for_access_token(id_token: str = Body(..., embed=True), db: AsyncSession = Depends(get_db)):
    try:
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token['uid']
        user = await db.get(User, uid)
        if not user: raise HTTPException(status_code=401, detail="User not found in database.")

        if user.is_otp_enabled:
            two_factor_token = create_access_token(data={"sub": user.id, "2fa_passed": False}, expires_delta=datetime.timedelta(minutes=5))
            return JSONResponse(status_code=202, content={"message": "Two-factor authentication required.", "two_factor_token": two_factor_token})

        access_token = create_access_token(data={"sub": user.id, "ver": user.token_version, "2fa_passed": True})
        refresh_token = create_refresh_token(data={"sub": user.id})
        return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}
    except auth.InvalidIdTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Firebase ID token.")



@auth_router.post("/token/refresh", response_model=Token)
async def refresh_access_token(refresh_token: str = Body(..., embed=True), db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                          detail="Could not validate refresh token",
                                          headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None: raise credentials_exception
        user = await db.get(User, user_id)
        if not user: raise credentials_exception
        access_token_expires = datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        new_access_token = create_access_token(data={"sub": user.id, "role": user.role},
                                               expires_delta=access_token_expires)
        new_refresh_token = create_refresh_token(data={"sub": user.id})
        return {"access_token": new_access_token, "refresh_token": new_refresh_token, "token_type": "bearer"}
    except JWTError:
        raise credentials_exception


@auth_router.post("/superuser/login", response_model=Token, tags=["Authentication"])
async def superuser_login(login_data: SuperuserLoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Handles superuser login with a pre-hashed password check for robustness.
    """
    try:
        # 1. Check if the pre-hashed password was created successfully at startup
        if not SUPERUSER_PASSWORD_HASH:
            raise HTTPException(status_code=500,
                                detail="Superuser login is disabled due to a server configuration error.")

        # 2. Verify the submitted email
        if login_data.email != settings.SUPERUSER_EMAIL:
            logger.warning(f"Failed superuser login attempt for email: {login_data.email}")
            raise HTTPException(status_code=401, detail="Incorrect email or password")

        # 3. Verify the submitted password against the pre-hashed password
        # This is a much simpler and more reliable check
        if not pwd_context.verify(login_data.password, SUPERUSER_PASSWORD_HASH):
            logger.warning(f"Failed superuser login attempt for email: {login_data.email} (invalid password)")
            raise HTTPException(status_code=401, detail="Incorrect email or password")

        # 4. Find the superuser in the database to get their ID
        superuser = await db.scalar(select(User).where(User.email == settings.SUPERUSER_EMAIL))
        if not superuser:
            raise HTTPException(status_code=404, detail="Superuser account found in settings but not in the database.")

        # 5. Create and return tokens
        access_token = create_access_token(
            data={"sub": superuser.id, "ver": getattr(superuser, 'token_version', 0), "role": "superuser"}
        )
        refresh_token = create_refresh_token(data={"sub": superuser.id})

        logger.info(f"Successful superuser login for: {login_data.email}")
        return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

    except Exception as e:
        logger.error(f"An unexpected error occurred during superuser login: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An internal server error occurred during login.")

@users_router.get("/me", response_model=UserSchema)
async def read_users_me(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user


@users_router.post("/api-keys", response_model=APIKeySchema, status_code=status.HTTP_201_CREATED)
async def add_api_key(key_data: APIKeyCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    existing_key = await db.scalar(
        select(UserAPIKey).where(
            and_(
                UserAPIKey.user_id == current_user.id,
                UserAPIKey.exchange == key_data.exchange,
                UserAPIKey.asset_class == key_data.asset_class.value
            )
        )
    )
    if existing_key:
        raise HTTPException(status_code=400, detail=f"An API key for {key_data.exchange} and asset class {key_data.asset_class.value} already exists.")

    encrypted_api_key = user_service.encrypt_data(key_data.api_key)
    encrypted_secret_key = user_service.encrypt_data(key_data.secret_key)

    new_key = UserAPIKey(
        user_id=current_user.id,
        exchange=key_data.exchange,
        api_key_encrypted=encrypted_api_key,
        secret_key_encrypted=encrypted_secret_key,
        asset_class=key_data.asset_class.value  # --- FIX 1: Save the asset_class to the database ---
    )
    db.add(new_key)
    await db.commit()
    await db.refresh(new_key)

    # --- FIX 2: Include the asset_class in the response ---
    return APIKeySchema(
        id=new_key.id,
        exchange=new_key.exchange,
        api_key_masked=f"****{key_data.api_key[-4:]}",
        asset_class=new_key.asset_class
    )


@users_router.get("/api-keys", response_model=List[APIKeySchema])
async def get_api_keys(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    keys_result = await db.execute(select(UserAPIKey).where(UserAPIKey.user_id == current_user.id))
    key_list = keys_result.scalars().all()

    response_keys = []
    for key in key_list:
        try:
            decrypted_api_key = user_service.decrypt_data(key.api_key_encrypted)
            masked_key = f"****{decrypted_api_key[-4:]}"
        except Exception:
            masked_key = "Decryption Error - Please Update"

        # --- THIS IS THE FIX ---
        # We must include all required fields for the APIKeySchema.
        response_keys.append(APIKeySchema(
            id=key.id,
            exchange=key.exchange,
            api_key_masked=masked_key,
            asset_class=key.asset_class  # <-- ADD THIS LINE
        ))

    return response_keys


@users_router.delete("/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(key_id: int, current_user: User = Depends(get_current_user),
                         db: AsyncSession = Depends(get_db)):
    key_to_delete = await db.get(UserAPIKey, key_id)
    if not key_to_delete or key_to_delete.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="API Key not found.")
    await db.delete(key_to_delete)
    await db.commit()
    return


@users_router.post("/platform-api-keys", response_model=PlatformAPIKeyCreateResponse,
                   status_code=status.HTTP_201_CREATED)
async def create_platform_api_key(
        user: User = Depends(get_current_user),
        _=Depends(require_ultimate_plan),  # This runs the check but we don't need its return value
        db: AsyncSession = Depends(get_db)
):
    """Generate a new API key for the user's account."""
    prefix = f"ql_{secrets.token_urlsafe(8)}"
    api_key = f"{prefix}_{secrets.token_urlsafe(24)}"
    key_hash = pwd_context.hash(api_key)

    new_key = PlatformAPIKey(
        user_id=user.id,
        key_prefix=prefix,
        key_hash=key_hash
    )
    db.add(new_key)
    await db.commit()
    await db.refresh(new_key)

    return PlatformAPIKeyCreateResponse(
        id=new_key.id,
        key_prefix=new_key.key_prefix,
        full_key=api_key,
        created_at=new_key.created_at
    )


@users_router.get("/platform-api-keys", response_model=List[PlatformAPIKeySchema])
async def get_platform_api_keys(
        # --- FIX: Correct dependency injection ---
        user: User = Depends(get_current_user),
        _=Depends(require_ultimate_plan),
        db: AsyncSession = Depends(get_db)
):
    """List all active API keys for the user's account."""
    result = await db.execute(
        select(PlatformAPIKey).where(PlatformAPIKey.user_id == user.id)
    )
    return result.scalars().all()


@users_router.delete("/platform-api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_platform_api_key(
        key_id: int,
        # --- FIX: Correct dependency injection ---
        user: User = Depends(get_current_user),
        _=Depends(require_ultimate_plan),
        db: AsyncSession = Depends(get_db)
):
    """Revoke an API key."""
    key_to_delete = await db.get(PlatformAPIKey, key_id)
    if not key_to_delete or key_to_delete.user_id != user.id:
        raise HTTPException(status_code=404, detail="API Key not found.")

    await db.delete(key_to_delete)
    await db.commit()
    return


@users_router.get("/me/portfolio", response_model=List[Dict[str, Any]])
async def get_user_portfolio(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """
    A unified portfolio endpoint that aggregates balances from all connected non-custodial sources:
    1. The connected MT5 Gateway account.
    2. All connected CCXT exchanges (Binance, KuCoin, etc.).
    This function runs all data fetching operations concurrently for maximum performance.
    """
    # --- Step 1: Create Concurrent Tasks for All Data Sources ---
    fetch_tasks = []

    # Task for MT5 Gateway
    fetch_tasks.append(fetch_mt5_balance())  # Helper function defined below

    # Tasks for all CCXT Exchanges
    api_keys_result = await db.execute(select(UserAPIKey).where(UserAPIKey.user_id == current_user.id))
    api_keys = api_keys_result.scalars().all()

    for key_entry in api_keys:
        # Create a new, single-use client for each key. The helper will close it.
        private_client = await exchange_manager.get_private_client(
            current_user.id,
            key_entry.exchange,
            AssetClass(key_entry.asset_class)
        )
        if private_client:
            fetch_tasks.append(fetch_exchange_balance(private_client))

    if not fetch_tasks:
        return []  # Return early if no connections are configured

    # --- Step 2: Run All Fetching Tasks Concurrently ---
    source_balances = await asyncio.gather(*fetch_tasks, return_exceptions=True)

    # --- Step 3: Aggregate Balances from All Sources ---
    aggregated_portfolio = defaultdict(lambda: {'amount': Decimal(0), 'sources': []})
    for result in source_balances:
        if isinstance(result, Exception):
            logger.error(f"A portfolio fetch task failed for an external account: {result}")
            continue

        source_name = result["source"]
        balances = result["balances"]
        for asset, amount in balances.items():
            aggregated_portfolio[asset]['amount'] += Decimal(str(amount))
            if source_name not in aggregated_portfolio[asset]['sources']:
                aggregated_portfolio[asset]['sources'].append(source_name)

    if not aggregated_portfolio:
        return []

    # --- Step 4: Fetch Prices for All Aggregated Assets ---
    assets_to_price = [asset for asset in aggregated_portfolio.keys() if asset not in ['USD', 'USDT', 'USDC', 'BUSD']]
    asset_prices = {}

    if assets_to_price:
        pricing_exchange = await exchange_manager.get_fault_tolerant_public_client()
        if not pricing_exchange:
            raise HTTPException(status_code=503, detail="Market data provider is currently unavailable for pricing.")

        price_fetch_tasks = []
        try:
            await pricing_exchange.load_markets()
            for asset in assets_to_price:
                # Find a valid symbol to price the asset against USDT or BUSD
                symbol_usdt = f"{asset}/USDT"
                symbol_busd = f"{asset}/BUSD"
                if symbol_usdt in pricing_exchange.symbols:
                    price_fetch_tasks.append(fetch_asset_price(pricing_exchange, symbol_usdt))
                elif symbol_busd in pricing_exchange.symbols:
                    price_fetch_tasks.append(fetch_asset_price(pricing_exchange, symbol_busd))
                else:
                    asset_prices[asset] = Decimal(0)  # Mark as unpriceable

            price_results = await asyncio.gather(*price_fetch_tasks, return_exceptions=True)

            priceable_assets = [asset for asset in assets_to_price if asset not in asset_prices]
            for i, result in enumerate(price_results):
                asset = priceable_assets[i]
                if isinstance(result, Exception):
                    asset_prices[asset] = Decimal(0)
                else:
                    asset_prices[asset] = Decimal(str(result))
        finally:
            if pricing_exchange:
                await pricing_exchange.close()

    # --- Step 5: Build and Return the Final Portfolio ---
    final_portfolio = []
    stablecoins = ['USD', 'USDT', 'USDC', 'BUSD']
    for asset, data in aggregated_portfolio.items():
        price = Decimal(1) if asset in stablecoins else asset_prices.get(asset, Decimal(0))
        usd_value = data['amount'] * price

        if usd_value > 1.0:  # Filter out dust balances
            final_portfolio.append({
                "asset": asset,
                "amount": data['amount'],
                "usd_value": usd_value,
                "sources": data['sources']
            })

    return sorted(final_portfolio, key=lambda x: x['usd_value'], reverse=True)


async def fetch_mt5_balance() -> Dict:
    """Helper coroutine to fetch balance from the MT5 Gateway."""
    try:
        mt5_summary = await mt5_gateway_service.get_account_summary()
        if mt5_summary:
            asset = mt5_summary["currency"]
            balance = mt5_summary["balance"]
            return {
                "source": "MetaTrader 5",
                "balances": {asset: balance}
            }
        return {"source": "MetaTrader 5", "balances": {}}
    except Exception as e:
        # Raise the exception to be caught by asyncio.gather
        raise ConnectionError(f"MT5 balance fetch failed: {e}")


async def fetch_exchange_balance(client: BrokerClient) -> Dict:
    """
    Helper coroutine to fetch balance from a single CCXT client and ensure it's closed.
    This now works with our BrokerClient adapter interface.
    """
    exchange_id = "Unknown Exchange"
    try:
        # The adapter pattern allows us to get the underlying client's ID
        if isinstance(client, CcxtClient):
            exchange_id = client._client.id

        balance_data = await client.fetch_balance()  # This method needs to be added to the adapter

        # In a real system, fetch_balance would be a defined method on the BrokerClient interface
        # For now, we'll assume it exists on the passed client object.
        total_balances = balance_data.get('total', {})
        non_zero_balances = {
            asset: amount
            for asset, amount in total_balances.items()
            if amount > 0.00001
        }
        return {"source": exchange_id.title(), "balances": non_zero_balances}
    except Exception as e:
        raise ConnectionError(f"Balance fetch failed for {exchange_id}: {e}")
    finally:
        if client:
            await client.close()


async def fetch_asset_price(exchange: ccxt.Exchange, symbol: str) -> float:
    """Helper coroutine to fetch a single asset price."""
    try:
        ticker = await exchange.fetch_ticker(symbol)
        return ticker['last']
    except Exception:
        raise



@users_router.get("/me/full", response_model=FullUserSchema)
async def read_full_user_profile(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """
    Get the current user's complete profile information, including related profile data.
    """
    try:
        logger.info(f"Fetching full profile for user_id: {current_user.id}")

        # Eagerly load the profile relationship to avoid a separate query
        result = await db.execute(
            select(User).options(selectinload(User.profile)).where(User.id == current_user.id)
        )
        user = result.scalar_one_or_none()

        if not user:
            # This should theoretically never happen if get_current_user works, but it's good practice
            logger.warning(f"User not found in DB for id: {current_user.id} during full profile fetch.")
            raise HTTPException(status_code=404, detail="User not found")

        # The user object has been fetched. Now Pydantic will try to serialize it.
        # If the error happens, it will be caught by the except block below.
        logger.info(f"Successfully fetched user and profile. Returning to client.")
        return user

    except Exception as e:
        # This will catch any error and log it to your backend console.
        logger.error(f"!!! CRITICAL ERROR in /me/full endpoint for user {current_user.id}: {e}", exc_info=True)
        # exc_info=True will print the full traceback for detailed debugging.

        # Return a generic 500 error to the frontend
        raise HTTPException(status_code=500, detail="An internal error occurred while fetching the user profile.")


@users_router.put("/me/profile", response_model=UserProfileSchema)
async def update_user_profile(
        profile_data: UserProfileUpdate,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Updates the current user's profile information."""
    profile = await db.scalar(select(UserProfile).where(UserProfile.user_id == current_user.id))

    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)

    update_data = profile_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(profile, key, value)

    await db.commit()
    await db.refresh(profile)
    return profile


@users_router.post("/me/profile/picture", response_model=UserProfileSchema)
async def upload_profile_picture(
        file: UploadFile = File(...),
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """
    Securely uploads a user's profile picture to Cloudinary, validates it,
    and saves the resulting URL to the user's profile in a transaction-safe way.
    """
    # 1. Robust Validation
    if file.content_type not in ["image/jpeg", "image/png"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPG and PNG are accepted.")

    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
    size = await file.read()
    if len(size) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File size exceeds the 5MB limit.")
    await file.seek(0)

    try:
        # 2. Asynchronous Upload to Cloudinary
        logger.info(f"Uploading profile picture for user {current_user.id} to Cloudinary...")
        upload_result = await asyncio.to_thread(
            cloudinary.uploader.upload,
            file.file,
            folder="profile_pictures",
            public_id=f"user_{current_user.id}",
            overwrite=True,
            resource_type="image"
        )
        image_url = upload_result.get("secure_url")
        if not image_url:
            raise HTTPException(status_code=500, detail="Cloud service did not return a valid URL.")
        logger.info(f"Successfully uploaded image for user {current_user.id}. URL: {image_url}")

        # --- THIS IS THE FIX ---
        # We REMOVED the `async with db.begin():` block.
        # We now operate directly on the session provided by `get_db`.

        # 3. Save the URL to the database
        profile = await db.scalar(select(UserProfile).where(UserProfile.user_id == current_user.id))
        if not profile:
            profile = UserProfile(user_id=current_user.id)
            db.add(profile)

        profile.profile_picture_url = image_url

        # 4. Manually commit the session.
        await db.commit()
        await db.refresh(profile)

        return profile

    except Exception as e:
        # If any part of this process fails (upload or DB save), we log it
        # and return a user-friendly error. The `get_db` dependency will
        # automatically handle rolling back any partial DB changes.
        logger.error(f"Profile picture upload failed for user {current_user.id}: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=503, detail="Failed to upload image. Please try again later.")




# --- HELPER FUNCTIONS FOR THE PORTFOLIO ENDPOINT ---
# These should be placed right below the `get_user_portfolio` function.
async def fetch_exchange_balance(client: BrokerClient) -> Dict[str, float]:
    """
    Fetches the account balance from any given client that adheres to the BrokerClient adapter pattern.
    This function is now POLYMORPHIC and handles CCXT and MT5 clients correctly.
    """
    try:
        # --- THIS IS THE POLYMORPHIC FIX ---
        # 1. Check the type of the client object passed in.

        if isinstance(client, CcxtClient):
            # If it's a CCXT client, use the standard fetch_balance method.
            balance_data = await client._client.fetch_balance()
            total_balances = balance_data.get('total', {})
            return {
                asset: amount
                for asset, amount in total_balances.items()
                if amount > 0.00001  # Filter dust
            }

        elif isinstance(client, Mt5Client):
            # If it's an MT5 client, use its specific get_account_summary method.
            # This must be run in a thread because the Mt5Client's methods are blocking.
            summary = await asyncio.to_thread(client.get_account_summary)
            if summary and summary.get("status") == "success":
                # MT5 provides the main account currency and balance directly.
                currency = summary["details"]["currency"]
                balance = summary["details"]["balance"]
                return {currency: balance}
            else:
                # If fetching the summary fails, return an empty dict.
                logger.warning("Failed to fetch MT5 account summary for portfolio.")
                return {}

        else:
            # If an unknown client type is passed, log a warning.
            logger.warning(f"Unknown client type passed to fetch_exchange_balance: {type(client)}")
            return {}

    except Exception as e:
        # This generic catch is important for handling unexpected errors from any client type.
        client_id = client._client.id if isinstance(client, CcxtClient) else "MT5"
        logger.error(f"Could not fetch balance from {client_id}: {e}", exc_info=True)
        raise  # Re-raise the exception to be handled by the main endpoint's asyncio.gather

    finally:
        # Ensure that no matter what happens, the client connection is closed.
        if client:
            await client.close()


async def fetch_asset_price(exchange: ccxt.Exchange, symbol: str) -> float:
    """Fetches the last price for a given trading symbol."""
    try:
        ticker = await exchange.fetch_ticker(symbol)
        return ticker['last']
    except ccxt.BadSymbol:
        # Try fetching against BUSD as a fallback if USDT market doesn't exist
        try:
            fallback_symbol = f"{symbol.split('/')[0]}/BUSD"
            ticker = await exchange.fetch_ticker(fallback_symbol)
            return ticker['last']
        except Exception:
            # Re-raise the original exception if fallback also fails
            raise
    except Exception:
        raise


# In main.py, inside the `bots_router`

@bots_router.post("/", response_model=TradingBotSchema, status_code=status.HTTP_201_CREATED, tags=["Trading Bots"])
async def create_trading_bot(
        bot_data: TradingBotCreate,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """
    Creates a new trading bot for the current user.
    Handles both pre-built and visual strategies, and robustly enforces plan limits.
    """
    try:
        # 1. Check if the user has reached their bot limit for their current plan
        user_bots_count_result = await db.execute(
            select(func.count(TradingBot.id)).where(TradingBot.owner_id == current_user.id)
        )
        user_bots_count = user_bots_count_result.scalar_one()

        plan_limits = {
            SubscriptionPlan.BASIC.value: 2,  # Example limit
            SubscriptionPlan.PREMIUM.value: 10,  # Example limit
            SubscriptionPlan.ULTIMATE.value: 50,  # Example limit
        }

        # Superusers have no limits
        if current_user.role != UserRole.SUPERUSER.value:
            limit = plan_limits.get(current_user.subscription_plan, 0)
            if user_bots_count >= limit:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"You have reached the bot limit ({limit}) for the {current_user.subscription_plan} plan. Please upgrade."
                )

        # 2. Enforce feature gates using the new 'is_ultimate' helper function
        if bot_data.market_type == MarketType.FUTURE and not is_ultimate(current_user):
            raise HTTPException(status_code=403, detail="Futures trading is an Ultimate Plan feature.")

        if bot_data.optimus_enabled and not is_ultimate(current_user):
            raise HTTPException(status_code=403, detail="Optimus AI Mode is an Ultimate Plan feature.")

        # Assume 'sizing_strategy' is part of your TradingBotCreate model
        sizing_strategy = getattr(bot_data, 'sizing_strategy', PositionSizingStrategy.FIXED_AMOUNT)
        if sizing_strategy != PositionSizingStrategy.FIXED_AMOUNT and not is_ultimate(current_user):
            raise HTTPException(status_code=403, detail="Advanced Position Sizing is an Ultimate Plan feature.")

        # 3. Prepare strategy data
        strategy_params_str = json.dumps(bot_data.strategy_params) if bot_data.strategy_params else None
        visual_strategy_json_str = json.dumps(bot_data.visual_strategy_json) if bot_data.visual_strategy_json else None

        # 4. Create the new TradingBot database object
        new_bot = TradingBot(
            name=bot_data.name,
            owner_id=current_user.id,
            symbol=bot_data.symbol.upper(),
            exchange=bot_data.exchange.value,
            is_paper_trading=bot_data.is_paper_trading,
            strategy_type=bot_data.strategy_type.value,
            strategy_name=bot_data.strategy_name,
            strategy_params=strategy_params_str,
            visual_strategy_json=visual_strategy_json_str,
            market_type=bot_data.market_type.value,
            leverage=bot_data.leverage,
            take_profit_percentage=bot_data.take_profit_percentage,
            stop_loss_percentage=bot_data.stop_loss_percentage,
            market_regime_filter_enabled=bot_data.market_regime_filter_enabled,
            optimus_enabled=bot_data.optimus_enabled,
            # Add sizing strategy if it's part of your DB model
            # sizing_strategy=sizing_strategy.value,
            # sizing_params=json.dumps(getattr(bot_data, 'sizing_params', {})),
        )

        db.add(new_bot)
        await db.commit()
        await db.refresh(new_bot)

        logger.info(f"Successfully created bot '{new_bot.name}' (ID: {new_bot.id}) for user {current_user.email}")

        # 5. Return the SQLAlchemy object directly. FastAPI handles serialization.
        return new_bot

    except HTTPException:
        # Re-raise HTTPExceptions directly to send the correct status code to the client
        raise
    except Exception as e:
        logger.error(f"Failed to create bot for user {current_user.email}: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal server error occurred while creating the bot."
        )

# Helper function to avoid repetition in the endpoint
def is_ultimate(user: User) -> bool:
    """
    A helper function to check if a user has the Ultimate plan or is a superuser.
    """
    if user.role == UserRole.SUPERUSER.value:
        return True
    return user.subscription_plan == SubscriptionPlan.ULTIMATE.value

@bots_router.get("/", response_model=List[TradingBotSchema])
async def get_user_bots(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TradingBot).where(TradingBot.owner_id == current_user.id))
    bots = result.scalars().all()
    return [TradingBotSchema.model_validate(bot) for bot in bots]


@bots_router.get("/{bot_id}", response_model=TradingBotSchema)
async def get_bot_details(bot_id: PythonUUID, current_user: User = Depends(get_current_user),
                          db: AsyncSession = Depends(get_db)):
    bot = await db.get(TradingBot, bot_id)
    if not bot or bot.owner_id != current_user.id: raise HTTPException(status_code=404, detail="Bot not found")
    return TradingBotSchema.model_validate(bot)


@bots_router.post("/{bot_id}/start")
async def start_user_bot(bot_id: PythonUUID, background_tasks: BackgroundTasks,
                         current_user: User = Depends(get_current_user),
                         db: AsyncSession = Depends(get_db)):
    bot = await db.get(TradingBot, bot_id)
    if not bot or bot.owner_id != current_user.id: raise HTTPException(status_code=404, detail="Bot not found")
    if bot.is_active: raise HTTPException(status_code=400, detail="Bot is already active")
    await strategy_service.start_bot(db, current_user, bot, background_tasks)
    return {"message": "Bot started successfully", "bot_id": bot_id}


@bots_router.post("/{bot_id}/stop")
async def stop_user_bot(bot_id: PythonUUID, current_user: User = Depends(get_current_user),
                        db: AsyncSession = Depends(get_db)):
    bot = await db.get(TradingBot, bot_id)
    if not bot or bot.owner_id != current_user.id: raise HTTPException(status_code=404, detail="Bot not found")
    if not bot.is_active: raise HTTPException(status_code=400, detail="Bot is not active")
    await strategy_service.stop_bot(db, bot)
    return {"message": "Bot stopped successfully", "bot_id": bot_id}


@bots_router.delete("/{bot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trading_bot(bot_id: PythonUUID, current_user: User = Depends(get_current_user),
                             db: AsyncSession = Depends(get_db)):
    bot = await db.get(TradingBot, bot_id)
    if not bot or bot.owner_id != current_user.id: raise HTTPException(status_code=404, detail="Bot not found")
    if bot.is_active: raise HTTPException(status_code=400, detail="Cannot delete an active bot. Please stop it first.")
    await db.delete(bot)
    await db.commit()
    return


@bots_router.get("/{bot_id}/logs", response_model=List[TradeLogSchema])
async def get_bot_trade_logs(bot_id: PythonUUID, current_user: User = Depends(get_current_user),
                             db: AsyncSession = Depends(get_db)):
    bot = await db.get(TradingBot, bot_id)
    if not bot or bot.owner_id != current_user.id: raise HTTPException(status_code=404, detail="Bot not found")
    result = await db.execute(
        select(TradeLog).where(TradeLog.bot_id == bot_id).order_by(TradeLog.timestamp.desc()).limit(100))
    logs = result.scalars().all()
    return logs


@bots_router.post("/webhook/{webhook_id}")
async def tradingview_webhook(webhook_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    """
    Receives and processes incoming webhooks from TradingView alerts.
    """
    # 1. Find the bot associated with this unique, secret webhook ID
    result = await db.execute(select(TradingBot).where(TradingBot.webhook_id == webhook_id))
    bot = result.scalar_one_or_none()

    if not bot or not bot.is_active:
        # If the bot is not active or doesn't exist, ignore the webhook
        # Return 200 OK to prevent TradingView from retrying or marking the alert as failed.
        return {"status": "ignored_inactive_bot"}

    # 2. Get the owner of the bot
    user = await db.get(User, bot.owner_id)
    if not user:
        return {"status": "ignored_no_owner"}

    # 3. Parse the incoming alert data
    try:
        alert_data = await request.json()
    except json.JSONDecodeError:
        # Handle cases where TradingView might send plain text
        alert_data = {"raw": await request.body()}

    # 4. Trigger the webhook strategy execution
    await strategy_service.run_webhook_strategy(user, bot, alert_data)

    return {"status": "ok"}


@trading_router.post("/orders", response_model=OpenOrderSchema)
async def place_manual_order(
        order_data: ManualOrderCreate,
        current_user: User = Depends(get_current_user),

):
    """
    Places a manual trade order on a user's connected external exchange.
    """
    private_exchange = None
    try:
        private_exchange = await exchange_manager.get_private_client(current_user.id, order_data.exchange,
                                                                   order_data.asset_class)
        if not private_exchange:
            raise HTTPException(status_code=400, detail="Exchange not connected or API keys are invalid.")

        params = {}
        if order_data.type == OrderType.STOP_LIMIT:
            params['stopPrice'] = order_data.stop_price

        order = await private_exchange.create_order(
            symbol=order_data.symbol,
            type=order_data.type.value,
            side=order_data.side.value,
            amount=order_data.amount,
            price=order_data.price,
            params=params
        )

        # We don't log manual trades in the bot's TradeLog, but we return the order confirmation
        return OpenOrderSchema(
            id=order['id'],
            symbol=order['symbol'],
            side=order['side'],
            type=order['type'],
            amount=order['amount'],
            price=order.get('price', 0.0),
            filled=order.get('filled', 0.0),
            status=order.get('status', 'open'),
            timestamp=datetime.datetime.fromtimestamp(order['timestamp'] / 1000, tz=datetime.timezone.utc)
        )
    except (ccxt.InsufficientFunds, ccxt.InvalidOrder, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Manual order placement failed for user {current_user.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred while placing the order.")
    finally:
        if private_exchange:
            await private_exchange.close()


@trading_router.get("/orders/{exchange}/{symbol}", response_model=List[Dict])
async def get_open_orders(
    exchange: str, 
    symbol: str, 
    user: User = Depends(get_current_user)
):
    """
    Fetches the user's currently open orders from their connected 
    non-custodial exchange account for a specific symbol.
    """
    private_client = None
    try:
        # Use the robust ExchangeManager to get a temporary, authenticated client
        private_client = await exchange_manager.get_private_client(user.id, exchange, AssetClass.CRYPTO)
        if not private_client:
            raise HTTPException(status_code=400, detail=f"API keys for '{exchange}' are not configured or are invalid.")
        
        # Fetch the open orders using the client
        open_orders = await private_client.fetch_open_orders(symbol)
        return open_orders
        
    except ccxt.BadSymbol as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ccxt.AuthenticationError:
        raise HTTPException(status_code=403, detail="Authentication failed. Please check your API keys.")
    except Exception as e:
        logger.error(f"Failed to fetch open orders for {symbol} on {exchange} for user {user.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred while fetching orders.")
    finally:
        # CRITICAL: Always close the single-use private client
        if private_client:
            await private_client.close()


@public_router.get("/bots/{bot_id}", response_model=PublicBotPerformanceSchema)
async def get_public_bot_performance(
        bot_id: PythonUUID,
        db: AsyncSession = Depends(get_db)
):
    """Fetches the performance data for a single, publicly shared bot.    This endpoint does not require authentication.
    """
    # Eagerly load the trade logs associated with the bot
    result = await db.execute(
        select(TradingBot)
        .options(selectinload(TradingBot.trade_logs))
        .where(TradingBot.id == bot_id, TradingBot.is_public == True)
    )
    bot = result.scalar_one_or_none()

    if not bot:
        raise HTTPException(status_code=404, detail="Public bot not found or not shared.")

    # Sort trade logs by timestamp descending before returning
    bot.trade_logs.sort(key=lambda x: x.timestamp, reverse=True)

    return bot


@public_router.get("/community-stats", response_model=CommunityStatsSchema)
async def get_community_stats(db: AsyncSession = Depends(get_db)):
    """
    Fetches aggregated, public-facing statistics for the homepage.
    This endpoint is designed to be fast and is not authenticated.
    """
    # 1. Get Total Users
    total_users_query = select(func.count(User.id))
    total_users = await db.scalar(total_users_query)

    # 2. Get Total Bots Created
    bots_created_query = select(func.count(TradingBot.id))
    bots_created = await db.scalar(bots_created_query)

    # 3. Get Top 3 Performing Strategies from the Marketplace
    # We will rank them by their paper trading PNL for a consistent and positive metric.
    top_strategies_query = (
        select(TradingBot)
        .options(selectinload(TradingBot.owner).selectinload(User.profile))
        .where(TradingBot.publish_type != BotPublishType.PRIVATE.value)
        .order_by(TradingBot.paper_pnl_usd.desc())
        .limit(3)
    )
    top_strategies_result = await db.execute(top_strategies_query)
    top_strategies = top_strategies_result.scalars().all()

    return CommunityStatsSchema(
        total_users=total_users,
        bots_created=bots_created,
        top_strategies=top_strategies
    )


@public_router.get("/market-ticker", response_model=MarketTickerResponseSchema)
async def get_market_ticker_data():
    """A public endpoint to fetch live ticker data for the homepage."""
    exchange = await exchange_manager.get_fault_tolerant_public_client()
    if not exchange:
        raise HTTPException(status_code=503, detail="Market data provider is currently unavailable.")

    symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT']
    try:
        tickers = await exchange.fetch_tickers(symbols)
        market_data = {
            symbol: TickerSchema(price=data['last'], change=data['percentage'])
            for symbol, data in tickers.items()
            if data and data.get('last') is not None
        }
        return MarketTickerResponseSchema(data=market_data)
    except Exception as e:
        logger.error(f"Failed to fetch public market ticker: {e}")
        raise HTTPException(status_code=500, detail="Could not fetch market data.")


@public_router.get("/market-ticker")
async def get_market_ticker(symbols: Optional[List[str]] = Query(None)):
    """
    Fetches ticker prices from multiple exchanges for resilience.
    Defaults to a standard list if no symbols are provided.
    """
    if not symbols:
        symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT', 'ADA/USDT']

    exchanges = ['binance', 'kucoin', 'bybit']  # Fallback order
    all_tickers = {}

    for exchange_id in exchanges:
        try:
            exchange_class = getattr(ccxt, exchange_id)
            async with exchange_class() as exchange:
                if exchange.has['fetchTickers']:
                    tickers = await exchange.fetch_tickers(symbols)
                    # Merge results, giving preference to the first successful exchange
                    for symbol, data in tickers.items():
                        if symbol not in all_tickers:
                            all_tickers[symbol] = {
                                'symbol': symbol,
                                'price': data.get('last'),
                                'change_24h': data.get('percentage')
                            }
                    # If we have all symbols, we can stop
                    if len(all_tickers) == len(symbols):
                        break
        except Exception as e:
            logger.warning(f"Could not fetch tickers from {exchange_id}: {e}")
            continue

    if not all_tickers:
        raise HTTPException(status_code=503, detail="Market data is temporarily unavailable.")

    return list(all_tickers.values())

@public_router.post("/chat")
async def handle_public_chat(request: ChatRequest):
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    try:
        # Calls the new, correct method for the general assistant persona
        response_text = await llm_service.get_general_assistant_response(request.message, request.history)
        return {"response": response_text}
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Public chat assistant failed to get LLM response: {e}", exc_info=True)
        raise HTTPException(status_code=503, detail="The AI assistant is currently unavailable.")

@public_router.get("/market-data/status")
async def get_market_data_status():
    """
    Returns the current health status of the live market data broadcaster.
    This allows the frontend to display an accurate connection status.
    """
    return MARKET_DATA_HEALTH


@public_router.post("/serials/activate")
async def activate_serial_number(
        request: SerialNumberActivateRequest,
        db: AsyncSession = Depends(get_db)
):
    """
    Validates a serial number and locks it to a machine ID.
    This is the endpoint the desktop app will call once.
    """
    async with db.begin():
        # Find the serial key in the database
        query = select(SerialNumber).where(SerialNumber.serial_key == request.serial_key)
        result = await db.execute(query)
        serial = result.scalar_one_or_none()

        if not serial or not serial.is_active:
            raise HTTPException(status_code=404, detail="Serial key is invalid or has been deactivated.")

        # Hash the incoming machine ID for secure storage
        machine_id_hash = pwd_context.hash(request.machine_id)

        if serial.machine_id_hash:
            # If the key is already activated, check if it's the same machine
            if not pwd_context.verify(request.machine_id, serial.machine_id_hash):
                raise HTTPException(status_code=403,
                                    detail="This serial key has already been activated on another machine.")
            # If it's the same machine, just confirm activation
            return {"status": "success", "message": "Activation confirmed for this machine."}

        # First-time activation: lock the key to this machine
        serial.machine_id_hash = machine_id_hash
        serial.activated_at = datetime.datetime.now(datetime.timezone.utc)
        await db.commit()

    return {"status": "success", "message": "QuantumEdge Terminal has been successfully activated."}


@strategies_router.get("/marketplace", response_model=List[PublicStrategySchema])
async def get_marketplace_strategies(db: AsyncSession = Depends(get_db)):
    """
    Fetches all publicly shared trading bot strategies, ordered by popularity.
    """
    result = await db.execute(
        select(TradingBot)
        .options(selectinload(TradingBot.owner).selectinload(User.profile))  # Eager load author and profile
        .where(TradingBot.is_public == True)
        .order_by(TradingBot.clone_count.desc())
        .limit(100)
    )
    return result.scalars().all()


@bots_router.patch("/{bot_id}/publish", response_model=TradingBotSchema)
async def publish_bot_to_marketplace(
        bot_id: PythonUUID,
        request: BotPublishRequest,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Allows a user to publish or unpublish their bot to the marketplace."""
    bot = await db.get(TradingBot, bot_id)
    if not bot or bot.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Bot not found")

    bot.description = request.description
    bot.backtest_results_cache = json.dumps(request.backtest_results)

    # --- NEW: Handle publish type and price ---
    bot.publish_type = request.publish_type.value
    bot.is_public = request.publish_type != BotPublishType.PRIVATE.value
    if request.publish_type == BotPublishType.SUBSCRIPTION:
        bot.price_usd_monthly = request.price_usd_monthly
    else:
        bot.price_usd_monthly = None

    await db.commit()
    await db.refresh(bot)
    # Correctly re-validate the updated bot object before returning
    return TradingBotSchema.model_validate(bot)


class TradingBotUpdate(BaseModel):
    name: Optional[str] = None
    symbol: Optional[str] = None
    exchange: Optional[ExchangeName] = None
    asset_class: Optional[AssetClass] = None
    strategy_type: Optional[StrategyType] = None
    market_type: Optional[MarketType] = None
    is_paper_trading: Optional[bool] = None
    strategy_name: Optional[str] = None
    strategy_params: Optional[Dict[str, Any]] = None
    visual_strategy_json: Optional[Dict[str, Any]] = None
    take_profit_percentage: Optional[float] = Field(None, gt=0)
    stop_loss_percentage: Optional[float] = Field(None, gt=0)
    leverage: Optional[int] = Field(None, gt=0, le=125)
    market_regime_filter_enabled: Optional[bool] = None
    optimus_enabled: Optional[bool] = None


# --- ADD THIS NEW ENDPOINT to the bots_router ---

@bots_router.put("/{bot_id}", response_model=TradingBotSchema)
async def update_bot(
        bot_id: PythonUUID,
        bot_data: TradingBotUpdate,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """
    Updates an existing trading bot.
    A user can only update a bot they own.
    """
    async with db.begin():
        bot = await db.get(TradingBot, bot_id)

        if not bot or bot.owner_id != current_user.id:
            raise HTTPException(status_code=404, detail="Bot not found")

        if bot.is_active:
            raise HTTPException(status_code=400, detail="Cannot edit an active bot. Please stop it first.")

        # Get the update data, excluding any fields that were not sent (None)
        update_data = bot_data.model_dump(exclude_unset=True)

        # Iterate over the provided data and update the bot object
        for key, value in update_data.items():
            if value is not None:
                # Handle JSON fields separately
                if key in ["strategy_params", "visual_strategy_json"]:
                    setattr(bot, key, json.dumps(value))
                else:
                    setattr(bot, key, value)

        db.add(bot)
        await db.commit()

    await db.refresh(bot)
    return bot


@strategies_router.post("/{bot_id}/clone", response_model=TradingBotSchema)
async def clone_strategy(
        bot_id: PythonUUID,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """
    Clones a public strategy into the current user's account as a new, private bot.
    """
    # 1. Fetch the public bot to be cloned
    public_bot = await db.get(TradingBot, bot_id)
    if not public_bot or not public_bot.is_public:
        raise HTTPException(status_code=404, detail="Public strategy not found")
    # --- NEW: Subscription Access Control ---
    if public_bot.publish_type == BotPublishType.SUBSCRIPTION.value:
        has_access = await subscription_service.has_active_subscription(db, current_user.id, bot_id)
        if not has_access and public_bot.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="You must have an active subscription to clone this premium strategy.")

    # 2. Increment the clone count of the original bot
    public_bot.clone_count += 1

    # 3. Create a new bot for the current user with copied settings
    new_bot = TradingBot(
        name=f"Clone of {public_bot.name}",
        owner_id=current_user.id,
        strategy_name=public_bot.strategy_name,
        strategy_params=public_bot.strategy_params,  # Copies the exact parameters
        symbol=public_bot.symbol,
        exchange=public_bot.exchange,
        # Cloned bots default to private and paper trading for safety
        is_public=False,
        is_paper_trading=True,
    )

    db.add(new_bot)
    await db.commit()
    await db.refresh(new_bot)
    return new_bot


@market_router.get("/price/{exchange}/{symbol}")
@limiter.limit("10/second")
async def get_realtime_price(request: Request, exchange: str, symbol: str):
    symbol_formatted = symbol.replace("-", "/").upper()
    price = await trading_service.fetch_realtime_price(exchange.lower(), symbol_formatted)
    if price is None: raise HTTPException(status_code=404, detail=f"Could not fetch price for {symbol} on {exchange}")
    return {"exchange": exchange, "symbol": symbol, "price": price}


@market_router.get("/sentiment/{crypto_name}")
async def get_crypto_sentiment(crypto_name: str, user: User = Depends(require_premium_plan)):
    sentiment_data = await ml_service.get_market_sentiment(crypto_name)
    return sentiment_data


@market_router.post("/strategies/compare", response_model=List[BacktestResultSchema])
async def compare_strategies(
        request: StrategyComparisonRequest,
        user: User = Depends(require_ultimate_plan)
):
    """
    Backtests a comprehensive, production-grade set of strategies and their
    common variations, returning a ranked performance list.
    """
    # --- THIS IS THE COMPLETE, FINAL LIST ---
    strategies_to_test = [
        # MA Cross Variations
        {"name": "MA_Cross", "params": {"short_window": 20, "long_window": 50}},
        {"name": "MA_Cross", "params": {"short_window": 50, "long_window": 200}},

        # Bollinger Bands Variations
        {"name": "Bollinger_Bands", "params": {"window": 20, "std_dev": 2.0}},
        {"name": "Bollinger_Bands", "params": {"window": 20, "std_dev": 2.5}},

        # RSI & MACD Crossover
        {"name": "RSI_MACD_Crossover", "params": {}},  # Uses default params

        # SuperTrend Variations
        {"name": "SuperTrend_ADX_Filter", "params": {"st_period": 10, "st_multiplier": 2.0, "adx_threshold": 25}},
        {"name": "SuperTrend_ADX_Filter", "params": {"st_period": 12, "st_multiplier": 3.0, "adx_threshold": 25}},

        # Volatility Squeeze
        {"name": "Volatility_Squeeze", "params": {}},  # Uses default params

        # Ichimoku Cloud Breakout
        {"name": "Ichimoku_Cloud_Breakout", "params": {}},  # Uses default params

        # Smart Money Concepts
        {"name": "Smart_Money_Concepts", "params": {"risk_reward_ratio": 2.0}},
        {"name": "Smart_Money_Concepts", "params": {"risk_reward_ratio": 3.0}},

        # AI Enhanced Strategy
        {"name": "AI_Signal_Confirmation", "params": {"confidence_threshold": 0.2}},
    ]

    tasks = []
    for s in strategies_to_test:
        task = strategy_analysis_service.backtest_strategy(
            strategy_name=s["name"],
            params=s["params"],
            symbol=request.symbol,
            exchange_name=request.exchange,
            start_date=request.start_date,
            end_date=request.end_date,
        )
        tasks.append(task)

    results = await asyncio.gather(*tasks, return_exceptions=True)

    valid_results = []
    for res in results:
        if isinstance(res, Exception):
            logger.error(f"A backtest in the comparison set failed: {res}")
        elif res.get("error"):
            logger.warning(f"Backtest returned a manageable error: {res['error']}")
        else:
            valid_results.append(res)

    # Rank results by Sharpe Ratio (a professional risk-adjusted return metric)
    ranked_results = sorted(valid_results, key=lambda x: x.get('sharpe_ratio', -np.inf), reverse=True)

    return ranked_results


@market_router.get("/analysis/copilot/{exchange}/{symbol:path}")
async def get_copilot_analysis(
    request: Request, # <-- This type hint is now unambiguous and correct
    exchange: str,
    symbol: str,
    user: User = Depends(get_current_user)
):
    """
    Provides an on-demand AI analysis of the current market conditions.
    It first tries to use our internal ML model with direct exchange data.
    If that fails, it falls back to providing a summary from TradingView.
    """
    analysis = None

    # --- 1. Primary Method: Use our internal ML model with CCXT data ---
    try:
        # Use the fault-tolerant manager to get a working CCXT exchange
        exchange_client = await exchange_manager.get_fault_tolerant_public_client()
        if exchange_client:
            # Fetch 200 hours of data, as required by the ML model's indicators
            ohlcv = await exchange_client.fetch_ohlcv(symbol.upper(), '1h', limit=200)
            if ohlcv and len(ohlcv) >= 200:
                df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
                analysis = ml_service.analyze_market_conditions(df)
                logger.info(
                    f"Co-Pilot analysis for {symbol} served via internal ML model (Source: {exchange_client.id}).")
    except Exception as e:
        logger.warning(f"Internal ML analysis failed for {symbol}: {e}. Proceeding to fallback.")
        analysis = None  # Ensure analysis is None if this block fails

    # --- 2. Fallback Method: Use TradingView's pre-computed analysis ---
    if not analysis:
        logger.info(f"Falling back to TradingView for Co-Pilot analysis of {symbol}.")
        tv_client = request.app.state.tv_client  # <-- GET THE CLIENT HERE
        tv_analysis_data = await tv_client.get_analysis_for_ml(symbol)
        if tv_analysis_data:
            analysis = ml_service.analyze_market_conditions_from_tv(tv_analysis_data)
            logger.info(f"Co-Pilot analysis for {symbol} served via TradingView fallback.")

    # --- 3. Final Response ---
    if analysis:
        return analysis
    else:
        # If both the primary and fallback methods fail, return an error.
        logger.error(f"All data sources failed for Co-Pilot analysis of {symbol}.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Market analysis is temporarily unavailable. Both primary and fallback data sources failed."
        )

# --- NEW: Telegram Endpoints ---
@users_router.get("/me/telegram/link", response_model=TelegramLinkResponse)
async def get_telegram_link_code(current_user: User = Depends(get_current_user)):
    """
    Generates a unique, one-time code and provides the dynamically fetched
    bot username for linking a Telegram account.
    """
    # This generates the unique code for the user to send to the bot.
    code = telegram_service.generate_linking_code(current_user.id)

    # This now calls our robust getter method instead of using a placeholder.
    # It will return the real username fetched at startup.
    bot_username = telegram_service.get_bot_username()

    return TelegramLinkResponse(link_code=code, bot_username=bot_username)



@users_router.get("/me/subscriptions", response_model=List[StrategySubscriptionSchema])
async def get_my_subscriptions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetches all active and recent strategy subscriptions for the current user."""
    result = await db.execute(
        select(StrategySubscription)
        .options(selectinload(StrategySubscription.strategy_bot)) # Eagerly load bot details
        .where(StrategySubscription.subscriber_id == current_user.id)
        .order_by(StrategySubscription.expires_at.desc())
    )
    subscriptions = result.scalars().all()
    # Pydantic will automatically map the nested strategy_bot.name to strategy_bot_name
    return subscriptions


@users_router.get(
    "/platform-api-keys",
    # --- THE FIX ---
    # The endpoint now uses the new, correct schema for its response.
    response_model=List[PlatformAPIKeySchema],
    tags=["API Keys"]
)
async def fetch_platform_api_keys(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """
    Fetches all platform API keys for the currently authenticated user.
    """
    result = await db.execute(
        select(PlatformAPIKey).where(PlatformAPIKey.user_id == current_user.id)
    )
    keys = result.scalars().all()

    # The response_model will now correctly serialize the 'keys' objects
    # using PlatformAPIKeySchema, including the key_prefix.
    return keys


# --- NEW: Pydantic model for query parameters ---
class TradeLogFilterParams(BaseModel):
    page: int = Query(1, gt=0)
    page_size: int = Query(20, gt=0, le=100)
    bot_id: Optional[PythonUUID] = Query(None)
    symbol: Optional[str] = Query(None)
    side: Optional[str] = Query(None)


class PaginatedTradeLogResponse(BaseModel):
    total_items: int
    total_pages: int
    page: int
    page_size: int
    items: List[TradeLogSchema]


@users_router.get("/me/trade-logs", response_model=PaginatedTradeLogResponse)
async def get_my_trade_logs(
        params: TradeLogFilterParams = Depends(),
        user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """
    Fetches a paginated and filterable list of all trade logs for the current user.
    """
    query = select(TradeLog).where(TradeLog.user_id == user.id)

    # Apply filters
    if params.bot_id:
        query = query.where(TradeLog.bot_id == params.bot_id)
    if params.symbol:
        query = query.where(TradeLog.symbol.ilike(f"%{params.symbol}%"))
    if params.side:
        query = query.where(TradeLog.side == params.side)

    # First, get the total count of items that match the filters
    count_query = select(func.count()).select_from(query.subquery())
    total_items = await db.scalar(count_query)

    # Then, apply pagination to the main query
    query = query.order_by(TradeLog.timestamp.desc())
    query = query.offset((params.page - 1) * params.page_size).limit(params.page_size)

    result = await db.execute(query)
    items = result.scalars().all()

    total_pages = (total_items + params.page_size - 1) // params.page_size

    return PaginatedTradeLogResponse(
        total_items=total_items,
        total_pages=total_pages,
        page=params.page,
        page_size=params.page_size,
        items=items
    )



# --- NEW: Strategy Optimization Endpoints ---
@market_router.post("/strategies/optimize", response_model=OptimizationTaskResponse)
async def start_strategy_optimization(
        request: StrategyOptimizationRequest,
        background_tasks: BackgroundTasks,
        user: User = Depends(get_current_user) # We still get the full user object here to get the ID
):
    """
    Kicks off a long-running strategy parameter optimization task.
    This version correctly passes the user's ID to the background task.
    """
    task_id = f"opt-{uuid4()}"
    task_store.set_task(task_id, {"status": OptimizationStatus.PENDING, "progress": 0.0})

    # --- THIS IS THE CRITICAL FIX ---
    # The background task is created here.
    # Instead of passing the entire `user` object, we pass `user.id`, which is a simple string.
    # The background task can safely use this string to send WebSocket notifications.
    background_tasks.add_task(
        strategy_analysis_service.run_optimization_task, 
        task_id, 
        user.id, # Pass the ID string
        request
    )
    
    return OptimizationTaskResponse(task_id=task_id, message="Optimization task started. See progress in real-time.")

# --- UPDATE the status endpoint to use the shared store ---
@market_router.get("/strategies/optimize/status/{task_id}", response_model=OptimizationStatusResponse)
async def get_optimization_status(task_id: str, user: User = Depends(require_ultimate_plan)):
    """Checks the status from the centralized task store."""
    task_info = task_store.get_task(task_id)
    if not task_info:
        raise HTTPException(status_code=404, detail="Optimization task not found.")
    return OptimizationStatusResponse(task_id=task_id, **task_info)

@market_router.post("/strategies/backtest", response_model=OptimizationTaskResponse) # Now returns a task ID
async def run_single_backtest(
    request: SingleBacktestRequest,
    user: User = Depends(get_current_user)
):
    """
    Runs a backtest as a Celery task and returns a task ID to poll for results.
    """
    task = run_single_backtest_task.delay(request_data=request.model_dump(mode='json'))
    return OptimizationTaskResponse(task_id=task.id, message="Backtest task has been queued.")


@market_router.get("/tasks/status/{task_id}", response_model=OptimizationStatusResponse)
async def get_task_status(task_id: str, user: User = Depends(get_current_user)):
    """
    Checks the status and retrieves the result of any Celery task from the Redis backend.
    """
    task_result = AsyncResult(task_id, app=celery_app)

    status = task_result.state
    response_data = {"task_id": task_id, "status": status, "progress": 0.0, "results": None, "error": None}

    if status == 'PENDING':
        response_data['status'] = OptimizationStatus.PENDING
    elif status == 'PROGRESS':
        response_data['status'] = OptimizationStatus.RUNNING
        response_data['progress'] = task_result.info.get('progress', 0)
    elif status == 'SUCCESS':
        response_data['status'] = OptimizationStatus.COMPLETED
        response_data['progress'] = 1.0
        response_data['results'] = task_result.result
    elif status == 'FAILURE':
        response_data['status'] = OptimizationStatus.FAILED
        response_data['progress'] = 1.0
        # task_result.info contains the exception object
        response_data['error'] = str(task_result.info)

    return OptimizationStatusResponse(**response_data)


class InterpretRequest(BaseModel):
    text: str = Field(..., max_length=500)
    history: Optional[List[Dict[str, str]]] = []  # The frontend will now send the chat history




@market_router.post("/strategies/interpret")
async def interpret_strategy(request: InterpretRequest, user: User = Depends(require_premium_plan)):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Input text cannot be empty.")
    try:
        # Calls the new, correct method for the Sensei persona
        response_text = await llm_service.get_sensei_response(request.text, request.history)
        return {"response": response_text}
    except ConnectionError as e:
        # This catches the error from LLMService if the model isn't loaded
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        # This catches live API call failures (e.g., network issues)
        logger.error(f"Strategy Sensei failed to get LLM response: {e}", exc_info=True)
        raise HTTPException(status_code=503, detail="The Strategy Sensei is currently unavailable.")

@public_router.post("/contact")
async def handle_contact_form(
        request: ContactFormRequest,
):
    """
    Accepts a contact form submission and offloads the email sending
    to a high-priority, reliable Celery task. Responds immediately.
    """
    # This call is now fully implemented and robust.
    # It sends the job to the 'high_priority' queue.
    send_email_task.delay(
        recipient=settings.MAIL_TO,
        subject=f"New Contact Form Submission from {request.name}",
        body=f"""
You have received a new message from the QuantumLeap AI contact form.

Name: {request.name}
Email: {request.email}
-----------------------------------------

Message:
{request.message}
"""
    )

    return {"message": "Your message has been received successfully. We will get back to you shortly."}


@integrations_router.post("/mt5/trade")
async def log_mt5_trade(
        signal: MT5TradeSignal,
        background_tasks: BackgroundTasks,
        user: User = Depends(get_user_from_platform_api_key),
        db: AsyncSession = Depends(get_db)
):
    """
    This secure endpoint listens for trade signals from an external MT4/5 bridge.
    It authenticates the request, finds the corresponding bot, and logs the trade.
    """
    bot = await db.get(TradingBot, signal.bot_id)
    if not bot or bot.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Bot not found or not owned by this user.")

    # --- ROBUSTNESS FIX: Verify this signal is for an MT5-configured bot ---
    if bot.exchange not in [ExchangeName.MT4.value, ExchangeName.MT5.value]:
        logger.warning(f"MT5 signal received for bot {bot.id}, but it is not configured as an MT4/5 bot. Ignoring.")
        raise HTTPException(status_code=400, detail="This bot is not configured for MT4/5 signals.")

    if not bot.is_active:
        logger.warning(f"MT5 trade signal received for inactive bot {bot.id}. Ignoring.")
        return {"status": "ignored_inactive_bot"}

    # Create a new trade log entry
    trade = TradeLog(
        user_id=user.id,
        bot_id=bot.id,
        exchange=bot.exchange,  # Log the specific exchange (mt4 or mt5)
        symbol=signal.symbol,
        order_id=signal.order_id,
        side=signal.action.lower(),
        type='market',  # Assume market execution from the terminal
        amount=signal.volume,
        price=signal.price,
        cost=signal.price * signal.volume,
        is_paper_trade=bot.is_paper_trading,  # Log as paper/live based on the bot's setting
        timestamp=datetime.datetime.now(datetime.timezone.utc)
    )
    db.add(trade)
    await db.commit()

    logger.info(f"Successfully logged trade from MT5 for bot {bot.id}. Order ID: {signal.order_id}")

    # Trigger background tasks for P&L updates and notifications
    background_tasks.add_task(trading_service.update_bot_pnl, db, bot.id)

    # Send real-time notifications
    base_asset = signal.symbol[:3]
    msg = f"📈 *Trade Logged via {bot.exchange.upper()}*\nBot: `{bot.name}`\n{signal.action.upper()} `{signal.volume}` `{base_asset}` at `{signal.price}`"
    background_tasks.add_task(telegram_service.notify_user, user.id, msg)

    trade_schema = TradeLogSchema.model_validate(trade)
    background_tasks.add_task(
        websocket_manager.send_personal_message,
        {"type": "trade_executed", "bot_id": str(bot.id), "details": jsonable_encoder(trade_schema)},
        user.id
    )

    return {"status": "trade logged successfully"}


@integrations_router.get("/mt5/credentials", response_model=List[MT5CredentialsSchema])
async def get_mt5_credentials(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MT5Credentials).where(MT5Credentials.user_id == user.id))
    return result.scalars().all()


@integrations_router.post("/mt5/connect")
async def connect_to_mt5(creds: MT5CredentialsCreate, user: User = Depends(get_current_user)):
    """
    Initiates a connection to the user's MT5 account.
    This will be the main connection used by all MT5 bots.
    """
    success = await mt5_gateway_service.connect_and_login(
        login=creds.account_number,
        password=creds.password,
        server=creds.server
    )
    if not success:
        raise HTTPException(status_code=400, detail="Failed to connect to MT5. Check terminal status and credentials.")

    return {"status": "success", "message": "MT5 Gateway connected successfully."}


@integrations_router.post("/mt5/disconnect")
async def disconnect_from_mt5(user: User = Depends(get_current_user)):
    """Disconnects the gateway from the MT5 terminal."""
    await mt5_gateway_service.shutdown()
    return {"status": "success", "message": "MT5 Gateway disconnected."}


@integrations_router.post("/mt5/credentials", response_model=MT5CredentialsSchema)
async def save_mt5_credentials(creds: MT5CredentialsCreate, user: User = Depends(get_current_user),
                               db: AsyncSession = Depends(get_db)):
    """
    Saves or updates a user's MT5 credentials using a robust "upsert" pattern
    that is compatible with FastAPI's dependency injection session.
    """
    try:
        # --- THIS IS THE FIX ---
        # We REMOVE the `async with db.begin():` block, as the `get_db`
        # dependency already manages the transaction.

        # 1. Find any existing credentials for this user.
        query = select(MT5Credentials).where(MT5Credentials.user_id == user.id)
        existing_creds_result = await db.execute(query)
        existing_creds = existing_creds_result.scalar_one_or_none()

        if existing_creds:
            # 2. If an entry exists, UPDATE its fields.
            logger.info(f"Updating existing MT5 credentials for user {user.id}")
            existing_creds.account_number = str(creds.account_number)
            existing_creds.password_encrypted = user_service.encrypt_data(creds.password)
            existing_creds.server = creds.server
            creds_to_return = existing_creds
        else:
            # 3. If no entry exists, CREATE a new one.
            logger.info(f"Creating new MT5 credentials for user {user.id}")
            new_creds = MT5Credentials(
                user_id=user.id,
                account_number=str(creds.account_number),
                password_encrypted=user_service.encrypt_data(creds.password),
                server=creds.server
            )
            db.add(new_creds)
            creds_to_return = new_creds

        # 4. Manually commit the changes to the session.
        await db.commit()
        await db.refresh(creds_to_return)

        return creds_to_return

    except Exception as e:
        # If any database operation fails, `get_db` will handle the rollback.
        logger.error(f"Failed to save MT5 credentials for user {user.id}: {e}", exc_info=True)
        # Re-raise as an HTTPException to give a clean error to the frontend.
        if isinstance(e, IntegrityError):  # This would catch other potential DB errors
            raise HTTPException(status_code=400, detail="Database integrity error.")
        raise HTTPException(status_code=500, detail="An internal error occurred while saving credentials.")



@auth_router.post("/2fa/setup", response_model=TwoFactorSetupResponse)
async def setup_two_factor_auth(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.is_otp_enabled:
        raise HTTPException(status_code=400, detail="2FA is already enabled.")

    otp_secret = pyotp.random_base32()
    current_user.otp_secret_encrypted = user_service.encrypt_data(otp_secret)
    await db.commit()

    otp_uri = pyotp.totp.TOTP(otp_secret).provisioning_uri(name=current_user.email, issuer_name="QuantumLeap AI")

    img = qrcode.make(otp_uri, image_factory=qrcode.image.svg.SvgPathImage)
    svg_str = img.to_string(encoding='unicode')

    return TwoFactorSetupResponse(otp_secret=otp_secret, otp_uri=otp_uri, qr_code_svg=svg_str)


@auth_router.post("/2fa/verify")
async def verify_two_factor_auth(request: TwoFactorVerificationRequest, current_user: User = Depends(get_current_user),
                                 db: AsyncSession = Depends(get_db)):
    if not current_user.otp_secret_encrypted:
        raise HTTPException(status_code=400, detail="2FA setup not initiated.")

    otp_secret = user_service.decrypt_data(current_user.otp_secret_encrypted)
    totp = pyotp.TOTP(otp_secret)

    if not totp.verify(request.token):
        raise HTTPException(status_code=400, detail="Invalid 2FA token.")

    current_user.is_otp_enabled = True
    current_user.token_version += 1  # Force logout other sessions
    await db.commit()
    return {"message": "2FA has been successfully enabled."}


@auth_router.post("/2fa/login", response_model=Token)
async def two_factor_login(request: TwoFactorLoginRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload = jwt.decode(request.two_factor_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("2fa_passed"): raise HTTPException(400, "Invalid token type.")
        user_id = payload.get("sub")
        user = await db.get(User, user_id)
        if not user or not user.is_otp_enabled: raise HTTPException(400, "2FA not enabled for user.")

        otp_secret = user_service.decrypt_data(user.otp_secret_encrypted)
        if not pyotp.TOTP(otp_secret).verify(request.token):
            raise HTTPException(401, "Invalid 2FA token.")

        access_token = create_access_token(data={"sub": user.id, "ver": user.token_version, "2fa_passed": True})
        refresh_token = create_refresh_token(data={"sub": user.id})
        return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

    except JWTError:
        raise HTTPException(401, "Invalid or expired 2FA challenge token.")


# ==============================================================================
# 9. PAYMENT GATEWAY INTEGRATION
# ==============================================================================
class PaymentService:
    PLAN_PRICES = {SubscriptionPlan.BASIC: {"price": 0.00, "currency": "USD"},
                   SubscriptionPlan.PREMIUM: {"price": 29.99, "currency": "USD"},
                   SubscriptionPlan.ULTIMATE: {"price": 79.99, "currency": "USD"}}

    async def _create_payment_record(self, db: AsyncSession, user_id: str, reference: str, amount: float, currency: str, gateway: str, plan_purchased: str, strategy_bot_id: Optional[PythonUUID] = None):
        payment = Payment(user_id=user_id, reference=reference, amount=amount, currency=currency,
                          gateway=gateway, plan_purchased=plan_purchased, strategy_bot_id=strategy_bot_id)
        db.add(payment)
        await db.commit()
        return payment

    async def initiate_paypal_payment(self, db: AsyncSession, user: User, plan: Optional[SubscriptionPlan] = None, strategy_bot: Optional[TradingBot] = None):
        if plan:
            price_info = self.PLAN_PRICES[plan]
            amount = price_info['price']
            description = f"QuantumLeap {plan.value.capitalize()} Plan"
            reference = f"plan-{uuid4()}"
        elif strategy_bot:
            amount = strategy_bot.price_usd_monthly
            description = f"1-Month Access: {strategy_bot.name}"
            reference = f"strategy-{uuid4()}"
        else:
            raise ValueError("Either a plan or a strategy must be provided.")

        auth_token = await self._get_paypal_token()
        if not auth_token: raise HTTPException(status_code=500, detail="Could not authenticate with PayPal.")
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {auth_token}"}
        payload = {"intent": "CAPTURE", "purchase_units": [{"reference_id": reference,
                                                            "amount": {"currency_code": "USD",
                                                                       "value": str(amount)},
                                                            "description": description}],
                   "application_context": {"return_url": f"{settings.BASE_URL}/dashboard/billing?status=success",
                                           "cancel_url": f"{settings.BASE_URL}/dashboard/billing?status=cancelled",
                                           "brand_name": "QuantumLeap AI Trader", "user_action": "PAY_NOW"}}
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{settings.PAYPAL_API_BASE}/v2/checkout/orders", headers=headers,
                                    json=payload) as resp:
                if resp.status != 201:
                    error_text = await resp.text()
                    logger.error(f"PayPal order creation failed: {error_text}")
                    raise HTTPException(status_code=500, detail="Failed to create PayPal order.")
                order_data = await resp.json()
        approval_link = next((link['href'] for link in order_data['links'] if link['rel'] == 'approve'), None)
        if not approval_link: raise HTTPException(status_code=500, detail="Could not find PayPal approval link.")
        payment_record = await self._create_payment_record(db, user.id, order_data['id'], amount, "USD", 'paypal',
                                                           plan.value if plan else "strategy_subscription",
                                                           strategy_bot.id if strategy_bot else None)
        return PaymentInitResponse(payment_url=approval_link, reference=order_data['id'], gateway='paypal')

    async def _get_paypal_token(self):
        auth = aiohttp.BasicAuth(settings.PAYPAL_CLIENT_ID, settings.PAYPAL_CLIENT_SECRET)
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{settings.PAYPAL_API_BASE}/v1/oauth2/token", auth=auth,
                                    data={'grant_type': 'client_credentials'}) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data['access_token']
        return None

    async def initiate_paystack_payment(self, db: AsyncSession, user: User,
                                        plan: SubscriptionPlan) -> PaymentInitResponse:
        price_info = self.PLAN_PRICES[plan]
        reference = f"paystack-{uuid4()}"
        headers = {"Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}", "Content-Type": "application/json"}
        amount_in_cents = int(price_info['price'] * 100)
        payload = {"email": user.email, "amount": amount_in_cents, "currency": price_info['currency'],
                   "reference": reference, "callback_url": f"{settings.BASE_URL}/dashboard/billing"}
        async with aiohttp.ClientSession() as session:
            async with session.post("https://api.paystack.co/transaction/initialize", headers=headers,
                                    json=payload) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    logger.error(f"Paystack initialization failed: {error_text}")
                    raise HTTPException(status_code=500, detail="Failed to initiate Paystack payment.")
                data = await resp.json()
        payment_data = data['data']
        await self._create_payment_record(db, user.id, reference, price_info['price'], price_info['currency'], 'paystack', plan.value)
        return PaymentInitResponse(payment_url=payment_data['authorization_url'], reference=reference,
                                   gateway='paystack')

    async def fulfill_subscription(self, db: AsyncSession, user_id: str, plan: SubscriptionPlan):
        user = await db.get(User, user_id)
        if not user:
            logger.error(f"Cannot fulfill subscription. User {user_id} not found.")
            return
        user.subscription_plan = plan.value
        user.subscription_expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=31)
        await notification_service.create_notification(
            db,
            type=NotificationType.PAYMENT_SUCCESS,
            message=f"User {user.email} successfully subscribed to the {plan.plan_purchased} plan via PayPal.",
            user_id=user.id
        )

        await db.commit()
        await db.refresh(user)
        logger.info(f"Subscription for user {user.id} upgraded to {plan.value}.")
        await websocket_manager.send_personal_message(
            {"type": "subscription_update", "profile": UserSchema.model_validate(user).model_dump()}, user.id)


payment_service = PaymentService()


@payments_router.post("/initialize", response_model=PaymentInitResponse)
async def initialize_payment(request: PaymentRequest,
                             gateway: str = Query(..., enum=["paypal", "paystack", "flutterwave"]),
                             current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if gateway == "paypal":
        return await payment_service.initiate_paypal_payment(db, current_user, request.plan)
    elif gateway == "paystack":
        return await payment_service.initiate_paystack_payment(db, current_user, request.plan)
    else:
        raise HTTPException(status_code=400, detail="Invalid payment gateway selected.")


@payments_router.post("/webhook/paystack")
async def handle_paystack_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    paystack_signature = request.headers.get('x-paystack-signature')
    body = await request.body()
    hashed = hmac.new(settings.PAYSTACK_SECRET_KEY.encode(), body, hashlib.sha512).hexdigest()
    if hashed != paystack_signature:
        logger.warning("Invalid Paystack webhook signature received.")
        raise HTTPException(status_code=400, detail="Invalid signature")
    event_data = json.loads(body)
    event_type = event_data.get('event')
    if event_type == 'charge.success':
        data = event_data['data']
        reference = data['reference']
        payment = await db.scalar(select(Payment).where(Payment.reference == reference))
        if not payment:
            logger.error(f"Paystack webhook: Payment with reference {reference} not found.")
            return JSONResponse(content={"status": "not found"}, status_code=404)
        if payment.status == 'successful': return JSONResponse(content={"status": "already processed"})
        payment.status = 'successful'
        # The plan is stored as a string, convert it back to an Enum to pass to fulfill_subscription
        plan_enum = SubscriptionPlan(payment.plan_purchased)
        await payment_service.fulfill_subscription(db, payment.user_id, plan_enum)
        if payment.strategy_bot_id:
            # This was a payment for a strategy subscription
            await subscription_service.create_subscription(db, payment.user_id, payment.strategy_bot_id, payment)
        else:
            # This was a payment for a platform plan
            plan_enum = SubscriptionPlan(payment.plan_purchased)
            await payment_service.fulfill_subscription(db, payment.user_id, plan_enum)
        await db.commit()
        logger.info(f"Paystack payment {reference} processed successfully.")
    return JSONResponse(content={"status": "ok"})


# ==============================================================================
# 10. SUPERUSER ENDPOINTS
# ==============================================================================

@superuser_router.get("/dashboard/stats", dependencies=[Depends(get_current_superuser)])
async def get_system_stats(db: AsyncSession = Depends(get_db)):
    total_users = await db.scalar(select(func.count(User.id)))
    total_bots = await db.scalar(select(func.count(TradingBot.id)))
    active_bots = await db.scalar(select(func.count(TradingBot.id)).where(TradingBot.is_active == True))
    total_trades = await db.scalar(select(func.count(TradeLog.id)))
    return {"total_users": total_users, "total_bots": total_bots, "active_bots": active_bots,
            "running_bot_tasks": len(strategy_service.running_bot_tasks), "total_trades_logged": total_trades}


@superuser_router.get("/users", response_model=List[UserSchema], dependencies=[Depends(get_current_superuser)])
async def list_all_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return users


@superuser_router.post("/users/{user_id}/impersonate", response_model=Token,
                       dependencies=[Depends(get_current_superuser)])
async def impersonate_user(user_id: str, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user: raise HTTPException(status_code=404, detail="User not found")
    impersonation_expires = datetime.timedelta(minutes=15)
    access_token = create_access_token(data={"sub": user.id, "role": user.role, "impersonator": "superuser"},
                                       expires_delta=impersonation_expires)
    return {"access_token": access_token, "refresh_token": "", "token_type": "bearer"}


@superuser_router.post("/emergency/kill-all-bots", dependencies=[Depends(get_current_superuser)])
async def emergency_kill_switch(background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    logger.critical("!!! EMERGENCY KILL SWITCH ACTIVATED BY SUPERUSER !!!")

    async def kill_bots_task():
        async with async_session_maker() as session:
            active_bots_result = await session.execute(select(TradingBot).where(TradingBot.is_active == True))
            active_bots = active_bots_result.scalars().all()
            for bot in active_bots:
                logger.warning(f"Kill Switch: Stopping bot {bot.id}")
                await strategy_service.stop_bot(session, bot)
            logger.critical("!!! EMERGENCY KILL SWITCH: ALL BOTS STOPPED !!!")

    background_tasks.add_task(kill_bots_task)
    return {"message": "Emergency kill switch activated. All bots are being stopped in the background."}


@superuser_router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_by_superuser(
        user_id: str,
        superuser: User = Depends(get_current_superuser),
        db: AsyncSession = Depends(get_db)
):
    """
    Deletes a user from both the local database and Firebase Authentication.
    This is an irreversible action.
    """
    if user_id == superuser.id:
        raise HTTPException(status_code=400, detail="Superuser cannot delete themselves.")

    user_to_delete = await db.get(User, user_id)
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found.")

    # Step 1: Delete from Firebase Auth
    try:
        auth.delete_user(user_to_delete.id)
        logger.info(f"Successfully deleted user {user_id} from Firebase Auth.")
    except auth.UserNotFoundError:
        logger.warning(f"User {user_id} not found in Firebase Auth, but deleting from local DB anyway.")
    except Exception as e:
        logger.error(f"Failed to delete user {user_id} from Firebase: {e}")
        # In a production system, you might want to stop here or just flag the account
        # for manual review instead of proceeding with a partial deletion.
        raise HTTPException(status_code=500, detail="Failed to delete user from authentication provider.")

    # Step 2: Delete from local database (cascading relationships will handle the rest)
    await db.delete(user_to_delete)
    await db.commit()
    logger.info(f"Successfully deleted user {user_id} and their data from the local database.")
    return


@superuser_router.patch("/users/{user_id}/plan", response_model=UserSchema)
async def change_user_plan_by_superuser(
        user_id: str,
        plan: SubscriptionPlan = Body(..., embed=True),
        superuser: User = Depends(get_current_superuser),
        db: AsyncSession = Depends(get_db)
):
    """Changes a user's subscription plan and sets an expiry date."""
    user_to_update = await db.get(User, user_id)
    if not user_to_update:
        raise HTTPException(status_code=404, detail="User not found.")

    user_to_update.subscription_plan = plan.value
    # Set a very long expiry for manual overrides
    if plan != SubscriptionPlan.BASIC:
        user_to_update.subscription_expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
            days=365 * 10)
        user.token_version += 1
    else:
        user_to_update.subscription_expires_at = None

    await db.commit()
    await db.refresh(user_to_update)
    return user_to_update


@superuser_router.patch("/users/{user_id}/promote", response_model=UserSchema)
async def promote_user_to_superuser(
        user_id: str,
        superuser: User = Depends(get_current_superuser),
        db: AsyncSession = Depends(get_db)
):
    """Promotes a regular user to a superuser."""
    user_to_promote = await db.get(User, user_id)
    if not user_to_promote:
        raise HTTPException(status_code=404, detail="User not found.")

    if user_to_promote.role == UserRole.SUPERUSER.value:
        raise HTTPException(status_code=400, detail="User is already a superuser.")

    user_to_promote.role = UserRole.SUPERUSER.value
    await db.commit()
    await db.refresh(user_to_promote)
    return user_to_promote


@superuser_router.post("/users", response_model=UserSchema, status_code=201)
async def create_user_by_superuser(
        user_data: AdminUserCreate,
        superuser: User = Depends(get_current_superuser),
        db: AsyncSession = Depends(get_db)
):
    """Allows a superuser to create a new user."""
    try:
        firebase_user = auth.create_user(email=user_data.email, password=user_data.password)
        new_user = User(
            id=firebase_user.uid,
            email=user_data.email,
            role=user_data.role.value,
            subscription_plan=user_data.subscription_plan.value
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        return new_user
    except auth.EmailAlreadyExistsError:
        raise HTTPException(status_code=400, detail="A user with this email already exists in Firebase.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")


@superuser_router.patch("/users/{user_id}", response_model=FullUserSchema)
async def update_user_by_superuser(
        user_id: str,
        update_data: AdminUserUpdate,
        superuser: User = Depends(get_current_superuser),
        db: AsyncSession = Depends(get_db)
):
    """Allows a superuser to update any user's profile and core details."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    update_dict = update_data.model_dump(exclude_unset=True)

    if 'email' in update_dict:
        auth.update_user(user.id, email=update_dict['email'])
        user.email = update_dict['email']

    if 'role' in update_dict:
        user.role = update_dict['role'].value

    if 'subscription_plan' in update_dict:
        user.subscription_plan = update_dict['subscription_plan'].value

    profile_update_fields = ['first_name', 'last_name']
    if any(field in update_dict for field in profile_update_fields):
        profile = await db.scalar(select(UserProfile).where(UserProfile.user_id == user_id))
        if not profile:
            profile = UserProfile(user_id=user_id)
            db.add(profile)

        if 'first_name' in update_dict: profile.first_name = update_dict['first_name']
        if 'last_name' in update_dict: profile.last_name = update_dict['last_name']

    await db.commit()
    await db.refresh(user)
    # Eager load the profile for the response
    result = await db.execute(select(User).options(selectinload(User.profile)).where(User.id == user.id))
    return result.scalar_one()

@superuser_router.get("/notifications", response_model=List[NotificationSchema])
async def get_superuser_notifications(db: AsyncSession = Depends(get_db)):
    """
    Fetches the most recent system-wide notifications for the superuser dashboard.
    """
    result = await db.execute(
        select(Notification).order_by(Notification.created_at.desc()).limit(20)
    )
    notifications = result.scalars().all()
    return notifications


@superuser_router.post("/serials/generate", response_model=SerialNumberSchema)
async def generate_serial_number(
        superuser: User = Depends(get_current_superuser),
        db: AsyncSession = Depends(get_db)
):
    """Generates a new, unique serial number for distribution."""
    # Format: QETD-XXXX-XXXX-XXXX-XXXX (QuantumEdgeTerminal)
    new_key = f"QLTD-{''.join(secrets.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') for _ in range(4))}-{''.join(secrets.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') for _ in range(4))}-{''.join(secrets.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') for _ in range(4))}-{''.join(secrets.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') for _ in range(4))}"

    serial = SerialNumber(
        serial_key=new_key,
        created_by_user_id=superuser.id
    )
    db.add(serial)
    await db.commit()
    await db.refresh(serial)
    return serial


@superuser_router.get("/serials", response_model=List[SerialNumberSchema])
async def get_all_serial_numbers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SerialNumber).order_by(SerialNumber.created_at.desc()))
    return result.scalars().all()
# ==============================================================================
# WEBSOCKET and ROUTER SETUP
# ==============================================================================

@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    user_id = None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        await websocket_manager.connect(user_id, websocket)

        # This loop now processes incoming messages from the client.
        while True:
            data = await websocket.receive_json()
            action = data.get("action")

            if action == "subscribe_chart":
                symbol = data.get("symbol")
                if symbol:
                    websocket_manager.subscribe_to_symbol(user_id, symbol)

            elif action == "unsubscribe_chart":
                websocket_manager.unsubscribe_from_symbol(user_id)

    except WebSocketDisconnect:
        if user_id:
            websocket_manager.disconnect(user_id)
    except JWTError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        if user_id:
            websocket_manager.disconnect(user_id)


app.include_router(auth_router)
app.include_router(users_router)
app.include_router(bots_router)
app.include_router(market_router)
app.include_router(payments_router)
app.include_router(superuser_router)
app.include_router(wallet_router)
app.include_router(strategies_router)
app.include_router(public_router)
app.include_router(trading_router)
app.include_router(integrations_router)


# This block is only for direct execution, not for Uvicorn
if __name__ == "__main__":
    import uvicorn


    logger.warning("Running in debug mode. Do not use for production.")
    # uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)

    #uvicorn main:app --port 8000 --reload ---CMD 1
    #celery -A celery_worker worker -l info -Q long_running,high_priority --pool=solo CMD 2

    # gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app ---------- For Production level