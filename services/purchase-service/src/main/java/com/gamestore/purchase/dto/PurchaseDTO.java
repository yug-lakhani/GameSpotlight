package com.gamestore.purchase.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PurchaseDTO {
    private String id;
    private String userId;
    private String gameId;
    private Double price;
    private String purchaseStatus;
    private Instant purchasedAt;
}
