package com.gamestore.purchase.service;

import com.gamestore.purchase.dto.PurchaseDTO;
import com.gamestore.purchase.entity.Purchase;
import com.gamestore.purchase.producer.PurchaseEventProducer;
import com.gamestore.purchase.repository.PurchaseRepository;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.GenericContainer;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;


class PurchaseServiceRedisIT {

    private GenericContainer<?> redis;
    private StringRedisTemplate redisTemplate;
    private PurchaseRepository purchaseRepository;
    private PurchaseEventProducer eventProducer;
    private PurchaseService purchaseService;

    @BeforeEach
    void setup() {
        Assumptions.assumeTrue(
            DockerClientFactory.instance().isDockerAvailable(),
            "Docker not available for Testcontainers on this machine"
        );

        redis = new GenericContainer<>("redis:7.2.1").withExposedPorts(6379);
        redis.start();

        String host = redis.getHost();
        Integer port = redis.getFirstMappedPort();
        LettuceConnectionFactory connectionFactory = new LettuceConnectionFactory(host, port);
        connectionFactory.afterPropertiesSet();
        redisTemplate = new StringRedisTemplate(connectionFactory);
        redisTemplate.afterPropertiesSet();

        // clean DB
        redisTemplate.getConnectionFactory().getConnection().flushDb();

        purchaseRepository = mock(PurchaseRepository.class);
        eventProducer = mock(PurchaseEventProducer.class);
        purchaseService = new PurchaseService(purchaseRepository, redisTemplate, eventProducer);
    }

    @AfterEach
    void tearDown() {
        try {
            if (redisTemplate != null) redisTemplate.getConnectionFactory().getConnection().flushDb();
        } catch (Exception ignored) {}
        try {
            if (redis != null) redis.stop();
        } catch (Exception ignored) {}
    }

    @Test
    void createPurchaseWithIdempotency_storeAndReturnResult() throws Exception {
        PurchaseDTO dto = new PurchaseDTO(null, "user-it", "game-it", 5.0, "COMPLETED", Instant.now());
        Purchase saved = new Purchase();
        saved.setId("it-1");
        saved.setUserId("user-it");
        saved.setGameId("game-it");
        saved.setPrice(5.0);
        saved.setPurchaseStatus("COMPLETED");

        when(purchaseRepository.existsByUserIdAndGameId("user-it", "game-it")).thenReturn(false);
        when(purchaseRepository.save(any(Purchase.class))).thenReturn(saved);

        String key = "it-key-1";
        PurchaseService.IdempotencyResult created = purchaseService.createPurchaseWithIdempotency(dto, key);

        assertNotNull(created);
        assertFalse(created.isReplayed());
        assertEquals("it-1", created.getPurchase().getId());

        String redisResultKey = "idem:purchase:" + dto.getUserId() + ":" + key + ":result";
        String stored = redisTemplate.opsForValue().get(redisResultKey);
        assertNotNull(stored);

        // second call should return stored result and not call repository.save again
        PurchaseService.IdempotencyResult second = purchaseService.createPurchaseWithIdempotency(new PurchaseDTO(null, "user-it", "game-it", 5.0, null, null), key);
        assertNotNull(second);
        assertTrue(second.isReplayed());
        assertEquals("it-1", second.getPurchase().getId());
        verify(purchaseRepository, times(1)).save(any());
    }
}
