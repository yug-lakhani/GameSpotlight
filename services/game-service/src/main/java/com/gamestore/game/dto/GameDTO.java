package com.gamestore.game.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class GameDTO {
    private String id;
    private String title;
    private String description;
    private String genre;
    private Double price;
    private String developer;
    private String imageUrl;
    private String gameFileUrl;
    private List<String> galleryImageUrls;
    private Long sizeInBytes;
    private Instant createdAt;
    private List<ReviewDTO> reviews;
    private String version;
    private String platform;
    private String ageRating;
    private String systemRequirements;
    private String releaseDate;
    private String abbreviation;  // e.g., "rc" for "Rocket Car", "bs" for "Brawl Stars"
    
    // Stats fields for eventual consistency
    private Long totalPurchases;
    private Long totalDownloads;
}
