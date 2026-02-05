FROM docker.m.daocloud.io/library/node:20-alpine

# Install Python and Shell dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    bash \
    curl \
    && python3 -m venv /opt/venv

# Install Python packages for skills
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir \
    pypdf \
    reportlab \
    openpyxl \
    pandas \
    python-docx

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy proto files
COPY proto ./proto

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Create mount points
RUN mkdir -p /app/skills /app/data /app/logs

# Set ownership
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Expose ports
EXPOSE 50051 5271

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start application
CMD ["node", "dist/index.js"]
