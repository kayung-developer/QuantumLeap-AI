# Use an official, slim Python runtime as a parent image
FROM python:3.10-slim

# Set the working directory inside the container
WORKDIR /code

# Copy the dependencies file and install them efficiently
COPY ./requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# Copy the rest of your application's source code
COPY . /code/

# The command to run your application. Fly.io provides the port.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]