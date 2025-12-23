#ifndef MINI_REDIS_H
#define MINI_REDIS_H

#include <stddef.h>
#include <stdint.h>

// ============================================================================
// Configuration
// ============================================================================
#define DEFAULT_PORT 6379
#define INITIAL_BUCKETS 64
#define LOAD_FACTOR_THRESHOLD 0.75
#define MAX_KEY_SIZE 256
#define MAX_VALUE_SIZE 4096
#define BUFFER_SIZE 8192

// ============================================================================
// Hash Table Entry
// ============================================================================
typedef struct HashEntry {
    char *key;
    char *value;
    size_t key_len;
    size_t value_len;
    struct HashEntry *next;  // Chaining for collision resolution
} HashEntry;

// ============================================================================
// Hash Table
// ============================================================================
typedef struct HashTable {
    HashEntry **buckets;
    size_t num_buckets;
    size_t num_entries;
    size_t memory_used;  // Track memory usage
} HashTable;

// ============================================================================
// Hash Table Functions
// ============================================================================

// Create a new hash table
HashTable *ht_create(size_t initial_buckets);

// Destroy hash table and free all memory
void ht_destroy(HashTable *ht);

// Insert or update a key-value pair
// Returns 0 on success, -1 on failure
int ht_set(HashTable *ht, const char *key, const char *value);

// Get value for a key
// Returns pointer to value or NULL if not found
const char *ht_get(HashTable *ht, const char *key);

// Delete a key
// Returns 0 if deleted, -1 if not found
int ht_delete(HashTable *ht, const char *key);

// Get statistics
void ht_stats(HashTable *ht, size_t *num_keys, size_t *memory_bytes);

// ============================================================================
// Server Functions
// ============================================================================

// Start the TCP server
int server_start(int port);

// Process a command and return response
// Caller must free the returned string
char *process_command(HashTable *ht, const char *command);

#endif // MINI_REDIS_H
