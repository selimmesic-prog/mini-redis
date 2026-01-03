FROM gcc:latest

WORKDIR /app

# Copy source files
COPY . .

# Build the engine
RUN make clean && make

# Expose the Redis port
EXPOSE 6379

# Run the server
CMD ["./mini-redis", "6379"]
