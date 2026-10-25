FROM node:20-bullseye-slim

# Install Python, pip, ffmpeg, and curl
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp via pip
RUN pip3 install --no-cache-dir yt-dlp

# Set working directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install --production

# Bundle app source
COPY . .

# Create downloads folder
RUN mkdir -p downloads

# Set environment port
ENV PORT=3000
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
