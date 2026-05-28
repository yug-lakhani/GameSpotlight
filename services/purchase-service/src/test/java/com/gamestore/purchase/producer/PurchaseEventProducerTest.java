package com.gamestore.purchase.producer;

import com.gamestore.purchase.event.PurchaseCreatedEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.messaging.Message;

import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DisplayName("PurchaseEventProducer Tests")
class PurchaseEventProducerTest {

    @Mock
    private KafkaTemplate<String, PurchaseCreatedEvent> kafkaTemplate;

    @InjectMocks
    private PurchaseEventProducer purchaseEventProducer;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    @DisplayName("Should publish PurchaseCreatedEvent to Kafka topic")
    void testPublishPurchaseCreatedEvent() {
        // Arrange
        String purchaseId = "purchase123";
        String userId = "user456";
        String gameId = "game789";
        String idempotencyKey = "idem-key-001";

        CompletableFuture<Void> completedFuture = CompletableFuture.completedFuture(null);
        when(kafkaTemplate.send(any(Message.class)))
                .thenReturn(CompletableFuture.completedFuture(
                        new org.springframework.kafka.support.SendResult<>(
                                null,
                                new org.apache.kafka.clients.producer.RecordMetadata(
                                        new org.apache.kafka.common.TopicPartition("game.purchases", 0),
                                        0, 0, 1000L, 0, 0
                                )
                        )
                ));

        // Act
        purchaseEventProducer.publishPurchaseCreatedEvent(purchaseId, userId, gameId, idempotencyKey);

        // Assert
        ArgumentCaptor<Message> captor = ArgumentCaptor.forClass(Message.class);
        verify(kafkaTemplate, times(1)).send(captor.capture());

        Message<?> capturedMessage = captor.getValue();
        assertNotNull(capturedMessage);
        assertNotNull(capturedMessage.getPayload());
        assertTrue(capturedMessage.getPayload() instanceof PurchaseCreatedEvent);

        PurchaseCreatedEvent event = (PurchaseCreatedEvent) capturedMessage.getPayload();
        assertEquals(purchaseId, event.getPurchaseId());
        assertEquals(userId, event.getUserId());
        assertEquals(gameId, event.getGameId());
        assertEquals(idempotencyKey, event.getIdempotencyKey());
        assertEquals("PURCHASE_CREATED", event.getEventType());
        assertNotNull(event.getEventId());
        assertNotNull(event.getTimestamp());
    }

    @Test
    @DisplayName("Should handle KafkaTemplate exceptions gracefully")
    void testPublishPurchaseCreatedEvent_Exception() {
        // Arrange
        String purchaseId = "purchase123";
        String userId = "user456";
        String gameId = "game789";
        String idempotencyKey = "idem-key-002";

        when(kafkaTemplate.send(any(Message.class)))
                .thenThrow(new RuntimeException("Kafka connection failed"));

        // Act & Assert
        assertDoesNotThrow(() -> purchaseEventProducer.publishPurchaseCreatedEvent(purchaseId, userId, gameId, idempotencyKey));
        verify(kafkaTemplate, times(1)).send(any(Message.class));
    }

    @Test
    @DisplayName("Should set correct Kafka headers in message")
    void testPublishPurchaseCreatedEvent_Headers() {
        // Arrange
        String purchaseId = "purchase123";
        String userId = "user456";
        String gameId = "game789";
        String idempotencyKey = "idem-key-003";

        when(kafkaTemplate.send(any(Message.class)))
                .thenReturn(CompletableFuture.completedFuture(
                        new org.springframework.kafka.support.SendResult<>(
                                null,
                                new org.apache.kafka.clients.producer.RecordMetadata(
                                        new org.apache.kafka.common.TopicPartition("game.purchases", 0),
                                        0, 0, 1000L, 0, 0
                                )
                        )
                ));

        // Act
        purchaseEventProducer.publishPurchaseCreatedEvent(purchaseId, userId, gameId, idempotencyKey);

        // Assert
        ArgumentCaptor<Message> captor = ArgumentCaptor.forClass(Message.class);
        verify(kafkaTemplate, times(1)).send(captor.capture());

        Message<?> capturedMessage = captor.getValue();
        assertEquals("game.purchases", capturedMessage.getHeaders().get(org.springframework.kafka.support.KafkaHeaders.TOPIC));
        assertEquals(purchaseId, capturedMessage.getHeaders().get("kafka_messageKey"));
    }
}
