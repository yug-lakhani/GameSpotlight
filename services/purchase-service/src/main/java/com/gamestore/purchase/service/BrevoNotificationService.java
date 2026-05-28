package com.gamestore.purchase.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import jakarta.mail.internet.MimeMessage;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class BrevoNotificationService {

    private final JavaMailSender mailSender;
    private final RestTemplate restTemplate;

    @Value("${auth.user.service.url}")
    private String authUserServiceUrl;

    @Value("${game.service.url}")
    private String gameServiceUrl;

    @Value("${app.mail.from-address}")
    private String fromAddress;

    @Async
    @Retryable(
        retryFor = Exception.class,
        maxAttempts = 3,
        backoff = @Backoff(delay = 2000, multiplier = 2.0)
    )
    public void sendPurchaseSuccessEmail(String username, String gameId, Double price) {
        if (username == null || username.isBlank()) {
            log.warn("Skipping purchase-success email because username is blank");
            return;
        }

        Optional<UserContact> contact = resolveUser(username);
        if (contact.isEmpty() || contact.get().email() == null || contact.get().email().isBlank()) {
            log.warn("Skipping purchase-success email because no email address could be resolved for username='{}'", username);
            return;
        }
        log.debug("Resolved purchase recipient for username='{}': {}", username, contact.get());

        GameSummary game = resolveGame(gameId).orElse(new GameSummary(gameId, "your game", price));
        log.debug("Resolved game summary for gameId='{}': {}", gameId, game);
        String subject = "Purchase successful: " + safeText(game.title(), "your game");
        String priceText = price == null ? "" : String.format(Locale.ROOT, "%.2f", price);
        String body = """
                <html>
                  <body style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
                    <h2 style="color: #0f766e;">Purchase completed</h2>
                    <p>Hi %s,</p>
                    <p>Your purchase of <strong>%s</strong> was completed successfully.</p>
                    <p>%s</p>
                    <p style="margin-top: 24px;">Thanks for buying from GameSpotlight.</p>
                  </body>
                </html>
                """.formatted(
                escapeHtml(displayName(contact.get())),
                escapeHtml(game.title()),
                priceText.isBlank() ? "" : "Total paid: " + escapeHtml(priceText)
        );

        sendHtmlEmail(contact.get().email(), subject, body);
    }

    private Optional<UserContact> resolveUser(String username) {
        try {
            ResponseEntity<UserContact> response = restTemplate.getForEntity(
                    authUserServiceUrl + "/users/by-username/{username}",
                    UserContact.class,
                    username);
            if (!response.getStatusCode().is2xxSuccessful()) {
                return Optional.empty();
            }
            return Optional.ofNullable(response.getBody());
        } catch (Exception exception) {
            log.error("Could not resolve purchase recipient for username='{}'", username, exception);
            return Optional.empty();
        }
    }

    private Optional<GameSummary> resolveGame(String gameId) {
        if (gameId == null || gameId.isBlank()) {
            return Optional.empty();
        }

        try {
            ResponseEntity<GameSummary> response = restTemplate.getForEntity(
                    gameServiceUrl + "/games/{gameId}",
                    GameSummary.class,
                    gameId);
            if (!response.getStatusCode().is2xxSuccessful()) {
                return Optional.empty();
            }
            return Optional.ofNullable(response.getBody());
        } catch (Exception exception) {
            log.warn("Could not resolve game summary for gameId='{}': {}", gameId, exception.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Public helper to fetch a game's summary (id, title, price).
     * Used by other services that need the game's current price when clients omit it.
     */
    public Optional<GameSummary> fetchGameSummary(String gameId) {
        return resolveGame(gameId);
    }

    @Retryable(
        retryFor = Exception.class,
        maxAttempts = 3,
        backoff = @Backoff(delay = 1500, multiplier = 1.5)
    )
    private void sendHtmlEmail(String to, String subject, String htmlBody) {
        try {
            log.info("Sending purchase-success email to {} via Brevo from {}", to, fromAddress);
            log.debug("Email subject='{}', bodyLength={}, to={}, from={}", subject, htmlBody == null ? 0 : htmlBody.length(), to, fromAddress);
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            try {
                MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, StandardCharsets.UTF_8.name());
                if (fromAddress != null && !fromAddress.isBlank()) {
                    helper.setFrom(fromAddress);
                }
                helper.setTo(to);
                helper.setSubject(subject);
                helper.setText(htmlBody, true);
                mailSender.send(mimeMessage);
            } catch (jakarta.mail.MessagingException me) {
                throw new RuntimeException(me);
            }
            log.info("Sent purchase-success email to {}", to);
        } catch (Exception exception) {
            log.error("Failed to send purchase-success email to {} - will retry", to, exception);
            throw exception;
        }
    }

    private String displayName(UserContact contact) {
        if (contact.displayName() != null && !contact.displayName().isBlank()) {
            return contact.displayName();
        }
        if (contact.username() != null && !contact.username().isBlank()) {
            return contact.username();
        }
        return "Customer";
    }

    private String safeText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private String escapeHtml(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private record UserContact(String id, String username, String email, String displayName) {
    }

    private record GameSummary(String id, String title, Double price) {
    }
}