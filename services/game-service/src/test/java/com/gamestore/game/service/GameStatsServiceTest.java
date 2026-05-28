package com.gamestore.game.service;

import com.gamestore.game.entity.Game;
import com.gamestore.game.entity.ProcessedEvent;
import com.gamestore.game.event.PurchaseCreatedEvent;
import com.gamestore.game.repository.GameRepository;
import com.gamestore.game.repository.ProcessedEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DisplayName("GameStatsService Tests")
class GameStatsServiceTest {

    @Mock
    private GameRepository gameRepository;

    @Mock
    private ProcessedEventRepository processedEventRepository;

    @InjectMocks
    private GameStatsService gameStatsService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    @DisplayName("Should increment purchase count when event is first processed")
    void testHandlePurchaseCreatedEvent_FirstTime() {
        // Arrange
        String gameId = "game123";
        String purchaseId = "purchase456";
        String userId = "user789";
        String idempotencyKey = "idem-key-001";

        Game game = new Game();
        game.setId(gameId);
        game.setTitle("Test Game");
        game.setTotalPurchases(5L);
        game.setTotalDownloads(10L);

        PurchaseCreatedEvent event = new PurchaseCreatedEvent();
        event.setEventId("event001");
        event.setPurchaseId(purchaseId);
        event.setGameId(gameId);
        event.setUserId(userId);
        event.setIdempotencyKey(idempotencyKey);
        event.setTimestamp(Instant.now());

        when(processedEventRepository.findByIdempotencyKey(idempotencyKey))
                .thenReturn(Optional.empty());
        when(gameRepository.findById(gameId))
                .thenReturn(Optional.of(game));
        when(gameRepository.save(any(Game.class)))
                .thenReturn(game);
        when(processedEventRepository.save(any(ProcessedEvent.class)))
                .thenReturn(new ProcessedEvent());

        // Act
        gameStatsService.handlePurchaseCreatedEvent(event);

        // Assert
        verify(gameRepository, times(1)).findById(gameId);
        verify(gameRepository, times(1)).save(argThat(g -> g.getTotalPurchases() == 6L));
        verify(processedEventRepository, times(1)).save(any(ProcessedEvent.class));
    }

    @Test
    @DisplayName("Should not increment purchase count for duplicate events (idempotency)")
    void testHandlePurchaseCreatedEvent_Duplicate() {
        // Arrange
        String gameId = "game123";
        String purchaseId = "purchase456";
        String userId = "user789";
        String idempotencyKey = "idem-key-002";

        PurchaseCreatedEvent event = new PurchaseCreatedEvent();
        event.setEventId("event002");
        event.setPurchaseId(purchaseId);
        event.setGameId(gameId);
        event.setUserId(userId);
        event.setIdempotencyKey(idempotencyKey);
        event.setTimestamp(Instant.now());

        ProcessedEvent alreadyProcessed = new ProcessedEvent();
        alreadyProcessed.setIdempotencyKey(idempotencyKey);

        when(processedEventRepository.findByIdempotencyKey(idempotencyKey))
                .thenReturn(Optional.of(alreadyProcessed));

        // Act
        gameStatsService.handlePurchaseCreatedEvent(event);

        // Assert
        verify(gameRepository, never()).findById(anyString());
        verify(gameRepository, never()).save(any(Game.class));
        verify(processedEventRepository, never()).save(any(ProcessedEvent.class));
    }

    @Test
    @DisplayName("Should handle case where game is not found")
    void testHandlePurchaseCreatedEvent_GameNotFound() {
        // Arrange
        String gameId = "nonexistent-game";
        String purchaseId = "purchase456";
        String userId = "user789";
        String idempotencyKey = "idem-key-003";

        PurchaseCreatedEvent event = new PurchaseCreatedEvent();
        event.setEventId("event003");
        event.setPurchaseId(purchaseId);
        event.setGameId(gameId);
        event.setUserId(userId);
        event.setIdempotencyKey(idempotencyKey);
        event.setTimestamp(Instant.now());

        when(processedEventRepository.findByIdempotencyKey(idempotencyKey))
                .thenReturn(Optional.empty());
        when(gameRepository.findById(gameId))
                .thenReturn(Optional.empty());

        // Act
        gameStatsService.handlePurchaseCreatedEvent(event);

        // Assert
        verify(gameRepository, times(1)).findById(gameId);
        verify(gameRepository, never()).save(any(Game.class));
        verify(processedEventRepository, never()).save(any(ProcessedEvent.class));
    }

    @Test
    @DisplayName("Should initialize purchase count to 0 if null")
    void testHandlePurchaseCreatedEvent_NullPurchaseCount() {
        // Arrange
        String gameId = "game123";
        String purchaseId = "purchase456";
        String userId = "user789";
        String idempotencyKey = "idem-key-004";

        Game game = new Game();
        game.setId(gameId);
        game.setTitle("Test Game");
        game.setTotalPurchases(null);  // null purchase count
        game.setTotalDownloads(5L);

        PurchaseCreatedEvent event = new PurchaseCreatedEvent();
        event.setEventId("event004");
        event.setPurchaseId(purchaseId);
        event.setGameId(gameId);
        event.setUserId(userId);
        event.setIdempotencyKey(idempotencyKey);
        event.setTimestamp(Instant.now());

        when(processedEventRepository.findByIdempotencyKey(idempotencyKey))
                .thenReturn(Optional.empty());
        when(gameRepository.findById(gameId))
                .thenReturn(Optional.of(game));
        when(gameRepository.save(any(Game.class)))
                .thenReturn(game);
        when(processedEventRepository.save(any(ProcessedEvent.class)))
                .thenReturn(new ProcessedEvent());

        // Act
        gameStatsService.handlePurchaseCreatedEvent(event);

        // Assert
        verify(gameRepository, times(1)).save(argThat(g -> g.getTotalPurchases() == 1L));
        verify(processedEventRepository, times(1)).save(any(ProcessedEvent.class));
    }

    @Test
    @DisplayName("Should retrieve purchase count for existing game")
    void testGetGamePurchaseCount_Success() {
        // Arrange
        String gameId = "game123";
        Game game = new Game();
        game.setId(gameId);
        game.setTotalPurchases(42L);

        when(gameRepository.findById(gameId))
                .thenReturn(Optional.of(game));

        // Act
        Long count = gameStatsService.getGamePurchaseCount(gameId);

        // Assert
        assertEquals(42L, count);
        verify(gameRepository, times(1)).findById(gameId);
    }

    @Test
    @DisplayName("Should return 0 when game not found or purchase count is null")
    void testGetGamePurchaseCount_NotFound() {
        // Arrange
        String gameId = "nonexistent-game";
        when(gameRepository.findById(gameId))
                .thenReturn(Optional.empty());

        // Act
        Long count = gameStatsService.getGamePurchaseCount(gameId);

        // Assert
        assertEquals(0L, count);
    }

    @Test
    @DisplayName("Should retrieve download count for existing game")
    void testGetGameDownloadCount_Success() {
        // Arrange
        String gameId = "game123";
        Game game = new Game();
        game.setId(gameId);
        game.setTotalDownloads(100L);

        when(gameRepository.findById(gameId))
                .thenReturn(Optional.of(game));

        // Act
        Long count = gameStatsService.getGameDownloadCount(gameId);

        // Assert
        assertEquals(100L, count);
        verify(gameRepository, times(1)).findById(gameId);
    }

    @Test
    @DisplayName("Should return 0 when game not found or download count is null")
    void testGetGameDownloadCount_NotFound() {
        // Arrange
        String gameId = "nonexistent-game";
        when(gameRepository.findById(gameId))
                .thenReturn(Optional.empty());

        // Act
        Long count = gameStatsService.getGameDownloadCount(gameId);

        // Assert
        assertEquals(0L, count);
    }
}
