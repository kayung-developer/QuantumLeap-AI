# app/tasks.py

import asyncio
import itertools
from celery import Task
from celery.utils.log import get_task_logger

from celery_worker import celery_app


# --- A mechanism to get a clean asyncio event loop for each task ---
# This is a robust pattern for running async code within a synchronous Celery worker.
def get_async_loop():
    try:
        return asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.new_event_loop()


# --- Custom Base Task for Reusable Logic ---
# This allows us to share startup/shutdown logic for async tasks.
class AsyncDbTask(Task):
    abstract = True

    def __init__(self):
        super().__init__()
        # These will be initialized within the worker process
        self.strategy_analysis_service = None
        self.websocket_manager = None
        self.telegram_service = None

    def __call__(self, *args, **kwargs):
        # Lazy-initialize services inside the worker process when the task is called
        if self.strategy_analysis_service is None:
            from .main import strategy_analysis_service, websocket_manager, telegram_service
            self.strategy_analysis_service = strategy_analysis_service
            self.websocket_manager = websocket_manager
            self.telegram_service = telegram_service
        return super().__call__(*args, **kwargs)


logger = get_task_logger(__name__)


# ==============================================================================
# 1. LONG-RUNNING TASKS (Backtesting & Optimization)
# ==============================================================================

@celery_app.task(base=AsyncDbTask, name="app.tasks.run_single_backtest_task", bind=True)
def run_single_backtest_task(self, request_data: dict):
    """
    The Celery task for running a single, comprehensive backtest.
    Returns the full results dictionary upon completion.
    """
    from .main import SingleBacktestRequest  # Local import to avoid circular dependencies
    request = SingleBacktestRequest(**request_data)

    async def main():
        logger.info(
            f"Celery task {self.request.id} starting single backtest for {request.strategy_name} on {request.symbol}.")
        try:
            # Call the existing backtest service method, which is already async
            results = await self.strategy_analysis_service.backtest_strategy(
                strategy_name=request.strategy_name,
                params=request.params,
                symbol=request.symbol,
                exchange_name=request.exchange,
                start_date=request.start_date,
                end_date=request.end_date,
            )
            logger.info(f"Celery task {self.request.id} completed backtest successfully.")
            return results
        except Exception as e:
            logger.error(f"Backtest task {self.request.id} failed: {e}", exc_info=True)
            # Re-raise the exception to mark the task as FAILED in Celery
            raise

    return get_async_loop().run_until_complete(main())


@celery_app.task(base=AsyncDbTask, name="app.tasks.run_optimization_task", bind=True)
def run_optimization_task(self, user_id: str, request_data: dict):
    """
    The Celery task for running a full strategy parameter optimization.
    It provides real-time progress updates via WebSockets and updates its own state.
    """
    from .main import StrategyOptimizationRequest, OptimizationResult  # Local import

    task_id = self.request.id
    request = StrategyOptimizationRequest(**request_data)

    async def main():
        self.update_state(state='PROGRESS', meta={'progress': 0.0, 'status': 'Starting...'})

        param_names = request.parameter_ranges.keys()
        param_values = request.parameter_ranges.values()
        param_combinations = list(itertools.product(*param_values))
        total_runs = len(param_combinations)

        logger.info(
            f"Celery task {task_id} starting optimization for '{request.strategy_name}' with {total_runs} combinations.")

        completed_runs = 0
        results = []

        # We run backtests sequentially within the task to avoid overwhelming a single worker.
        # For massive-scale optimization, you would dispatch each backtest as its own sub-task.
        for combo in param_combinations:
            params = dict(zip(param_names, combo))
            try:
                metrics = await self.strategy_analysis_service.backtest_strategy(
                    strategy_name=request.strategy_name,
                    params=params,
                    symbol=request.symbol,
                    exchange_name=request.exchange,
                    start_date=request.start_date,
                    end_date=request.end_date,
                )
                results.append(OptimizationResult(params=params, metrics=metrics))
            except Exception as e:
                logger.warning(f"A single backtest run failed within optimization task {task_id}: {e}")

            completed_runs += 1
            progress = completed_runs / total_runs

            # --- Real-time Progress Update ---
            self.update_state(state='PROGRESS',
                              meta={'progress': progress, 'status': f'Running {completed_runs}/{total_runs}'})
            await self.websocket_manager.send_personal_message({
                "type": "optimization_progress",
                "task_id": task_id,
                "progress": progress
            }, user_id)

        # --- Finalize Task ---
        results.sort(key=lambda x: x.metrics.get('sharpe_ratio', -float('inf')), reverse=True)
        logger.info(f"Optimization task {task_id} completed successfully.")

        # The return value is automatically stored as the task's result
        return [r.model_dump(mode='json') for r in results]

    try:
        final_results = get_async_loop().run_until_complete(main())

        # --- Final WebSocket Notification ---
        get_async_loop().run_until_complete(
            self.websocket_manager.send_personal_message({
                "type": "optimization_complete",
                "task_id": task_id,
                "status": "COMPLETED",
                "results": final_results,
            }, user_id)
        )
        return final_results
    except Exception as e:
        logger.error(f"Optimization task {task_id} failed critically: {e}", exc_info=True)
        # Send a failure notification via WebSocket
        get_async_loop().run_until_complete(
            self.websocket_manager.send_personal_message({
                "type": "optimization_complete",
                "task_id": task_id,
                "status": "FAILED",
                "error": str(e),
            }, user_id)
        )
        # Re-raise to mark the Celery task as FAILED
        raise


# ==============================================================================
# 2. HIGH-PRIORITY TASKS (Notifications)
# ==============================================================================

@celery_app.task(base=AsyncDbTask, name="app.tasks.send_telegram_notification_task")
def send_telegram_notification_task(user_id: str, message: str):
    """Sends a formatted notification to a user via Telegram."""
    logger.info(f"Executing Telegram notification task for user {user_id}")

    async def main():
        await self.telegram_service.notify_user(user_id, message)

    get_async_loop().run_until_complete(main())


@celery_app.task(
    name="app.tasks.send_email_task",
    acks_late=True,
    # Automatically retry the task if it fails (e.g., SMTP server is temporarily down)
    autoretry_for=(Exception,),
    retry_kwargs={'max_retries': 3, 'countdown': 60}  # Retry 3 times, with a 60s delay
)
def send_email_task(recipient: str, subject: str, body: str):
    """
    A robust Celery task for sending emails. It uses the EmailService
    and includes automatic retries on failure.
    """
    # Import the service here, inside the task function.
    # This is a best practice in Celery to ensure the service is instantiated
    # within the worker process.
    from .main import email_service

    logger.info(f"Executing email task to {recipient} with subject '{subject}'")

    # Use the async event loop runner we defined
    get_async_loop().run_until_complete(
        email_service.send_email(recipient, subject, body)
    )