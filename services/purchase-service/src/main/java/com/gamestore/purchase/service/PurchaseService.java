package com.gamestore.purchase.service;

import com.gamestore.purchase.dto.PurchaseDTO;
import com.gamestore.purchase.entity.Purchase;
import com.gamestore.purchase.producer.PurchaseEventProducer;
import com.gamestore.purchase.repository.PurchaseRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.security.MessageDigest;
import java.util.UUID;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class PurchaseService {

    public static final class IdempotencyResult {
        private final PurchaseDTO purchase;
        private final boolean replayed;

        public IdempotencyResult(PurchaseDTO purchase, boolean replayed) {
            this.purchase = purchase;
            this.replayed = replayed;
        }

        public PurchaseDTO getPurchase() {
            return purchase;
        }

        public boolean isReplayed() {
            return replayed;
        }
    }

    private final PurchaseRepository purchaseRepository;
    private final org.springframework.data.redis.core.StringRedisTemplate redisTemplate;
    private final PurchaseEventProducer eventProducer;
    private final BrevoNotificationService brevoNotificationService;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper()
            .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule())
            .disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    @Autowired
    public PurchaseService(PurchaseRepository purchaseRepository, 
                           org.springframework.data.redis.core.StringRedisTemplate redisTemplate,
                           PurchaseEventProducer eventProducer,
                           BrevoNotificationService brevoNotificationService) {
        this.purchaseRepository = purchaseRepository;
        this.redisTemplate = redisTemplate;
        this.eventProducer = eventProducer;
        this.brevoNotificationService = brevoNotificationService;
    }

    /**
     * Backwards-compatible constructor used by older tests/builds that only
     * provide three dependencies. Supplies a no-op BrevoNotificationService
     * to avoid reintroducing the previous null-service bug.
     */
    public PurchaseService(PurchaseRepository purchaseRepository,
                           org.springframework.data.redis.core.StringRedisTemplate redisTemplate,
                           PurchaseEventProducer eventProducer) {
        this(purchaseRepository, redisTemplate, eventProducer, new NoopBrevoNotificationService());
    }

    /**
     * Minimal no-op BrevoNotificationService used only for test compatibility
     * when the real bean is not supplied. Uses a default JavaMailSenderImpl
     * and RestTemplate and overrides the send method as a no-op.
     */
    private static final class NoopBrevoNotificationService extends BrevoNotificationService {
        public NoopBrevoNotificationService() {
            super(new org.springframework.mail.javamail.JavaMailSenderImpl(), new org.springframework.web.client.RestTemplate());
        }

        @Override
        public void sendPurchaseSuccessEmail(String username, String gameId, Double price) {
            // intentionally no-op for tests/builds that don't wire the real service
        }
    }

    public List<PurchaseDTO> getPurchasesByUser(String userId) {
        return purchaseRepository.findByUserId(userId).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public PurchaseDTO getPurchaseById(String id) {
        return purchaseRepository.findById(id)
                .map(this::toDTO)
                .orElse(null);
    }

    public PurchaseDTO createPurchase(PurchaseDTO dto) {
        PurchaseDTO created = createPurchaseInternal(dto);
        // Always publish an event even when clients do not provide idempotency headers.
        eventProducer.publishPurchaseCreatedEvent(
                created.getId(),
                created.getUserId(),
                created.getGameId(),
                UUID.randomUUID().toString());
        return created;
    }

    private synchronized PurchaseDTO createPurchaseInternal(PurchaseDTO dto) {
        if (purchaseRepository.existsByUserIdAndGameId(dto.getUserId(), dto.getGameId())) {
            throw new IllegalStateException("You already own this game.");
        }

        Purchase purchase = new Purchase();
        purchase.setUserId(dto.getUserId());
        purchase.setGameId(dto.getGameId());

        // If client omitted the price, attempt to resolve it from the game service.
        Double price = dto.getPrice();
        if (price == null) {
            try {
                java.util.Optional<?> gsOpt = brevoNotificationService.fetchGameSummary(dto.getGameId());
                if (gsOpt.isPresent()) {
                    Object gs = gsOpt.get();
                    try {
                        // GameSummary is a private record inside BrevoNotificationService; use reflection-safe access
                        java.lang.reflect.Method m = gs.getClass().getMethod("price");
                        Object p = m.invoke(gs);
                        if (p instanceof Double) {
                            price = (Double) p;
                        } else if (p instanceof Number) {
                            price = ((Number) p).doubleValue();
                        }
                    } catch (Exception ignored) {
                    }
                }
            } catch (Exception ignored) {
            }
        }

        purchase.setPrice(price);
        purchase.setPurchaseStatus(dto.getPurchaseStatus() != null ? dto.getPurchaseStatus() : "COMPLETED");
        try {
            Purchase saved = purchaseRepository.save(purchase);
            PurchaseDTO created = toDTO(saved);
            return created;
        } catch (DataIntegrityViolationException ex) {
            throw new IllegalStateException("You already own this game.");
        }
    }

    /**
     * Idempotent create using Redis idempotency key.
     * If a previous result exists we return it; otherwise we attempt to create and store the result.
     */
    public IdempotencyResult createPurchaseWithIdempotency(PurchaseDTO dto, String idempotencyKey) {
        String redisKey = "idem:purchase:" + dto.getUserId() + ":" + idempotencyKey;
        String resultKey = redisKey + ":result";
        String hashKey = redisKey + ":hash";
        String requestHash = hashRequest(dto);

        // If an idempotent result already exists, replay it directly.
        String existingHash = safeGet(hashKey);
        if (existingHash != null && !existingHash.equals(requestHash)) {
            throw new IllegalStateException("Idempotency key reused with a different request payload.");
        }
        PurchaseDTO cached = deserializePurchase(safeGet(resultKey));
        if (cached != null) {
            return new IdempotencyResult(cached, true);
        }

        Boolean acquired = redisTemplate.opsForValue().setIfAbsent(redisKey, "LOCK", java.time.Duration.ofMinutes(5));
        if (Boolean.FALSE.equals(acquired)) {
            // Another request may still be finishing; poll briefly for completed result.
            for (int attempt = 0; attempt < 5; attempt++) {
                String polledHash = safeGet(hashKey);
                if (polledHash != null && !polledHash.equals(requestHash)) {
                    throw new IllegalStateException("Idempotency key reused with a different request payload.");
                }

                PurchaseDTO polled = deserializePurchase(safeGet(resultKey));
                if (polled != null) {
                    return new IdempotencyResult(polled, true);
                }

                try {
                    Thread.sleep(120);
                } catch (InterruptedException interruptedException) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
            throw new IllegalStateException("Duplicate request in progress. Retry shortly.");
        }

        try {
            // Persist request hash for payload consistency across retries.
            redisTemplate.opsForValue().set(hashKey, requestHash, java.time.Duration.ofHours(24));

            PurchaseDTO created = createPurchaseInternal(dto);
            try {
                String json = objectMapper.writeValueAsString(created);
                redisTemplate.opsForValue().set(resultKey, json, java.time.Duration.ofHours(24));
            } catch (Exception ignored) {
            }
            
            // Emit PurchaseCreatedEvent for game stats aggregation
            eventProducer.publishPurchaseCreatedEvent(created.getId(), created.getUserId(), created.getGameId(), idempotencyKey);
            
            return new IdempotencyResult(created, false);
        } catch (RuntimeException runtimeException) {
            // Avoid stale hash when no final result was persisted.
            if (safeGet(resultKey) == null) {
                try {
                    redisTemplate.delete(hashKey);
                } catch (Exception ignored) {
                }
            }
            throw runtimeException;
        } finally {
            try {
                redisTemplate.delete(redisKey);
            } catch (Exception ignored) {
            }
        }
    }

    public PurchaseDTO getIdempotencyResult(String userId, String idempotencyKey) {
        String resultKey = "idem:purchase:" + userId + ":" + idempotencyKey + ":result";
        try {
            String stored = redisTemplate.opsForValue().get(resultKey);
            if (stored != null) {
                return objectMapper.readValue(stored, PurchaseDTO.class);
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private String safeGet(String key) {
        try {
            return redisTemplate.opsForValue().get(key);
        } catch (Exception ignored) {
            return null;
        }
    }

    private PurchaseDTO deserializePurchase(String raw) {
        if (raw == null) {
            return null;
        }
        try {
            return objectMapper.readValue(raw, PurchaseDTO.class);
        } catch (Exception ignored) {
            return null;
        }
    }

    private String hashRequest(PurchaseDTO dto) {
        try {
            com.fasterxml.jackson.databind.node.ObjectNode node = objectMapper.createObjectNode();
            node.put("userId", dto.getUserId());
            node.put("gameId", dto.getGameId());
            if (dto.getPrice() != null) {
                node.put("price", dto.getPrice());
            } else {
                node.putNull("price");
            }
            node.put("purchaseStatus", dto.getPurchaseStatus() != null ? dto.getPurchaseStatus() : "COMPLETED");

            byte[] payload = objectMapper.writeValueAsBytes(node);
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(payload);
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to compute idempotency request hash.", exception);
        }
    }

    public PurchaseDTO completePurchase(String id) {
        return purchaseRepository.findById(id).map(purchase -> {
            purchase.setPurchaseStatus("COMPLETED");
            Purchase updated = purchaseRepository.save(purchase);
            return toDTO(updated);
        }).orElse(null);
    }

    public void deletePurchase(String id) {
        purchaseRepository.deleteById(id);
    }

    private PurchaseDTO toDTO(Purchase purchase) {
        return new PurchaseDTO(
                purchase.getId(),
                purchase.getUserId(),
                purchase.getGameId(),
                purchase.getPrice(),
                purchase.getPurchaseStatus(),
                purchase.getPurchasedAt()
        );
    }
}
