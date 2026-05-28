package com.gamestore.authuser.dto;

public record AuthResponse(String token, long expiresInSeconds, UserResponse user) {
}