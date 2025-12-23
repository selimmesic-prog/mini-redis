// ============================================================================
// server.c - TCP Server for Mini-Redis
// ============================================================================

#define _POSIX_C_SOURCE 200809L

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>
#include <signal.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <ctype.h>
#include <time.h>
#include <stdarg.h>
#include "mini_redis.h"

// Global hash table
static HashTable *g_hash_table = NULL;

// Server socket (for cleanup)
static int g_server_socket = -1;

// Running flag
static volatile int g_running = 1;

// ============================================================================
// Logging Utilities
// ============================================================================
static void log_timestamp(void) {
    time_t now = time(NULL);
    struct tm *tm_info = localtime(&now);
    char buffer[26];
    strftime(buffer, 26, "%Y-%m-%d %H:%M:%S", tm_info);
    printf("[%s] ", buffer);
}

static void log_info(const char *fmt, ...) {
    log_timestamp();
    printf("[INFO] ");
    va_list args;
    va_start(args, fmt);
    vprintf(fmt, args);
    va_end(args);
    printf("\n");
    fflush(stdout);
}

static void log_error(const char *fmt, ...) {
    log_timestamp();
    fprintf(stderr, "[ERROR] ");
    va_list args;
    va_start(args, fmt);
    vfprintf(stderr, fmt, args);
    va_end(args);
    fprintf(stderr, "\n");
    fflush(stderr);
}

static void log_debug(const char *fmt, ...) {
    log_timestamp();
    printf("[DEBUG] ");
    va_list args;
    va_start(args, fmt);
    vprintf(fmt, args);
    va_end(args);
    printf("\n");
    fflush(stdout);
}

// ============================================================================
// String Utilities
// ============================================================================
static char *trim_whitespace(char *str) {
    // Trim leading whitespace
    while (isspace((unsigned char)*str)) str++;
    
    if (*str == 0) return str;
    
    // Trim trailing whitespace
    char *end = str + strlen(str) - 1;
    while (end > str && isspace((unsigned char)*end)) end--;
    
    end[1] = '\0';
    return str;
}

static char *str_duplicate(const char *str) {
    if (!str) return NULL;
    size_t len = strlen(str) + 1;
    char *dup = (char *)malloc(len);
    if (dup) {
        memcpy(dup, str, len);
    }
    return dup;
}

// ============================================================================
// Parse Command - Extract tokens from command string
// Returns number of tokens parsed
// ============================================================================
static int parse_command(char *cmd, char **tokens, int max_tokens) {
    int count = 0;
    char *saveptr;
    char *token;
    
    // First token (command)
    token = strtok_r(cmd, " \t", &saveptr);
    while (token && count < max_tokens) {
        tokens[count++] = token;
        token = strtok_r(NULL, " \t", &saveptr);
    }
    
    return count;
}

// ============================================================================
// Process Command
// ============================================================================
char *process_command(HashTable *ht, const char *command) {
    if (!ht || !command) {
        return str_duplicate("ERROR: Invalid parameters");
    }
    
    // Make a copy of command for parsing (strtok modifies the string)
    char *cmd_copy = str_duplicate(command);
    if (!cmd_copy) {
        return str_duplicate("ERROR: Memory allocation failed");
    }
    
    // Trim whitespace
    char *trimmed = trim_whitespace(cmd_copy);
    
    // Handle empty command
    if (strlen(trimmed) == 0) {
        free(cmd_copy);
        return str_duplicate("ERROR: Empty command");
    }
    
    // Parse command into tokens
    char *tokens[10];
    int num_tokens = parse_command(trimmed, tokens, 10);
    
    if (num_tokens == 0) {
        free(cmd_copy);
        return str_duplicate("ERROR: Empty command");
    }
    
    // Convert command to uppercase for case-insensitive matching
    for (char *p = tokens[0]; *p; ++p) {
        *p = toupper((unsigned char)*p);
    }
    
    char *response = NULL;
    
    // ========================================================================
    // SET key value
    // ========================================================================
    if (strcmp(tokens[0], "SET") == 0) {
        if (num_tokens < 3) {
            response = str_duplicate("ERROR: SET requires key and value");
        } else {
            // Reconstruct value if it contains spaces
            // Find where the value starts in original command
            char *original_copy = str_duplicate(command);
            char *trimmed_orig = trim_whitespace(original_copy);
            
            // Skip "SET" and key
            char *p = trimmed_orig;
            while (*p && !isspace((unsigned char)*p)) p++;  // Skip SET
            while (*p && isspace((unsigned char)*p)) p++;   // Skip spaces
            while (*p && !isspace((unsigned char)*p)) p++;  // Skip key
            while (*p && isspace((unsigned char)*p)) p++;   // Skip spaces
            
            // p now points to the value
            if (*p) {
                if (ht_set(ht, tokens[1], p) == 0) {
                    response = str_duplicate("OK");
                    log_info("SET %s = %s", tokens[1], p);
                } else {
                    response = str_duplicate("ERROR: Failed to set value");
                }
            } else {
                response = str_duplicate("ERROR: SET requires a value");
            }
            
            free(original_copy);
        }
    }
    // ========================================================================
    // GET key
    // ========================================================================
    else if (strcmp(tokens[0], "GET") == 0) {
        if (num_tokens < 2) {
            response = str_duplicate("ERROR: GET requires a key");
        } else {
            const char *value = ht_get(ht, tokens[1]);
            if (value) {
                response = str_duplicate(value);
                log_info("GET %s -> %s", tokens[1], value);
            } else {
                response = str_duplicate("NULL");
                log_info("GET %s -> NULL", tokens[1]);
            }
        }
    }
    // ========================================================================
    // DEL key
    // ========================================================================
    else if (strcmp(tokens[0], "DEL") == 0) {
        if (num_tokens < 2) {
            response = str_duplicate("ERROR: DEL requires a key");
        } else {
            if (ht_delete(ht, tokens[1]) == 0) {
                response = str_duplicate("OK");
                log_info("DEL %s -> OK", tokens[1]);
            } else {
                response = str_duplicate("NOT FOUND");
                log_info("DEL %s -> NOT FOUND", tokens[1]);
            }
        }
    }
    // ========================================================================
    // STATS
    // ========================================================================
    else if (strcmp(tokens[0], "STATS") == 0) {
        size_t num_keys, memory_bytes;
        ht_stats(ht, &num_keys, &memory_bytes);
        
        // Format as JSON
        char buffer[256];
        snprintf(buffer, sizeof(buffer), 
                 "{\"keys\": %zu, \"memory_bytes\": %zu}", 
                 num_keys, memory_bytes);
        response = str_duplicate(buffer);
        log_info("STATS -> keys=%zu, memory=%zu bytes", num_keys, memory_bytes);
    }
    // ========================================================================
    // KEYS - List all keys (bonus command)
    // ========================================================================
    else if (strcmp(tokens[0], "KEYS") == 0) {
        // Build JSON array of keys
        size_t buffer_size = 4096;
        char *buffer = (char *)malloc(buffer_size);
        if (!buffer) {
            response = str_duplicate("ERROR: Memory allocation failed");
        } else {
            strcpy(buffer, "[");
            size_t pos = 1;
            int first = 1;
            
            for (size_t i = 0; i < ht->num_buckets; i++) {
                HashEntry *entry = ht->buckets[i];
                while (entry) {
                    // Check buffer space
                    size_t needed = strlen(entry->key) + 5;  // "key", 
                    if (pos + needed >= buffer_size - 2) {
                        buffer_size *= 2;
                        char *new_buffer = (char *)realloc(buffer, buffer_size);
                        if (!new_buffer) {
                            free(buffer);
                            buffer = NULL;
                            break;
                        }
                        buffer = new_buffer;
                    }
                    
                    if (!first) {
                        buffer[pos++] = ',';
                    }
                    first = 0;
                    
                    pos += snprintf(buffer + pos, buffer_size - pos, 
                                   "\"%s\"", entry->key);
                    
                    entry = entry->next;
                }
                if (!buffer) break;
            }
            
            if (buffer) {
                buffer[pos++] = ']';
                buffer[pos] = '\0';
                response = buffer;
                log_info("KEYS -> %s", response);
            } else {
                response = str_duplicate("ERROR: Memory allocation failed");
            }
        }
    }
    // ========================================================================
    // PING - Health check
    // ========================================================================
    else if (strcmp(tokens[0], "PING") == 0) {
        response = str_duplicate("PONG");
        log_debug("PING -> PONG");
    }
    // ========================================================================
    // QUIT - Close connection
    // ========================================================================
    else if (strcmp(tokens[0], "QUIT") == 0) {
        response = str_duplicate("BYE");
    }
    // ========================================================================
    // Unknown command
    // ========================================================================
    else {
        char buffer[256];
        snprintf(buffer, sizeof(buffer), "ERROR: Unknown command '%s'", tokens[0]);
        response = str_duplicate(buffer);
        log_info("Unknown command: %s", tokens[0]);
    }
    
    free(cmd_copy);
    return response;
}

// ============================================================================
// Signal Handler
// ============================================================================
static void signal_handler(int sig) {
    if (sig == SIGINT || sig == SIGTERM) {
        log_info("Received signal %d, shutting down...", sig);
        g_running = 0;
        
        // Close server socket to unblock accept()
        if (g_server_socket >= 0) {
            close(g_server_socket);
            g_server_socket = -1;
        }
    }
}

// ============================================================================
// Handle Client Connection
// ============================================================================
static void handle_client(int client_socket, struct sockaddr_in *client_addr) {
    char buffer[BUFFER_SIZE];
    char client_ip[INET_ADDRSTRLEN];
    
    inet_ntop(AF_INET, &client_addr->sin_addr, client_ip, INET_ADDRSTRLEN);
    log_info("Client connected: %s:%d", client_ip, ntohs(client_addr->sin_port));
    
    while (g_running) {
        // Clear buffer
        memset(buffer, 0, BUFFER_SIZE);
        
        // Read from client with bounds checking
        ssize_t bytes_read = recv(client_socket, buffer, BUFFER_SIZE - 1, 0);
        
        if (bytes_read < 0) {
            if (errno == EINTR) continue;
            log_error("recv() failed: %s", strerror(errno));
            break;
        }
        
        if (bytes_read == 0) {
            log_info("Client disconnected: %s:%d", client_ip, ntohs(client_addr->sin_port));
            break;
        }
        
        // Null-terminate the buffer (already done by memset, but be explicit)
        buffer[bytes_read] = '\0';
        
        // Process command
        char *response = process_command(g_hash_table, buffer);
        
        if (response) {
            // Send response with newline
            size_t response_len = strlen(response);
            char *response_with_newline = (char *)malloc(response_len + 2);
            
            if (response_with_newline) {
                strcpy(response_with_newline, response);
                response_with_newline[response_len] = '\n';
                response_with_newline[response_len + 1] = '\0';
                
                ssize_t bytes_sent = send(client_socket, response_with_newline, 
                                          response_len + 1, 0);
                
                if (bytes_sent < 0) {
                    log_error("send() failed: %s", strerror(errno));
                }
                
                free(response_with_newline);
            }
            
            // Check if client wants to quit
            if (strcmp(response, "BYE") == 0) {
                free(response);
                break;
            }
            
            free(response);
        }
    }
    
    close(client_socket);
}

// ============================================================================
// Start Server
// ============================================================================
int server_start(int port) {
    struct sockaddr_in server_addr, client_addr;
    socklen_t client_len = sizeof(client_addr);
    
    // Create socket
    g_server_socket = socket(AF_INET, SOCK_STREAM, 0);
    if (g_server_socket < 0) {
        log_error("Failed to create socket: %s", strerror(errno));
        return -1;
    }
    
    // Set socket options (allow address reuse)
    int opt = 1;
    if (setsockopt(g_server_socket, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt)) < 0) {
        log_error("setsockopt() failed: %s", strerror(errno));
        close(g_server_socket);
        return -1;
    }
    
    // Configure server address
    memset(&server_addr, 0, sizeof(server_addr));
    server_addr.sin_family = AF_INET;
    server_addr.sin_addr.s_addr = INADDR_ANY;
    server_addr.sin_port = htons(port);
    
    // Bind socket
    if (bind(g_server_socket, (struct sockaddr *)&server_addr, sizeof(server_addr)) < 0) {
        log_error("bind() failed: %s", strerror(errno));
        close(g_server_socket);
        return -1;
    }
    
    // Listen for connections
    if (listen(g_server_socket, 10) < 0) {
        log_error("listen() failed: %s", strerror(errno));
        close(g_server_socket);
        return -1;
    }
    
    log_info("Mini-Redis server started on port %d", port);
    log_info("Listening for connections...");
    
    // Accept connections
    while (g_running) {
        int client_socket = accept(g_server_socket, 
                                   (struct sockaddr *)&client_addr, 
                                   &client_len);
        
        if (client_socket < 0) {
            if (errno == EINTR || !g_running) {
                break;
            }
            log_error("accept() failed: %s", strerror(errno));
            continue;
        }
        
        // Handle client (single-threaded for MVP)
        handle_client(client_socket, &client_addr);
    }
    
    // Cleanup
    if (g_server_socket >= 0) {
        close(g_server_socket);
        g_server_socket = -1;
    }
    
    return 0;
}

// ============================================================================
// Main
// ============================================================================
int main(int argc, char *argv[]) {
    int port = DEFAULT_PORT;
    
    // Parse command line arguments
    if (argc > 1) {
        port = atoi(argv[1]);
        if (port <= 0 || port > 65535) {
            fprintf(stderr, "Invalid port number: %s\n", argv[1]);
            fprintf(stderr, "Usage: %s [port]\n", argv[0]);
            return 1;
        }
    }
    
    // Set up signal handlers
    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);
    signal(SIGPIPE, SIG_IGN);  // Ignore broken pipe
    
    // Create hash table
    g_hash_table = ht_create(INITIAL_BUCKETS);
    if (!g_hash_table) {
        log_error("Failed to create hash table");
        return 1;
    }
    
    log_info("===========================================");
    log_info("  Mini-Redis - In-Memory Key-Value Store  ");
    log_info("===========================================");
    log_info("Hash table initialized with %d buckets", INITIAL_BUCKETS);
    
    // Start server
    int result = server_start(port);
    
    // Cleanup
    log_info("Shutting down...");
    ht_destroy(g_hash_table);
    g_hash_table = NULL;
    
    log_info("Goodbye!");
    
    return result;
}
