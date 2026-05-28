package com.gamestore.wishlist.controller;

import com.gamestore.wishlist.dto.WishlistDTO;
import com.gamestore.wishlist.service.WishlistService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/wishlist")
@RequiredArgsConstructor
public class WishlistController {

    private final WishlistService wishlistService;

    @GetMapping("/{userId}")
    public ResponseEntity<WishlistDTO> getWishlist(@PathVariable String userId) {
        WishlistDTO wishlist = wishlistService.getWishlistByUser(userId);
        return wishlist != null ? ResponseEntity.ok(wishlist) : ResponseEntity.notFound().build();
    }

    @PostMapping("/{userId}/game/{gameId}")
    public ResponseEntity<WishlistDTO> addGameToWishlist(@PathVariable String userId, @PathVariable String gameId) {
        WishlistDTO wishlist = wishlistService.getWishlistByUser(userId);
        String wishlistId;
        if (wishlist == null) {
            WishlistDTO created = wishlistService.createWishlistForUser(userId, "Favorites");
            wishlistId = created.getId();
        } else {
            wishlistId = wishlist.getId();
        }
        WishlistDTO updated = wishlistService.addGameToWishlist(userId, wishlistId, gameId);
        return ResponseEntity.status(HttpStatus.OK).body(updated);
    }

    @DeleteMapping("/{userId}/game/{gameId}")
    public ResponseEntity<WishlistDTO> removeGameFromWishlist(@PathVariable String userId, @PathVariable String gameId) {
        WishlistDTO wishlist = wishlistService.getWishlistByUser(userId);
        if (wishlist == null) {
            return ResponseEntity.notFound().build();
        }
        WishlistDTO updated = wishlistService.removeGameFromWishlist(userId, wishlist.getId(), gameId);
        return updated != null ? ResponseEntity.ok(updated) : ResponseEntity.notFound().build();
    }
}
