# Use a stable, slim Python runtime
FROM python:3.11-slim

# Set the working directory inside the container
WORKDIR /app

# Set environment variables for best practices
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install system dependencies, including supervisor for process management
RUN apt-get update && apt-get install -y --no-install-recommends build-essential supervisor

# Copy the requirements file from the 'backend' subdirectory in the build context.
COPY backend/requirements.txt .

# Install all Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the supervisor configuration file from the 'backend' subdirectory.
COPY backend/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Copy the pre-downloaded NLTK data from the 'backend' subdirectory.
COPY backend/nltk_data/ /app/nltk_data/

# Copy the entire backend application code into the container.
COPY backend/ /app/

# Expose the port for the web server (read by supervisor)
EXPOSE ${PORT:-8000}

# The main command for the container is to run supervisor.
# It will start Gunicorn and the Celery worker based on the .conf file.
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
