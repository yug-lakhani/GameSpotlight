package com.gamestore.game.repository;

import com.gamestore.game.entity.ProcessedEvent;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for tracking processed events to ensure idempotent event handling.
 */
@Repository
public interface ProcessedEventRepository extends MongoRepository<ProcessedEvent, String> {
    
    /**
     * Check if an event has already been processed by its idempotency key.
     *
     * @param idempotencyKey the idempotency key of the original request
     * @return Optional containing the ProcessedEvent if found
     */
    Optional<ProcessedEvent> findByIdempotencyKey(String idempotencyKey);
    
    /**
     * Find processed event by entity ID and event type.
     *
     * @param entityId the ID of the entity
     * @param eventType the type of event
     * @return Optional containing the ProcessedEvent if found
     */
    Optional<ProcessedEvent> findByEntityIdAndEventType(String entityId, String eventType);
}
