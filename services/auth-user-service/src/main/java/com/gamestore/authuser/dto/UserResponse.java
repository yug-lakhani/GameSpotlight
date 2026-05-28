package com.gamestore.authuser.dto;

import java.time.Instant;
import java.util.Set;

public record UserResponse(
        String id,
        String username,
        String email,
        String displayName,
        Set<String> roles,
        Instant createdAt) {
}