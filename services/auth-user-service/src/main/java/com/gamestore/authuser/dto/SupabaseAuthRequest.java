package com.gamestore.authuser.dto;

import jakarta.validation.constraints.NotBlank;

public record SupabaseAuthRequest(
        @NotBlank(message = "Access token is required")
        String accessToken,
        Boolean wantsDeveloper) {
}