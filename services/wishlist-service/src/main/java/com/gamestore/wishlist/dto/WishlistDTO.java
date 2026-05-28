package com.gamestore.wishlist.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Set;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class WishlistDTO {
    private String id;
    private String userId;
    private String name;
    private Set<String> gameIds;
    private Instant createdAt;
}
