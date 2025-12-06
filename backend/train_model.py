import MetaTrader5 as mt5
import pandas as pd
import numpy as np
import lightgbm as lgb
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, classification_report
import joblib
import os

# --- DEFINITIVE FIX: Import the necessary converter and type ---
import onnxmltools
from onnxmltools.convert.common.data_types import FloatTensorType

# ==============================================================================
# IMPORTANT: CONFIGURE YOUR MT5 CREDENTIALS HERE
# ==============================================================================
MT5_SERVER = "XMTrading-MT5 3"  # e.g., "XMGlobal-MT5-Demo"
MT5_LOGIN = 75394874  # Your MT5 account number
MT5_PASSWORD = "!0TzJpJd"  # Your MT5 main password


# ==============================================================================
# 1. DATA ACQUISITION
# ==============================================================================
def fetch_data(symbol="EURUSD", timeframe=mt5.TIMEFRAME_H1, num_bars=50000):
    """Fetches a large dataset from a pre-running MetaTrader 5 terminal."""
    print("--- Data Acquisition ---")
    print("Attempting to connect to a running MetaTrader 5 terminal...")

    if not mt5.initialize(login=MT5_LOGIN, server=MT5_SERVER, password=MT5_PASSWORD):
        print(f"MT5 initialize() failed, error code = {mt5.last_error()}")
        mt5.shutdown()
        return None

    account_info = mt5.account_info()
    if not account_info:
        print("Could not retrieve account info. Connection failed.")
        mt5.shutdown()
        return None

    print(f"MT5 connection successful to account {account_info.login} on {account_info.server}.")

    rates = mt5.copy_rates_from_pos(symbol, timeframe, 0, num_bars)
    mt5.shutdown()

    if rates is None or len(rates) == 0:
        print("No data received.")
        return None

    print(f"Successfully fetched {len(rates)} bars for {symbol}.")

    df = pd.DataFrame(rates)
    df['time'] = pd.to_datetime(df['time'], unit='s')
    return df


# ==============================================================================
# HELPER FUNCTIONS: TECHNICAL INDICATORS USING PANDAS
# ==============================================================================
def calculate_rsi(df: pd.DataFrame, length: int = 14) -> pd.DataFrame:
    """Calculates the Relative Strength Index (RSI) using pandas."""
    delta = df['close'].diff(1)
    gain = delta.where(delta > 0, 0)
    loss = -delta.where(delta < 0, 0)
    avg_gain = gain.ewm(com=length - 1, min_periods=length, adjust=False).mean()
    avg_loss = loss.ewm(com=length - 1, min_periods=length, adjust=False).mean()
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    df['feature_rsi'] = rsi
    return df


def calculate_atr(df: pd.DataFrame, length: int = 14) -> pd.DataFrame:
    """Calculates the Average True Range (ATR) using pandas."""
    high_low = df['high'] - df['low']
    high_close = np.abs(df['high'] - df['close'].shift(1))
    low_close = np.abs(df['low'] - df['close'].shift(1))
    tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    atr = tr.ewm(com=length - 1, min_periods=length, adjust=False).mean()
    df['feature_atr'] = atr
    return df


def calculate_bbands(df: pd.DataFrame, length: int = 20, std_dev: float = 2.0) -> pd.DataFrame:
    """Calculates Bollinger Bands (BBands) using pandas."""
    middle_band = df['close'].rolling(window=length).mean()
    rolling_std = df['close'].rolling(window=length).std()
    df[f'BBM_{length}_{std_dev}'] = middle_band
    df[f'BBU_{length}_{std_dev}'] = middle_band + (rolling_std * std_dev)
    df[f'BBL_{length}_{std_dev}'] = middle_band - (rolling_std * std_dev)
    return df


def calculate_macd(df: pd.DataFrame, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.DataFrame:
    """Calculates the Moving Average Convergence Divergence (MACD) using pandas."""
    ema_fast = df['close'].ewm(span=fast, adjust=False).mean()
    ema_slow = df['close'].ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    df[f'MACD_{fast}_{slow}_{signal}'] = macd_line
    df[f'MACDh_{fast}_{slow}_{signal}'] = histogram
    df[f'MACDs_{fast}_{slow}_{signal}'] = signal_line
    return df


# ==============================================================================
# 2. FEATURE ENGINEERING & 3. LABELING
# ==============================================================================
def create_features_and_labels(df: pd.DataFrame, look_forward: int = 5) -> (pd.DataFrame, list):
    """Engineers features, creates the target label, and returns the features list."""
    print("\n--- Feature Engineering & Labeling ---")

    df = calculate_rsi(df, length=14)
    df = calculate_atr(df, length=14)
    df = calculate_bbands(df, length=20, std_dev=2.0)
    df = calculate_macd(df, fast=12, slow=26, signal=9)

    df['feature_bb_width'] = (df['BBU_20_2.0'] - df['BBL_20_2.0']) / df['BBM_20_2.0']
    df['feature_atr_norm'] = df['feature_atr'] / df['close']

    future_price = df['close'].shift(-look_forward)
    df['target'] = np.where(future_price > df['close'], 1, 0)

    # --- THIS IS THE LIST OF FEATURES THAT MUST BE SAVED ---
    feature_cols = [
        'feature_rsi', 'feature_atr', 'feature_bb_width', 'feature_atr_norm',
        'MACD_12_26_9', 'MACDh_12_26_9', 'MACDs_12_26_9'
    ]
    # ----------------------------------------------------

    valid_feature_cols = [col for col in feature_cols if col in df.columns]
    final_cols = valid_feature_cols + ['target']

    processed_df = df[final_cols].dropna().reset_index(drop=True)
    print(f"Feature engineering complete. Dataset shape: {processed_df.shape}")

    # Return both the processed DataFrame and the list of feature names
    return processed_df, valid_feature_cols


# ==============================================================================
# MAIN TRAINING SCRIPT
# ==============================================================================
if __name__ == "__main__":

    raw_data = fetch_data()
    if raw_data is None:
        print("\nModel training aborted due to data fetching failure.")
        exit()

    processed_data, features_list = create_features_and_labels(raw_data)

    if processed_data.empty:
        print("\nProcessed data is empty after feature engineering. Cannot train model.")
        exit()

    X = processed_data.drop('target', axis=1)
    y = processed_data['target']

    print(f"\n--- Data Splitting ---")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    print(f"Data split: {len(X_train)} training samples, {len(X_test)} testing samples.")

    print("\n--- Data Preprocessing (Scaling) ---")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    print("\n--- Model Training ---")
    model = lgb.LGBMClassifier(
        objective='binary', random_state=42, n_estimators=250,
        learning_rate=0.05, num_leaves=31, max_depth=-1, n_jobs=-1
    )
    model.fit(X_train_scaled, y_train)

    print("\n--- Model Evaluation ---")
    preds = model.predict(X_test_scaled)
    print("\n--- Classification Report ---")
    print(classification_report(y_test, preds, target_names=['DOWN', 'UP']))
    print(f"Model Accuracy: {accuracy_score(y_test, preds):.4f}")

    print("\n--- Model Saving ---")
    os.makedirs("models", exist_ok=True)

    # Define paths for all three artifacts
    scaler_path = "models/scaler.pkl"
    onnx_path = "models/lgbm_signal_model.onnx"
    features_path = "models/features.pkl"

    # Save the scaler
    joblib.dump(scaler, scaler_path)
    print(f"Scaler saved to: {scaler_path}")

    # --- THIS IS THE ADDITION ---
    # Save the list of feature names. This is crucial for the live application.
    joblib.dump(features_list, features_path)
    print(f"Feature list saved to: {features_path}")
    # ----------------------------

    # Convert and save the ONNX model
    num_features = X_train.shape[1]
    initial_type = [('input', FloatTensorType([None, num_features]))]

    print("Converting LightGBM model to ONNX format...")
    onnx_model = onnxmltools.convert_lightgbm(
        model,
        initial_types=initial_type,
        target_opset=12
    )

    with open(onnx_path, "wb") as f:
        f.write(onnx_model.SerializeToString())
    print(f"ONNX model saved to: {onnx_path}")

    print("\n--- MODEL GENERATION COMPLETE ---")