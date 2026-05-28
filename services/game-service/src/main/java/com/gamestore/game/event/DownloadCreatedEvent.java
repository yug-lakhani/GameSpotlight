package com.gamestore.game.event;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.Instant;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class DownloadCreatedEvent implements Serializable {
    private static final long serialVersionUID = 1L;

    @JsonProperty("event_id")
    private String eventId;

    @JsonProperty("download_id")
    private String downloadId;

    @JsonProperty("user_id")
    private String userId;

    @JsonProperty("game_id")
    private String gameId;

    @JsonProperty("timestamp")
    private Instant timestamp;

    @JsonProperty("idempotency_key")
    private String idempotencyKey;

    @JsonProperty("event_type")
    private String eventType = "DOWNLOAD_CREATED";
}
