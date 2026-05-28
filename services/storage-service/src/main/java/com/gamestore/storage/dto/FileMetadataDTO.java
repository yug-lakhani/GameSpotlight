package com.gamestore.storage.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class FileMetadataDTO {
    private String id;
    private String fileName;
    private String fileType;
    private Long fileSize;
    private String url;
    private String uploadedBy;
}
