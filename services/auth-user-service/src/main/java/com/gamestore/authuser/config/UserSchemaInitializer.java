package com.gamestore.authuser.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class UserSchemaInitializer {

    private static final Logger log = LoggerFactory.getLogger(UserSchemaInitializer.class);

    private final JdbcTemplate jdbcTemplate;

    public UserSchemaInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void ensureDeveloperOptInColumn() {
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "select count(*) from information_schema.columns where table_name = 'users' and column_name = 'developer_opt_in'",
                    Integer.class
            );

            if (count != null && count > 0) {
                return;
            }

            log.info("Adding missing developer_opt_in column to users table");
            jdbcTemplate.execute("alter table users add column if not exists developer_opt_in boolean not null default false");
        } catch (Exception ex) {
            log.warn("Unable to ensure developer_opt_in column exists", ex);
        }
    }
}