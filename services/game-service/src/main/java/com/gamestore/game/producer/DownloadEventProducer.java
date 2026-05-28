package com.gamestore.game.producer;

import com.gamestore.game.event.DownloadCreatedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.Message;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class DownloadEventProducer {

    private final KafkaTemplate<String, DownloadCreatedEvent> kafkaTemplate;

    public DownloadCreatedEvent publishDownloadCreatedEvent(String downloadId, String userId, String gameId) {
        try {
            DownloadCreatedEvent event = new DownloadCreatedEvent();
            event.setEventId(UUID.randomUUID().toString());
            event.setDownloadId(downloadId);
            event.setUserId(userId);
            event.setGameId(gameId);
            event.setTimestamp(Instant.now());
            // Use the generated eventId as idempotency key so retries won't double-count
            event.setIdempotencyKey(event.getEventId());

            Message<DownloadCreatedEvent> message = MessageBuilder
                    .withPayload(event)
                    .setHeader(KafkaHeaders.TOPIC, "game.downloads")
                    .setHeader("kafka_messageKey", downloadId)
                    .build();

            kafkaTemplate.send(message).whenComplete((sendResult, ex) -> {
                if (ex != null) {
                    log.error("Failed to publish DownloadCreatedEvent for download ID: {}", downloadId, ex);
                } else {
                    log.info("Successfully published DownloadCreatedEvent for download ID: {}, offset: {}",
                            downloadId, sendResult.getRecordMetadata().offset());
                }
            });
            return event;
        } catch (Exception e) {
            log.error("Error publishing DownloadCreatedEvent for download ID: {}", downloadId, e);
            return null;
        }
    }
}
