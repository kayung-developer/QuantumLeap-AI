# backend/worker.py (NEW FILE)

import asyncio
import logging
from main import telegram_service  # Import the already configured service from main.py

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


async def main():
    """
    This is the entry point for the background worker.
    It initializes and runs the Telegram polling service indefinitely.
    """
    logger.info("Starting Telegram background worker...")
    await telegram_service.initialize_bot_info()
    telegram_service.setup_handlers()
    await telegram_service.run_polling()

    # Keep the worker alive
    while True:
        await asyncio.sleep(3600)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Telegram background worker stopped.")