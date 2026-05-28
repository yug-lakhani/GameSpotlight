package com.gamestore.game.event;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.Instant;

/**
 * Event emitted when a purchase is successfully created.
 * Used for eventual consistency in updating game stats (purchase counts).
 * Includes idempotency key to prevent duplicate stats increments.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class PurchaseCreatedEvent implements Serializable {
    private static final long serialVersionUID = 1L;

    @JsonProperty("event_id")
    private String eventId;

    @JsonProperty("purchase_id")
    private String purchaseId;

    @JsonProperty("user_id")
    private String userId;

    @JsonProperty("game_id")
    private String gameId;

    @JsonProperty("timestamp")
    private Instant timestamp;

    @JsonProperty("idempotency_key")
    private String idempotencyKey;

    @JsonProperty("event_type")
    private String eventType = "PURCHASE_CREATED";
}
