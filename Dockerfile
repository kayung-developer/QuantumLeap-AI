# Use a stable, slim Python runtime as the base image
FROM python:3.11-slim

# Set the working directory inside the container
WORKDIR /app

# Set environment variables for best practices
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install system dependencies, including supervisor
RUN apt-get update && apt-get install -y --no-install-recommends build-essential supervisor

# --- THIS IS THE CRITICAL FIX ---
# All COPY paths must now be prefixed with `backend/` because that's where the files
# are located relative to this Dockerfile in your Git repository.

# Copy the requirements file from the 'backend' subdirectory.
COPY backend/requirements.txt .

# Install all Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the supervisor configuration file from the 'backend' subdirectory.
COPY backend/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Copy the pre-downloaded NLTK data from the 'backend' subdirectory.
COPY backend/nltk_data/ /app/nltk_data/

# Copy the application code from the 'backend/app' subdirectory.
COPY backend/app/ /app/app/

# Expose the port the app will run on
EXPOSE ${PORT:-8000}

# The CMD to run supervisor. This does not need to change as it uses paths inside the container.
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
