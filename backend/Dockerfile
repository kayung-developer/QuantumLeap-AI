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

# Copy the entire application code
COPY . .

# Expose the port for the web server
EXPOSE ${PORT:-8000}

# The CMD is now handled by the entrypoint script below, but this is a good fallback.
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]