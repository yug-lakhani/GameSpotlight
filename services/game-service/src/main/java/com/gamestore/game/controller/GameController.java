package com.gamestore.game.controller;

import com.gamestore.game.dto.GameDTO;
import com.gamestore.game.dto.PaginationDTO;
import com.gamestore.game.dto.ReviewRequest;
import com.gamestore.game.event.DownloadCreatedEvent;
import com.gamestore.game.security.AuthUtils;
import com.gamestore.game.service.GameService;
import com.gamestore.game.service.GameStatsService;
import com.gamestore.game.producer.DownloadEventProducer;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/games")
@RequiredArgsConstructor
public class GameController {

    private final GameService gameService;
    private final GameStatsService gameStatsService;
    private final AuthUtils authUtils;
    private final DownloadEventProducer downloadEventProducer;

    @GetMapping
    public ResponseEntity<List<GameDTO>> getAllGames() {
        return ResponseEntity.ok(gameService.getAllGames());
    }

    @GetMapping("/search")
    public ResponseEntity<List<GameDTO>> searchGames(
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String query) {
        String effectiveTitle = (title == null || title.isBlank()) ? query : title;
        return ResponseEntity.ok(gameService.searchGames(effectiveTitle));
    }

    @GetMapping("/semantic-search")
    public ResponseEntity<List<GameDTO>> semanticSearchGames(@RequestParam(required = false) String query) {
        return ResponseEntity.ok(gameService.semanticSearchGames(query));
    }

    @GetMapping("/suggestions")
    public ResponseEntity<Map<String, Object>> searchSuggestions(
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "8") int limit) {
        return ResponseEntity.ok(gameService.getSearchSuggestions(query, limit));
    }

    @GetMapping("/semantic-search/paginated")
    public ResponseEntity<PaginationDTO<GameDTO>> semanticSearchGamesPaginated(
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "1") int page) {
        return ResponseEntity.ok(gameService.semanticSearchGamesPaginated(query, page));
    }

    @GetMapping("/filter")
    public ResponseEntity<List<GameDTO>> filterGames(
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String genre,
            @RequestParam(required = false) Double minPrice,
            @RequestParam(required = false) Double maxPrice) {
        return ResponseEntity.ok(gameService.filterGames(title, genre, minPrice, maxPrice));
    }

    @GetMapping("/price")
    public ResponseEntity<List<GameDTO>> getGamesByPrice(
            @RequestParam(required = false) Double min,
            @RequestParam(required = false) Double max) {
        return ResponseEntity.ok(gameService.getGamesByPrice(min, max));
    }

    @GetMapping("/developer/{developer}")
    public ResponseEntity<List<GameDTO>> getGamesByDeveloper(@PathVariable String developer) {
        return ResponseEntity.ok(gameService.getGamesByDeveloper(developer));
    }

    @GetMapping("/{id:^(?!all$).+}")
    public ResponseEntity<GameDTO> getGameById(@PathVariable String id) {
        GameDTO game = gameService.getGameById(id);
        return game != null ? ResponseEntity.ok(game) : ResponseEntity.notFound().build();
    }

    @GetMapping("/{id}/similar")
    public ResponseEntity<List<GameDTO>> getSimilarGames(@PathVariable String id) {
        GameDTO game = gameService.getGameById(id);
        if (game == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(gameService.similarGames(id, 6));
    }

    @PostMapping("/{id}/reviews")
    public ResponseEntity<GameDTO> addReview(
            @PathVariable String id,
            @RequestBody ReviewRequest reviewRequest,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Integer rating = reviewRequest == null ? null : reviewRequest.getRating();
        String comment = reviewRequest == null ? null : reviewRequest.getComment();

        if (rating == null || rating < 1 || rating > 5) {
            return ResponseEntity.badRequest().build();
        }

        String username = authUtils.extractUsernameFromHeader(authorizationHeader);
        GameDTO updated = gameService.addReview(id, rating, comment, username);
        return updated != null ? ResponseEntity.ok(updated) : ResponseEntity.notFound().build();
    }

    @DeleteMapping("/{id}/reviews")
    public ResponseEntity<GameDTO> deleteReview(
            @PathVariable String id,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        String username = authUtils.extractUsernameFromHeader(authorizationHeader);
        GameDTO updated = gameService.deleteReview(id, username);
        return updated != null ? ResponseEntity.ok(updated) : ResponseEntity.notFound().build();
    }

    @GetMapping("/{id}/download-url")
    public ResponseEntity<Map<String, String>> getDownloadUrl(
            @PathVariable String id,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        GameDTO game = gameService.getGameById(id);
        if (game == null || game.getGameFileUrl() == null || game.getGameFileUrl().isBlank()) {
            return ResponseEntity.notFound().build();
        }
        try {
            String signedUrl = gameService.generateSignedDownloadUrl(game.getGameFileUrl());

            // Publish a download event asynchronously and update stats immediately.
            // The same idempotency key prevents the Kafka listener from double-counting later.
            try {
                String userId = authUtils.extractUsernameFromHeader(authorizationHeader);
                String downloadId = java.util.UUID.randomUUID().toString();
                if (userId == null) {
                    userId = "Anonymous";
                }
                try {
                    DownloadCreatedEvent event = downloadEventProducer.publishDownloadCreatedEvent(downloadId, userId, id);
                    if (event != null) {
                        gameStatsService.recordDownloadCreatedEvent(event);
                    }
                } catch (Exception ignored) {
                    // best-effort: do not block download on event publishing
                }
            } catch (Exception ignored) {}

            return ResponseEntity.ok(Map.of("url", signedUrl));
        } catch (Exception e) {
            System.err.println("⚠️ Failed to generate signed URL: " + e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", "Failed to generate download URL"));
        }
    }

    @GetMapping("/genre/{genre}")
    public ResponseEntity<List<GameDTO>> getGamesByGenre(@PathVariable String genre) {
        return ResponseEntity.ok(gameService.getGamesByGenre(genre));
    }

    @PostMapping
    public ResponseEntity<GameDTO> createGame(@RequestBody GameDTO gameDTO) {
        GameDTO created = gameService.createGame(gameDTO);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<GameDTO> updateGame(@PathVariable String id, @RequestBody GameDTO gameDTO) {
        GameDTO updated = gameService.updateGame(id, gameDTO);
        return updated != null ? ResponseEntity.ok(updated) : ResponseEntity.notFound().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteGame(@PathVariable String id) {
        gameService.deleteGame(id);
        return ResponseEntity.noContent().build();
    }

    // Game Stats Endpoints
    @GetMapping("/{id}/stats")
    public ResponseEntity<Map<String, Object>> getGameStats(@PathVariable String id) {
        GameDTO game = gameService.getGameById(id);
        if (game == null) {
            return ResponseEntity.notFound().build();
        }
        Long purchaseCount = gameStatsService.getGamePurchaseCount(id);
        Long downloadCount = gameStatsService.getGameDownloadCount(id);
        return ResponseEntity.ok(Map.of(
                "gameId", id,
                "title", game.getTitle(),
                "totalPurchases", purchaseCount,
                "totalDownloads", downloadCount
        ));
    }

    @GetMapping("/{id}/purchase-count")
    public ResponseEntity<Map<String, Long>> getGamePurchaseCount(@PathVariable String id) {
        return ResponseEntity.ok(Map.of("purchaseCount", gameStatsService.getGamePurchaseCount(id)));
    }

    @GetMapping("/{id}/download-count")
    public ResponseEntity<Map<String, Long>> getGameDownloadCount(@PathVariable String id) {
        return ResponseEntity.ok(Map.of("downloadCount", gameStatsService.getGameDownloadCount(id)));
    }

    // Paginated Endpoints (default page size: 100)
    @GetMapping("/paginated")
    public ResponseEntity<PaginationDTO<GameDTO>> getAllGamesPaginated(
            @RequestParam(defaultValue = "1") int page) {
        return ResponseEntity.ok(gameService.getAllGamesPaginated(page));
    }

    @GetMapping("/search/paginated")
    public ResponseEntity<PaginationDTO<GameDTO>> searchGamesPaginated(
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "1") int page) {
        String effectiveTitle = (title == null || title.isBlank()) ? query : title;
        return ResponseEntity.ok(gameService.searchGamesPaginated(effectiveTitle, page));
    }

    @GetMapping("/filter/paginated")
    public ResponseEntity<PaginationDTO<GameDTO>> filterGamesPaginated(
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String genre,
            @RequestParam(required = false) Double minPrice,
            @RequestParam(required = false) Double maxPrice,
            @RequestParam(defaultValue = "1") int page) {
        return ResponseEntity.ok(gameService.filterGamesPaginated(title, genre, minPrice, maxPrice, page));
    }

    @GetMapping("/price/paginated")
    public ResponseEntity<PaginationDTO<GameDTO>> getGamesByPricePaginated(
            @RequestParam(required = false) Double min,
            @RequestParam(required = false) Double max,
            @RequestParam(defaultValue = "1") int page) {
        return ResponseEntity.ok(gameService.getGamesByPricePaginated(min, max, page));
    }

    @GetMapping("/genre/{genre}/paginated")
    public ResponseEntity<PaginationDTO<GameDTO>> getGamesByGenrePaginated(
            @PathVariable String genre,
            @RequestParam(defaultValue = "1") int page) {
        return ResponseEntity.ok(gameService.getGamesByGenrePaginated(genre, page));
    }

}
