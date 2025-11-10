# Use a stable, slim Python runtime
FROM python:3.11-slim

# Set the working directory
WORKDIR /app

# Set environment variables for best practices
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install system dependencies (supervisor and build tools)
RUN apt-get update && apt-get install -y --no-install-recommends build-essential supervisor

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the pre-downloaded NLTK data
COPY nltk_data/ /app/nltk_data/

# Copy the supervisor configuration file
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Copy the entire application code from the current directory
COPY . .

# Expose the port for the web server (read by supervisor)
EXPOSE ${PORT:-8000}

# The main command for the container is to run supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
