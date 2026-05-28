package com.gamestore.authuser.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
public class JwtService {

    private final SecretKey key;
    private final long expirationSeconds;

    public JwtService(@Value("${jwt.secret}") String secret,
                      @Value("${jwt.expiration-seconds:604800}") long expirationSeconds) {
        byte[] secretBytes;
        if (secret.length() >= 32) {
            secretBytes = secret.getBytes(StandardCharsets.UTF_8);
        } else {
            try {
                secretBytes = Decoders.BASE64.decode(secret);
            } catch (io.jsonwebtoken.io.DecodingException e) {
                try {
                    // Accept URL-safe base64 (contains '-' and '_')
                    secretBytes = Decoders.BASE64URL.decode(secret);
                } catch (io.jsonwebtoken.io.DecodingException ex) {
                    // Fallback to raw UTF-8 bytes if decoding fails
                    secretBytes = secret.getBytes(StandardCharsets.UTF_8);
                }
            }
        }

        // Ensure key is strong enough for HS256. If too short, derive a 256-bit key via SHA-256.
        SecretKey tmpKey;
        try {
            tmpKey = Keys.hmacShaKeyFor(secretBytes);
        } catch (io.jsonwebtoken.security.WeakKeyException weak) {
            try {
                java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
                byte[] hashed = md.digest(secretBytes);
                tmpKey = Keys.hmacShaKeyFor(hashed);
            } catch (Exception ex) {
                // Last resort: use original bytes (this will likely fail later).
                tmpKey = Keys.hmacShaKeyFor(secretBytes);
            }
        }
        this.key = tmpKey;
        this.expirationSeconds = expirationSeconds;
    }

    public String generateToken(String username, Set<String> roles) {
        Instant now = Instant.now();
        return Jwts.builder()
                .setSubject(username)
                .claim("roles", roles)
                .setIssuedAt(Date.from(now))
                .setExpiration(Date.from(now.plusSeconds(expirationSeconds)))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public Optional<String> parseUsername(String token) {
        return Optional.ofNullable(parseClaims(token).getSubject());
    }

    public List<String> parseRoles(String token) {
        Object roles = parseClaims(token).get("roles");
        if (roles instanceof List<?> list) {
            return list.stream().map(String::valueOf).toList();
        }
        return List.of();
    }

    private Claims parseClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    public long getExpirationSeconds() {
        return expirationSeconds;
    }
}