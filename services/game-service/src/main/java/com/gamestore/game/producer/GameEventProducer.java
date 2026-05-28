package com.gamestore.game.producer;

import com.gamestore.game.event.GameCreatedEvent;
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
public class GameEventProducer {

    private final KafkaTemplate<String, GameCreatedEvent> kafkaTemplate;

    public void publishGameCreatedEvent(String gameId, String title, String developerUsername) {
        try {
            GameCreatedEvent event = new GameCreatedEvent();
            event.setEventId(UUID.randomUUID().toString());
            event.setGameId(gameId);
            event.setTitle(title);
            event.setDeveloperUsername(developerUsername);
            event.setTimestamp(Instant.now());

            Message<GameCreatedEvent> message = MessageBuilder
                    .withPayload(event)
                    .setHeader(KafkaHeaders.TOPIC, "game.created")
                    .setHeader("kafka_messageKey", gameId)
                    .build();

            kafkaTemplate.send(message).whenComplete((sendResult, ex) -> {
                if (ex != null) {
                    log.error("Failed to publish GameCreatedEvent for game ID: {}", gameId, ex);
                } else {
                    log.info("Successfully published GameCreatedEvent for game ID: {}, offset: {}",
                            gameId, sendResult.getRecordMetadata().offset());
                }
            });
        } catch (Exception e) {
            log.error("Error publishing GameCreatedEvent for game ID: {}", gameId, e);
            // Non-fatal: do not block game creation on event publishing
        }
    }
}
