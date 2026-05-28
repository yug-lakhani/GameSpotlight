package com.gamestore.game.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
public class PaginationDTO<T> {
    private List<T> content;
    private int pageNumber;
    private int pageSize;
    private long totalElements;
    private int totalPages;
    private boolean hasNext;
    private boolean hasPrevious;

    public PaginationDTO(List<T> content, int pageNumber, int pageSize, long totalElements, int totalPages, boolean hasNext, boolean hasPrevious) {
        this.content = content == null ? new ArrayList<>() : new ArrayList<>(content);
        this.pageNumber = pageNumber;
        this.pageSize = pageSize;
        this.totalElements = totalElements;
        this.totalPages = totalPages;
        this.hasNext = hasNext;
        this.hasPrevious = hasPrevious;
    }

    public void setContent(List<T> content) {
        this.content = content == null ? new ArrayList<>() : new ArrayList<>(content);
    }

    public static <T> PaginationDTO<T> of(List<T> content, int pageNumber, int pageSize, long totalElements) {
        int totalPages = (int) Math.ceil((double) totalElements / pageSize);
        boolean hasNext = pageNumber < totalPages;
        boolean hasPrevious = pageNumber > 1;
        return new PaginationDTO<>(content, pageNumber, pageSize, totalElements, totalPages, hasNext, hasPrevious);
    }
}
