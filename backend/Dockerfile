# --- STAGE 1: The Builder Stage ---
# This stage installs all dependencies, including build-time tools,
# into a virtual environment.
FROM python:3.11-slim as builder

# Set the working directory
WORKDIR /app

# Set environment variables for best practices
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install system dependencies required for compiling some Python packages
RUN apt-get update && apt-get install -y --no-install-recommends build-essential

# Create and activate a virtual environment. This is a best practice
# for creating clean, isolated dependency sets.
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy and install Python requirements first to leverage Docker's layer caching.
# This step will only re-run if requirements.txt changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


# --- STAGE 2: The Final Production Image ---
# This stage creates the slim, final image that will be deployed.
FROM python:3.11-slim as final

# Set the working directory
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install only the necessary runtime system dependencies (supervisor).
# We don't need 'build-essential' in the final image.
RUN apt-get update && apt-get install -y --no-install-recommends supervisor

# Copy the virtual environment with all installed Python packages from the builder stage.
# This is much faster and cleaner than running `pip install` again.
COPY --from=builder /opt/venv /opt/venv

# Copy the supervisor configuration file into its required location.
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Copy the pre-downloaded NLTK data into the image.
COPY nltk_data/ /app/nltk_data/

# Copy the entire application code (main.py, tasks.py, etc.).
COPY . .

# Activate the virtual environment for all subsequent commands in the container.
ENV PATH="/opt/venv/bin:$PATH"

# Expose the port the app will run on. This is read by supervisord.conf via the
# %(ENV_PORT)s variable. AWS ECS will map this to the host.
EXPOSE 8000

# The main command for the container is to run supervisor.
# Supervisor will then read the .conf file and start both Gunicorn (for the web app)
# and the Celery worker process.
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
