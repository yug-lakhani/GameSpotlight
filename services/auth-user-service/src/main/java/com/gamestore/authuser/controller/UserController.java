package com.gamestore.authuser.controller;

import com.gamestore.authuser.dto.UserResponse;
import com.gamestore.authuser.service.AuthService;
import org.springframework.security.core.Authentication;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final AuthService authService;

    @GetMapping("/profile")
    public UserResponse profile(Authentication authentication) {
        return authService.me(authentication.getName());
    }

    @GetMapping("/by-username/{username}")
    public ResponseEntity<UserResponse> byUsername(@PathVariable String username) {
        try {
            return ResponseEntity.ok(authService.me(username));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }
}