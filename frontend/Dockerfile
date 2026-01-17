# Build stage
FROM node:20-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build argument for API URL (should NOT include /api - code adds it)
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine

# Create non-root user for nginx
RUN addgroup -S nginx-group && adduser -S nginx-user -G nginx-group

# Copy built assets with proper ownership
COPY --from=build --chown=nginx-user:nginx-group /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create necessary directories with proper permissions
RUN mkdir -p /var/cache/nginx /var/run && \
    chown -R nginx-user:nginx-group /var/cache/nginx /var/run /usr/share/nginx/html && \
    chmod -R 755 /var/cache/nginx /var/run

# Switch to non-root user (nginx will listen on 80 which requires root, so we use nginx user)
# Note: nginx:alpine already has nginx user, we just ensure proper permissions
USER nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
