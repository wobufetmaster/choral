# WSL2 simulation (Ubuntu-based) installation test environment
FROM ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Simulate WSL2 environment characteristics
# WSL2 typically uses Ubuntu as base
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy repository code
COPY . .

# The test script will run ./install.sh
