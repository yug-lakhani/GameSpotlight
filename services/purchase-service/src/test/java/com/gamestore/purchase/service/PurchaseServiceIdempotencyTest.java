package com.gamestore.purchase.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gamestore.purchase.dto.PurchaseDTO;
import com.gamestore.purchase.entity.Purchase;
import com.gamestore.purchase.producer.PurchaseEventProducer;
import com.gamestore.purchase.repository.PurchaseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PurchaseServiceIdempotencyTest {

    private PurchaseRepository purchaseRepository;
    private StringRedisTemplate redisTemplate;
    private PurchaseEventProducer eventProducer;
    private ValueOperations<String, String> valueOps;
    private PurchaseService purchaseService;
    private ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setup() {
        purchaseRepository = mock(PurchaseRepository.class);
        redisTemplate = mock(StringRedisTemplate.class);
        eventProducer = mock(PurchaseEventProducer.class);
        valueOps = mock(ValueOperations.class);
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        purchaseService = new PurchaseService(purchaseRepository, redisTemplate, eventProducer);
        objectMapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
        objectMapper.disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }

    @Test
    void createPurchaseWithIdempotency_whenNoExistingLock_createsAndStoresResult() throws Exception {
        PurchaseDTO dto = new PurchaseDTO(null, "user1", "game1", 9.99, "COMPLETED", Instant.now());
        Purchase saved = new Purchase();
        saved.setId("p1");
        saved.setUserId("user1");
        saved.setGameId("game1");
        saved.setPrice(9.99);
        saved.setPurchaseStatus("COMPLETED");

        when(redisTemplate.opsForValue().setIfAbsent(anyString(), anyString(), any())).thenReturn(Boolean.TRUE);
        when(purchaseRepository.existsByUserIdAndGameId("user1", "game1")).thenReturn(false);
        when(purchaseRepository.save(any(Purchase.class))).thenReturn(saved);

        PurchaseService.IdempotencyResult result = purchaseService.createPurchaseWithIdempotency(dto, "key-123");

        assertNotNull(result);
        assertFalse(result.isReplayed());
        assertEquals("p1", result.getPurchase().getId());
        // ensure result was serialized and stored
        verify(valueOps, atLeastOnce()).set(contains("result"), anyString(), any());
        // ensure lock was deleted
        verify(redisTemplate, atLeastOnce()).delete(contains("key-123"));
    }

    @Test
    void createPurchaseWithIdempotency_whenExistingResult_returnsStored() throws Exception {
        String resultJson = objectMapper.writeValueAsString(new PurchaseDTO("p2", "user2", "game2", 4.99, "COMPLETED", Instant.now()));
        when(redisTemplate.opsForValue().setIfAbsent(anyString(), anyString(), any())).thenReturn(Boolean.FALSE);
        when(valueOps.get(anyString())).thenAnswer(invocation -> {
            String key = invocation.getArgument(0, String.class);
            return key.endsWith(":result") ? resultJson : null;
        });

        PurchaseService.IdempotencyResult result = purchaseService.createPurchaseWithIdempotency(new PurchaseDTO(null, "user2", "game2", 4.99, null, null), "key-xyz");

        assertNotNull(result);
        assertTrue(result.isReplayed());
        assertEquals("p2", result.getPurchase().getId());
        verify(purchaseRepository, never()).save(any());
    }

    @Test
    void createPurchaseWithIdempotency_whenSameKeyDifferentPayload_throws() {
        when(redisTemplate.opsForValue().setIfAbsent(anyString(), anyString(), any())).thenReturn(Boolean.TRUE);

        PurchaseDTO first = new PurchaseDTO(null, "user5", "game5", 3.99, "COMPLETED", null);
        Purchase saved = new Purchase();
        saved.setId("p5");
        saved.setUserId("user5");
        saved.setGameId("game5");
        saved.setPrice(3.99);
        saved.setPurchaseStatus("COMPLETED");
        when(purchaseRepository.existsByUserIdAndGameId("user5", "game5")).thenReturn(false);
        when(purchaseRepository.save(any(Purchase.class))).thenReturn(saved);

        PurchaseService.IdempotencyResult firstResult = purchaseService.createPurchaseWithIdempotency(first, "same-key");
        assertNotNull(firstResult.getPurchase());

        when(valueOps.get(contains(":hash"))).thenReturn("different-hash-value");
        assertThrows(IllegalStateException.class,
                () -> purchaseService.createPurchaseWithIdempotency(new PurchaseDTO(null, "user5", "game5", 99.99, "COMPLETED", null), "same-key"));
    }

    @Test
    void getIdempotencyResult_whenStored_returnsDto() throws Exception {
        PurchaseDTO dto = new PurchaseDTO("p3", "user3", "game3", 1.99, "COMPLETED", Instant.now());
        String json = objectMapper.writeValueAsString(dto);
        when(valueOps.get(anyString())).thenReturn(json);

        PurchaseDTO found = purchaseService.getIdempotencyResult("user3", "k");
        assertNotNull(found);
        assertEquals("p3", found.getId());
    }

    @Test
    void createPurchaseWithIdempotency_whenLockExistsAndNoResult_throws() {
        when(redisTemplate.opsForValue().setIfAbsent(anyString(), anyString(), any())).thenReturn(Boolean.FALSE);
        when(valueOps.get(anyString())).thenReturn(null);

        assertThrows(IllegalStateException.class, () -> purchaseService.createPurchaseWithIdempotency(new PurchaseDTO(null, "user4", "game4", 2.99, null, null), "k2"));
    }
}
