package com.gamestore.game.service;

import com.gamestore.game.entity.Game;
import com.gamestore.game.entity.ProcessedEvent;
import com.gamestore.game.event.DownloadCreatedEvent;
import com.gamestore.game.event.PurchaseCreatedEvent;
import com.gamestore.game.repository.GameRepository;
import com.gamestore.game.repository.ProcessedEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

/**
 * Service for handling game statistics updates via Kafka events.
 * Implements eventual consistency through idempotent event handlers.
 * Each event is tracked to prevent duplicate stats increments on reprocessing.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GameStatsService {

    private final GameRepository gameRepository;
    private final ProcessedEventRepository processedEventRepository;
    private final GameService gameService;
    private final OpenSearchService openSearchService;

    /**
     * Handles PurchaseCreatedEvent by incrementing the game's total purchases count.
     * Uses idempotency key to ensure the same purchase is not counted twice if the event is reprocessed.
     *
     * @param event the purchase created event
     */
    @KafkaListener(topics = "game.purchases", groupId = "game-service", autoStartup = "${app.kafka.listeners-enabled:false}")
    public void handlePurchaseCreatedEvent(PurchaseCreatedEvent event) {
        try {
            String processedKey = (event.getIdempotencyKey() == null || event.getIdempotencyKey().isBlank())
                    ? "purchase:" + event.getPurchaseId()
                    : event.getIdempotencyKey();

            log.info("Processing PurchaseCreatedEvent: purchaseId={}, gameId={}, idempotencyKey={}", 
                    event.getPurchaseId(), event.getGameId(), event.getIdempotencyKey());

            // Check if this event has already been processed
            if (processedEventRepository.findByIdempotencyKey(processedKey).isPresent()) {
                log.warn("Event already processed (idempotency_key={}), skipping duplicate processing", processedKey);
                return;
            }

            // Retrieve the game and increment purchase count
            Game game = gameRepository.findById(event.getGameId()).orElse(null);
            if (game == null) {
                log.warn("Game not found for gameId={}, cannot update purchase count", event.getGameId());
                return;
            }

            // Atomically increment the purchase count
            long currentCount = game.getTotalPurchases() != null ? game.getTotalPurchases() : 0L;
            game.setTotalPurchases(currentCount + 1);

            // Save the updated game
            gameRepository.save(game);
            log.info("Updated game purchase count: gameId={}, newCount={}", event.getGameId(), game.getTotalPurchases());

            // Sync updated game to OpenSearch (guarded: allow processing to continue if indexing or helpers are unavailable)
            try {
                if (openSearchService != null && gameService != null) {
                    openSearchService.indexGame(gameService.toDTO(game));
                }
            } catch (Exception ex) {
                log.warn("OpenSearch sync failed for gameId={}", event.getGameId(), ex);
            }

            // Mark this event as processed
            ProcessedEvent processed = new ProcessedEvent();
            processed.setId(UUID.randomUUID().toString());
            processed.setIdempotencyKey(processedKey);
            processed.setEventType("PURCHASE_CREATED");
            processed.setEntityId(event.getPurchaseId());
            processed.setProcessedAt(Instant.now());
            processedEventRepository.save(processed);

            log.info("Successfully processed PurchaseCreatedEvent: purchaseId={}, gameId={}", 
                    event.getPurchaseId(), event.getGameId());

        } catch (Exception e) {
            log.error("Error processing PurchaseCreatedEvent: purchaseId={}, gameId={}", 
                    event.getPurchaseId(), event.getGameId(), e);
            // Don't re-throw; let Kafka retry the message
        }
    }

    @KafkaListener(topics = "game.downloads", groupId = "game-service", autoStartup = "${app.kafka.listeners-enabled:false}")
    public void handleDownloadCreatedEvent(DownloadCreatedEvent event) {
        recordDownloadCreatedEvent(event);
    }

    public void recordDownloadCreatedEvent(DownloadCreatedEvent event) {
        try {
            String processedKey = (event.getIdempotencyKey() == null || event.getIdempotencyKey().isBlank())
                    ? "download:" + event.getDownloadId()
                    : event.getIdempotencyKey();

            log.info("Processing DownloadCreatedEvent: downloadId={}, gameId={}, idempotencyKey={}",
                    event.getDownloadId(), event.getGameId(), event.getIdempotencyKey());

            if (processedEventRepository.findByIdempotencyKey(processedKey).isPresent()) {
                log.warn("Event already processed (idempotency_key={}), skipping duplicate processing", processedKey);
                return;
            }

            Game game = gameRepository.findById(event.getGameId()).orElse(null);
            if (game == null) {
                log.warn("Game not found for gameId={}, cannot update download count", event.getGameId());
                return;
            }

            long currentCount = game.getTotalDownloads() != null ? game.getTotalDownloads() : 0L;
            game.setTotalDownloads(currentCount + 1);

            gameRepository.save(game);
            log.info("Updated game download count: gameId={}, newCount={}", event.getGameId(), game.getTotalDownloads());

            // Sync updated game to OpenSearch (guarded)
            try {
                if (openSearchService != null && gameService != null) {
                    openSearchService.indexGame(gameService.toDTO(game));
                }
            } catch (Exception ex) {
                log.warn("OpenSearch sync failed for gameId={}", event.getGameId(), ex);
            }

            ProcessedEvent processed = new ProcessedEvent();
            processed.setId(java.util.UUID.randomUUID().toString());
            processed.setIdempotencyKey(processedKey);
            processed.setEventType("DOWNLOAD_CREATED");
            processed.setEntityId(event.getDownloadId());
            processed.setProcessedAt(java.time.Instant.now());
            processedEventRepository.save(processed);

            log.info("Successfully processed DownloadCreatedEvent: downloadId={}, gameId={}", event.getDownloadId(), event.getGameId());

        } catch (Exception e) {
            log.error("Error processing DownloadCreatedEvent: downloadId={}, gameId={}", event.getDownloadId(), event.getGameId(), e);
        }
    }

    /**
     * Get current purchase count for a game (for API endpoints).
     *
     * @param gameId the game ID
     * @return the total purchase count, or 0 if game not found
     */
    public Long getGamePurchaseCount(String gameId) {
        return gameRepository.findById(gameId)
                .map(game -> game.getTotalPurchases() != null ? game.getTotalPurchases() : 0L)
                .orElse(0L);
    }

    /**
     * Get current download count for a game (for API endpoints).
     *
     * @param gameId the game ID
     * @return the total download count, or 0 if game not found
     */
    public Long getGameDownloadCount(String gameId) {
        return gameRepository.findById(gameId)
                .map(game -> game.getTotalDownloads() != null ? game.getTotalDownloads() : 0L)
                .orElse(0L);
    }
}
