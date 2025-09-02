#
# QuantumLeap AI Trader - Backend
# main.py
#
# This monolithic file contains the entire backend logic for the application,
# including the FastAPI server, database models, API endpoints, trading logic,
# AI/ML integrations, and payment processing.
import random

import joblib  # Add this to your core imports
import xgboost as xgb  # Add this to your AI/ML imports
import itertools
# --- Core Libraries ---
import os
import asyncio
import signal
from collections import defaultdict
import json
import logging
import datetime
import hmac
import hashlib
import time
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional, AsyncGenerator, Annotated
from enum import Enum as PythonEnum
import secrets

# --- FastAPI and Related Libraries ---
from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    status,
    Request,
    WebSocket,
    WebSocketDisconnect,
    BackgroundTasks,
    APIRouter,
    Header,
    Body,
    Query
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from fastapi import UploadFile, File

from uuid import uuid4, UUID as PythonUUID  # Keep Python's UUID but rename it
from enum import Enum as PythonEnum
from decimal import Decimal, getcontext

# --- Database (SQLAlchemy) ---
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Float,
    DateTime,
    Boolean,
    ForeignKey,
    Text,
    event,
    UUID
)
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base, relationship, Session, selectinload
from sqlalchemy.future import select
from sqlalchemy.sql import func
from sqlalchemy import Numeric

# --- Pydantic for Data Validation ---
from pydantic import (
    BaseModel,
    EmailStr,
    Field,
    validator,
    ConfigDict
)
from pydantic_settings import BaseSettings
from pydantic import field_validator
# --- Security and Authentication ---
import firebase_admin
from firebase_admin import credentials, auth
from jose import JWTError, jwt
from passlib.context import CryptContext
from cryptography.fernet import Fernet

# --- AI & Machine Learning ---
import numpy as np
import pandas as pd
#import tensorflow as tf
# import tf_keras as tf
from sklearn.preprocessing import MinMaxScaler
# import xgboost as xgb # Uncomment if you have a pre-trained XGBoost model
import nltk
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import google.generativeai as genai

# --- Trading & Broker Integration ---
from tradingview_ta import TA_Handler, Interval
import ccxt.async_support as ccxt
import aiohttp
from abc import ABC, abstractmethod
from oandapyV20 import API
from oandapyV20.contrib.requests import MarketOrderRequest, TakeProfitDetails, StopLossDetails

# --- Utilities ---
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# --- NEW: Telegram Bot Library ---
from telegram import Update, User as TelegramUser
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes, ApplicationBuilder
from telegram.error import InvalidToken

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


# ==============================================================================
# 1. CONFIGURATION
# ==============================================================================

# Set Decimal precision
getcontext().prec = 28
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
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    FIREBASE_CREDENTIALS_PATH: str
    API_ENCRYPTION_KEY: str
    PAYPAL_CLIENT_ID: str
    PAYPAL_CLIENT_SECRET: str
    PAYPAL_API_BASE: str = "https://api-m.sandbox.paypal.com"
    PAYSTACK_SECRET_KEY: str
    FLUTTERWAVE_SECRET_KEY: str
    NEWS_API_KEY: str
    BINANCE_API_KEY: Optional[str] = None
    BINANCE_API_SECRET: Optional[str] = None
    SUPERUSER_EMAIL: EmailStr = "admin@quantumleap.ai"
    SUPERUSER_PASSWORD: str = "supersecretpassword"
    BITGO_API_KEY: str
    BITGO_API_BASE_URL: str
    BITGO_WALLET_ID_BTC: str
    BITGO_WALLET_ID_ETH: str
    PLATFORM_USER_ID: str
    # --- NEW: Telegram Bot Settings ---
    TELEGRAM_BOT_TOKEN: str
    # --- NEW: Webhook Secret for signature verification ---
    BASE_URL: str = "https://brown-baths-design.loca.lt"  # Your actual production domain
    TRADINGVIEW_WEBHOOK_SECRET: str = "default_secret_for_dev" # A long, random string you create and keep secret
    TELEGRAM_ADMIN_CHAT_ID: str
    BITGO_WEBHOOK_SECRET: str

    GOOGLE_GEMINI_API_KEY: str

    # --- NEW: Email Configuration ---
    MAIL_USERNAME: str
    MAIL_PASSWORD: str
    MAIL_FROM: EmailStr
    MAIL_TO: EmailStr  # Where the contact form messages will be sent
    MAIL_SERVER: str
    MAIL_PORT: int

    TRADINGVIEW_USERNAME: str
    TRADINGVIEW_PASSWORD: str

    class Config:
        env_file = ".env"


settings = Settings()

# ==============================================================================
# 2. CORE INFRASTRUCTURE INITIALIZATION
# ==============================================================================
limiter = Limiter(key_func=get_remote_address)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
fernet = Fernet(settings.API_ENCRYPTION_KEY.encode())
engine = create_async_engine(settings.DATABASE_URL)
async_session_maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session


try:
    cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
    firebase_admin.initialize_app(cred)
    logger.info("Firebase Admin SDK initialized successfully.")
except Exception as e:
    logger.error(f"Failed to initialize Firebase Admin SDK: {e}")


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
    PENDING = "PENDING";
    RUNNING = "RUNNING";
    COMPLETED = "COMPLETED";
    FAILED = "FAILED"

class AssetClass(str, PythonEnum):
    CRYPTO = "crypto"
    FOREX = "forex"

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
    exchange = Column(String, nullable=False)
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
    side = Column(String)
    type = Column(String)
    amount = Column(Float)
    price = Column(Float)
    cost = Column(Float)
    timestamp = Column(DateTime(timezone=True), default=func.now())
    is_paper_trade = Column(Boolean, default=False)
    user = relationship("User", back_populates="trade_logs")
    __table_args__ = ({"sqlite_autoincrement": True} if "sqlite" in settings.DATABASE_URL else {})


class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    reference = Column(String, unique=True, index=True, nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String, nullable=False)
    gateway = Column(String, nullable=False)
    status = Column(String, default="pending")
    plan_purchased = Column(String(10), nullable=False)
    strategy_bot_id = Column(UUID, ForeignKey("trading_bots.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # --- FIX: Add the missing relationship ---
    strategy_bot = relationship("TradingBot", back_populates="payments")
    __table_args__ = ({"sqlite_autoincrement": True} if "sqlite" in settings.DATABASE_URL else {})


class PlatformAPIKey(Base):
    __tablename__ = "platform_api_keys"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    key_prefix = Column(String(8), unique=True, nullable=False)  # e.g., "ql_aB3dE..."
    key_hash = Column(String, nullable=False)  # We only store the hash
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

    __table_args__ = ({"sqlite_autoincrement": True} if "sqlite" in settings.DATABASE_URL else {})



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


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserSchema(BaseModel):
    id: str
    email: EmailStr
    role: UserRole
    subscription_plan: SubscriptionPlan
    subscription_expires_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime
    telegram_chat_id: Optional[str] = None  # NEW
    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)


class UserProfileSchema(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    profile_picture_url: Optional[str] = None
    country: Optional[str] = None
    phone_number: Optional[str] = None
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
    secret_key: str  # For OANDA, 'secret_key' will be the Account ID
    asset_class: AssetClass = AssetClass.CRYPTO


class APIKeySchema(BaseModel):
    id: int
    exchange: str
    api_key_masked: str
    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)


# Schema for showing the key ONCE upon creation
class PlatformAPIKeyCreateResponse(BaseModel):
    id: int
    key_prefix: str
    full_key: str  # This is only ever sent once
    created_at: datetime.datetime
    message: str = "This is your API key. Please store it securely as you will not be able to see it again."


# Schema for listing existing keys
class PlatformAPIKeySchema(BaseModel):
    id: int
    key_prefix: str
    created_at: datetime.datetime
    is_active: bool
    model_config = ConfigDict(from_attributes=True)


class TradingBotCreate(BaseModel):
    name: str
    # --- MODIFIED: Make prebuilt strategy fields optional ---
    strategy_name: Optional[str] = None
    strategy_params: Optional[Dict[str, Any]] = None
    symbol: str
    exchange: str
    is_paper_trading: bool = False
    use_dynamic_sizing: bool = False
    mode: BotMode = BotMode.NON_CUSTODIAL
    market_regime_filter_enabled: bool = False

    asset_class: AssetClass

    # --- FIX: Removed duplicate fields ---
    take_profit_percentage: Optional[float] = Field(None, gt=0, description="Take profit at X% above entry price.")
    stop_loss_percentage: Optional[float] = Field(None, gt=0, description="Stop loss at X% below entry price.")

    optimus_enabled: bool = False
    sizing_strategy: PositionSizingStrategy = PositionSizingStrategy.FIXED_AMOUNT
    sizing_params: Optional[Dict[str, Any]] = None

    # --- NEW: Fields for visual strategies ---
    strategy_type: StrategyType
    visual_strategy_json: Optional[Dict[str, Any]] = None

    market_type: MarketType = MarketType.SPOT
    leverage: int = Field(1, gt=0, le=125)  # Validate leverage between 1 and 125

   # --- NEW: Validator to ensure one strategy type is provided ---
    @validator('strategy_name', always=True)
    def check_strategy_consistency(cls, v, values):
        if values.get('strategy_type') == StrategyType.PREBUILT and not v:
            raise ValueError("strategy_name is required for prebuilt strategies")
        if values.get('strategy_type') == StrategyType.VISUAL and not values.get('visual_strategy_json'):
            raise ValueError("visual_strategy_json is required for visual strategies")
        return v
class TradingBotSchema(BaseModel):
    id: PythonUUID  # Use the standard Python UUID type for validation
    name: str
    owner_id: str
    strategy_name: str
    strategy_params: Dict[str, Any]
    symbol: str
    exchange: str
    is_active: bool
    is_paper_trading: bool
    use_dynamic_sizing: bool
    created_at: datetime.datetime

    asset_class: AssetClass

    # --- NEW & FIXED ---
    mode: BotMode
    market_regime_filter_enabled: bool

    # --- NEW: Add the new fields to the response schema ---
    take_profit_percentage: Optional[float] = None
    stop_loss_percentage: Optional[float] = None
    active_position_id: Optional[str] = None
    active_position_entry_price: Optional[float] = None
    active_position_amount: Optional[float] = None
    active_exit_order_id: Optional[str] = None

    # --- NEW: Add Optimus Mode to the response ---
    optimus_enabled: bool

    # --- NEW: Add sizing strategy to response ---
    sizing_strategy: PositionSizingStrategy
    sizing_params: Optional[Dict[str, Any]] = None

    # --- NEW: Add visual strategy fields to response ---
    strategy_type: StrategyType
    visual_strategy_json: Optional[Dict[str, Any]] = None
    # --- NEW: Add P&L fields to the response ---
    live_pnl_usd: float
    paper_pnl_usd: float

    # --- NEW: Add analytics cache to the response ---
    performance_analytics_cache: Optional[Dict[str, Any]] = None

    publish_type: BotPublishType
    price_usd_monthly: Optional[float] = None

    market_type: MarketType
    leverage: int
    # ADD `arbitrary_types_allowed=True` HERE
    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)

    @field_validator('visual_strategy_json', mode='before')
    @classmethod
    def parse_visual_strategy(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return {}
        return v
    # This validator tells Pydantic how to convert the `strategy_params` field.
    # --- NEW: Add a validator for sizing_params ---
    @field_validator('sizing_params', mode='before')
    @classmethod
    def parse_sizing_params(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return {}
        return v

    @field_validator('strategy_params', mode='before')
    @classmethod
    def parse_strategy_params(cls, v):
        # If the value `v` is a string (coming from the database model),
        # we load it as JSON. Otherwise, we return it as is.
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                raise ValueError("Invalid JSON string for strategy_params")
        return v


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
    from_asset: str
    to_asset: str
    amount_in: Decimal
    amount_out: Decimal
    rate: Decimal
    fee: Decimal
    expires_at: datetime.datetime


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

    @validator('price', always=True)
    def price_required_for_limit(cls, v, values):
        if values.get('type') in [OrderType.LIMIT, OrderType.STOP_LIMIT] and v is None:
            raise ValueError('Price is required for limit and stop-limit orders')
        return v


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

    @validator('price_usd_monthly', always=True)
    def price_required_for_subscription(cls, v, values):
        if values.get('publish_type') == BotPublishType.SUBSCRIPTION and not v:
            raise ValueError('A price is required for subscription-based strategies.')
        return v


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
    order_id: str # The unique order ID from the MT4/5 terminal


class ChatRequest(BaseModel):
    message: str = Field(..., max_length=1000)
    history: Optional[List[Dict[str, str]]] = []


class SwapQuoteResponse(BaseModel):
    quote_id: str
    user_id: str # To ensure a user can only execute their own quote
    from_asset: str
    to_asset: str
    amount_in: Decimal
    amount_out: Decimal
    rate: Decimal
    fee: Decimal
    expires_at: datetime.datetime

# --- NEW: The execute request now only needs the quote ID ---
class SwapExecuteRequest(BaseModel):
    quote_id: str

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
        token_data = TokenData(uid=user_id, role=payload.get("role"))
    except JWTError:
        raise credentials_exception

    user = await db.get(User, token_data.uid)
    if user is None:
        raise credentials_exception

    if not user.is_subscription_active():
        bots_to_deactivate = await db.execute(
            select(TradingBot).where(TradingBot.owner_id == user.id, TradingBot.is_active == True))
        for bot in bots_to_deactivate.scalars().all():
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
async def get_user_from_platform_api_key(
        authorization: str = Header(...),
        db: AsyncSession = Depends(get_db)
) -> User:
    """
    Validates a Platform API Key provided in the Authorization header.
    This is used for server-to-server communication (e.g., MT4/5 Bridge -> Backend).
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing Platform API Key",
        headers={"WWW-Authenticate": "Bearer"},
    )

    scheme, _, token = authorization.partition(' ')
    if scheme.lower() != 'bearer' or not token:
        raise credentials_exception

    # Extract the prefix to find the key in the database
    try:
        prefix = token.split('_')[0] + '_'
    except IndexError:
        raise credentials_exception

    # Find the key by its non-secret prefix
    key_entry = await db.scalar(
        select(PlatformAPIKey).where(PlatformAPIKey.key_prefix == prefix, PlatformAPIKey.is_active == True)
    )

    if not key_entry:
        raise credentials_exception

    # Securely verify the full token against the stored hash
    if not pwd_context.verify(token, key_entry.key_hash):
        raise credentials_exception

    # Fetch the associated user
    user = await db.get(User, key_entry.user_id)
    if not user:
        raise credentials_exception

    return user


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


user_service = UserService()


# --- 1. The Abstract Base Class (The "Interface") ---
class BrokerClient(ABC):
    @abstractmethod
    async def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int) -> List[List]:
        pass

    @abstractmethod
    async def create_market_order(self, symbol: str, side: str, amount: float, params: Dict = {}):
        pass

    @abstractmethod
    async def close(self):
        pass
    # ... add other methods like fetch_positions, set_leverage as needed


# --- 2. The CCXT Adapter ---
class CcxtClient(BrokerClient):
    def __init__(self, ccxt_instance: ccxt.Exchange):
        self._client = ccxt_instance

    async def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int) -> List[List]:
        return await self._client.fetch_ohlcv(symbol, timeframe, limit=limit)

    async def create_market_order(self, symbol: str, side: str, amount: float, params: Dict = {}):
        return await self._client.create_market_order(symbol, side, amount, params)

    async def close(self):
        await self._client.close()


# --- 3. The OANDA Adapter ---
class OandaClient(BrokerClient):
    def __init__(self, api_key: str, account_id: str):
        self._client = API(access_token=api_key, environment="practice")  # Use "live" for production
        self._account_id = account_id

    async def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int) -> List[List]:
        # OANDA uses different timeframe notation (e.g., 'M1' for 1 minute)
        # and symbol notation (e.g., 'EUR_USD'). A production system would have a mapping utility.
        params = {'count': limit, 'granularity': 'M1'}
        # This is a synchronous call, so we run it in an executor to not block the event loop
        loop = asyncio.get_running_loop()
        r = await loop.run_in_executor(None, lambda: self._client.get_candles(instrument=symbol, params=params))
        # Convert OANDA format to CCXT format: [timestamp, open, high, low, close, volume]
        return [
            [c['time'], float(c['mid']['o']), float(c['mid']['h']), float(c['mid']['l']), float(c['mid']['c']),
             c['volume']]
            for c in r['candles']
        ]

    async def create_market_order(self, symbol: str, side: str, amount: float, params: Dict = {}):
        # OANDA uses positive units for long, negative for short
        units = amount if side == 'buy' else -amount
        order_request = MarketOrderRequest(instrument=symbol, units=units)
        loop = asyncio.get_running_loop()
        r = await loop.run_in_executor(None,
                                       lambda: self._client.create_order(self._account_id, data=order_request.data))
        return r  # Return the order confirmation

    async def close(self):
        # oandapyV20 does not have an explicit close method for its session
        pass



class BrokerManager:
    def __init__(self):
        self._public_clients: Dict[str, ccxt.Exchange] = {}
        self._public_lock = asyncio.Lock()
        self.PUBLIC_DATA_SOURCES = ['binance', 'kucoin', 'bybit']

    # --- NEW & OVERHAULED: A robust, fault-tolerant client fetcher ---
    async def get_fault_tolerant_public_client(self) -> Optional[ccxt.Exchange]:
        """
        Tries to get a shared public client from a prioritized list of exchanges.
        Cycles through the list until a successful connection is made.
        """
        async with self._public_lock:
            for exchange_name in self.PUBLIC_DATA_SOURCES:
                try:
                    # Try to get an existing client first
                    if exchange_name in self._public_clients:
                        client = None
                        # Test if the client is still healthy
                        await self._public_clients[exchange_name].fetch_time()
                        return self._public_clients[exchange_name]

                    # If not existing, create a new one
                    logger.info(f"Attempting to connect to public data source: {exchange_name}")
                    exchange_class = getattr(ccxt, exchange_name)
                    client = exchange_class({'options': {'defaultType': 'spot'}})

                    # The first connection will do a check
                    await client.load_markets()  # This will raise an error if connection fails

                    self._public_clients[exchange_name] = client
                    logger.info(f"Successfully connected to {exchange_name}. Using as primary data source.")
                    return client

                except (ccxt.NetworkError, ccxt.ExchangeNotAvailable) as e:
                    logger.warning(f"Failed to connect to {exchange_name}: {e}. Trying next provider.")
                    # If a client existed but is now unhealthy, remove it
                    if exchange_name in self._public_clients:
                        await self._public_clients[exchange_name].close()
                        del self._public_clients[exchange_name]
                    if client:
                        await client.close()  # Ensure client is closed on failure
                    continue  # Move to the next exchange in the list

            logger.error(
                "!!! CRITICAL: Could not connect to any public data provider. Market data features will be unavailable.")
            return None


    async def get_private_client(self, user_id: str, exchange_name: str, asset_class: AssetClass) -> Optional[ccxt.Exchange]:
        """
        Securely creates a new, authenticated broker client instance for a specific user,
        returning the correct adapter based on the asset class.
        """
        async with async_session_maker() as db:
            api_key_entry = await db.scalar(
                select(UserAPIKey).where(UserAPIKey.user_id == user_id, UserAPIKey.exchange == exchange_name,
                                         UserAPIKey.asset_class == asset_class.value)
            )
            if not api_key_entry: return None

            try:
                api_key = user_service.decrypt_api_key(api_key_entry.api_key_encrypted)
                secret_key = user_service.decrypt_api_key(
                    api_key_entry.secret_key_encrypted)  # For OANDA, this is the account ID

                if asset_class == AssetClass.CRYPTO:
                    exchange_class = getattr(ccxt, exchange_name)
                    client = exchange_class({'apiKey': api_key, 'secret': secret_key, 'enableRateLimit': True})
                    await client.load_markets()
                    return CcxtClient(client)

                elif asset_class == AssetClass.FOREX:
                    if exchange_name == 'oanda':
                        return OandaClient(api_key=api_key, account_id=secret_key)
                    else:
                        # Placeholder for other Forex brokers
                        raise NotImplementedError(f"Forex broker '{exchange_name}' is not supported.")

                else:
                    raise ValueError(f"Unknown asset class: {asset_class}")

            except Exception as e:
                logger.error(f"Failed to create private client for {exchange_name}: {e}")
                return None


    async def close_all_public(self):
        """Closes all shared public clients gracefully on application shutdown."""
        async with self._public_lock:
            for exchange_name, client in self._public_clients.items():
                try:
                    await client.close()
                    logger.info(f"Closed shared public client for {exchange_name}")
                except Exception as e:
                    logger.error(f"Failed to close public client for {exchange_name}: {e}")
            self._public_clients.clear()


broker_manager = BrokerManager()  # New global instance

from decimal import Decimal, getcontext

getcontext().prec = 28  # Set precision for Decimal calculations


# --- NEW: A dedicated client for fetching data from TradingView as a fallback ---
class TradingViewClient:
    """
    A robust client for fetching market data from TradingView's unofficial API.
    This serves as a reliable fallback when direct exchange connections fail.
    """

    def __init__(self):
        # A predefined list to identify forex pairs for correct symbol formatting.
        self.forex_pairs = {
            'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'NZD/USD',
            'USD/CAD', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'NZD/JPY',
            'GBP/CHF', 'AUD/NZD', 'EUR/AUD', 'GBP/CAD', 'EUR/CAD', 'USD/MXN',
            'USD/ZAR', 'USD/INR'
        }

    def _format_symbol_for_tv(self, symbol: str) -> dict:
        """Formats a standard symbol for the tradingview-ta library."""
        clean_symbol = symbol.replace('/', '')
        if symbol in self.forex_pairs:
            return {"screener": "forex", "symbol": clean_symbol}
        else:
            # For crypto, we specify a high-volume exchange to ensure data availability
            return {"screener": "crypto", "symbol": f"BINANCE:{clean_symbol}"}

        # --- NEW: A dedicated method to get the full analysis object for the ML service fallback ---

    async def get_analysis_for_ml(self, symbol: str) -> Optional[Dict]:
        """Asynchronously fetches the complete analysis object for a single symbol."""
        try:
            tv_symbol = self._format_symbol_for_tv(symbol)
            handler = TA_Handler(
                symbol=tv_symbol["symbol"],
                screener=tv_symbol["screener"],
                exchange="FX_IDC" if tv_symbol["screener"] == "forex" else "BINANCE",
                interval=Interval.INTERVAL_1_HOUR  # Co-pilot uses 1-hour analysis
            )
            # Run the synchronous library call in a separate thread
            analysis = await asyncio.to_thread(handler.get_analysis)
            return analysis
        except Exception as e:
            logger.warning(f"TradingView analysis fetch failed for {symbol}: {e}")
            return None

    async def _fetch_single_ticker(self, symbol: str) -> Optional[Dict]:
        """Asynchronously fetches analysis for a single symbol with retries and backoff."""
        max_retries = 3
        base_delay = 2  # Start with a 2-second delay

        for attempt in range(max_retries):
            try:
                tv_symbol = self._format_symbol_for_tv(symbol)
                handler = TA_Handler(
                    symbol=tv_symbol["symbol"], screener=tv_symbol["screener"],
                    exchange="BITSTAMP" if "BTC" in symbol else "BINANCE",
                    interval=Interval.INTERVAL_1_DAY
                )
                # Run the synchronous, blocking call in a separate thread
                analysis = await asyncio.to_thread(handler.get_analysis)

                if analysis and 'close' in analysis.indicators:
                    current_price = analysis.indicators['close']
                    prev_close = analysis.indicators.get('open', current_price)
                    change_pct = ((current_price - prev_close) / prev_close) * 100 if prev_close != 0 else 0

                    return {"last": current_price, "percentage": change_pct}
                return None

            except Exception as e:
                # Specifically check for the 429 rate-limit error
                if "429" in str(e):
                    delay = base_delay ** attempt  # Exponential backoff: 2s, 4s, 8s
                    logger.warning(
                        f"TradingView rate limited for {symbol}. Retrying in {delay} seconds... (Attempt {attempt + 1}/{max_retries})")
                    await asyncio.sleep(delay)
                else:
                    # For other errors, log it and stop retrying for this symbol
                    logger.warning(f"TradingView fetch failed for symbol {symbol}: {e}")
                    return None

        logger.error(f"TradingView fetch for {symbol} failed after {max_retries} retries.")
        return None

    async def fetch_tickers(self, symbols: List[str]) -> Dict[str, Dict]:
        """
        Fetches ticker data for a list of symbols concurrently using TradingView.
        Includes a random stagger to avoid simultaneous request bursts and prevent rate-limiting.
        """

        async def fetch_with_stagger(symbol: str):
            # Stagger requests to look more human and avoid instant rate-limits
            await asyncio.sleep(random.uniform(0, 2))  # Wait a random time up to 2 seconds
            return await self._fetch_single_ticker(symbol)

        tasks = [fetch_with_stagger(s) for s in symbols]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        tickers = {}
        for i, res in enumerate(results):
            if isinstance(res, dict):
                tickers[symbols[i]] = res

        return tickers


# --- NEW: Instantiate the TradingView client globally ---
tv_client = TradingViewClient()


class InsufficientFundsError(Exception):
    """Custom exception for wallet operations."""
    pass


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


class SwapService:
    SWAP_FEE_PERCENT = Decimal("0.002")  # 0.2% swap fee
    QUOTE_VALIDITY_SECONDS = 20  # Quotes are firm for 20 seconds

    def __init__(self):
        # In-memory storage for quotes. For multi-server production, use Redis.
        self.quotes: Dict[str, SwapQuoteResponse] = {}

    async def get_swap_rate(self, from_asset: str, to_asset: str) -> Decimal:
        """Gets the live market rate for a currency pair."""
        if from_asset == to_asset:
            return Decimal(1)
        # For Fiat <-> Crypto, USDT is the bridge
        if to_asset == "USDT":
            symbol = f"{from_asset}/{to_asset}"
        else:
            symbol = f"{to_asset}/{from_asset}"

        try:
            # --- FIX: Correct call to fault-tolerant client with NO arguments ---
            exchange = await broker_manager.get_fault_tolerant_public_client()
            if not exchange:
                raise HTTPException(status_code=503, detail="Market data providers are currently unavailable.")

            ticker = await exchange.fetch_ticker(symbol)
            price = Decimal(str(ticker['last']))

            return Decimal(1) / price if to_asset == "USDT" else price
        except Exception as e:
            logger.error(f"Could not get swap rate for {from_asset}->{to_asset}: {e}")
            raise HTTPException(status_code=503, detail="Liquidity provider service is currently unavailable.")

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
                await wallet_service._update_balance(...)

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
        """
        Fetches the bot's own user information and caches it.
        This is called once during the application's lifespan startup.
        """
        try:
            logger.info("Fetching Telegram bot information...")
            self.bot_info = await self.application.bot.get_me()
            logger.info(f"Telegram bot initialized: {self.bot_info.full_name} (@{self.bot_info.username})")
        except InvalidToken:
            logger.critical(
                "!!! CRITICAL: The provided TELEGRAM_BOT_TOKEN is invalid. Telegram features will not work.")
        except Exception as e:
            logger.error(f"Failed to fetch Telegram bot info: {e}")

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
        self.application.add_handler(CommandHandler("start", self.start_command))
        self.application.add_handler(CommandHandler("status", self.status_command))
        # Add more handlers for portfolio, stop bot, etc.
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
        try:
            await self.application.bot.send_message(chat_id=chat_id, text=text, parse_mode='Markdown')
        except Exception as e:
            logger.error(f"Failed to send Telegram message to {chat_id}: {e}")

    async def notify_user(self, user_id: str, message: str):
        async with async_session_maker() as db:
            user = await db.get(User, user_id)
            if user and user.telegram_chat_id:
                await self.send_message(user.telegram_chat_id, message)

    async def run_polling(self):
        logger.info("Telegram bot polling started...")
        await self.application.initialize()
        await self.application.start()
        await self.application.updater.start_polling()

    async def stop_polling(self):
        if self.application.updater and self.application.updater.is_running:
            await self.application.updater.stop()
        await self.application.stop()
        await self.application.shutdown()
        logger.info("Telegram bot polling stopped.")

# Instantiate the service globally
telegram_service = TelegramService(settings.TELEGRAM_BOT_TOKEN)



class StrategySubscription(Base):
    __tablename__ = "strategy_subscriptions"
    id = Column(UUID, primary_key=True, default=uuid4)
    subscriber_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    strategy_bot_id = Column(UUID, ForeignKey("trading_bots.id"), nullable=False, index=True)

    status = Column(String, default=SubscriptionStatus.ACTIVE.value, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    payment_id = Column(Integer, ForeignKey("payments.id"), nullable=False)  # Link to the payment record

    subscriber = relationship("User")
    strategy_bot = relationship("TradingBot")



class MarketRegimeService:
    def __init__(self):
        self.regime_cache: Dict[str, MarketRegime] = {}
        self._lock = asyncio.Lock()

    async def update_regime(self, symbol: str = "BTC/USDT"):
        try:
            exchange = await broker_manager.get_fault_tolerant_public_client()
            # Use daily candles for long-term trend

            ohlcv = await exchange.fetch_ohlcv(symbol, '1d', limit=201)
            if not ohlcv:
                return

            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['ma_200'] = df['close'].rolling(window=200).mean()
            df['ma_50'] = df['close'].rolling(window=50).mean()

            latest = df.iloc[-1]
            new_regime = MarketRegime.SIDEWAYS  # Default

            if latest['close'] > latest['ma_200'] and latest['ma_50'] > latest['ma_200']:
                new_regime = MarketRegime.BULLISH
            elif latest['close'] < latest['ma_200'] and latest['ma_50'] < latest['ma_200']:
                new_regime = MarketRegime.BEARISH

            async with self._lock:
                self.regime_cache['default'] = new_regime
            logger.info(f"Market regime updated: {new_regime.value}")

        except Exception as e:
            logger.error(f"Failed to update market regime: {e}")

    def get_regime(self, symbol: str) -> MarketRegime:
        # For now, use a single global regime. Can be expanded to per-symbol.
        return self.regime_cache.get('default', MarketRegime.SIDEWAYS)

    async def run_analysis_loop(self):
        while True:
            await self.update_regime()
            await asyncio.sleep(60 * 15)  # Update every 15 minutes


# Instantiate the service globally
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
            exchange = await broker_manager.get_fault_tolerant_public_client()
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
        investment_usd = Decimal(str(params.get("amount_usd"))) if "amount_usd" in params else self.get_dynamic_investment_usd(user)
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
            SubscriptionPlan.ULTIMATE.value: Decimal("4.5454545454545455"),  # Ultimate (Live Trading): ~4.545 * $11 = ~$50 trade size
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
                    await telegram_service.notify_user(user.id, msg)
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
        self._load_model_artifacts()
        self.sentiment_analyzer = SentimentIntensityAnalyzer()

    def _load_model_artifacts(self):
        """Loads the pre-trained XGBoost model, scaler, and feature list from disk."""
        try:
            logger.info("Loading Optimus AI model artifacts...")
            self.model = xgb.Booster()
            self.model.load_model("optimus_model.json")
            self.scaler = joblib.load("scaler.pkl")
            self.features = joblib.load("features.pkl")
            logger.info("Optimus AI model artifacts loaded successfully.")
        except Exception as e:
            logger.error(
                f"!!! CRITICAL: Could not load Optimus AI model artifacts. Optimus/Co-Pilot will be disabled. Error: {e}")
            self.model = None  # Ensure model is None on failure

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
    def __init__(self, api_key: str):
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

        self.model = genai.GenerativeModel(
            model_name='gemini-2.5-pro',  # Using the latest model
            safety_settings=[
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
            ]
        )

    async def _get_response(self, system_prompt: str, user_text: str, history: List[Dict[str, str]]) -> str:
        """A generic, reusable method to get a response from the AI with a specific system prompt."""
        # The first message sets the persona for the AI
        messages_for_api = [{"role": "user", "parts": [system_prompt]},
                            {"role": "model", "parts": ["Understood. I am ready to assist."]}]

        # Add the previous conversation history
        for message in history:
            role = "user" if message["role"] == "user" else "model"
            messages_for_api.append({'role': role, 'parts': [message["content"]]})

        # Add the user's new message
        messages_for_api.append({'role': 'user', 'parts': [user_text]})

        try:
            response = await self.model.generate_content_async(messages_for_api)
            return response.text
        except Exception as e:
            logger.error(f"Error communicating with Google Gemini API: {e}", exc_info=True)
            raise


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
        Performs a robust, historical backtest of a single strategy with advanced metrics.
        Uses a fault-tolerant data source for fetching historical data.
        """
        logger.info(f"Starting backtest for {strategy_name} on {symbol} from {start_date} to {end_date}")

        # --- 1. Fetch Historical Data Robustly ---
        all_ohlcv = []
        try:
            # Use the fault-tolerant method to get a reliable data source.
            # We ignore the 'exchange_name' parameter for public data fetching to ensure resilience.
            exchange = await broker_manager.get_fault_tolerant_public_client()
            if not exchange:
                raise HTTPException(status_code=503, detail="Market data providers are currently unavailable.")

            exchange.options['defaultType'] = 'spot'

            since = exchange.parse8601(f"{start_date}T00:00:00Z")
            limit = 1000  # Fetch a larger chunk size for efficiency
            end_timestamp = exchange.parse8601(f"{end_date}T23:59:59Z")

            while since < end_timestamp:
                logger.debug(f"Fetching OHLCV for {symbol} from {exchange.id} starting at {exchange.iso8601(since)}")
                ohlcv = await exchange.fetch_ohlcv(symbol, '1d', since, limit)
                if not ohlcv:
                    logger.warning(f"No more data returned for {symbol} at {exchange.iso8601(since)}. Ending fetch.")
                    break

                all_ohlcv.extend(ohlcv)
                since = ohlcv[-1][0] + 86400000  # Advance by one day in milliseconds

            if not all_ohlcv:
                raise ValueError("No historical data could be fetched for the given symbol and date range.")

        except (ccxt.NetworkError, ccxt.ExchangeError) as e:
            logger.error(f"A network or exchange error occurred during backtest data fetching: {e}", exc_info=True)
            raise HTTPException(status_code=503, detail=f"Failed to connect to a data provider: {e}")
        except Exception as e:
            logger.error(f"An unexpected error occurred during backtest data fetching: {e}", exc_info=True)
            raise HTTPException(status_code=400, detail=str(e))

        # --- 2. Prepare DataFrame ---
        df = pd.DataFrame(all_ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
        df = df[(df['timestamp'] >= pd.to_datetime(start_date)) & (df['timestamp'] <= pd.to_datetime(end_date))]

        if df.empty:
            raise HTTPException(status_code=400, detail="No historical data available for the precise date range.")

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

    def _generate_signals(self, strategy_name, df, params):
        df['signal'] = 0
        if strategy_name == "MA_Cross":
            short_ma = df['close'].rolling(window=params.get('short_window', 50)).mean()
            long_ma = df['close'].rolling(window=params.get('long_window', 200)).mean()
            df.loc[(short_ma > long_ma) & (short_ma.shift(1) <= long_ma.shift(1)), 'signal'] = 1  # Buy
            df.loc[(short_ma < long_ma) & (short_ma.shift(1) >= long_ma.shift(1)), 'signal'] = -1  # Sell
        elif strategy_name == "Bollinger_Bands":
            sma = df['close'].rolling(window=params.get('window', 20)).mean()
            std = df['close'].rolling(window=params.get('window', 20)).std()
            upper = sma + (std * params.get('std_dev', 2))
            lower = sma - (std * params.get('std_dev', 2))
            df.loc[df['close'] < lower, 'signal'] = 1
            df.loc[df['close'] > upper, 'signal'] = -1
        elif strategy_name == "Smart_Money_Concepts":
            df = self.smc_analyzer.find_bos_choch(df)
            df = self.smc_analyzer.find_order_blocks(df)

            df['bullish_choch_signal'] = (df['choch'] == 1).rolling(10).sum() > 0

            # Buy when price pulls back to an order block after a bullish CHoCH
            df.loc[(df['bullish_choch_signal']) & (df['close'] <= df['bullish_ob']), 'signal'] = 1

            # For backtesting, a simple exit strategy is to sell on a bearish CHoCH
            df.loc[df['choch'] == -1, 'signal'] = -1
        return df

    async def run_optimization_task(self, task_id: str, request: StrategyOptimizationRequest):
        self.optimization_tasks[task_id]['status'] = OptimizationStatus.RUNNING

        param_names = request.parameter_ranges.keys()
        param_values = request.parameter_ranges.values()
        param_combinations = list(itertools.product(*param_values))
        total_runs = len(param_combinations)

        results = []
        try:
            for i, combo in enumerate(param_combinations):
                params = dict(zip(param_names, combo))
                metrics = await self.backtest_strategy(
                    strategy_name=request.strategy_name,
                    params=params,
                    symbol=request.symbol,
                    exchange_name=request.exchange,
                    start_date=request.start_date,
                    end_date=request.end_date
                )
                results.append(OptimizationResult(params=params, metrics=metrics))
                self.optimization_tasks[task_id]['progress'] = (i + 1) / total_runs

            # Sort results by Sharpe Ratio
            results.sort(key=lambda x: x.metrics.get('sharpe_ratio', 0), reverse=True)
            self.optimization_tasks[task_id]['results'] = results
            self.optimization_tasks[task_id]['status'] = OptimizationStatus.COMPLETED

        except Exception as e:
            logger.error(f"Optimization task {task_id} failed: {e}")
            self.optimization_tasks[task_id]['status'] = OptimizationStatus.FAILED
            self.optimization_tasks[task_id]['error'] = str(e)


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
        self.strategies = {
            "TradingView_Alert": self.run_webhook_strategy,
            "RSI_MACD_Crossover": self.run_rsi_macd_crossover_strategy,
            "MA_Cross": self.run_ma_cross_strategy,
            "Bollinger_Bands": self.run_bollinger_bands_strategy,
            "Smart_Money_Concepts": self.run_smc_strategy,
            "Grid_Trading": self.run_grid_trading_strategy,
            "VISUAL_STRATEGY": self.run_visual_strategy,
        }
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
                api_key = user_service.decrypt_api_key(api_key_entry.api_key_encrypted)
                secret_key = user_service.decrypt_api_key(api_key_entry.secret_key_encrypted)
                return await trading_service.get_exchange_client(
                    exchange_name=exchange_name, api_key=api_key, secret_key=secret_key
                )
            except Exception as e:
                logger.error(f"Failed to create authenticated client for user {user_id} on {exchange_name}: {e}")
                return None

    def _parse_webhook_data(self, alert_body: Dict[str, Any]) -> Optional[str]:
        """
        Parses the incoming TradingView alert body to determine the intended action.
        This is flexible to handle various user-defined message formats.
        Returns 'buy', 'sell', or None.
        """
        # Look for a specific "action" key first
        action = alert_body.get("action", "").lower()
        if action in ["buy", "sell"]:
            return action

        # If no "action" key, inspect the raw message content for keywords
        # This allows users to just type "buy" or "long" in their TV alert message
        raw_message = str(alert_body).lower()
        if any(keyword in raw_message for keyword in ["buy", "long", "enter"]):
            return "buy"
        if any(keyword in raw_message for keyword in ["sell", "short", "exit", "close"]):
            return "sell"

        return None

    async def start_bot(self, db: AsyncSession, user: User, bot: TradingBot, background_tasks: BackgroundTasks):
        """
        Robustly starts a trading bot, handling different strategy types and preventing race conditions.
        """
        async with self._bot_locks[bot.id]:
            # Re-fetch the bot from DB inside the lock to get the most current state
            current_bot = await db.get(TradingBot, bot.id)
            if not current_bot:
                logger.error(f"Attempted to start a non-existent bot with id {bot.id}")
                return

            if current_bot.is_active or current_bot.id in self.running_bot_tasks:
                logger.warning(f"Bot {current_bot.id} is already running or marked as active. Start request ignored.")
                return

            await telegram_service.notify_user(user.id, f"▶️ Attempting to start bot `{current_bot.name}`...")

            try:
                # --- Logic for Webhook-driven Bots ---
                if current_bot.strategy_name == "TradingView_Alert":
                    if not current_bot.webhook_id:
                        current_bot.webhook_id = f"tv_{secrets.token_urlsafe(16)}"

                    current_bot.is_active = True
                    await db.commit()

                    # Provide the user with the necessary info to configure their alert
                    # NOTE: Replace 'https://yourdomain.com' with your actual public domain
                    webhook_url = f"https://brown-baths-design.loca.lt/api/bots/webhook/{current_bot.webhook_id}"
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

            # --- For all bots (including webhook), mark as inactive in the database ---
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
                                background_tasks: BackgroundTasks, sizing_overrides: Optional[Dict] = None):
        """
        A centralized, robust helper to handle trade execution for any bot.
        This function acts as an orchestrator, validating signals and routing to the correct
        execution logic based on the bot's configuration.
        """
        # 1. Validate Signal against Current State
        in_position = bot.active_position_entry_price is not None
        if signal == 'buy' and in_position and bot.market_type == MarketType.SPOT.value:
            logger.info(f"Spot bot {bot.id} received 'buy' signal but is already in a position. Ignoring.")
            return
        if signal == 'sell' and not in_position and bot.market_type == MarketType.SPOT.value:
            logger.info(f"Spot bot {bot.id} received 'sell' signal but is not in a position. Ignoring.")
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
            amount_base = investment_usd / price
            trade = TradeLog(user_id=user.id, bot_id=bot.id, exchange="paper", symbol=bot.symbol,
                             order_id=f"paper-{uuid4()}", side=signal, type='market', amount=float(amount_base),
                             price=float(price), cost=float(investment_usd), is_paper_trade=True)
            db.add(trade)
            await db.commit()
            background_tasks.add_task(trading_service.update_bot_pnl, db, bot.id)
            msg = f"📄 *Paper Trade Executed*\nBot: `{bot.name}`\n{signal.upper()} `{amount_base:.6f}` `{base_asset}` at `~${price:.2f}`"
            await telegram_service.notify_user(user.id, msg)
            return

        # 4. Handle Live Trading
        private_client = None
        try:
            private_client = await broker_manager.get_private_client(
                user.id, bot.exchange, AssetClass(bot.asset_class), MarketType(bot.market_type)
            )
            if not private_client:
                err_msg = f"🛑 Bot `{bot.name}` stopped: Could not connect to {bot.exchange}. Please check your API keys."
                await telegram_service.notify_user(user.id, err_msg)
                bot.is_active = False
                await db.commit()
                return

            bot_for_sizing = bot
            if sizing_overrides and sizing_overrides.get("strategy"):
                # Use a copy to avoid changing the actual bot object
                from copy import deepcopy
                ghost_bot = deepcopy(bot)
                ghost_bot.sizing_strategy = sizing_overrides["strategy"]
                ghost_bot.sizing_params = json.dumps(sizing_overrides["params"])
                bot_for_sizing = ghost_bot

            amount_to_trade = await trading_service.get_position_size(user, bot_for_sizing, private_client)

            if bot.market_type == MarketType.SPOT.value:
                if signal == 'buy':
                    await self._execute_spot_entry(db, user, bot, price, private_client, background_tasks)
                elif signal == 'sell':
                    await self._execute_spot_exit(db, user, bot, price, private_client, background_tasks)
            elif bot.market_type == MarketType.FUTURE.value:
                    await self._execute_future_trade(db, user, bot, signal, price, private_client, background_tasks)

        except (ccxt.InsufficientFunds, ccxt.InvalidOrder, ValueError) as e:
            err_msg = f"🛑 Bot `{bot.name}` stopped due to an error on {bot.exchange}: {e}"
            await telegram_service.notify_user(user.id, err_msg)
            bot.is_active = False
            await db.commit()
        except ccxt.NetworkError as e:
            err_msg = f"📡 Bot `{bot.name}` has a temporary network issue with {bot.exchange}. It will keep trying."
            await telegram_service.notify_user(user.id, err_msg)
        except Exception as e:
            logger.error(f"Unexpected external trading error for bot {bot.id}: {e}", exc_info=True)
            err_msg = f"🛑 Bot `{bot.name}` stopped due to an unexpected external error."
            await telegram_service.notify_user(user.id, err_msg)
            bot.is_active = False
            await db.commit()
        finally:
            if private_client:
                await private_client.close()

    async def _execute_spot_entry(self, db: AsyncSession, user: User, bot: TradingBot, price: Decimal, client: BrokerClient, background_tasks: BackgroundTasks):
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
        await telegram_service.notify_user(user.id, msg)
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

    async def _execute_spot_exit(self, db: AsyncSession, user: User, bot: TradingBot, price: Decimal, client: BrokerClient, background_tasks: BackgroundTasks):
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
                                               f"🚀 *Futures Position Opened*\nBot: `{bot.name}` ({position_type} @ {bot.leverage}x).")    # --- NEW: The runner for all visual strategies ---
    async def run_visual_strategy(self, user: User, bot: TradingBot, data_queue: asyncio.Queue, background_tasks: BackgroundTasks):
        from collections import deque
        historical_candles = deque(maxlen=250)  # Use a larger buffer for visual strategies

        try:
            # Hydration
            client = await broker_manager.get_private_client(user.id, bot.exchange, AssetClass(bot.asset_class))
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
                        await self.execute_bot_trade(db, user, current_bot, signal, Decimal(str(kline['c'])), background_tasks)

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
            client = await broker_manager.get_private_client(user.id, bot.exchange, AssetClass(bot.asset_class))
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

                        await self.execute_bot_trade(db, user, current_bot, 'buy', Decimal(str(kline['c'])), background_tasks)

                    elif sell_signal and in_position:
                        await self.execute_bot_trade(db, user, current_bot, 'sell', Decimal(str(kline['c'])), background_tasks)
                previous_macd_hist_state = current_macd_hist_state
        except asyncio.CancelledError:
            logger.info(f"RSI/MACD bot {bot.id} task was cancelled.")
        except Exception as e:
            logger.error(f"Critical error in RSI/MACD bot {bot.id}: {e}", exc_info=True)
            async with async_session_maker() as db:
                await self.stop_bot(db, bot)

    # --- STRATEGY 2: Moving Average Crossover ---
    async def run_ma_cross_strategy(self, user: User, bot: TradingBot, data_queue: asyncio.Queue, background_tasks: BackgroundTasks):
        params = json.loads(bot.strategy_params)
        short_window, long_window = params.get('short_window', 50), params.get('long_window', 200)
        from collections import deque
        historical_closes = deque(maxlen=long_window + 5)
        previous_ma_state = 0

        # --- Hydration Logic (remains the same) ---
        try:
            client = await broker_manager.get_private_client(user.id, bot.exchange, AssetClass(bot.asset_class))
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

                        await self.execute_bot_trade(db, user, current_bot, 'buy', Decimal(str(kline['c'])), background_tasks)

                    elif sell_signal and in_position:
                        await self.execute_bot_trade(db, user, current_bot, 'sell', Decimal(str(kline['c'])), background_tasks)

        except asyncio.CancelledError:
            logger.info(f"MA Cross bot {bot.id} task was cancelled.")
        except Exception as e:
            logger.error(f"Critical error in MA Cross bot {bot.id}: {e}", exc_info=True)
            async with async_session_maker() as db:
                await self.stop_bot(db, bot)

    # --- STRATEGY 3: Bollinger Bands ---

    async def run_bollinger_bands_strategy(self, user: User, bot: TradingBot, data_queue: asyncio.Queue, background_tasks: BackgroundTasks):
        params = json.loads(bot.strategy_params)
        window, std_dev = params.get('window', 20), params.get('std_dev', 2.0)
        from collections import deque
        historical_closes = deque(maxlen=window + 5)

        # --- Hydration Logic (remains the same) ---
        try:
            client = await broker_manager.get_private_client(user.id, bot.exchange, AssetClass(bot.asset_class))
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

                        await self.execute_bot_trade(db, user, current_bot, 'buy', Decimal(str(kline['c'])), background_tasks)

                    elif sell_signal and in_position:
                        # For mean reversion, we can also use the middle band (SMA) as an exit signal
                        await self.execute_bot_trade(db, user, current_bot, 'sell', Decimal(str(kline['c'])), background_tasks)

        except asyncio.CancelledError:
            logger.info(f"Bollinger Bands bot {bot.id} task was cancelled.")
        except Exception as e:
            logger.error(f"Critical error in Bollinger Bands bot {bot.id}: {e}", exc_info=True)
            async with async_session_maker() as db:
                await self.stop_bot(db, bot)

    # --- STRATEGY 4: Smart Money Concepts ---
    async def run_smc_strategy(self, user: User, bot: TradingBot, data_queue: asyncio.Queue, background_tasks: BackgroundTasks):
        from collections import deque
        historical_candles = deque(maxlen=200)

        # --- Hydration Logic (remains the same) ---
        try:
            client = await broker_manager.get_private_client(user.id, bot.exchange, AssetClass(bot.asset_class))
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
            broker_adapter = await broker_manager.get_private_client(user.id, bot.exchange, AssetClass.CRYPTO)
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


strategy_service = StrategyService()


# --- THIS IS THE COMPLETE, ROBUST, AND UPDATED BACKGROUND TASK ---
async def broadcast_market_data():
    """
    A robust background task that fetches and broadcasts market data.
    It first tries fast, direct exchange APIs. If all of them fail,
    it automatically falls back to using TradingView as a data source.
    """
    all_symbols = [
        'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT',
        'ADA/USDT', 'AVAX/USDT', 'SHIB/USDT', 'DOT/USDT', 'LINK/USDT', 'TRX/USDT',
        'MATIC/USDT', 'LTC/USDT', 'ATOM/USDT', 'NEAR/USDT', 'UNI/USDT', 'XLM/USDT',
        'ICP/USDT', 'ETC/USDT', 'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF',
        'AUD/USD', 'NZD/USD', 'USD/CAD', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY',
        'AUD/JPY', 'NZD/JPY', 'GBP/CHF', 'AUD/NZD', 'EUR/AUD', 'GBP/CAD',
        'EUR/CAD', 'USD/MXN', 'USD/ZAR', 'USD/INR'
    ]

    while True:
        tickers = {}
        data_source = "Unknown"

        try:
            # --- PRIMARY METHOD: Try to use the fast, direct CCXT exchange APIs first ---
            exchange = await broker_manager.get_fault_tolerant_public_client()

            if exchange:
                data_source = exchange.id
                tickers = await exchange.fetch_tickers(all_symbols)
            else:
                # --- FALLBACK METHOD: If all CCXT exchanges fail, use TradingView ---
                logger.warning("All CCXT exchange connections failed. Falling back to TradingView for market data.")
                data_source = "TradingView"
                tickers = await tv_client.fetch_tickers(all_symbols)

            # If either method failed to return any data, log it and wait.
            if not tickers:
                logger.error(
                    f"Failed to fetch any market data from all available sources ({data_source}). Skipping this broadcast cycle.")
                await asyncio.sleep(30)  # Wait longer if all sources are down
                continue

            # --- Process and broadcast the successfully fetched data ---
            market_data = {}
            for symbol, data in tickers.items():
                if data and data.get('last') is not None and data.get('percentage') is not None:
                    market_data[symbol] = {
                        "price": data['last'],
                        "change": data['percentage']
                    }

            if market_data:
                await websocket_manager.broadcast({
                    "type": "market_update",
                    "data": market_data
                })
                logger.info(f"Market data broadcasted successfully using {data_source}.")

        except Exception as e:
            logger.error(f"An unexpected critical error occurred in broadcast_market_data: {e}", exc_info=True)

        # Wait for the next cycle
        await asyncio.sleep(20)  # Increased sleep time slightly for stability


# ==============================================================================
# 7. FASTAPI LIFESPAN MANAGER & APP SETUP
# ==============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ==================================================================
    # APPLICATION STARTUP LOGIC
    # ==================================================================
    logger.info("QuantumLeap AI Trader Starting Up...")

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

    # --- 2. Start Core Background Services ---
    logger.info("Starting background services...")
    telegram_service.setup_handlers()
    await telegram_service.initialize_bot_info()

    # Store all background tasks on app.state for graceful shutdown
    app.state.telegram_task = asyncio.create_task(telegram_service.run_polling())
    app.state.market_regime_task = asyncio.create_task(market_regime_service.run_analysis_loop())

    # --- FIX: Correctly create and store the broadcast task ---
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

    # --- 1. Cancel All Background Service Tasks ---
    logger.info("Cancelling background service tasks...")
    tasks_to_cancel = [
        app.state.telegram_task,
        app.state.market_regime_task,
        app.state.broadcast_task  # --- FIX: Ensure broadcast_task is cancelled ---
    ]
    for task in tasks_to_cancel:
        if task and not task.done():
            task.cancel()

    # --- 2. Stop All Running Trading Bot Tasks ---
    logger.info("Stopping all active trading bots...")
    bot_tasks = list(strategy_service.running_bot_tasks.values())
    for task in bot_tasks:
        if not task.done():
            task.cancel()

    # Wait for all cancelled tasks to finish
    all_tasks = tasks_to_cancel + bot_tasks
    await asyncio.gather(*all_tasks, return_exceptions=True)
    logger.info("All application tasks have been cancelled.")

    # --- 3. Close External Connections Gracefully ---
    logger.info("Closing external connections...")
    await broker_manager.close_all_public()
    await market_streamer.close()
    await telegram_service.stop_polling()
    await engine.dispose()
    logger.info("All external connections closed.")
    logger.info("Shutdown complete.")


app = FastAPI(title="QuantumLeap AI Trader",
              description="A Real-Time AI Trading System with Bot Automation and Market Analysis.", version="1.0.0",
              lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_credentials=True, allow_methods=["*"],
                   allow_headers=["*"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

auth_router = APIRouter(prefix="/api/auth", tags=["Authentication"])
users_router = APIRouter(prefix="/api/users", tags=["Users"])
bots_router = APIRouter(prefix="/api/bots", tags=["Trading Bots"])
market_router = APIRouter(prefix="/api/market", tags=["Market Data & AI"])
payments_router = APIRouter(prefix="/api/payments", tags=["Payments & Subscriptions"])
superuser_router = APIRouter(prefix="/api/superuser", tags=["Superuser"])
wallet_router = APIRouter(prefix="/api/wallet", tags=["Wallet & Swapping"])
strategies_router = APIRouter(prefix="/api/strategies", tags=["Strategy Marketplace"])
public_router = APIRouter(prefix="/api/public", tags=["Public API"])
trading_router = APIRouter(prefix="/api/trading", tags=["Manual Trading"])
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
        request: SwapExecuteRequest, # Changed to the new request model
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
        await db.commit()
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


@auth_router.post("/token", response_model=Token)
async def login_for_access_token(id_token: str = Body(..., embed=True), db: AsyncSession = Depends(get_db)):
    try:
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token['uid']
        user = await db.get(User, uid)
        if not user:
            user = User(id=uid, email=decoded_token['email'], role=UserRole.USER.value,
                        subscription_plan=SubscriptionPlan.BASIC.value)
            db.add(user)
            await db.commit()
            await db.refresh(user)
            logger.info(f"User {uid} existed in Firebase but not local DB. Created now.")
        access_token_expires = datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(data={"sub": user.id, "role": user.role}, expires_delta=access_token_expires)
        refresh_token = create_refresh_token(data={"sub": user.id})
        return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}
    except auth.InvalidIdTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Firebase ID token.")
    except Exception as e:
        logger.error(f"Error during token generation: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not process login.")


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


@auth_router.post("/superuser/login", response_model=Token)
async def superuser_login(form_data: SuperuserLoginSchema, db: AsyncSession = Depends(get_db)):
    if form_data.email != settings.SUPERUSER_EMAIL:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if not user_service.verify_password(form_data.password,
                                        user_service.get_password_hash(settings.SUPERUSER_PASSWORD)):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    user_result = await db.execute(select(User).where(User.email == settings.SUPERUSER_EMAIL))
    user = user_result.scalar_one_or_none()
    if not user: raise HTTPException(status_code=404, detail="Superuser not found in database.")
    access_token_expires = datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": user.id, "role": user.role}, expires_delta=access_token_expires)
    refresh_token = create_refresh_token(data={"sub": user.id})
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}


@users_router.get("/me", response_model=UserSchema)
async def read_users_me(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user


@users_router.post("/api-keys", response_model=APIKeySchema, status_code=status.HTTP_201_CREATED)
async def add_api_key(key_data: APIKeyCreate, current_user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    existing_key = await db.scalar(
        select(UserAPIKey).where(UserAPIKey.user_id == current_user.id, UserAPIKey.exchange == key_data.exchange))
    if existing_key: raise HTTPException(status_code=400, detail=f"API key for {key_data.exchange} already exists.")
    encrypted_api_key, encrypted_secret_key = user_service.encrypt_api_key(
        key_data.api_key), user_service.encrypt_api_key(key_data.secret_key)
    new_key = UserAPIKey(user_id=current_user.id, exchange=key_data.exchange, api_key_encrypted=encrypted_api_key,
                         secret_key_encrypted=encrypted_secret_key)
    db.add(new_key)
    await db.commit()
    await db.refresh(new_key)
    return APIKeySchema(id=new_key.id, exchange=new_key.exchange, api_key_masked=f"****{key_data.api_key[-4:]}")


@users_router.get("/api-keys", response_model=List[APIKeySchema])
async def get_api_keys(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    keys = await db.execute(select(UserAPIKey).where(UserAPIKey.user_id == current_user.id))
    key_list = keys.scalars().all()
    response_keys = []
    for key in key_list:
        try:
            decrypted_api_key = user_service.decrypt_api_key(key.api_key_encrypted)
            masked_key = f"****{decrypted_api_key[-4:]}"
        except Exception:
            masked_key = "Decryption Error - Please Update"
        response_keys.append(APIKeySchema(id=key.id, exchange=key.exchange, api_key_masked=masked_key))
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
    Calculates the user's total portfolio value by fetching balances from all
    their connected exchanges and calculating the current USD value of each asset.
    This is a production-ready, concurrent implementation.
    """
    # Step 1: Get all of the user's decrypted API keys from the database.
    api_keys_result = await db.execute(
        select(UserAPIKey).where(UserAPIKey.user_id == current_user.id)
    )
    api_keys = api_keys_result.scalars().all()

    if not api_keys:
        return []

    # Step 2: Create a list of concurrent tasks to fetch balances from each exchange.
    balance_fetch_tasks = []
    for key_entry in api_keys:
        try:
            api_key = user_service.decrypt_api_key(key_entry.api_key_encrypted)
            secret_key = user_service.decrypt_api_key(key_entry.secret_key_encrypted)

            # This creates a NEW, single-use client for each key.
            # The fetch_exchange_balance helper will close it.
            exchange_client = await trading_service.get_exchange_client(
                exchange_name=key_entry.exchange,
                api_key=api_key,
                secret_key=secret_key
            )

            if exchange_client:
                balance_fetch_tasks.append(fetch_exchange_balance(exchange_client))

        except Exception as e:
            logger.error(f"Failed to process API key for user {current_user.id} on exchange {key_entry.exchange}: {e}")
            continue

    # Step 3: Run all balance-fetching tasks concurrently.
    exchange_balances_results = await asyncio.gather(*balance_fetch_tasks, return_exceptions=True)

    # Step 4: Aggregate all balances into a single dictionary.
    aggregated_portfolio = defaultdict(float)
    for result in exchange_balances_results:
        if isinstance(result, Exception):
            logger.error(f"Portfolio fetch failed for an exchange: {result}")
            continue
        for asset, amount in result.items():
            aggregated_portfolio[asset] += amount

    # Step 5: Fetch current prices for all held assets to calculate their USD value.
    if not aggregated_portfolio:
        return []

    assets_to_price = [asset for asset in aggregated_portfolio.keys() if asset != 'USDT']

    # We use a shared, public client for pricing to be efficient.
    pricing_exchange = await broker_manager.get_fault_tolerant_public_client()
    price_fetch_tasks = []

    try:
        for asset in assets_to_price:
            symbol = f"{asset}/USDT"
            price_fetch_tasks.append(fetch_asset_price(pricing_exchange, symbol))

        # --- THIS IS THE CORRECTED LOGIC ---
        # 1. Run all the pricing tasks concurrently.
        price_results = await asyncio.gather(*price_fetch_tasks, return_exceptions=True)
        # 2. The original code had the .close() call here, which was wrong.
        #    The `pricing_exchange` is a shared client from the manager, so we
        #    DO NOT manually close it. The manager handles its lifecycle.
        # ------------------------------------

        asset_prices = {}
        for i, result in enumerate(price_results):
            asset = assets_to_price[i]
            if isinstance(result, Exception):
                logger.warning(f"Could not fetch price for {asset}: {result}")
                asset_prices[asset] = 0.0
            else:
                asset_prices[asset] = result

    finally:
        # We don't need to call .close() on the shared public client,
        # as the ExchangeManager handles its lifecycle. This block is
        # kept for logical clarity but no action is needed here.
        pass

    # Step 6: Build the final portfolio list with USD values.
    final_portfolio = []
    for asset, total_amount in aggregated_portfolio.items():
        price = 1.0 if asset == 'USDT' else asset_prices.get(asset, 0.0)
        usd_value = total_amount * price

        if usd_value > 1.0:
            final_portfolio.append({
                "asset": asset,
                "amount": total_amount,
                "current_price": price,
                "usd_value": usd_value
            })

    return sorted(final_portfolio, key=lambda x: x['usd_value'], reverse=True)


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
    Uploads a profile picture. In a real system, this uploads the file to a
    cloud storage service (like AWS S3 or Cloudinary) and saves the URL.
    """
    # --- Production Implementation: Upload to Cloud Service ---
    # 1. Validate file type and size
    if file.content_type not in ["image/jpeg", "image/png"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPG and PNG are accepted.")

    # 2. In a real system, you would use a library like `cloudinary` or `boto3` here.
    # import cloudinary.uploader
    # upload_result = cloudinary.uploader.upload(file.file, folder="profile_pictures")
    # image_url = upload_result.get("secure_url")

    # --- For this implementation, we will simulate the upload result ---
    # This mock URL is safe for demonstration.
    image_url = f"https://res.cloudinary.com/demo/image/upload/sample.jpg?user={current_user.id}&ts={int(time.time())}"
    logger.info(f"Simulated upload for user {current_user.id}. Image URL: {image_url}")

    profile = await db.scalar(select(UserProfile).where(UserProfile.user_id == current_user.id))
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)

    profile.profile_picture_url = image_url
    await db.commit()
    await db.refresh(profile)
    return profile


# --- HELPER FUNCTIONS FOR THE PORTFOLIO ENDPOINT ---
# These should be placed right below the `get_user_portfolio` function.
async def fetch_exchange_balance(exchange: ccxt.Exchange) -> Dict[str, float]:
    """
    Fetches the account balance from a single exchange and returns a dictionary
    of assets with their total amounts, filtering out dust.
    """
    try:
        balance_data = await exchange.fetch_balance()
        total_balances = balance_data.get('total', {})
        non_zero_balances = {
            asset: amount
            for asset, amount in total_balances.items()
            if amount > 0.00001
        }
        return non_zero_balances
    except Exception as e:
        logger.error(f"Could not fetch balance from {exchange.id}: {e}")
        # Propagate the exception to be handled by asyncio.gather
        raise
    finally:
        # This block is GUARANTEED to run, whether an error occurred or not.
        # This ensures the authenticated client connection is always closed.
        await exchange.close()


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

@bots_router.post("/", response_model=TradingBotSchema, status_code=status.HTTP_201_CREATED)
async def create_trading_bot(bot_data: TradingBotCreate, current_user: User = Depends(get_current_user),
                             db: AsyncSession = Depends(get_db)):
    """
    Creates a new trading bot for the current user.
    Handles both pre-built and visual strategies, and enforces plan limits.
    """
    # 1. Check if the user has reached their bot limit for their current plan
    user_bots_count_result = await db.execute(
        select(func.count(TradingBot.id)).where(TradingBot.owner_id == current_user.id)
    )
    user_bots_count = user_bots_count_result.scalar_one()

    plan_limits = {
        SubscriptionPlan.BASIC.value: 1,
        SubscriptionPlan.PREMIUM.value: 5,
        SubscriptionPlan.ULTIMATE.value: 20,
    }

    if current_user.role != UserRole.SUPERUSER.value and user_bots_count >= plan_limits.get(
            current_user.subscription_plan, 0):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You have reached the bot limit ({plan_limits[current_user.subscription_plan]}) for the {current_user.subscription_plan} plan. Please upgrade."
        )

    # 2. Enforce feature gates for Ultimate Plan features
    if bot_data.market_type == MarketType.FUTURE and not is_ultimate(current_user):
        raise HTTPException(status_code=403, detail="Futures trading is an Ultimate Plan feature.")

    if bot_data.optimus_enabled and not is_ultimate(current_user):
        raise HTTPException(status_code=403, detail="Optimus AI Mode is an Ultimate Plan feature.")

    if bot_data.sizing_strategy != PositionSizingStrategy.FIXED_AMOUNT and not is_ultimate(current_user):
        raise HTTPException(status_code=403, detail="Advanced Position Sizing is an Ultimate Plan feature.")

    # 3. Prepare strategy data based on the type (prebuilt vs. visual)
    strategy_name_to_save = bot_data.strategy_name
    strategy_params_to_save = bot_data.strategy_params
    visual_strategy_to_save = bot_data.visual_strategy_json

    if bot_data.strategy_type == StrategyType.VISUAL:
        # For visual bots, we assign a placeholder name and clear prebuilt params
        strategy_name_to_save = f"Visual_{bot_data.name.replace(' ', '_')}"
        strategy_params_to_save = {}
    else:
        # For prebuilt bots, clear any visual strategy data
        visual_strategy_to_save = None

    # 4. Create the new TradingBot database object with all fields
    new_bot = TradingBot(
        name=bot_data.name,
        owner_id=current_user.id,
        symbol=bot_data.symbol.upper(),
        exchange=bot_data.exchange.lower(),
        is_paper_trading=bot_data.is_paper_trading,

        # Strategy fields
        strategy_type=bot_data.strategy_type.value,
        strategy_name=strategy_name_to_save,
        strategy_params=json.dumps(strategy_params_to_save),
        visual_strategy_json=json.dumps(visual_strategy_to_save) if visual_strategy_to_save else None,

        # Futures & Leverage fields
        market_type=bot_data.market_type.value,
        leverage=bot_data.leverage,

        # Risk Management fields
        take_profit_percentage=bot_data.take_profit_percentage,
        stop_loss_percentage=bot_data.stop_loss_percentage,
        sizing_strategy=bot_data.sizing_strategy.value,
        sizing_params=json.dumps(bot_data.sizing_params) if bot_data.sizing_params else None,

        # Advanced AI options
        market_regime_filter_enabled=bot_data.market_regime_filter_enabled,
        optimus_enabled=bot_data.optimus_enabled
    )

    db.add(new_bot)
    await db.commit()
    await db.refresh(new_bot)

    return TradingBotSchema.model_validate(new_bot)


# Helper function to avoid repetition in the endpoint
def is_ultimate(user: User) -> bool:
    return user.subscription_plan == SubscriptionPlan.ULTIMATE.value or user.role == UserRole.SUPERUSER.value


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
async def start_user_bot(bot_id: PythonUUID,  background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user),
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
        private_exchange = await broker_manager.get_private_client(current_user.id, order_data.exchange, order_data.asset_class)
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


@trading_router.get("/orders/{exchange}/{symbol}", response_model=List[OpenOrderSchema])
async def get_open_orders(
        exchange: str,
        symbol: str,
        current_user: User = Depends(get_current_user)
):
    """Fetches all open orders for a specific symbol from a user's connected exchange."""
    private_exchange = None
    try:
        private_exchange = await broker_manager.get_private_client(current_user.id, exchange)
        if not private_exchange:
            return []

        open_orders = await private_exchange.fetch_open_orders(symbol)

        # Convert ccxt order format to our Pydantic schema
        return [OpenOrderSchema(
            id=o['id'], symbol=o['symbol'], side=o['side'], type=o['type'],
            amount=o['amount'], price=o.get('price', 0.0), filled=o.get('filled', 0.0),
            status=o.get('status', 'open'),
            timestamp=datetime.datetime.fromtimestamp(o['timestamp'] / 1000, tz=datetime.timezone.utc)
        ) for o in open_orders]

    except Exception as e:
        logger.error(f"Failed to fetch open orders for user {current_user.id}: {e}")
        return []  # Return empty list on error
    finally:
        if private_exchange:
            await private_exchange.close()


@public_router.get("/bots/{bot_id}", response_model=PublicBotPerformanceSchema)
async def get_public_bot_performance(
        bot_id: PythonUUID,
        db: AsyncSession = Depends(get_db)
):
    """
    Fetches the performance data for a single, publicly shared bot.
    This endpoint does not require authentication.
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
    exchange = await broker_manager.get_fault_tolerant_public_client()
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


@public_router.post("/chat")
async def handle_public_chat(request: ChatRequest):
    """
    Handles conversational queries from the public-facing chat assistant.
    This endpoint is not authenticated and uses the GENERAL assistant persona.
    """
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    try:
        # Calls the new, correct method for general queries
        response_text = await llm_service.get_general_assistant_response(request.message, request.history)
        return {"response": response_text}
    except Exception as e:
        logger.error(f"Public chat assistant failed to get LLM response: {e}", exc_info=True)
        raise HTTPException(status_code=503, detail="The AI assistant is currently unavailable.")


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

    bot.is_public = request.is_public
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
        user: User = Depends(require_ultimate_plan)  # This is an ultimate-tier feature
):
    """
    Backtests a predefined set of strategies and returns their performance,
    ranked by Sharpe Ratio.
    """
    # Define a set of common parameter variations to test
    strategies_to_test = [
        {"name": "MA_Cross", "params": {"short_window": 20, "long_window": 50}},
        {"name": "MA_Cross", "params": {"short_window": 50, "long_window": 200}},
        {"name": "Bollinger_Bands", "params": {"window": 20, "std_dev": 2}},
        {"name": "Bollinger_Bands", "params": {"window": 20, "std_dev": 2.5}},
        {"name": "Smart_Money_Concepts", "params": {"risk_reward_ratio": 2.0}},  # NEW
        {"name": "Smart_Money_Concepts", "params": {"risk_reward_ratio": 3.0}},  # NEW
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

    # Filter out any results that produced errors and log them
    valid_results = []
    for res in results:
        if isinstance(res, Exception):
            logger.error(f"Backtest failed with exception: {res}")
        elif res.get("error"):
            logger.warning(f"Backtest returned an error: {res['error']}")
        else:
            valid_results.append(res)

    # Rank results by Sharpe Ratio (higher is better)
    ranked_results = sorted(valid_results, key=lambda x: x['sharpe_ratio'], reverse=True)

    return ranked_results


@market_router.get("/analysis/copilot/{exchange}/{symbol:path}")
async def get_copilot_analysis(
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
        exchange_client = await broker_manager.get_fault_tolerant_public_client()
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

# --- NEW: Strategy Optimization Endpoints ---
@market_router.post("/strategies/optimize", response_model=OptimizationTaskResponse)
async def start_strategy_optimization(
        request: StrategyOptimizationRequest,
        background_tasks: BackgroundTasks,
        user: User = Depends(require_ultimate_plan)
):
    """Kicks off a long-running strategy parameter optimization task."""
    task_id = f"opt-{uuid4()}"
    strategy_analysis_service.optimization_tasks[task_id] = {
        "status": OptimizationStatus.PENDING,
        "progress": 0.0,
        "results": None,
        "error": None
    }
    background_tasks.add_task(strategy_analysis_service.run_optimization_task, task_id, request)
    return OptimizationTaskResponse(task_id=task_id,
                                    message="Optimization task started. Check status endpoint for progress.")


@market_router.get("/strategies/optimize/status/{task_id}", response_model=OptimizationStatusResponse)
async def get_optimization_status(task_id: str, user: User = Depends(require_ultimate_plan)):
    """Checks the status and retrieves results of an optimization task."""
    task_info = strategy_analysis_service.optimization_tasks.get(task_id)
    if not task_info:
        raise HTTPException(status_code=404, detail="Optimization task not found.")

    return OptimizationStatusResponse(task_id=task_id, **task_info)


@market_router.post("/strategies/backtest", response_model=BacktestResultSchema)
async def run_single_backtest(
        request: SingleBacktestRequest,
        user: User = Depends(get_current_user)
):
    """
    Runs a backtest for a single, specific strategy configuration.
    Used for pre-publish analysis.
    """
    try:
        results = await strategy_analysis_service.backtest_strategy(
            strategy_name=request.strategy_name,
            params=request.params,
            symbol=request.symbol,
            exchange_name=request.exchange,
            start_date=request.start_date,
            end_date=request.end_date,
        )
        return results
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Single backtest failed with unexpected error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An internal error occurred during backtesting.")


class InterpretRequest(BaseModel):
    text: str = Field(..., max_length=500)
    history: Optional[List[Dict[str, str]]] = []  # The frontend will now send the chat history




@market_router.post("/strategies/interpret")
async def interpret_strategy(request: InterpretRequest, user: User = Depends(require_premium_plan)):
    """
    Receives a user's message and chat history, gets a conversational response
    from the STRATEGY SENSEI persona, and returns it.
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Input text cannot be empty.")
    try:
        # This correctly continues to call the specialist "Sensei" method
        response_text = await llm_service.get_sensei_response(request.text, request.history)
        return {"response": response_text}
    except Exception as e:
        raise HTTPException(status_code=503, detail="The Strategy Sensei is currently unavailable.")

@public_router.post("/contact")
async def handle_contact_form(
        request: ContactFormRequest,
        background_tasks: BackgroundTasks
):
    """
    Accepts contact form submissions, validates them, and sends an email
    in the background.
    """

    def send_email_notification(data: ContactFormRequest):
        try:
            # --- Construct the Email ---
            msg = MIMEMultipart()
            msg['From'] = settings.MAIL_FROM
            msg['To'] = settings.MAIL_TO
            msg['Subject'] = f"New Contact Form Submission from {data.name}"

            body = f"""
            You have received a new message from the QuantumLeap AI contact form.

            Name: {data.name}
            Email: {data.email}
            -----------------------------------------

            Message:
            {data.message}
            """
            msg.attach(MIMEText(body, 'plain'))

            # --- Connect to SMTP Server and Send ---
            logger.info(f"Connecting to SMTP server {settings.MAIL_SERVER}:{settings.MAIL_PORT}")
            server = smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT)
            server.starttls()  # Secure the connection
            server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
            text = msg.as_string()
            server.sendmail(settings.MAIL_FROM, settings.MAIL_TO, text)
            server.quit()
            logger.info("Contact form email sent successfully.")

        except Exception as e:
            # In a production app, you would log this to a service like Sentry
            logger.error(f"!!! CRITICAL: Failed to send contact form email: {e}", exc_info=True)

    # Run the email sending as a background task so the user gets an immediate response
    background_tasks.add_task(send_email_notification, request)

    return {"message": "Your message has been sent successfully."}


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

    if not bot.is_active:
        logger.warning(f"MT5 trade signal received for inactive bot {bot.id}. Ignoring.")
        return {"status": "ignored_inactive_bot"}

    # Create a new trade log entry
    trade = TradeLog(
        user_id=user.id,
        bot_id=bot.id,
        exchange="mt5",  # Mark the trade as originating from MT5
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
    msg = f"📈 *Trade Logged via MT5*\nBot: `{bot.name}`\n{signal.action.upper()} `{signal.volume}` `{base_asset}` at `{signal.price}`"
    background_tasks.add_task(telegram_service.notify_user, user.id, msg)

    trade_schema = TradeLogSchema.model_validate(trade)
    background_tasks.add_task(
        websocket_manager.send_personal_message,
        {"type": "trade_executed", "bot_id": str(bot.id), "details": jsonable_encoder(trade_schema)},
        user.id
    )

    return {"status": "trade logged successfully"}


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
                                                            "amount": {"currency_code": price_info['currency'],
                                                                       "value": str(price_info['price'])},
                                                            "description": f"QuantumLeap {plan.value.capitalize()} Plan"}],
                   "application_context": {"return_url": "http://localhost:3000/dashboard/billing?status=success",
                                           "cancel_url": "http://localhost:3000/dashboard/billing?status=cancelled",
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
                   "reference": reference, "callback_url": "http://localhost:3000/dashboard/billing"}
        async with aiohttp.ClientSession() as session:
            async with session.post("https://api.paystack.co/transaction/initialize", headers=headers,
                                    json=payload) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    logger.error(f"Paystack initialization failed: {error_text}")
                    raise HTTPException(status_code=500, detail="Failed to initiate Paystack payment.")
                data = await resp.json()
        payment_data = data['data']
        await self._create_payment_record(db, user.id, reference, plan, 'paystack')
        return PaymentInitResponse(payment_url=payment_data['authorization_url'], reference=reference,
                                   gateway='paystack')

    async def fulfill_subscription(self, db: AsyncSession, user_id: str, plan: SubscriptionPlan):
        user = await db.get(User, user_id)
        if not user:
            logger.error(f"Cannot fulfill subscription. User {user_id} not found.")
            return
        user.subscription_plan = plan.value
        user.subscription_expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=31)
        await db.commit()
        await db.refresh(user)
        logger.info(f"Subscription for user {user.id} upgraded to {plan.value}.")
        await websocket_manager.send_personal_message(
            {"type": "subscription_update", "profile": UserSchema.from_orm(user).model_dump()}, user.id)


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
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)
    # uvicorn main:app --reload
    #uvicorn main:app --port 8000
    #venv\Scripts\activate
