package com.gamestore.purchase.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.util.UUID;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "purchases", uniqueConstraints = @UniqueConstraint(name = "user_game_unique_idx", columnNames = {"user_id", "game_id"}))
public class Purchase {
    @Id
    @Column(name = "id", nullable = false, updatable = false, length = 36)
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "game_id", nullable = false)
    private String gameId;

    @Column(name = "price")
    private Double price;

    @Column(name = "purchase_status", nullable = false)
    private String purchaseStatus;

    @Column(name = "purchased_at", nullable = false)
    private Instant purchasedAt;

    @PrePersist
    void onCreate() {
        if (id == null || id.isBlank()) {
            id = UUID.randomUUID().toString();
        }
        if (purchasedAt == null) {
            purchasedAt = Instant.now();
        }
        if (purchaseStatus == null || purchaseStatus.isBlank()) {
            purchaseStatus = "COMPLETED";
        }
    }
}
