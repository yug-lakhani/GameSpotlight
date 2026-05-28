package com.gamestore.game.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Document(collection = "games")
public class Game {
    @Id
    private String id;
    private String title;
    private String description;
    private String genre;
    private Double price;
    private String developer;
    private String imageUrl;
    private String gameFileUrl;
    private List<String> galleryImageUrls = new ArrayList<>();
    private Long sizeInBytes;
    private List<Review> reviews = new ArrayList<>();
    private String version;
    private String platform;
    private String ageRating;
    private String systemRequirements;
    private String releaseDate;
    private String abbreviation;  // e.g., "rc" for "Rocket Car", "bs" for "Brawl Stars"
    @CreatedDate
    private Instant createdAt;
    
    // Stats fields for eventual consistency
    private Long totalPurchases = 0L;
    private Long totalDownloads = 0L;
}
