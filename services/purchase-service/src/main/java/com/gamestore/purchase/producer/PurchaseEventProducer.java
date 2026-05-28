package com.gamestore.purchase.producer;

import com.gamestore.purchase.event.PurchaseCreatedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.Message;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

/**
 * Kafka producer for publishing purchase-related events.
 * Events are published to enable eventual consistency across services.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PurchaseEventProducer {

    private final KafkaTemplate<String, PurchaseCreatedEvent> kafkaTemplate;

    /**
     * Publishes a PurchaseCreatedEvent to Kafka.
     * Uses the purchase ID as the message key to maintain ordering within a partition.
     *
     * @param purchaseId the ID of the newly created purchase
     * @param userId the ID of the user who made the purchase
     * @param gameId the ID of the game that was purchased
     * @param idempotencyKey the idempotency key used for the purchase request
     */
    public void publishPurchaseCreatedEvent(String purchaseId, String userId, String gameId, String idempotencyKey) {
        try {
            PurchaseCreatedEvent event = new PurchaseCreatedEvent();
            event.setEventId(UUID.randomUUID().toString());
            event.setPurchaseId(purchaseId);
            event.setUserId(userId);
            event.setGameId(gameId);
            event.setTimestamp(Instant.now());
            event.setIdempotencyKey(idempotencyKey);

            Message<PurchaseCreatedEvent> message = MessageBuilder
                    .withPayload(event)
                    .setHeader(KafkaHeaders.TOPIC, "game.purchases")
                    .setHeader("kafka_messageKey", purchaseId)
                    .build();

            kafkaTemplate.send(message).whenComplete((sendResult, ex) -> {
                if (ex != null) {
                    log.error("Failed to publish PurchaseCreatedEvent for purchase ID: {}", purchaseId, ex);
                } else {
                    log.info("Successfully published PurchaseCreatedEvent for purchase ID: {}, offset: {}",
                            purchaseId, sendResult.getRecordMetadata().offset());
                }
            });
        } catch (Exception e) {
            log.error("Error publishing PurchaseCreatedEvent for purchase ID: {}", purchaseId, e);
            // Don't re-throw; publishing failures should not block the purchase operation
            // The event will be missed, but the purchase will still be recorded in the DB
        }
    }
}
