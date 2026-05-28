package com.gamestore.wishlist.service;

import com.gamestore.wishlist.dto.WishlistDTO;
import com.gamestore.wishlist.entity.Wishlist;
import com.gamestore.wishlist.repository.WishlistRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class WishlistService {

    private final WishlistRepository wishlistRepository;

    public WishlistService(WishlistRepository wishlistRepository) {
        this.wishlistRepository = wishlistRepository;
    }

    public WishlistDTO getWishlistByUser(String userId) {
        return wishlistRepository.findByUserId(userId)
                .map(this::toDTO)
                .orElse(null);
    }

    public List<WishlistDTO> getWishlistsForUser(String userId) {
        List<Wishlist> found = wishlistRepository.findAllByUserId(userId);
        if (found == null || found.isEmpty()) return List.of();
        return found.stream().map(this::toDTO).collect(Collectors.toList());
    }

    public WishlistDTO createWishlistForUser(String userId, String name) {
        Wishlist w = new Wishlist();
        w.setUserId(userId);
        w.setName((name == null || name.isBlank()) ? "Favorites" : name);
        w.setGameIds(new HashSet<>());
        Wishlist saved = wishlistRepository.save(w);
        return toDTO(saved);
    }

    public Optional<WishlistDTO> getWishlistByIdForUser(String userId, String wishlistId) {
        return wishlistRepository.findById(wishlistId)
                .filter(w -> userId.equals(w.getUserId()))
                .map(this::toDTO);
    }

    public boolean deleteWishlistByIdForUser(String userId, String wishlistId) {
        return wishlistRepository.findById(wishlistId)
                .filter(w -> userId.equals(w.getUserId()))
                .map(wishlist -> {
                    wishlistRepository.deleteById(wishlist.getId());
                    return true;
                })
                .orElse(false);
    }

    public WishlistDTO addGameToWishlist(String userId, String wishlistId, String gameId) {
        return wishlistRepository.findById(wishlistId)
                .filter(w -> userId.equals(w.getUserId()))
                .map(wishlist -> {
                    if (wishlist.getGameIds() == null) wishlist.setGameIds(new HashSet<>());
                    wishlist.getGameIds().add(gameId);
                    return wishlistRepository.save(wishlist);
                })
                .map(this::toDTO)
                .orElse(null);
    }

    public WishlistDTO removeGameFromWishlist(String userId, String wishlistId, String gameId) {
        return wishlistRepository.findById(wishlistId).filter(w -> userId.equals(w.getUserId())).map(wishlist -> {
            if (wishlist.getGameIds() == null) wishlist.setGameIds(new HashSet<>());
            wishlist.getGameIds().remove(gameId);
            Wishlist updated = wishlistRepository.save(wishlist);
            return toDTO(updated);
        }).orElse(null);
    }

    public WishlistDTO updateWishlistItem(String userId, String wishlistId, String oldGameId, String newGameId) {
        return wishlistRepository.findById(wishlistId).filter(w -> userId.equals(w.getUserId())).map(wishlist -> {
            if (wishlist.getGameIds() == null) wishlist.setGameIds(new HashSet<>());
            wishlist.getGameIds().remove(oldGameId);
            wishlist.getGameIds().add(newGameId);
            Wishlist updated = wishlistRepository.save(wishlist);
            return toDTO(updated);
        }).orElse(null);
    }

    private WishlistDTO toDTO(Wishlist wishlist) {
        List<String> gameIds = new ArrayList<>();
        if (wishlist.getGameIds() != null) {
            gameIds.addAll(wishlist.getGameIds());
        }
        return new WishlistDTO(
            wishlist.getId(),
            wishlist.getUserId(),
            wishlist.getName(),
            new HashSet<>(gameIds),
            wishlist.getCreatedAt()
        );
    }
}
