# Debian 12 minimal installation test environment
FROM debian:12

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install minimal required packages
# Note: install.sh should handle Node.js installation
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
