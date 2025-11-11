# app/celery_worker.py

import os
from celery import Celery
from kombu import Queue
import logging

logger = logging.getLogger(__name__)

# --- Redis Configuration ---
# Get the Redis URL from environment variables. Default to localhost for local development.
# In production (e.g., on Render/Heroku), this will be a REDIS_URL from your provider.
# Using /1 instead of /0 separates the Celery broker from a potential cache DB.
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/1")

logger.info(f"Celery worker connecting to broker at: {REDIS_URL}")

# --- Define the Celery Application ---
# This instance is what your workers will run and what your FastAPI app will use to send tasks.
celery_app = Celery(
    "quantumleap_worker",
    broker=REDIS_URL,
    backend=REDIS_URL,  # Use Redis as the backend to store task results and states
    include=['tasks']  # Automatically discover tasks in the app.tasks module
)

# --- Production-Grade Configuration ---
celery_app.conf.update(
    # Ensure tasks are acknowledged only after they complete, preventing task loss on worker crash.
    task_acks_late=True,

    # Use a more robust serializer. 'json' is safe and universal.
    task_serializer='json',
    result_serializer='json',
    accept_content=['json'],

    # Set a default expiration for task results to prevent Redis from filling up.
    result_expires=3600,  # 1 hour

    # Use UTC for all timekeeping to ensure consistency across servers.
    timezone='UTC',
    enable_utc=True,

    # --- Task Queues for Prioritization ---
    # This setup allows us to separate long, heavy tasks from short, quick ones.
    task_queues=(
        Queue('high_priority', routing_key='high_priority'),  # For tasks like sending emails, notifications
        Queue('long_running', routing_key='long_running'),  # For backtests and optimizations
        Queue('default', routing_key='default'),  # For general-purpose tasks
    ),

    # --- Task Routing ---
    # This dictionary maps specific tasks to their designated queues.
    task_routes={
        'tasks.run_optimization_task': {
            'queue': 'long_running',
            'routing_key': 'long_running',
        },
        'tasks.run_single_backtest_task': {
            'queue': 'long_running',
            'routing_key': 'long_running',
        },
        'tasks.send_telegram_notification_task': {
            'queue': 'high_priority',
            'routing_key': 'high_priority',
        },
        'tasks.send_email_task': {
            'queue': 'high_priority',
            'routing_key': 'high_priority',
        },
        # Any task not explicitly routed will go to the 'default' queue.
        'tasks.*': {
            'queue': 'default',
            'routing_key': 'default'
        }
    },

    # --- Worker Configuration ---
    # Number of concurrent worker processes. CELERY_CONCURRENCY env var or CPU count.
    worker_concurrency=os.cpu_count(),

    # Max tasks per worker process before it's restarted. Prevents memory leaks.
    worker_max_tasks_per_child=100,
)


# Optional: Add a simple task to verify the worker is running
@celery_app.task(name="tasks.health_check")
def health_check():
    logger.info("Celery worker health check: OK")
    return {"status": "ok"}