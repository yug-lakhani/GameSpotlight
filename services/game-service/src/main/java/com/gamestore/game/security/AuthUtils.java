package com.gamestore.game.security;

import org.springframework.stereotype.Component;

/**
 * Utility class for authentication-related operations
 */
@Component
public class AuthUtils {

    private final JwtService jwtService;

    public AuthUtils(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    /**
     * Extract username from Authorization header
     * @param authorizationHeader The Authorization header value
     * @return Username or "Anonymous" if extraction fails
     */
    public String extractUsernameFromHeader(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            return "Anonymous";
        }
        String token = authorizationHeader.substring("Bearer ".length()).trim();
        if (token.isEmpty()) {
            return "Anonymous";
        }
        try {
            return jwtService.parseUsername(token).orElse("Anonymous");
        } catch (RuntimeException ex) {
            return "Anonymous";
        }
    }
}
