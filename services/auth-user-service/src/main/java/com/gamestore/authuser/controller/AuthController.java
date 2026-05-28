package com.gamestore.authuser.controller;

import com.gamestore.authuser.dto.AuthResponse;
import com.gamestore.authuser.dto.LoginRequest;
import com.gamestore.authuser.dto.RegisterRequest;
import com.gamestore.authuser.dto.SupabaseAuthRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.gamestore.authuser.dto.UserResponse;
import com.gamestore.authuser.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    @PostMapping("/register")
    public ResponseEntity<UserResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/developer")
    public ResponseEntity<AuthResponse> becomeDeveloper(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(authService.becomeDeveloper(authentication.getName()));
    }

    @PostMapping("/bootstrap")
    public ResponseEntity<Object> bootstrap(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.bootstrapFirstAdmin(request));
    }

    @PostMapping("/oauth")
    public ResponseEntity<Object> oauth(@Valid @RequestBody SupabaseAuthRequest request) {
            String token = request.accessToken();
            log.info("/api/auth/oauth called - accessToken present={}, length={}", token != null && !token.isBlank(), token == null ? 0 : Math.min(token.length(), 200));
            // Let service and GlobalExceptionHandler handle validation and errors so clients receive JSON error payloads
            return ResponseEntity.ok(authService.exchangeSupabaseToken(token, Boolean.TRUE.equals(request.wantsDeveloper())));
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> me(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(authService.me(authentication.getName()));
    }

    @GetMapping("/session")
    public ResponseEntity<UserResponse> session(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(authService.me(authentication.getName()));
    }
}