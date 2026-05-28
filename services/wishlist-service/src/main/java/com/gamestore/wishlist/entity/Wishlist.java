package com.gamestore.wishlist.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Set;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Document(collection = "wishlists")
public class Wishlist {
    @Id
    private String id;
    private String userId;
    private String name;
    private Set<String> gameIds;
    @CreatedDate
    private Instant createdAt;
}
