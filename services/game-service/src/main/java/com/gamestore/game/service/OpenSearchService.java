package com.gamestore.game.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gamestore.game.dto.GameDTO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import jakarta.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

@Slf4j
@Service
public class OpenSearchService {

    public record SearchPage(List<String> ids, long total) {}

    private static final int DEFAULT_RESULT_SIZE = 10;
    private static final int MAX_RETRIES = 3;
    private static final long RETRY_DELAY_MS = 250L;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${opensearch.enabled:false}")
    private boolean enabled;

    @Value("${opensearch.scheme:https}")
    private String scheme;

    @Value("${opensearch.host:}")
    private String host;

    @Value("${opensearch.port:443}")
    private int port;

    @Value("${opensearch.username:}")
    private String username;

    @Value("${opensearch.password:}")
    private String password;

    @Value("${opensearch.index:games}")
    private String indexName;

    @Value("${opensearch.synonym-rules:}")
    private String synonymRulesConfig;

    @Value("${opensearch.rebuild-index-on-startup:true}")
    private boolean rebuildIndexOnStartup;

    @Value("${opensearch.sync-enabled:true}")
    private boolean syncEnabled;

    public OpenSearchService(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void initialize() {
        log.info("OpenSearchService initialization starting. Enabled={}, Host={}", enabled, host);
        if (!isEnabled()) {
            log.warn("OpenSearch is DISABLED (enabled={}, host={}). Search will not use OpenSearch.", enabled, host);
            return;
        }
        log.info("OpenSearch is ENABLED. Connecting to {}://{}:{}", scheme, host, port);
        if (rebuildIndexOnStartup) {
            log.info("Deleting existing OpenSearch index '{}' for rebuild", indexName);
            deleteIndexIfExists();
        }
        log.info("Ensuring OpenSearch index '{}' exists", indexName);
        ensureIndexExists();
    }

    public boolean isEnabled() {
        return enabled && host != null && !host.isBlank();
    }

    public void ensureIndexExists() {
        if (!isEnabled()) {
            return;
        }

        try {
            ResponseEntity<String> response = executeWithRetry(() -> exchangeRaw(HttpMethod.GET, "/" + indexName, null));
            if (response.getStatusCode().is2xxSuccessful()) {
                ensureSuggestMapping();
                return;
            }
        } catch (HttpStatusCodeException notFound) {
            if (notFound.getStatusCode() != HttpStatus.NOT_FOUND) {
                log.warn("OpenSearch index check failed: {}", notFound.getResponseBodyAsString());
                return;
            }
        } catch (Exception ex) {
            log.warn("OpenSearch index check failed: {}", ex.getMessage());
            return;
        }

        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("id", Map.of("type", "keyword"));
        properties.put("title", searchTextField());
        properties.put("abbreviation", searchTextField());  // High-weight search for abbreviations
        properties.put("description", Map.of("type", "text"));
        properties.put("genre", searchTextField());
        properties.put("developer", searchTextField());
        properties.put("platform", searchTextField());
        properties.put("ageRating", searchTextField());
        properties.put("systemRequirements", Map.of("type", "text"));
        properties.put("releaseDate", Map.of("type", "keyword"));
        properties.put("price", Map.of("type", "double"));
        properties.put("totalPurchases", Map.of("type", "long"));
        properties.put("totalDownloads", Map.of("type", "long"));
        properties.put("suggest", Map.of("type", "completion"));

        Map<String, Object> mappings = new LinkedHashMap<>();
        mappings.put("properties", properties);

        Map<String, Object> indexSettings = new LinkedHashMap<>();
        indexSettings.put("number_of_shards", 1);
        indexSettings.put("number_of_replicas", 0);

        Map<String, Object> settings = new LinkedHashMap<>();
        settings.put("index", indexSettings);
        Map<String, Object> analysis = buildAnalysisSettings();
        if (!analysis.isEmpty()) {
            settings.put("analysis", analysis);
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("settings", settings);
        body.put("mappings", mappings);

        try {
            exchangeJson(HttpMethod.PUT, "/" + indexName, body);
            ensureSuggestMapping();
            log.info("OpenSearch index '{}' created or already available", indexName);
        } catch (Exception ex) {
            log.warn("OpenSearch index creation failed: {}", ex.getMessage());
        }
    }

    private void deleteIndexIfExists() {
        if (!isEnabled()) {
            return;
        }

        try {
            executeWithRetry(() -> exchangeRaw(HttpMethod.DELETE, "/" + indexName, null));
            log.info("OpenSearch index '{}' deleted for rebuild", indexName);
        } catch (HttpStatusCodeException notFound) {
            if (notFound.getStatusCode() != HttpStatus.NOT_FOUND) {
                log.debug("OpenSearch index delete skipped: {}", notFound.getResponseBodyAsString());
            }
        } catch (Exception ex) {
            log.debug("OpenSearch index delete skipped: {}", ex.getMessage());
        }
    }

    private Map<String, Object> buildAnalysisSettings() {
        Map<String, Object> analysis = new LinkedHashMap<>();
        List<String> synonymRules = buildSynonymRules();
        if (synonymRules.isEmpty()) {
            log.debug("OpenSearch index analysis settings: no synonyms configured, using default tokenization");
            return analysis;
        }

        log.info("Creating OpenSearch analyzer with {} synonym rule(s): {}", synonymRules.size(), synonymRules);
        Map<String, Object> filter = new LinkedHashMap<>();
        filter.put("game_synonyms", Map.of(
                "type", "synonym_graph",
                "synonyms", synonymRules
        ));

        Map<String, Object> analyzer = new LinkedHashMap<>();
        analyzer.put("game_search_analyzer", Map.of(
                "tokenizer", "standard",
                "filter", List.of("lowercase", "game_synonyms")
        ));

        analysis.put("filter", filter);
        analysis.put("analyzer", analyzer);
        log.info("OpenSearch analyzer created with synonym_graph filter");
        return analysis;
    }

    private List<String> buildSynonymRules() {
        List<String> rules = new ArrayList<>();
        if (synonymRulesConfig == null || synonymRulesConfig.isBlank()) {
            log.warn("OpenSearch synonym rules are not configured (config='{}'), search will not use synonym matching", synonymRulesConfig);
            return rules;
        }

        log.info("Parsing OpenSearch synonym rules from config: '{}'", synonymRulesConfig);
        String[] pairs = synonymRulesConfig.split(",");
        for (String pair : pairs) {
            String trimmed = pair.trim();
            if (trimmed.isEmpty()) {
                continue;
            }

            String[] kv = trimmed.split("[:=]", 2);
            if (kv.length != 2) {
                continue;
            }

            String left = kv[0].trim().toLowerCase();
            String right = kv[1].trim().toLowerCase();
            if (!left.isEmpty() && !right.isEmpty()) {
                // Use bidirectional comma format for multi-word synonyms
                // This allows both "coc" and "clash of clans" to match each other
                rules.add(left + ", " + right);
                // Also add reverse direction to ensure proper matching
                if (!left.equals(right)) {
                    rules.add(right + ", " + left);
                }
            }
        }

        if (!rules.isEmpty()) {
            log.info("Configured {} OpenSearch synonym rule(s) for index analysis", rules.size());
        }
        return rules;
    }

    private Map<String, Object> searchTextField() {
        Map<String, Object> field = new LinkedHashMap<>();
        field.put("type", "text");
        field.put("search_analyzer", "game_search_analyzer");
        field.put("fields", Map.of("keyword", Map.of("type", "keyword")));
        return field;
    }

    private void ensureSuggestMapping() {
        if (!isEnabled()) {
            return;
        }

        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("suggest", Map.of("type", "completion"));

        Map<String, Object> mappings = new LinkedHashMap<>();
        mappings.put("properties", properties);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("properties", properties);

        try {
            executeWithRetry(() -> exchangeJson(HttpMethod.PUT, "/" + indexName + "/_mapping", body));
        } catch (Exception ex) {
            log.debug("OpenSearch suggest mapping update skipped or failed: {}", ex.getMessage());
        }
    }

    public void indexGame(GameDTO game) {
        if (!isSyncEnabled() || game == null || game.getId() == null || game.getId().isBlank()) {
            return;
        }

        Map<String, Object> document = toDocument(game);
        try {
            executeWithRetry(() -> exchangeJson(HttpMethod.PUT, "/" + indexName + "/_doc/" + game.getId(), document));
        } catch (Exception ex) {
            log.warn("OpenSearch index update failed for gameId={}: {}", game.getId(), ex.getMessage());
        }
    }

    public void deleteGame(String gameId) {
        if (!isSyncEnabled() || gameId == null || gameId.isBlank()) {
            return;
        }

        try {
            executeWithRetry(() -> exchangeRaw(HttpMethod.DELETE, "/" + indexName + "/_doc/" + gameId, null));
        } catch (Exception ex) {
            log.warn("OpenSearch delete failed for gameId={}: {}", gameId, ex.getMessage());
        }
    }

    /**
     * Returns true when OpenSearch is enabled AND live sync operations (index updates/deletes)
     * are permitted by configuration.
     */
    public boolean isSyncEnabled() {
        return isEnabled() && syncEnabled;
    }

    public void backfillIndexFromGames(List<GameDTO> games) {
        if (!isEnabled() || games == null || games.isEmpty()) {
            log.debug("OpenSearch backfill skipped: enabled={}, games count={}", enabled, games == null ? 0 : games.size());
            return;
        }

        log.info("Starting OpenSearch index backfill with {} game(s)", games.size());
        int indexed = 0;
        int failed = 0;
        
        for (GameDTO game : games) {
            try {
                indexGame(game);
                indexed++;
            } catch (Exception ex) {
                log.warn("Failed to backfill game {}: {}", game.getId(), ex.getMessage());
                failed++;
            }
        }
        
        log.info("OpenSearch backfill completed: {} indexed, {} failed", indexed, failed);
    }

    public List<String> searchGameIds(String query, int size) {
        if (!isEnabled() || query == null || query.isBlank()) {
            return List.of();
        }

        log.info("OpenSearch semantic search requested for query='{}'", query);

        Map<String, Object> body = Map.of(
                "size", Math.max(1, Math.min(size, 50)),
                "_source", List.of("id"),
                "query", Map.of(
                        "multi_match", Map.of(
                                        "query", query,
                                        "fields", List.of(
                                            "abbreviation^10",  // Abbreviations get highest priority
                                            "title^5",
                                            "description^3",
                                            "genre^2",
                                            "developer^2",
                                            "platform^2",
                                            "ageRating",
                                            "systemRequirements"
                                        ),
                                        "fuzziness", "AUTO",
                                        "prefix_length", 0  // Allow matching from the start
                                )
                )
        );

        return searchIds(body);
    }

    public SearchPage searchGamesByTitle(String title, int size, int from) {
        if (!isEnabled() || title == null || title.isBlank()) {
            return new SearchPage(List.of(), 0L);
        }

        log.info("OpenSearch search by title requested for title='{}'", title);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("size", Math.max(1, Math.min(size, 100)));
        body.put("from", Math.max(0, from));
        // Don't limit _source - get all fields to ensure id is included
        body.put("query", Map.of(
                "multi_match", Map.of(
                        "query", title,
                        "fields", List.of(
                            "abbreviation^10",  // Abbreviations get highest priority
                            "title^5",
                            "description^3",
                            "genre^2",
                            "developer^2",
                            "platform^2",
                            "ageRating",
                            "systemRequirements"
                        ),
                        "fuzziness", "AUTO",
                        "prefix_length", 0  // Allow matching from the start, important for short abbreviations
                )
        ));

        return searchPage(body);
    }

    public SearchPage searchGamesByGenre(String genre, int size, int from) {
        if (!isEnabled() || genre == null || genre.isBlank()) {
            return new SearchPage(List.of(), 0L);
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("size", Math.max(1, Math.min(size, 100)));
        body.put("from", Math.max(0, from));
        body.put("_source", List.of("id"));
        body.put("query", Map.of(
                "match", Map.of(
                        "genre", Map.of(
                                "query", genre,
                                "operator", "and"
                        )
                )
        ));

        return searchPage(body);
    }

    public SearchPage searchGamesByDeveloper(String developer, int size, int from) {
        if (!isEnabled() || developer == null || developer.isBlank()) {
            return new SearchPage(List.of(), 0L);
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("size", Math.max(1, Math.min(size, 100)));
        body.put("from", Math.max(0, from));
        body.put("_source", List.of("id"));
        body.put("query", Map.of(
                "match", Map.of(
                        "developer", Map.of(
                                "query", developer,
                                "operator", "and"
                        )
                )
        ));

        return searchPage(body);
    }

    public SearchPage searchGamesByFilter(String title, String genre, Double minPrice, Double maxPrice, int size, int from) {
        if (!isEnabled()) {
            return new SearchPage(List.of(), 0L);
        }

        List<Object> must = new ArrayList<>();
        List<Object> filter = new ArrayList<>();

        if (title != null && !title.isBlank()) {
            must.add(Map.of(
                    "match", Map.of(
                            "title", Map.of(
                                    "query", title,
                                    "operator", "and"
                            )
                    )
            ));
        }

        if (genre != null && !genre.isBlank()) {
            must.add(Map.of(
                    "match", Map.of(
                            "genre", Map.of(
                                    "query", genre,
                                    "operator", "and"
                            )
                    )
            ));
        }

        if (minPrice != null || maxPrice != null) {
            Map<String, Object> range = new LinkedHashMap<>();
            if (minPrice != null) {
                range.put("gte", minPrice);
            }
            if (maxPrice != null) {
                range.put("lte", maxPrice);
            }
            filter.add(Map.of("range", Map.of("price", range)));
        }

        Map<String, Object> boolQuery = new LinkedHashMap<>();
        if (!must.isEmpty()) {
            boolQuery.put("must", must);
        }
        if (!filter.isEmpty()) {
            boolQuery.put("filter", filter);
        }
        if (boolQuery.isEmpty()) {
            boolQuery.put("match_all", Map.of());
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("size", Math.max(1, Math.min(size, 100)));
        body.put("from", Math.max(0, from));
        body.put("_source", List.of("id"));
        body.put("sort", List.of(Map.of("title.keyword", Map.of("order", "asc", "missing", "_last"))));
        body.put("query", boolQuery.containsKey("match_all") ? boolQuery : Map.of("bool", boolQuery));

        return searchPage(body);
    }

    public Map<String, Object> searchSuggestions(String query, int size) {
        if (!isEnabled() || query == null || query.isBlank()) {
            Map<String, Object> empty = new LinkedHashMap<>();
            empty.put("query", "");
            empty.put("suggestions", List.of());
            empty.put("didYouMean", null);
            return empty;
        }

        String trimmedQuery = query.trim();
        int safeSize = Math.max(1, Math.min(size, 10));

        Map<String, Object> suggestQuery = Map.of(
                "prefix", trimmedQuery,
                "completion", Map.of(
                        "field", "suggest",
                        "size", safeSize,
                        "skip_duplicates", true,
                        "fuzzy", Map.of("fuzziness", "AUTO")
                )
        );

        Map<String, Object> body = Map.of(
                "suggest", Map.of("game-suggest", suggestQuery)
        );

        try {
            ResponseEntity<String> response = executeWithRetry(() -> exchangeJson(HttpMethod.POST, "/" + indexName + "/_search", body));
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null || response.getBody().isBlank()) {
                return emptySuggestionResponse(trimmedQuery);
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode suggestionNodes = root.path("suggest").path("game-suggest");
            List<String> suggestions = new ArrayList<>();

            if (suggestionNodes.isArray()) {
                for (JsonNode node : suggestionNodes) {
                    JsonNode options = node.path("options");
                    if (!options.isArray()) {
                        continue;
                    }

                    for (JsonNode option : options) {
                        String text = option.path("text").asText(null);
                        if (text != null && !text.isBlank() && !suggestions.contains(text)) {
                            suggestions.add(text);
                            if (suggestions.size() >= safeSize) {
                                break;
                            }
                        }
                    }

                    if (suggestions.size() >= safeSize) {
                        break;
                    }
                }
            }

            String didYouMean = suggestions.isEmpty() ? null : suggestions.get(0);
            Map<String, Object> responseBody = new LinkedHashMap<>();
            responseBody.put("query", trimmedQuery);
            responseBody.put("suggestions", suggestions);
            responseBody.put("didYouMean", didYouMean);
            log.debug("OpenSearch completion suggestions query='{}' suggestions={}", trimmedQuery, suggestions);
            return responseBody;
        } catch (Exception ex) {
            log.warn("OpenSearch completion suggester failed for query='{}': {}", trimmedQuery, ex.getMessage());
            return emptySuggestionResponse(trimmedQuery);
        }
    }

    private Map<String, Object> emptySuggestionResponse(String query) {
        Map<String, Object> empty = new LinkedHashMap<>();
        empty.put("query", query);
        empty.put("suggestions", List.of());
        empty.put("didYouMean", null);
        return empty;
    }

    public List<String> similarGameIds(GameDTO game, int size) {
        if (!isEnabled() || game == null) {
            return List.of();
        }

        log.info("OpenSearch similar-games search requested for gameId={} title='{}'", game.getId(), game.getTitle());

        Map<String, Object> body = Map.of(
                "size", Math.max(1, Math.min(size, 20)),
                "_source", List.of("id"),
                "query", Map.of(
                "more_like_this", Map.of(
                    "fields", List.of(
                        "title",
                        "description",
                        "genre",
                        "developer",
                        "platform",
                        "ageRating",
                        "systemRequirements"
                    ),
                    "like", List.of(
                        Map.of(
                            "_index", indexName,
                            "_id", game.getId()
                        )
                    ),
                    "min_term_freq", 1,
                    "min_doc_freq", 1,
                    "max_query_terms", 25,
                    "minimum_should_match", "30%"
                        )
                )
        );

        return searchIds(body);
    }

    private List<String> searchIds(Map<String, Object> body) {
        return searchPage(body).ids();
    }

    private SearchPage searchPage(Map<String, Object> body) {
        try {
            ResponseEntity<String> response = executeWithRetry(() -> exchangeJson(HttpMethod.POST, "/" + indexName + "/_search", body));
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null || response.getBody().isBlank()) {
                log.info("OpenSearch search returned no usable response from index '{}'", indexName);
                return new SearchPage(List.of(), 0L);
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode hits = root.path("hits").path("hits");
            if (!hits.isArray()) {
                log.warn("OpenSearch response hits is not an array: {}", hits);
                return new SearchPage(List.of(), 0L);
            }

            List<String> ids = new ArrayList<>();
            for (int i = 0; i < hits.size(); i++) {
                JsonNode hit = hits.get(i);
                String id = hit.path("_source").path("id").asText(null);
                String fallbackId = hit.path("_id").asText(null);
                
                log.debug("Hit {}: _source.id='{}', _id='{}', _source={}", i, id, fallbackId, hit.path("_source"));
                
                if (id == null || id.isBlank()) {
                    id = fallbackId;
                }
                if (id != null && !id.isBlank()) {
                    ids.add(id);
                } else {
                    log.warn("Hit {} has no valid ID. _source={}", i, hit.path("_source"));
                }
            }
            long total = root.path("hits").path("total").path("value").asLong(hits.size());
            log.info("OpenSearch search returned {} result(s) from index '{}', extracted {} IDs", total, indexName, ids.size());
            return new SearchPage(ids, total);
        } catch (Exception ex) {
            log.warn("OpenSearch query failed: {}", ex.getMessage());
            return new SearchPage(List.of(), 0L);
        }
    }

    private Map<String, Object> toDocument(GameDTO game) {
        Map<String, Object> document = new LinkedHashMap<>();
        document.put("id", game.getId());
        document.put("title", game.getTitle());
        document.put("abbreviation", game.getAbbreviation() == null ? "" : game.getAbbreviation());
        document.put("description", game.getDescription());
        document.put("genre", game.getGenre());
        document.put("price", game.getPrice());
        document.put("developer", game.getDeveloper());
        document.put("imageUrl", game.getImageUrl());
        document.put("gameFileUrl", game.getGameFileUrl());
        document.put("galleryImageUrls", game.getGalleryImageUrls());
        document.put("sizeInBytes", game.getSizeInBytes());
        document.put("version", game.getVersion());
        document.put("platform", game.getPlatform());
        document.put("ageRating", game.getAgeRating());
        document.put("systemRequirements", game.getSystemRequirements());
        document.put("releaseDate", game.getReleaseDate());
        document.put("totalPurchases", game.getTotalPurchases());
        document.put("totalDownloads", game.getTotalDownloads());
        List<String> inputs = new ArrayList<>();
        addSuggestionInput(inputs, game.getTitle());
        addSuggestionInput(inputs, game.getAbbreviation());  // Include abbreviation in suggestions
        addSuggestionInput(inputs, game.getDeveloper());
        addSuggestionInput(inputs, game.getGenre());

        Map<String, Object> suggest = new LinkedHashMap<>();
        suggest.put("input", inputs);
        suggest.put("weight", calculateSuggestionWeight(game));
        document.put("suggest", suggest);
        return document;
    }

    private void addSuggestionInput(List<String> inputs, String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        String candidate = value.trim();
        if (!inputs.contains(candidate)) {
            inputs.add(candidate);
        }
    }

    private int calculateSuggestionWeight(GameDTO game) {
        long purchases = game.getTotalPurchases() == null ? 0L : game.getTotalPurchases();
        long downloads = game.getTotalDownloads() == null ? 0L : game.getTotalDownloads();
        long rawWeight = 1L + purchases + downloads;
        return (int) Math.max(1L, Math.min(1000L, rawWeight));
    }

    private ResponseEntity<String> exchangeJson(HttpMethod method, String path, Object body) throws Exception {
        HttpHeaders headers = createHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<?> entity = new HttpEntity<>(body, headers);
        return restTemplate.exchange(baseUrl() + path, method, entity, String.class);
    }

    private ResponseEntity<String> exchangeRaw(HttpMethod method, String path, Object body) throws Exception {
        HttpHeaders headers = createHeaders();
        HttpEntity<?> entity = new HttpEntity<>(body, headers);
        return restTemplate.exchange(baseUrl() + path, method, entity, String.class);
    }

    private ResponseEntity<String> executeWithRetry(CheckedSupplier<ResponseEntity<String>> action) throws Exception {
        Exception lastError = null;
        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                return action.get();
            } catch (Exception ex) {
                lastError = ex;
                if (attempt < MAX_RETRIES) {
                    Thread.sleep(RETRY_DELAY_MS * attempt);
                }
            }
        }

        if (lastError != null) {
            throw lastError;
        }
        throw new IllegalStateException("OpenSearch request failed without an exception");
    }

    @FunctionalInterface
    private interface CheckedSupplier<T> {
        T get() throws Exception;
    }

    private HttpHeaders createHeaders() {
        HttpHeaders headers = new HttpHeaders();
        if (username != null && !username.isBlank()) {
            headers.setBasicAuth(username, password == null ? "" : password);
        }
        return headers;
    }

    private String baseUrl() {
        return scheme + "://" + host + ":" + port;
    }
}
