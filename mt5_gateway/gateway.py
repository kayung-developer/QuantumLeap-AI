# mt5_gateway/gateway.py
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Dict, Any, Optional

import MetaTrader5 as mt5
import uvicorn
from fastapi import FastAPI, Depends, HTTPException, Security
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from decimal import Decimal
import os
from dotenv import load_dotenv

# --- Load Configuration ---
load_dotenv()
API_KEY = os.getenv("API_KEY")
if not API_KEY:
    raise ValueError("API_KEY not found in .env file. The gateway cannot start securely.")

# --- Logging Configuration ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Pydantic Models for API Validation ---
class MT5Credentials(BaseModel):
    login: int
    password: str
    server: str

class TradeRequest(BaseModel):
    symbol: str
    action: str  # "buy" or "sell"
    volume: float
    sl_pips: int
    tp_pips: int

class HistoricalDataRequest(BaseModel):
    symbol: str
    timeframe: str
    start_date: str # ISO format string
    end_date: str   # ISO format string

# --- Security Dependency ---
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=True)

async def verify_api_key(key: str = Security(api_key_header)):
    """Verifies that the incoming request has the correct secret API key."""
    if key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid or missing API Key")

# --- The Core Gateway Service ---
class MT5GatewayService:
    def __init__(self):
        self._is_connected = False
        self._lock = asyncio.Lock()
        self._connection_info: Dict[str, Any] = {}
        logger.info("MT5 Gateway Service initialized.")

    async def _run_in_thread(self, func, *args, **kwargs):
        """Runs any blocking MT5 function in a separate thread."""
        return await asyncio.to_thread(func, *args, **kwargs)

    async def connect_and_login(self, creds: MT5Credentials) -> bool:
        async with self._lock:
            if self._is_connected:
                await self._run_in_thread(mt5.shutdown)
                self._is_connected = False
            
            def _connect():
                if not mt5.initialize():
                    logger.error(f"MT5 initialize() failed: {mt5.last_error()}")
                    mt5.shutdown()
                    return False
                if not mt5.login(login=creds.login, password=creds.password, server=creds.server):
                    logger.error(f"MT5 login failed for account {creds.login}: {mt5.last_error()}")
                    mt5.shutdown()
                    return False
                return True

            success = await self._run_in_thread(_connect)
            if success:
                self._is_connected = True
                self._connection_info = creds.model_dump()
                logger.info(f"MT5 Gateway successfully connected to account {creds.login}.")
            else:
                self._is_connected = False
                self._connection_info = {}
            return success

    async def shutdown(self):
        async with self._lock:
            if self._is_connected:
                await self._run_in_thread(mt5.shutdown)
                self._is_connected = False
                logger.info("MT5 Gateway connection has been shut down.")

    async def _ensure_connection(self):
        """Internal method to check and re-establish connection if lost."""
        if not self._is_connected or not await self._run_in_thread(mt5.terminal_info):
            logger.warning("MT5 connection lost or unresponsive. Attempting to reconnect...")
            if not self._connection_info:
                raise ConnectionError("MT5 Gateway has no credentials to use for reconnection.")
            
            creds = MT5Credentials(**self._connection_info)
            if not await self.connect_and_login(creds):
                raise ConnectionError("Failed to re-establish connection with the MT5 terminal.")

    async def get_account_summary(self) -> Optional[Dict[str, Any]]:
        if not self._is_connected: return None
        async with self._lock:
            if not self._is_connected: return None
            def _fetch():
                info = mt5.account_info()
                return info._asdict() if info else None
            return await self._run_in_thread(_fetch)

    async def fetch_historical_data(self, req: HistoricalDataRequest) -> Optional[list]:
        async with self._lock:
            await self._ensure_connection()
            def _fetch():
                timeframe_map = {
                    '1m': mt5.TIMEFRAME_M1, '5m': mt5.TIMEFRAME_M5, '15m': mt5.TIMEFRAME_M15,
                    '1h': mt5.TIMEFRAME_H1, '4h': mt5.TIMEFRAME_H4, '1d': mt5.TIMEFRAME_D1,
                }
                mt5_tf = timeframe_map.get(req.timeframe)
                if mt5_tf is None: raise ValueError("Unsupported timeframe")
                
                start_dt = datetime.datetime.fromisoformat(req.start_date)
                end_dt = datetime.datetime.fromisoformat(req.end_date)
                
                rates = mt5.copy_rates_range(req.symbol, mt5_tf, start_dt, end_dt)
                return rates.tolist() if rates is not None else None
            return await self._run_in_thread(_fetch)

    async def execute_trade(self, req: TradeRequest) -> Dict:
        async with self._lock:
            await self._ensure_connection()
            def _execute():
                symbol_info = mt5.symbol_info(req.symbol)
                if symbol_info is None: return {"status": "error", "message": "Symbol not found"}

                point, ask, bid = symbol_info.point, symbol_info.ask, symbol_info.bid
                trade_type = mt5.ORDER_TYPE_BUY if req.action.lower() == 'buy' else mt5.ORDER_TYPE_SELL
                price = ask if trade_type == mt5.ORDER_TYPE_BUY else bid
                
                sl = price - (req.sl_pips * point) if trade_type == mt5.ORDER_TYPE_BUY else price + (req.sl_pips * point)
                tp = price + (req.tp_pips * point) if trade_type == mt5.ORDER_TYPE_BUY else price - (req.tp_pips * point)

                order_request = {
                    "action": mt5.TRADE_ACTION_DEAL, "symbol": symbol_info.name, "volume": req.volume,
                    "type": trade_type, "price": price, "sl": sl, "tp": tp, "deviation": 20,
                    "magic": 234001, "comment": "QuantumLeap AI", "type_time": mt5.ORDER_TIME_GTC,
                    "type_filling": mt5.ORDER_FILLING_FOK,
                }
                result = mt5.order_send(order_request)
                if result and result.retcode == mt5.TRADE_RETCODE_DONE:
                    return {"status": "success", "order_id": result.order, "deal_id": result.deal, "price": result.price, "volume": result.volume}
                else:
                    return {"status": "error", "message": result.comment if result else "order_send() failed", "retcode": result.retcode if result else None}
            return await self._run_in_thread(_execute)

# --- FastAPI Application Setup ---
mt5_gateway_service = MT5GatewayService()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # This is where you could auto-connect on startup if desired
    yield
    # Graceful shutdown
    logger.info("Shutting down MT5 Gateway Service...")
    await mt5_gateway_service.shutdown()
    logger.info("Shutdown complete.")

app = FastAPI(title="QuantumLeap MT5 Gateway", lifespan=lifespan, dependencies=[Depends(verify_api_key)])

# --- API Endpoints ---
@app.post("/connect")
async def connect(creds: MT5Credentials):
    success = await mt5_gateway_service.connect_and_login(creds)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to connect to MT5.")
    return {"status": "success", "message": f"Connected to MT5 account {creds.login}."}

@app.post("/disconnect")
async def disconnect():
    await mt5_gateway_service.shutdown()
    return {"status": "success", "message": "Disconnected from MT5."}

@app.get("/account-summary")
async def get_account_summary():
    summary = await mt5_gateway_service.get_account_summary()
    if summary is None:
        raise HTTPException(status_code=503, detail="MT5 Gateway not connected.")
    return summary

@app.post("/execute-trade")
async def execute_trade(request: TradeRequest):
    try:
        result = await mt5_gateway_service.execute_trade(request)
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        return result
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))

@app.post("/historical-data")
async def get_historical_data(request: HistoricalDataRequest):
    try:
        data = await mt5_gateway_service.fetch_historical_data(request)
        if data is None:
            raise HTTPException(status_code=404, detail="No historical data found for the given parameters.")
        return data
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))

if __name__ == "__main__":
    # Run on a different port to avoid conflict with the main backend
    uvicorn.run(app, host="0.0.0.0", port=5557)