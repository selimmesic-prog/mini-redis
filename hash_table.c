// ============================================================================
// hash_table.c - Custom Hash Table Implementation for Mini-Redis
// ============================================================================

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "mini_redis.h"

// ============================================================================
// Hash Function (DJB2 by Dan Bernstein)
// ============================================================================
static uint64_t hash_djb2(const char *str) {
    uint64_t hash = 5381;
    int c;
    
    while ((c = *str++)) {
        hash = ((hash << 5) + hash) + c;  // hash * 33 + c
    }
    
    return hash;
}

// ============================================================================
// Create a new hash entry
// ============================================================================
static HashEntry *entry_create(const char *key, const char *value) {
    HashEntry *entry = (HashEntry *)malloc(sizeof(HashEntry));
    if (!entry) {
        return NULL;
    }
    
    entry->key_len = strlen(key);
    entry->value_len = strlen(value);
    
    entry->key = (char *)malloc(entry->key_len + 1);
    if (!entry->key) {
        free(entry);
        return NULL;
    }
    
    entry->value = (char *)malloc(entry->value_len + 1);
    if (!entry->value) {
        free(entry->key);
        free(entry);
        return NULL;
    }
    
    strcpy(entry->key, key);
    strcpy(entry->value, value);
    entry->next = NULL;
    
    return entry;
}

// ============================================================================
// Free a hash entry
// ============================================================================
static void entry_destroy(HashEntry *entry) {
    if (entry) {
        free(entry->key);
        free(entry->value);
        free(entry);
    }
}

// ============================================================================
// Calculate memory used by an entry
// ============================================================================
static size_t entry_memory(HashEntry *entry) {
    if (!entry) return 0;
    return sizeof(HashEntry) + entry->key_len + 1 + entry->value_len + 1;
}

// ============================================================================
// Create Hash Table
// ============================================================================
HashTable *ht_create(size_t initial_buckets) {
    HashTable *ht = (HashTable *)malloc(sizeof(HashTable));
    if (!ht) {
        return NULL;
    }
    
    ht->num_buckets = initial_buckets > 0 ? initial_buckets : INITIAL_BUCKETS;
    ht->num_entries = 0;
    ht->memory_used = sizeof(HashTable);
    
    ht->buckets = (HashEntry **)calloc(ht->num_buckets, sizeof(HashEntry *));
    if (!ht->buckets) {
        free(ht);
        return NULL;
    }
    
    ht->memory_used += ht->num_buckets * sizeof(HashEntry *);
    
    return ht;
}

// ============================================================================
// Destroy Hash Table
// ============================================================================
void ht_destroy(HashTable *ht) {
    if (!ht) return;
    
    // Free all entries
    for (size_t i = 0; i < ht->num_buckets; i++) {
        HashEntry *entry = ht->buckets[i];
        while (entry) {
            HashEntry *next = entry->next;
            entry_destroy(entry);
            entry = next;
        }
    }
    
    free(ht->buckets);
    free(ht);
}

// ============================================================================
// Resize Hash Table (when load factor exceeded)
// ============================================================================
static int ht_resize(HashTable *ht) {
    size_t new_num_buckets = ht->num_buckets * 2;
    HashEntry **new_buckets = (HashEntry **)calloc(new_num_buckets, sizeof(HashEntry *));
    
    if (!new_buckets) {
        return -1;
    }
    
    // Rehash all entries
    for (size_t i = 0; i < ht->num_buckets; i++) {
        HashEntry *entry = ht->buckets[i];
        while (entry) {
            HashEntry *next = entry->next;
            
            // Calculate new bucket index
            size_t new_index = hash_djb2(entry->key) % new_num_buckets;
            
            // Insert at head of new bucket
            entry->next = new_buckets[new_index];
            new_buckets[new_index] = entry;
            
            entry = next;
        }
    }
    
    // Update memory accounting
    ht->memory_used -= ht->num_buckets * sizeof(HashEntry *);
    ht->memory_used += new_num_buckets * sizeof(HashEntry *);
    
    free(ht->buckets);
    ht->buckets = new_buckets;
    ht->num_buckets = new_num_buckets;
    
    return 0;
}

// ============================================================================
// Set Key-Value Pair
// ============================================================================
int ht_set(HashTable *ht, const char *key, const char *value) {
    if (!ht || !key || !value) {
        return -1;
    }
    
    // Validate key and value sizes
    if (strlen(key) > MAX_KEY_SIZE || strlen(value) > MAX_VALUE_SIZE) {
        return -1;
    }
    
    // Check load factor and resize if needed
    float load_factor = (float)ht->num_entries / (float)ht->num_buckets;
    if (load_factor > LOAD_FACTOR_THRESHOLD) {
        if (ht_resize(ht) != 0) {
            fprintf(stderr, "[WARN] Failed to resize hash table\n");
            // Continue anyway, performance may degrade
        }
    }
    
    size_t index = hash_djb2(key) % ht->num_buckets;
    
    // Check if key already exists
    HashEntry *entry = ht->buckets[index];
    while (entry) {
        if (strcmp(entry->key, key) == 0) {
            // Update existing value
            size_t old_mem = entry_memory(entry);
            
            char *new_value = (char *)malloc(strlen(value) + 1);
            if (!new_value) {
                return -1;
            }
            
            strcpy(new_value, value);
            free(entry->value);
            entry->value = new_value;
            entry->value_len = strlen(value);
            
            // Update memory accounting
            ht->memory_used -= old_mem;
            ht->memory_used += entry_memory(entry);
            
            return 0;
        }
        entry = entry->next;
    }
    
    // Create new entry
    HashEntry *new_entry = entry_create(key, value);
    if (!new_entry) {
        return -1;
    }
    
    // Insert at head of bucket (chaining)
    new_entry->next = ht->buckets[index];
    ht->buckets[index] = new_entry;
    
    ht->num_entries++;
    ht->memory_used += entry_memory(new_entry);
    
    return 0;
}

// ============================================================================
// Get Value by Key
// ============================================================================
const char *ht_get(HashTable *ht, const char *key) {
    if (!ht || !key) {
        return NULL;
    }
    
    size_t index = hash_djb2(key) % ht->num_buckets;
    
    HashEntry *entry = ht->buckets[index];
    while (entry) {
        if (strcmp(entry->key, key) == 0) {
            return entry->value;
        }
        entry = entry->next;
    }
    
    return NULL;
}

// ============================================================================
// Delete Key
// ============================================================================
int ht_delete(HashTable *ht, const char *key) {
    if (!ht || !key) {
        return -1;
    }
    
    size_t index = hash_djb2(key) % ht->num_buckets;
    
    HashEntry *entry = ht->buckets[index];
    HashEntry *prev = NULL;
    
    while (entry) {
        if (strcmp(entry->key, key) == 0) {
            // Found the entry
            if (prev) {
                prev->next = entry->next;
            } else {
                ht->buckets[index] = entry->next;
            }
            
            ht->memory_used -= entry_memory(entry);
            ht->num_entries--;
            entry_destroy(entry);
            
            return 0;
        }
        prev = entry;
        entry = entry->next;
    }
    
    return -1;  // Not found
}

// ============================================================================
// Get Statistics
// ============================================================================
void ht_stats(HashTable *ht, size_t *num_keys, size_t *memory_bytes) {
    if (!ht) {
        if (num_keys) *num_keys = 0;
        if (memory_bytes) *memory_bytes = 0;
        return;
    }
    
    if (num_keys) *num_keys = ht->num_entries;
    if (memory_bytes) *memory_bytes = ht->memory_used;
}
