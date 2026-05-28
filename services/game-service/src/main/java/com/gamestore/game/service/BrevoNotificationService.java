package com.gamestore.game.service;

import jakarta.mail.internet.MimeMessage;
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

import java.nio.charset.StandardCharsets;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class BrevoNotificationService {

    private final JavaMailSender mailSender;
    private final RestTemplate restTemplate;

    @Value("${auth.user.service.url}")
    private String authUserServiceUrl;

    @Value("${app.mail.from-address}")
    private String fromAddress;

    @Async
    @Retryable(
        retryFor = Exception.class,
        maxAttempts = 5,
        backoff = @Backoff(delay = 3000, multiplier = 2.0)
    )
    public void sendGameCreatedEmail(String developerUsername, String gameTitle) {
        if (developerUsername == null || developerUsername.isBlank()) {
            log.warn("Skipping game-created email because developer username is blank");
            return;
        }

        resolveContact(developerUsername).ifPresentOrElse(contact -> {
            log.debug("Resolved contact for username='{}': {}", developerUsername, contact);
            if (contact.email() == null || contact.email().isBlank()) {
                log.warn("Skipping game-created email for username='{}' because no email address was found", developerUsername);
                return;
            }

            String title = safeText(gameTitle, "your new game");
            String subject = "Game published successfully: " + title;
            String greetingName = displayName(contact);
            String body = """
                    <html>
                      <body style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
                        <h2 style="color: #0f766e;">Your game is live</h2>
                        <p>Hi %s,</p>
                        <p>Your game <strong>%s</strong> was created successfully in GameSpotlight.</p>
                        <p>You can now edit it, upload new assets, and track performance from your developer workspace.</p>
                        <p style="margin-top: 24px;">GameSpotlight</p>
                      </body>
                    </html>
                    """.formatted(escapeHtml(greetingName), escapeHtml(title));

            sendHtmlEmail(contact.email(), subject, body);
        }, () -> log.warn("Skipping game-created email because the recipient could not be resolved for username='{}'", developerUsername));
    }

    private Optional<UserContact> resolveContact(String username) {
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
            log.error("Could not resolve user contact for username='{}'", username, exception);
            return Optional.empty();
        }
    }

    @Retryable(
        retryFor = Exception.class,
        maxAttempts = 5,
        backoff = @Backoff(delay = 2000, multiplier = 1.5)
    )
    private void sendHtmlEmail(String to, String subject, String htmlBody) {
        try {
            log.info("Sending game-created email to {} via Brevo from {}", to, fromAddress);
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
            log.info("Sent game-created email to {}", to);
        } catch (Exception exception) {
            log.error("Failed to send game-created email to {} - will retry", to, exception);
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
        return "Developer";
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
}
