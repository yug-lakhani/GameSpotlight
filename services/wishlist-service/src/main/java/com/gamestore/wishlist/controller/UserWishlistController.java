package com.gamestore.wishlist.controller;

import com.gamestore.wishlist.dto.WishlistDTO;
import com.gamestore.wishlist.security.AuthUtils;
import com.gamestore.wishlist.service.WishlistService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/user/wishlist")
@RequiredArgsConstructor
public class UserWishlistController {

    private final WishlistService wishlistService;
    private final AuthUtils authUtils;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> list(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        String userId = authUtils.extractUsernameFromHeader(authorizationHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        List<Map<String, Object>> payload = wishlistService.getWishlistsForUser(userId).stream()
                .map(this::toClientDto)
                .toList();
        return ResponseEntity.ok(payload);
    }

    @PostMapping("/create")
    public ResponseEntity<Map<String, Object>> create(
            @RequestParam(defaultValue = "Favorites") String name,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        String userId = authUtils.extractUsernameFromHeader(authorizationHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        WishlistDTO created = wishlistService.createWishlistForUser(userId, name);
        return ResponseEntity.status(HttpStatus.CREATED).body(toClientDto(created));
    }

    @GetMapping("/{wishlistId}")
    public ResponseEntity<Map<String, Object>> byId(
            @PathVariable String wishlistId,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        String userId = authUtils.extractUsernameFromHeader(authorizationHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        return wishlistService.getWishlistByIdForUser(userId, wishlistId)
                .map(dto -> ResponseEntity.ok(toClientDto(dto)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{wishlistId}")
    public ResponseEntity<Void> delete(
            @PathVariable String wishlistId,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        String userId = authUtils.extractUsernameFromHeader(authorizationHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        boolean deleted = wishlistService.deleteWishlistByIdForUser(userId, wishlistId);
        return deleted ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    @PostMapping("/{wishlistId}/add/{gameId}")
    public ResponseEntity<Map<String, Object>> add(
            @PathVariable String wishlistId,
            @PathVariable String gameId,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        String userId = authUtils.extractUsernameFromHeader(authorizationHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        WishlistDTO updated = wishlistService.addGameToWishlist(userId, wishlistId, gameId);
        if (updated == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(toClientDto(updated));
    }

    @DeleteMapping("/{wishlistId}/remove/{gameId}")
    public ResponseEntity<Map<String, Object>> remove(
            @PathVariable String wishlistId,
            @PathVariable String gameId,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        String userId = authUtils.extractUsernameFromHeader(authorizationHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        WishlistDTO updated = wishlistService.removeGameFromWishlist(userId, wishlistId, gameId);
        if (updated == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(toClientDto(updated));
    }

    @PutMapping("/{wishlistId}/update/{oldGameId}/{newGameId}")
    public ResponseEntity<Map<String, Object>> update(
            @PathVariable String wishlistId,
            @PathVariable String oldGameId,
            @PathVariable String newGameId,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        String userId = authUtils.extractUsernameFromHeader(authorizationHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        WishlistDTO updated = wishlistService.updateWishlistItem(userId, wishlistId, oldGameId, newGameId);
        if (updated == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(toClientDto(updated));
    }

    private Map<String, Object> toClientDto(WishlistDTO dto) {
        return toClientDto(dto, "Favorites");
    }

    private Map<String, Object> toClientDto(WishlistDTO dto, String name) {
        Map<String, Object> out = new HashMap<>();
        out.put("id", dto.getId());
        out.put("wishlistId", dto.getId());
        out.put("name", (dto.getName() == null || dto.getName().isBlank()) ? ((name == null || name.isBlank()) ? "Favorites" : name) : dto.getName());
        out.put("userId", dto.getUserId());
        out.put("gameIds", dto.getGameIds() == null ? Set.of() : dto.getGameIds());
        out.put("gameTitles", List.of());
        out.put("createdAt", dto.getCreatedAt());
        return out;
    }
}
