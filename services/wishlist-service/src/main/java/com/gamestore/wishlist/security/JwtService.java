package com.gamestore.wishlist.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

@Service
public class JwtService {

    private final SecretKey key;

    public JwtService(@Value("${jwt.secret:[REDACTED-JWT]}") String secret) {
        byte[] secretBytes = decodeSecret(secret);
        this.key = Keys.hmacShaKeyFor(secretBytes);
    }

    private byte[] decodeSecret(String secret) {
        if (secret == null || secret.isBlank()) {
            return "dev-wishlist-secret-dev-wishlist-secret".getBytes(StandardCharsets.UTF_8);
        }

        if (secret.length() >= 32) {
            return secret.getBytes(StandardCharsets.UTF_8);
        }

        try {
            return Decoders.BASE64.decode(secret);
        } catch (IllegalArgumentException ex) {
            try {
                return Decoders.BASE64URL.decode(secret);
            } catch (IllegalArgumentException ex2) {
                return secret.getBytes(StandardCharsets.UTF_8);
            }
        }
    }

    public Optional<String> parseUsername(String token) {
        return Optional.ofNullable(parseClaims(token).getSubject());
    }

    private Claims parseClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}
