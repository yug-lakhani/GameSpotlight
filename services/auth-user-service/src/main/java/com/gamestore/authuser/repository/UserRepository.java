package com.gamestore.authuser.repository;

import com.gamestore.authuser.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, String> {

    Optional<User> findByUsernameIgnoreCase(String username);

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByEmailIgnoreCase(String email);

    @Query("select case when count(u) > 0 then true else false end from User u join u.roles r where upper(r) = upper(:role)")
    boolean existsByRole(@Param("role") String role);
}