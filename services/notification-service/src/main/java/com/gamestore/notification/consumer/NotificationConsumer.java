package com.gamestore.notification.consumer;

import com.gamestore.game.event.GameCreatedEvent;
import com.gamestore.notification.service.BrevoNotificationService;
import com.gamestore.purchase.event.PurchaseCreatedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationConsumer {

    private final BrevoNotificationService brevoNotificationService;

    @KafkaListener(topics = "${app.kafka.topics.game-created:game.created}", groupId = "${spring.kafka.consumer.group-id:notification-service}", autoStartup = "${app.kafka.listeners-enabled:false}")
    public void onGameCreated(GameCreatedEvent event) {
        if (event == null) {
            log.warn("Received null GameCreatedEvent");
            return;
        }

        log.info("Received GameCreatedEvent for gameId={}, developer={}", event.getGameId(), event.getDeveloperUsername());
        brevoNotificationService.sendGameCreatedEmail(event.getDeveloperUsername(), event.getTitle());
    }

    @KafkaListener(topics = "${app.kafka.topics.purchase-created:game.purchases}", groupId = "${spring.kafka.consumer.group-id:notification-service}", autoStartup = "${app.kafka.listeners-enabled:false}")
    public void onPurchaseCreated(PurchaseCreatedEvent event) {
        if (event == null) {
            log.warn("Received null PurchaseCreatedEvent");
            return;
        }

        log.info("Received PurchaseCreatedEvent for purchaseId={}, userId={}", event.getPurchaseId(), event.getUserId());
        brevoNotificationService.sendPurchaseSuccessEmail(event.getUserId(), event.getGameId(), null);
    }
}
