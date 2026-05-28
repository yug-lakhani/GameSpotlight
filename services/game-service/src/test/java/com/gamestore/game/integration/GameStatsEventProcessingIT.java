package com.gamestore.game.integration;

import com.gamestore.game.entity.Game;
import com.gamestore.game.entity.ProcessedEvent;
import com.gamestore.game.event.PurchaseCreatedEvent;
import com.gamestore.game.repository.GameRepository;
import com.gamestore.game.repository.ProcessedEventRepository;
import com.gamestore.game.service.GameStatsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Game Stats Event Processing Integration Tests")
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class GameStatsEventProcessingIT {

    @Container
    static MongoDBContainer mongoContainer = new MongoDBContainer("mongo:7.0");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.data.mongodb.uri", mongoContainer::getReplicaSetUrl);
    }

    @Autowired
    private GameStatsService gameStatsService;

    @Autowired
    private GameRepository gameRepository;

    @Autowired
    private ProcessedEventRepository processedEventRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void setUp() {
        // Clear all collections before each test
        mongoTemplate.dropCollection("games");
        mongoTemplate.dropCollection("processed_events");
    }

    @Test
    @DisplayName("Should process purchase event and increment game purchase count")
    void testProcessPurchaseEventIncrementsPurchaseCount() {
        // Arrange
        String gameId = "game123";
        String purchaseId = "purchase456";
        String userId = "user789";
        String idempotencyKey = "idem-key-001";

        // Create game with initial stats
        Game game = new Game();
        game.setId(gameId);
        game.setTitle("Test Game");
        game.setTotalPurchases(10L);
        game.setTotalDownloads(50L);
        gameRepository.save(game);

        // Create purchase event
        PurchaseCreatedEvent event = new PurchaseCreatedEvent();
        event.setEventId("event001");
        event.setPurchaseId(purchaseId);
        event.setGameId(gameId);
        event.setUserId(userId);
        event.setIdempotencyKey(idempotencyKey);
        event.setTimestamp(Instant.now());

        // Act
        gameStatsService.handlePurchaseCreatedEvent(event);

        // Assert
        Optional<Game> updatedGame = gameRepository.findById(gameId);
        assertTrue(updatedGame.isPresent());
        assertEquals(11L, updatedGame.get().getTotalPurchases());
        assertEquals(50L, updatedGame.get().getTotalDownloads());

        // Verify processed event was recorded
        Optional<ProcessedEvent> processed = processedEventRepository.findByIdempotencyKey(idempotencyKey);
        assertTrue(processed.isPresent());
        assertEquals("PURCHASE_CREATED", processed.get().getEventType());
        assertEquals(purchaseId, processed.get().getEntityId());
    }

    @Test
    @DisplayName("Should not process duplicate events (idempotency check)")
    void testDuplicateEventNotProcessedTwice() {
        // Arrange
        String gameId = "game123";
        String purchaseId = "purchase456";
        String userId = "user789";
        String idempotencyKey = "idem-key-002";

        Game game = new Game();
        game.setId(gameId);
        game.setTitle("Test Game");
        game.setTotalPurchases(10L);
        gameRepository.save(game);

        PurchaseCreatedEvent event = new PurchaseCreatedEvent();
        event.setEventId("event002");
        event.setPurchaseId(purchaseId);
        event.setGameId(gameId);
        event.setUserId(userId);
        event.setIdempotencyKey(idempotencyKey);
        event.setTimestamp(Instant.now());

        // Act: Process event twice
        gameStatsService.handlePurchaseCreatedEvent(event);
        gameStatsService.handlePurchaseCreatedEvent(event);

        // Assert: Purchase count should only be incremented once
        Optional<Game> updatedGame = gameRepository.findById(gameId);
        assertTrue(updatedGame.isPresent());
        assertEquals(11L, updatedGame.get().getTotalPurchases());

        // Verify only one processed event record
        Optional<ProcessedEvent> processed = processedEventRepository.findByIdempotencyKey(idempotencyKey);
        assertTrue(processed.isPresent());
    }

    @Test
    @DisplayName("Should handle multiple purchases for same game atomically")
    void testMultiplePurchasesIncrementCorrectly() {
        // Arrange
        String gameId = "game123";
        Game game = new Game();
        game.setId(gameId);
        game.setTitle("Test Game");
        game.setTotalPurchases(0L);
        gameRepository.save(game);

        // Act: Process 5 purchase events
        for (int i = 0; i < 5; i++) {
            PurchaseCreatedEvent event = new PurchaseCreatedEvent();
            event.setEventId("event" + i);
            event.setPurchaseId("purchase" + i);
            event.setGameId(gameId);
            event.setUserId("user" + i);
            event.setIdempotencyKey("idem-key-" + i);
            event.setTimestamp(Instant.now());
            gameStatsService.handlePurchaseCreatedEvent(event);
        }

        // Assert
        Optional<Game> updatedGame = gameRepository.findById(gameId);
        assertTrue(updatedGame.isPresent());
        assertEquals(5L, updatedGame.get().getTotalPurchases());
    }

    @Test
    @DisplayName("Should retrieve correct purchase count via service method")
    void testGetGamePurchaseCount() {
        // Arrange
        String gameId = "game123";
        Game game = new Game();
        game.setId(gameId);
        game.setTotalPurchases(42L);
        gameRepository.save(game);

        // Act
        Long count = gameStatsService.getGamePurchaseCount(gameId);

        // Assert
        assertEquals(42L, count);
    }

    @Test
    @DisplayName("Should return 0 for non-existent game")
    void testGetGamePurchaseCountNonExistent() {
        // Act
        Long count = gameStatsService.getGamePurchaseCount("nonexistent-game");

        // Assert
        assertEquals(0L, count);
    }

    @Test
    @DisplayName("Should return 0 when purchase count is null")
    void testGetGamePurchaseCountNull() {
        // Arrange
        String gameId = "game123";
        Game game = new Game();
        game.setId(gameId);
        game.setTotalPurchases(null);
        gameRepository.save(game);

        // Act
        Long count = gameStatsService.getGamePurchaseCount(gameId);

        // Assert
        assertEquals(0L, count);
    }
}
