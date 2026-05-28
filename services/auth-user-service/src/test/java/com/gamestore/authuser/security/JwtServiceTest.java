package com.gamestore.authuser.security;

import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JwtServiceTest {

    @Test
    void generatesAndParsesToken() {
        JwtService jwtService = new JwtService("[REDACTED-JWT]", 60);
        String token = jwtService.generateToken("alice", Set.of("USER"));

        assertTrue(jwtService.parseUsername(token).isPresent());
        assertEquals("alice", jwtService.parseUsername(token).orElseThrow());
        assertTrue(jwtService.parseRoles(token).contains("USER"));
    }
}