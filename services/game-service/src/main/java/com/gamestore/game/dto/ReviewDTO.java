package com.gamestore.game.dto;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.datatype.jsr310.ser.InstantSerializer;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class ReviewDTO {
    private String username;
    private Integer rating;
    private String comment;
    @JsonSerialize(using = InstantSerializer.class)
    private Instant createdAt;
}
