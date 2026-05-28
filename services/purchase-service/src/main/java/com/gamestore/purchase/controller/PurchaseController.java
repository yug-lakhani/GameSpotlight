package com.gamestore.purchase.controller;

import com.gamestore.purchase.dto.PurchaseDTO;
import com.gamestore.purchase.security.AuthUtils;
import com.gamestore.purchase.service.PurchaseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/purchases")
@RequiredArgsConstructor
public class PurchaseController {

    private final PurchaseService purchaseService;
    private final AuthUtils authUtils;

    @GetMapping("/user/me")
    public ResponseEntity<List<PurchaseDTO>> getCurrentUserPurchases(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        String userId = authUtils.extractUsernameFromHeader(authorizationHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(purchaseService.getPurchasesByUser(userId));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<PurchaseDTO>> getPurchasesByUser(@PathVariable String userId) {
        return ResponseEntity.ok(purchaseService.getPurchasesByUser(userId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PurchaseDTO> getPurchaseById(@PathVariable String id) {
        PurchaseDTO purchase = purchaseService.getPurchaseById(id);
        return purchase != null ? ResponseEntity.ok(purchase) : ResponseEntity.notFound().build();
    }

    @PostMapping
    public ResponseEntity<?> createPurchase(
            @RequestBody PurchaseDTO purchaseDTO,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        String userId = authUtils.extractUsernameFromHeader(authorizationHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        purchaseDTO.setUserId(userId);
        try {
            if (idempotencyKey != null && !idempotencyKey.isBlank()) {
                PurchaseService.IdempotencyResult result = purchaseService.createPurchaseWithIdempotency(purchaseDTO, idempotencyKey);
                if (result.isReplayed()) {
                    return ResponseEntity.ok(result.getPurchase());
                }
                return ResponseEntity.status(HttpStatus.CREATED).body(result.getPurchase());
            } else {
                PurchaseDTO created = purchaseService.createPurchase(purchaseDTO);
                return ResponseEntity.status(HttpStatus.CREATED).body(created);
            }
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", ex.getMessage()));
        }
    }

    @PutMapping("/{id}/complete")
    public ResponseEntity<PurchaseDTO> completePurchase(@PathVariable String id) {
        PurchaseDTO completed = purchaseService.completePurchase(id);
        return completed != null ? ResponseEntity.ok(completed) : ResponseEntity.notFound().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePurchase(@PathVariable String id) {
        purchaseService.deletePurchase(id);
        return ResponseEntity.noContent().build();
    }

}
