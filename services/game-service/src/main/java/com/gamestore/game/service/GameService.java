package com.gamestore.game.service;

import com.gamestore.game.dto.GameDTO;
import com.gamestore.game.dto.PaginationDTO;
import com.gamestore.game.dto.ReviewDTO;
import com.gamestore.game.entity.Game;
import com.gamestore.game.entity.Review;
import com.gamestore.game.repository.GameRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Caching;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.web.client.RestTemplate;
import lombok.extern.slf4j.Slf4j;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Slf4j
@Service
public class GameService {

    private static final String GAMES_CACHE = "games";
    private static final String GAMES_CACHE_KEY = "top100";

    private final GameRepository gameRepository;
    private final RestTemplate restTemplate;
    private final CacheManager cacheManager;
    private final OpenSearchService openSearchService;
    private final BrevoNotificationService brevoNotificationService;
    private final com.gamestore.game.producer.GameEventProducer gameEventProducer;
    
    @Value("${storage.service.url:http://localhost:8085/api}")
    private String storageServiceUrl;

    @Value("${opensearch.backfill-on-startup:false}")
    private boolean opensearchBackfillOnStartup;

    public GameService(GameRepository gameRepository, RestTemplate restTemplate, CacheManager cacheManager, OpenSearchService openSearchService, BrevoNotificationService brevoNotificationService, com.gamestore.game.producer.GameEventProducer gameEventProducer) {
        this.gameRepository = gameRepository;
        this.restTemplate = restTemplate;
        this.cacheManager = cacheManager;
        this.openSearchService = openSearchService;
        this.brevoNotificationService = brevoNotificationService;
        this.gameEventProducer = gameEventProducer;
    }

    public List<GameDTO> getAllGames() {
        Cache cache = cacheManager.getCache(GAMES_CACHE);
        try {
            if (cache != null) {
                Cache.ValueWrapper cachedValue = cache.get(GAMES_CACHE_KEY);
                if (cachedValue != null && cachedValue.get() instanceof List<?> cachedGames) {
                    System.out.println("[CACHE HIT] games::top100 retrieved from Redis Cloud");
                    @SuppressWarnings("unchecked")
                    List<GameDTO> result = (List<GameDTO>) cachedGames;
                    return result;
                }
            }
        } catch (RuntimeException ex) {
            System.err.println("[CACHE ERROR] games::top100 read failed, falling back to MongoDB: " + ex.getMessage());
        }

        System.out.println("[CACHE MISS] games::top100 not found in Redis Cloud, loading top 100 from MongoDB");
        List<GameDTO> games;
        try {
            games = gameRepository.findAll(PageRequest.of(0, 100, Sort.by(Sort.Direction.DESC, "createdAt"))).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
        } catch (RuntimeException ex) {
            System.err.println("[CACHE ERROR] games::top100 MongoDB read failed, returning empty list: " + ex.getMessage());
            games = new ArrayList<>();
        }

        try {
            if (cache != null) {
                cache.put(GAMES_CACHE_KEY, games);
            }
        } catch (RuntimeException ex) {
            System.err.println("[CACHE ERROR] games::top100 write failed, returning MongoDB data: " + ex.getMessage());
        }

        return games;
    }

    @Cacheable(value = "game", key = "#id", unless = "#result == null")
    public GameDTO getGameById(String id) {
        return gameRepository.findById(id)
            .map(this::toDTO)
            .orElse(null);
    }

    @Cacheable(value = "gamesByGenre", key = "#genre == null ? 'all' : #genre.toLowerCase()")
    public List<GameDTO> getGamesByGenre(String genre) {
        if (genre != null && !genre.isBlank() && openSearchService.isEnabled()) {
            OpenSearchService.SearchPage searchPage = openSearchService.searchGamesByGenre(genre, 100, 0);
            List<GameDTO> result = loadGamesByIds(searchPage.ids());
            if (!result.isEmpty() || searchPage.total() > 0) {
                return result;
            }
        }

        try {
            return gameRepository.findByGenre(genre).stream()
                    .map(this::toDTO)
                    .collect(Collectors.toList());
        } catch (RuntimeException ex) {
            System.err.println("[CACHE ERROR] gamesByGenre MongoDB read failed, returning empty list: " + ex.getMessage());
            return new ArrayList<>();
        }
    }

    @Cacheable(value = "gamesSearch", key = "#title == null ? 'all' : #title.toLowerCase()")
    public List<GameDTO> searchGames(String title) {
        if (title == null || title.isBlank()) {
            return getAllGames();
        }

        if (openSearchService.isEnabled()) {
            OpenSearchService.SearchPage searchPage = openSearchService.searchGamesByTitle(title, 100, 0);
            List<GameDTO> result = loadGamesByIds(searchPage.ids());
            if (!result.isEmpty() || searchPage.total() > 0) {
                return result;
            }
        }

        try {
            return gameRepository.findByTitleContainingIgnoreCase(title).stream()
                    .map(this::toDTO)
                    .collect(Collectors.toList());
        } catch (RuntimeException ex) {
            System.err.println("[CACHE ERROR] gamesSearch MongoDB read failed, returning empty list: " + ex.getMessage());
            return new ArrayList<>();
        }
    }

    @Cacheable(value = "gamesByDeveloper", key = "#developer == null ? 'all' : #developer.toLowerCase()")
    public List<GameDTO> getGamesByDeveloper(String developer) {
        if (developer == null || developer.isBlank()) {
            return new ArrayList<>();
        }

        if (openSearchService.isEnabled()) {
            OpenSearchService.SearchPage searchPage = openSearchService.searchGamesByDeveloper(developer, 100, 0);
            List<GameDTO> result = loadGamesByIds(searchPage.ids());
            if (!result.isEmpty() || searchPage.total() > 0) {
                return result;
            }
        }

        try {
            return gameRepository.findByDeveloperIgnoreCase(developer).stream()
                    .map(this::toDTO)
                    .collect(Collectors.toList());
        } catch (RuntimeException ex) {
            System.err.println("[CACHE ERROR] gamesByDeveloper MongoDB read failed, returning empty list: " + ex.getMessage());
            return new ArrayList<>();
        }
    }

    public List<GameDTO> semanticSearchGames(String query) {
        if (query == null || query.isBlank()) {
            return getAllGames();
        }

        log.debug("[SEMANTIC_SEARCH] Raw query='{}'", query);

        List<String> ids = openSearchService.searchGameIds(query, 25);
        if (!ids.isEmpty()) {
            List<GameDTO> ordered = new ArrayList<>();
            for (String id : ids) {
                GameDTO game = getGameById(id);
                if (game != null) {
                    ordered.add(game);
                }
            }
            if (!ordered.isEmpty()) {
                return ordered;
            }
        }

        return List.of();
    }

    public Map<String, Object> getSearchSuggestions(String query, int limit) {
        return openSearchService.searchSuggestions(query, limit);
    }

    @Cacheable(value = "similarGames", key = "#gameId + ':' + #limit")
    public List<GameDTO> similarGames(String gameId, int limit) {
        GameDTO baseGame = getGameById(gameId);
        if (baseGame == null) {
            return List.of();
        }

        try {
            List<String> ids = openSearchService.similarGameIds(baseGame, limit);
            if (!ids.isEmpty()) {
                List<GameDTO> ordered = new ArrayList<>();
                for (String id : ids) {
                    if (gameId.equals(id)) {
                        continue;
                    }
                    GameDTO game = getGameById(id);
                    if (game != null) {
                        ordered.add(game);
                    }
                }
                if (!ordered.isEmpty()) {
                    return ordered;
                }
            }
        } catch (RuntimeException ex) {
            System.err.println("[CACHE ERROR] similarGames OpenSearch lookup failed, returning empty list: " + ex.getMessage());
        }

        return List.of();
    }

    @Cacheable(value = "gamesFilter", key = "(#title == null ? 'all' : #title.toLowerCase()) + '|' + (#genre == null ? 'all' : #genre.toLowerCase()) + '|' + (#minPrice == null ? 'min' : #minPrice) + '|' + (#maxPrice == null ? 'max' : #maxPrice)")
    public List<GameDTO> filterGames(String title, String genre, Double minPrice, Double maxPrice) {
        if (openSearchService.isEnabled()) {
            OpenSearchService.SearchPage searchPage = openSearchService.searchGamesByFilter(title, genre, minPrice, maxPrice, 500, 0);
            List<GameDTO> result = loadGamesByIds(searchPage.ids());
            if (!result.isEmpty() || searchPage.total() > 0) {
                return result;
            }
        }

        try {
            return gameRepository.findAll().stream()
                    .filter(game -> title == null || title.isBlank() || containsIgnoreCase(game.getTitle(), title))
                    .filter(game -> genre == null || genre.isBlank() || equalsIgnoreCase(game.getGenre(), genre))
                    .filter(game -> minPrice == null || game.getPrice() == null || game.getPrice() >= minPrice)
                    .filter(game -> maxPrice == null || game.getPrice() == null || game.getPrice() <= maxPrice)
                    .sorted(Comparator.comparing(Game::getTitle, Comparator.nullsLast(String::compareToIgnoreCase)))
                    .map(this::toDTO)
                    .collect(Collectors.toList());
        } catch (RuntimeException ex) {
            System.err.println("[CACHE ERROR] gamesFilter MongoDB read failed, returning empty list: " + ex.getMessage());
            return new ArrayList<>();
        }
    }

    @Cacheable(value = "gamesByPrice", key = "(#minPrice == null ? 'min' : #minPrice) + '|' + (#maxPrice == null ? 'max' : #maxPrice)")
    public List<GameDTO> getGamesByPrice(Double minPrice, Double maxPrice) {
        return filterGames(null, null, minPrice, maxPrice);
    }

    @Caching(evict = {
        @CacheEvict(value = "games", allEntries = true),
        @CacheEvict(value = "game", key = "#id"),
        @CacheEvict(value = "gamesByGenre", allEntries = true),
        @CacheEvict(value = "gamesSearch", allEntries = true),
        @CacheEvict(value = "gamesFilter", allEntries = true),
        @CacheEvict(value = "gamesByPrice", allEntries = true)
    })
    public GameDTO addReview(String id, Integer rating, String comment, String username) {
        return gameRepository.findById(id).map(game -> {
            if (game.getReviews() == null) {
                game.setReviews(new ArrayList<>());
            }
            String reviewerName = normalizeReviewerName(username);
            Review review = new Review(reviewerName, rating, comment, Instant.now());
            int existingIndex = findReviewIndex(game.getReviews(), reviewerName);
            if (existingIndex >= 0) {
                game.getReviews().set(existingIndex, review);
            } else {
                game.getReviews().add(review);
            }
            Game saved = gameRepository.save(game);
            return toDTO(saved);
        }).orElse(null);
    }

    @Caching(evict = {
        @CacheEvict(value = "games", allEntries = true),
        @CacheEvict(value = "game", key = "#id"),
        @CacheEvict(value = "gamesByGenre", allEntries = true),
        @CacheEvict(value = "gamesSearch", allEntries = true),
        @CacheEvict(value = "gamesFilter", allEntries = true),
        @CacheEvict(value = "gamesByPrice", allEntries = true)
    })
    public GameDTO deleteReview(String id, String username) {
        return gameRepository.findById(id).map(game -> {
            if (game.getReviews() == null || game.getReviews().isEmpty()) {
                return toDTO(game);
            }
            String reviewerName = normalizeReviewerName(username);
            int existingIndex = findReviewIndex(game.getReviews(), reviewerName);
            if (existingIndex >= 0) {
                game.getReviews().remove(existingIndex);
                Game saved = gameRepository.save(game);
                return toDTO(saved);
            }
            return toDTO(game);
        }).orElse(null);
    }

    @Caching(evict = {
        @CacheEvict(value = "games", allEntries = true),
        @CacheEvict(value = "gamesByGenre", allEntries = true),
        @CacheEvict(value = "gamesSearch", allEntries = true),
        @CacheEvict(value = "gamesFilter", allEntries = true),
        @CacheEvict(value = "gamesByPrice", allEntries = true),
        @CacheEvict(value = "semanticSearch", allEntries = true),
        @CacheEvict(value = "similarGames", allEntries = true)
    })
    public GameDTO createGame(GameDTO dto) {
        log.info("[CACHE_EVICT] Creating game: '{}'", dto.getTitle());
        Game game = new Game();
        game.setTitle(dto.getTitle());
        game.setDescription(dto.getDescription());
        game.setGenre(dto.getGenre());
        game.setPrice(dto.getPrice());
        game.setDeveloper(dto.getDeveloper());
        game.setImageUrl(dto.getImageUrl());
        game.setGameFileUrl(dto.getGameFileUrl());
        game.setGalleryImageUrls(dto.getGalleryImageUrls());
        game.setSizeInBytes(dto.getSizeInBytes());
        game.setVersion(dto.getVersion());
        game.setPlatform(dto.getPlatform());
        game.setAgeRating(dto.getAgeRating());
        game.setSystemRequirements(dto.getSystemRequirements());
        game.setReleaseDate(dto.getReleaseDate());
        Game saved = gameRepository.save(game);
        evictGameListCaches();
        GameDTO savedDto = toDTO(saved);
        syncGameToOpenSearch(savedDto);
        // publish event for async notification delivery
        try {
            gameEventProducer.publishGameCreatedEvent(savedDto.getId(), savedDto.getTitle(), savedDto.getDeveloper());
        } catch (Exception e) {
            log.error("Failed to publish GameCreatedEvent for game id={}: {}", savedDto.getId(), e.getMessage(), e);
        }
        log.info("[CACHE_EVICT] Game created and all semantic/search caches evicted");
        return savedDto;
    }

    @Caching(evict = {
        @org.springframework.cache.annotation.CacheEvict(value = "games", allEntries = true),
        @org.springframework.cache.annotation.CacheEvict(value = "game", key = "#id"),
        @org.springframework.cache.annotation.CacheEvict(value = "gamesByGenre", allEntries = true),
        @org.springframework.cache.annotation.CacheEvict(value = "gamesSearch", allEntries = true),
        @org.springframework.cache.annotation.CacheEvict(value = "gamesFilter", allEntries = true),
        @org.springframework.cache.annotation.CacheEvict(value = "gamesByPrice", allEntries = true),
        @org.springframework.cache.annotation.CacheEvict(value = "semanticSearch", allEntries = true),
        @org.springframework.cache.annotation.CacheEvict(value = "similarGames", allEntries = true)
    })
    public GameDTO updateGame(String id, GameDTO dto) {
        log.info("[CACHE_EVICT] Updating game id='{}', title='{}'", id, dto.getTitle());
        return gameRepository.findById(id).map(game -> {
            game.setTitle(dto.getTitle());
            game.setDescription(dto.getDescription());
            game.setGenre(dto.getGenre());
            game.setPrice(dto.getPrice());
            game.setDeveloper(dto.getDeveloper());
            game.setImageUrl(dto.getImageUrl());
            game.setGameFileUrl(dto.getGameFileUrl());
            game.setGalleryImageUrls(dto.getGalleryImageUrls());
            game.setSizeInBytes(dto.getSizeInBytes());
            game.setVersion(dto.getVersion());
            game.setPlatform(dto.getPlatform());
            game.setAgeRating(dto.getAgeRating());
            game.setSystemRequirements(dto.getSystemRequirements());
            game.setReleaseDate(dto.getReleaseDate());
            Game updated = gameRepository.save(game);
            GameDTO updatedDto = toDTO(updated);
            syncGameToOpenSearch(updatedDto);
            log.info("[CACHE_EVICT] Game updated and all semantic/search caches evicted");
            return updatedDto;
        }).orElse(null);
    }

    @Caching(evict = {
        @org.springframework.cache.annotation.CacheEvict(value = "games", allEntries = true),
        @org.springframework.cache.annotation.CacheEvict(value = "game", key = "#id"),
        @org.springframework.cache.annotation.CacheEvict(value = "gamesByGenre", allEntries = true),
        @org.springframework.cache.annotation.CacheEvict(value = "gamesSearch", allEntries = true),
        @org.springframework.cache.annotation.CacheEvict(value = "gamesFilter", allEntries = true),
        @org.springframework.cache.annotation.CacheEvict(value = "gamesByPrice", allEntries = true),
        @org.springframework.cache.annotation.CacheEvict(value = "semanticSearch", allEntries = true),
        @org.springframework.cache.annotation.CacheEvict(value = "similarGames", allEntries = true)
    })
    public void deleteGame(String id) {
        log.info("[CACHE_EVICT] Deleting game id='{}'", id);
        gameRepository.deleteById(id);
        removeGameFromOpenSearch(id);
        log.info("[CACHE_EVICT] Game deleted and all semantic/search caches evicted");
    }

    private void evictGameListCaches() {
        try {
            Cache cache = cacheManager.getCache(GAMES_CACHE);
            if (cache != null) {
                cache.clear();
            }
        } catch (RuntimeException ex) {
            System.err.println("[CACHE ERROR] game list cache eviction failed after write: " + ex.getMessage());
        }
    }

    private void syncGameToOpenSearch(GameDTO game) {
        if (game == null || !openSearchService.isSyncEnabled()) {
            return;
        }

        openSearchService.indexGame(game);
    }

    private void removeGameFromOpenSearch(String gameId) {
        if (gameId == null || gameId.isBlank() || !openSearchService.isSyncEnabled()) {
            return;
        }

        openSearchService.deleteGame(gameId);
    }

    public GameDTO toDTO(Game game) {
        GameDTO dto = new GameDTO();
        dto.setId(game.getId());
        dto.setTitle(game.getTitle());
        dto.setDescription(game.getDescription());
        dto.setGenre(game.getGenre());
        dto.setPrice(game.getPrice());
        dto.setDeveloper(game.getDeveloper());
        dto.setImageUrl(game.getImageUrl());
        dto.setGameFileUrl(game.getGameFileUrl());
        dto.setGalleryImageUrls(game.getGalleryImageUrls());
        dto.setSizeInBytes(game.getSizeInBytes());
        dto.setCreatedAt(game.getCreatedAt());
        dto.setVersion(game.getVersion());
        dto.setPlatform(game.getPlatform());
        dto.setAgeRating(game.getAgeRating());
        dto.setSystemRequirements(game.getSystemRequirements());
        dto.setReleaseDate(game.getReleaseDate());
        dto.setReviews(game.getReviews() == null ? List.of() : game.getReviews().stream()
            .map(review -> new ReviewDTO(
                review.getUsername(),
                review.getRating(),
                review.getComment(),
                review.getCreatedAt()
            ))
            .collect(Collectors.toList()));
        // include eventual-consistency stats if present on the entity
        dto.setTotalPurchases(game.getTotalPurchases() == null ? 0L : game.getTotalPurchases());
        dto.setTotalDownloads(game.getTotalDownloads() == null ? 0L : game.getTotalDownloads());
        return dto;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void backfillOpenSearchIndex() {
        if (!openSearchService.isEnabled()) {
            log.debug("OpenSearch backfill skipped: OpenSearch is not enabled");
            return;
        }

        if (!opensearchBackfillOnStartup) {
            log.info("OpenSearch backfill skipped: opensearch.backfill-on-startup=false");
            return;
        }

        try {
            log.info("Starting OpenSearch backfill for all games from MongoDB");
            List<GameDTO> games = gameRepository.findAll().stream()
                    .map(this::toDTO)
                    .collect(Collectors.toList());
            log.info("Found {} game(s) to backfill into OpenSearch", games.size());
            openSearchService.backfillIndexFromGames(games);
        } catch (RuntimeException ex) {
            log.error("OpenSearch backfill failed: {}", ex.getMessage(), ex);
        }
    }

    private boolean containsIgnoreCase(String value, String query) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(query.toLowerCase(Locale.ROOT));
    }

    private boolean equalsIgnoreCase(String left, String right) {
        return left != null && right != null && left.equalsIgnoreCase(right);
    }

    private String normalizeReviewerName(String username) {
        return (username == null || username.isBlank()) ? "Anonymous" : username.trim();
    }

    private int findReviewIndex(List<Review> reviews, String username) {
        for (int index = 0; index < reviews.size(); index++) {
            Review review = reviews.get(index);
            if (review != null && review.getUsername() != null && review.getUsername().equalsIgnoreCase(username)) {
                return index;
            }
        }
        return -1;
    }

    public PaginationDTO<GameDTO> getAllGamesPaginated(int page) {
        int pageSize = 100;
        if (page < 1) page = 1;

        if (page == 1) {
            Cache cache = cacheManager.getCache(GAMES_CACHE);
            String cacheKey = GAMES_CACHE_KEY;
            try {
                if (cache != null) {
                    Cache.ValueWrapper cachedValue = cache.get(cacheKey);
                    if (cachedValue != null && cachedValue.get() instanceof List<?> cachedGames) {
                        System.out.println("[CACHE HIT] games::top100 retrieved from Redis Cloud");
                        @SuppressWarnings("unchecked")
                        List<GameDTO> result = (List<GameDTO>) cachedGames;
                        return PaginationDTO.of(result, page, pageSize, result.size());
                    }
                }
            } catch (RuntimeException ex) {
                System.err.println("[CACHE ERROR] games::top100 read failed, falling back to MongoDB: " + ex.getMessage());
                try {
                    if (cache != null) {
                        cache.evict(cacheKey);
                        System.out.println("[CACHE EVICT] games::top100 evicted due to read error");
                    }
                } catch (RuntimeException ev) {
                    System.err.println("[CACHE ERROR] games::top100 evict failed: " + ev.getMessage());
                }
            }

            List<GameDTO> topGames = getAllGames();
            return PaginationDTO.of(topGames, page, pageSize, topGames.size());
        }

        System.out.println("[CACHE BYPASS] games::page:" + page + " not cached, loading page from MongoDB");
        List<GameDTO> allGames = gameRepository.findAll().stream()
            .map(this::toDTO)
            .collect(Collectors.toList());

        int start = (page - 1) * pageSize;
        int end = Math.min(start + pageSize, allGames.size());
        List<GameDTO> paginatedGames = start < allGames.size() ? allGames.subList(start, end) : List.of();
        List<GameDTO> paginatedCopy = new ArrayList<>(paginatedGames);

        return PaginationDTO.of(paginatedCopy, page, pageSize, allGames.size());
    }

    @Cacheable(value = "gamesByGenre", key = "(#genre == null ? 'all' : #genre.toLowerCase()) + ':page:' + #page + ':size:100'")
    public PaginationDTO<GameDTO> getGamesByGenrePaginated(String genre, int page) {
        int pageSize = 100;
        if (page < 1) page = 1;

        if (genre != null && !genre.isBlank() && openSearchService.isEnabled()) {
            int from = (page - 1) * pageSize;
            OpenSearchService.SearchPage searchPage = openSearchService.searchGamesByGenre(genre, pageSize, from);
            List<GameDTO> paginatedCopy = loadGamesByIds(searchPage.ids());
            return PaginationDTO.of(paginatedCopy, page, pageSize, searchPage.total());
        }

        List<GameDTO> allGames = gameRepository.findByGenre(genre).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());

        int start = (page - 1) * pageSize;
        int end = Math.min(start + pageSize, allGames.size());
        List<GameDTO> paginatedGames = start < allGames.size() ? allGames.subList(start, end) : List.of();
        List<GameDTO> paginatedCopy = new ArrayList<>(paginatedGames);
        
        return PaginationDTO.of(paginatedCopy, page, pageSize, allGames.size());
    }

    @Cacheable(value = "gamesSearch", key = "(#title == null ? 'all' : #title.toLowerCase()) + ':page:' + #page + ':size:100'")
    public PaginationDTO<GameDTO> searchGamesPaginated(String title, int page) {
        int pageSize = 100;
        if (page < 1) page = 1;

        if (title != null && !title.isBlank() && openSearchService.isEnabled()) {
            int from = (page - 1) * pageSize;
            OpenSearchService.SearchPage searchPage = openSearchService.searchGamesByTitle(title, pageSize, from);
            List<GameDTO> paginatedCopy = loadGamesByIds(searchPage.ids());
            return PaginationDTO.of(paginatedCopy, page, pageSize, searchPage.total());
        }

        List<GameDTO> allGames;
        if (title == null || title.isBlank()) {
            allGames = getAllGames();
        } else {
            allGames = gameRepository.findByTitleContainingIgnoreCase(title).stream()
                    .map(this::toDTO)
                    .collect(Collectors.toList());
        }

        int start = (page - 1) * pageSize;
        int end = Math.min(start + pageSize, allGames.size());
        List<GameDTO> paginatedGames = start < allGames.size() ? allGames.subList(start, end) : List.of();
        List<GameDTO> paginatedCopy = new ArrayList<>(paginatedGames);
        
        return PaginationDTO.of(paginatedCopy, page, pageSize, allGames.size());
    }

    public PaginationDTO<GameDTO> semanticSearchGamesPaginated(String query, int page) {
        log.debug("[SEMANTIC_SEARCH] Request: query='{}', page={}", query, page);
        String cacheQuery = query == null ? "all" : query.trim().toLowerCase(Locale.ROOT);
        log.debug("[SEMANTIC_SEARCH] Cache query: '{}'", cacheQuery);
        return semanticSearchGamesPaginatedCached(cacheQuery, page);
    }

    @Cacheable(value = "semanticSearch", key = "#normalizedQuery + ':page:' + #page + ':size:100'")
    public PaginationDTO<GameDTO> semanticSearchGamesPaginatedCached(String normalizedQuery, int page) {
        log.info("[SEMANTIC_SEARCH_CACHE] Cache key: '{}:page:{}:size:100'", normalizedQuery, page);
        int pageSize = 100;
        if (page < 1) page = 1;

        List<GameDTO> allGames = semanticSearchGames(normalizedQuery);
        log.debug("[SEMANTIC_SEARCH_CACHE] Retrieved {} results for query '{}'", allGames.size(), normalizedQuery);

        int start = (page - 1) * pageSize;
        int end = Math.min(start + pageSize, allGames.size());
        List<GameDTO> paginatedGames = start < allGames.size() ? allGames.subList(start, end) : List.of();
        List<GameDTO> paginatedCopy = new ArrayList<>(paginatedGames);

        log.info("[SEMANTIC_SEARCH_CACHE] Returning {} items on page {} (total: {})", paginatedCopy.size(), page, allGames.size());
        return PaginationDTO.of(paginatedCopy, page, pageSize, allGames.size());
    }

    @Cacheable(value = "gamesFilter", key = "(#title == null ? 'all' : #title.toLowerCase()) + '|' + (#genre == null ? 'all' : #genre.toLowerCase()) + '|' + (#minPrice == null ? 'min' : #minPrice) + '|' + (#maxPrice == null ? 'max' : #maxPrice) + ':page:' + #page + ':size:100'")
    public PaginationDTO<GameDTO> filterGamesPaginated(String title, String genre, Double minPrice, Double maxPrice, int page) {
        int pageSize = 100;
        if (page < 1) page = 1;

        if (openSearchService.isEnabled()) {
            int from = (page - 1) * pageSize;
            OpenSearchService.SearchPage searchPage = openSearchService.searchGamesByFilter(title, genre, minPrice, maxPrice, pageSize, from);
            List<GameDTO> paginatedCopy = loadGamesByIds(searchPage.ids());
            return PaginationDTO.of(paginatedCopy, page, pageSize, searchPage.total());
        }

        List<GameDTO> allGames = gameRepository.findAll().stream()
                .filter(game -> title == null || title.isBlank() || containsIgnoreCase(game.getTitle(), title))
                .filter(game -> genre == null || genre.isBlank() || equalsIgnoreCase(game.getGenre(), genre))
                .filter(game -> minPrice == null || game.getPrice() == null || game.getPrice() >= minPrice)
                .filter(game -> maxPrice == null || game.getPrice() == null || game.getPrice() <= maxPrice)
                .sorted(Comparator.comparing(Game::getTitle, Comparator.nullsLast(String::compareToIgnoreCase)))
                .map(this::toDTO)
                .collect(Collectors.toList());

        int start = (page - 1) * pageSize;
        int end = Math.min(start + pageSize, allGames.size());
        List<GameDTO> paginatedGames = start < allGames.size() ? allGames.subList(start, end) : List.of();
        List<GameDTO> paginatedCopy = new ArrayList<>(paginatedGames);
        
        return PaginationDTO.of(paginatedCopy, page, pageSize, allGames.size());
    }

    @Cacheable(value = "gamesByPrice", key = "(#minPrice == null ? 'min' : #minPrice) + '|' + (#maxPrice == null ? 'max' : #maxPrice) + ':page:' + #page + ':size:100'")
    public PaginationDTO<GameDTO> getGamesByPricePaginated(Double minPrice, Double maxPrice, int page) {
        return filterGamesPaginated(null, null, minPrice, maxPrice, page);
    }

    private List<GameDTO> loadGamesByIds(List<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return new ArrayList<>();
        }

        List<GameDTO> ordered = new ArrayList<>();
        for (String id : ids) {
            GameDTO game = getGameById(id);
            if (game != null) {
                ordered.add(game);
            }
        }
        return ordered;
    }

    public String generateSignedDownloadUrl(String gameFileUrl) throws Exception {
        if (gameFileUrl == null || gameFileUrl.isBlank()) {
            throw new Exception("No game file URL available");
        }

        try {
            String signedUrlEndpoint = storageServiceUrl + "/storage/signed-url?fileUrl=" + URLEncoder.encode(gameFileUrl, StandardCharsets.UTF_8);
            Map<String, String> response = restTemplate.getForObject(signedUrlEndpoint, Map.class);
            if (response != null && response.containsKey("url")) {
                System.out.println("✅ Generated signed URL for game file URL");
                return response.get("url");
            }
        } catch (Exception e) {
            System.err.println("⚠️ Failed to generate signed URL: " + e.getMessage());
        }

        return gameFileUrl; // Fallback to original URL
    }
}
