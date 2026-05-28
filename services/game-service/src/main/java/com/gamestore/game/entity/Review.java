package com.gamestore.game.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class Review {
    private String username;
    private Integer rating;
    private String comment;
    private Instant createdAt;
}
