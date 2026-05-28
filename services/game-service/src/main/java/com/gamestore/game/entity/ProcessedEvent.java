package com.gamestore.game.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Tracks processed events to ensure idempotent event handling.
 * Prevents duplicate stats increments when events are reprocessed.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
@Document(collection = "processed_events")
public class ProcessedEvent {
    @Id
    private String id;
    
    // The idempotency key of the original request
    private String idempotencyKey;
    
    // The event type (e.g., PURCHASE_CREATED, DOWNLOAD_COMPLETED)
    private String eventType;
    
    // The entity ID (e.g., purchase ID, download ID)
    private String entityId;
    
    // When this event was processed
    private Instant processedAt;
}
