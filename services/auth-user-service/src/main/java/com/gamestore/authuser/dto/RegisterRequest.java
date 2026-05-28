package com.gamestore.authuser.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank @Size(min = 3, max = 32) String username,
        String email,
        @NotBlank @Size(min = 8, max = 72) String password,
        String displayName,
        String role) {
}