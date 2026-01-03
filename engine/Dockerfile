FROM gcc:latest

WORKDIR /app

# Copy source files
COPY . .

# Build the engine
RUN make clean && make

# Expose the port
EXPOSE 6379

# Run the server using PORT env var (Railway sets this)
CMD ["sh", "-c", "./mini-redis ${PORT:-6379}"]
