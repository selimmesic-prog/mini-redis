# ============================================================================
# Mini-Redis C Engine Makefile
# ============================================================================

CC = gcc
CFLAGS = -Wall -Wextra -Werror -pedantic -std=c11 -O2
DEBUG_FLAGS = -g -DDEBUG -fsanitize=address
LDFLAGS = 

# Source files
SRCS = server.c hash_table.c
OBJS = $(SRCS:.c=.o)
TARGET = mini-redis

# Default target
all: $(TARGET)

# Link
$(TARGET): $(OBJS)
	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)

# Compile
%.o: %.c mini_redis.h
	$(CC) $(CFLAGS) -c -o $@ $<

# Debug build
debug: CFLAGS += $(DEBUG_FLAGS)
debug: clean all

# Clean
clean:
	rm -f $(OBJS) $(TARGET)

# Install (optional - copies to /usr/local/bin)
install: $(TARGET)
	cp $(TARGET) /usr/local/bin/

# Uninstall
uninstall:
	rm -f /usr/local/bin/$(TARGET)

# Run
run: $(TARGET)
	./$(TARGET)

# Test with netcat
test: $(TARGET)
	@echo "Starting server in background..."
	@./$(TARGET) &
	@sleep 1
	@echo "Testing commands..."
	@echo "PING" | nc localhost 6379
	@echo 'SET greeting "Hello, World!"' | nc localhost 6379
	@echo "GET greeting" | nc localhost 6379
	@echo "STATS" | nc localhost 6379
	@echo "KEYS" | nc localhost 6379
	@echo "DEL greeting" | nc localhost 6379
	@echo "GET greeting" | nc localhost 6379
	@echo "QUIT" | nc localhost 6379
	@pkill -f "./$(TARGET)" || true
	@echo "Tests complete!"

.PHONY: all clean debug install uninstall run test
