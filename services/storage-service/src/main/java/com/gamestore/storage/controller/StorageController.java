package com.gamestore.storage.controller;

import com.gamestore.storage.dto.FileMetadataDTO;
import com.gamestore.storage.service.StorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/storage")
@RequiredArgsConstructor
public class StorageController {

    private final StorageService storageService;

    @PostMapping("/upload")
    public ResponseEntity<FileMetadataDTO> uploadFile(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "uploadedBy", required = false) String uploadedBy) {
        try {
            if (file == null || file.isEmpty()) {
                return ResponseEntity.badRequest().build();
            }
            
            String fileName = file.getOriginalFilename();
            String fileType = file.getContentType();
            Long fileSize = file.getSize();
            
            FileMetadataDTO metadata = storageService.uploadFile(fileName, fileType, fileSize, uploadedBy, file);
            return ResponseEntity.status(HttpStatus.CREATED).body(metadata);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/upload-metadata")
    public ResponseEntity<FileMetadataDTO> uploadFileMetadata(@RequestBody FileMetadataDTO fileMetadata) {
        try {
            // This endpoint is for metadata-only upload (used when file is handled separately)
            FileMetadataDTO metadata = storageService.getFileMetadata(fileMetadata.getId());
            return ResponseEntity.status(HttpStatus.CREATED).body(metadata);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/files/{fileId}/metadata")
    public ResponseEntity<FileMetadataDTO> getFileMetadata(@PathVariable String fileId) {
        FileMetadataDTO metadata = storageService.getFileMetadata(fileId);
        if (metadata == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(metadata);
    }

    @GetMapping("/files/{fileId}")
    public ResponseEntity<byte[]> downloadFile(@PathVariable String fileId) {
        try {
            byte[] fileContent = storageService.getFileContent(fileId);
            if (fileContent == null) {
                return ResponseEntity.notFound().build();
            }
            
            String fileName = storageService.getFileName(fileId);
            String fileType = storageService.getFileType(fileId);

            ResponseEntity.BodyBuilder response = ResponseEntity.ok().contentType(MediaType.parseMediaType(fileType));
            if (fileType == null || !fileType.startsWith("image/")) {
                response = response.header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"");
            }

            return response.body(fileContent);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/files/{fileId}/download")
    public ResponseEntity<byte[]> downloadFileAttachment(@PathVariable String fileId) {
        try {
            byte[] fileContent = storageService.getFileContent(fileId);
            if (fileContent == null) {
                return ResponseEntity.notFound().build();
            }

            String fileName = storageService.getFileName(fileId);
            String fileType = storageService.getFileType(fileId);

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(fileType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                    .body(fileContent);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping("/files/{fileId}")
    public ResponseEntity<Void> deleteFile(@PathVariable String fileId) {
        try {
            storageService.deleteFile(fileId);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/signed-url/{fileId}")
    public ResponseEntity<Map<String, String>> getSignedUrl(
            @PathVariable String fileId,
            @RequestParam(value = "expiresIn", defaultValue = "3600") int expiresInSeconds) {
        try {
            String signedUrl = storageService.getSignedDownloadUrl(fileId, expiresInSeconds);
            return ResponseEntity.ok(Map.of("url", signedUrl));
        } catch (Exception e) {
            System.err.println("⚠️ Failed to generate signed URL for " + fileId + ": " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to generate signed URL"));
        }
    }

    @GetMapping("/signed-url")
    public ResponseEntity<Map<String, String>> getSignedUrlByFileUrl(
            @RequestParam("fileUrl") String fileUrl,
            @RequestParam(value = "expiresIn", defaultValue = "3600") int expiresInSeconds) {
        try {
            String signedUrl = storageService.getSignedDownloadUrlFromFileUrl(fileUrl, expiresInSeconds);
            return ResponseEntity.ok(Map.of("url", signedUrl));
        } catch (Exception e) {
            System.err.println("⚠️ Failed to generate signed URL for fileUrl=" + fileUrl + ": " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to generate signed URL"));
        }
    }
}
