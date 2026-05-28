package com.gamestore.purchase.repository;

import com.gamestore.purchase.entity.Purchase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PurchaseRepository extends JpaRepository<Purchase, String> {
    List<Purchase> findByUserId(String userId);
    List<Purchase> findByGameId(String gameId);
    boolean existsByUserIdAndGameId(String userId, String gameId);
}
