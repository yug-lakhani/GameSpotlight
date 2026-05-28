package com.gamestore.game.event;

import lombok.Data;

import java.time.Instant;

@Data
public class GameCreatedEvent {
    private String eventId;
    private String gameId;
    private String title;
    private String developerUsername;
    private Instant timestamp;
}
