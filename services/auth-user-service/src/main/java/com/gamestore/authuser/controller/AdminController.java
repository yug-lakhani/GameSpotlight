package com.gamestore.authuser.controller;

import com.gamestore.authuser.dto.UserResponse;
import com.gamestore.authuser.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import lombok.RequiredArgsConstructor;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class AdminController {

    private final AuthService authService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserResponse>> listUsers() {
        return ResponseEntity.ok(authService.listUsers());
    }

    @DeleteMapping("/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteUser(@PathVariable String userId) {
        authService.deleteUser(userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/cleanup-roles")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> cleanupRoles() {
        int updatedUsers = authService.cleanupRoleAssignments();
        return ResponseEntity.ok("Role cleanup complete. Updated users: " + updatedUsers);
    }
}
