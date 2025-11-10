# Use a stable, slim Python runtime
FROM python:3.11-slim

# Set the working directory
WORKDIR /app

# Set environment variables for best practices
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install system dependencies (e.g., for PostgreSQL client)
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev build-essential

# Copy requirements and install dependencies
COPY requirements.txt .
# Use a virtual environment inside the container for cleaner dependency management
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire application code
COPY . .

# Make the entrypoint script executable
COPY entrypoint.sh .
RUN chmod +x ./entrypoint.sh

# This entrypoint script will run when the container starts
ENTRYPOINT ["./entrypoint.sh"]
