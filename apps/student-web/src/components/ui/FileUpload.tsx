"use client";

import React, { useState, useRef, useCallback } from "react";

interface FileUploadProps {
  /** Accepted MIME types, e.g. ["application/pdf", "image/jpeg"] */
  accept?: string[];
  /** Max file size in bytes (default 5MB) */
  maxSize?: number;
  /** Called when a file is successfully uploaded. Returns the public URL. */
  onUpload: (url: string, filename: string) => void;
  /** Called when upload fails */
  onError?: (message: string) => void;
  /** Whether the upload is disabled */
  disabled?: boolean;
  /** Label shown above the drop zone */
  label: string;
  /** Helper text shown below the drop zone */
  helperText?: string;
  /** Show remove button if a file is already uploaded */
  uploadedFileName?: string | null;
  /** Called when the user removes an uploaded file */
  onRemove?: () => void;
  /** Upload endpoint */
  uploadUrl?: string;
}

const DEFAULT_ACCEPT = ["application/pdf"];
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function FileUpload({
  accept = DEFAULT_ACCEPT,
  maxSize = DEFAULT_MAX_SIZE,
  onUpload,
  onError,
  disabled = false,
  label,
  helperText,
  uploadedFileName = null,
  onRemove,
  uploadUrl = "/api/auth/upload",
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      // Validate type
      if (!accept.includes(file.type)) {
        const msg = "Invalid file type. Please upload a PDF file.";
        setError(msg);
        onError?.(msg);
        return;
      }

      // Validate size
      if (file.size > maxSize) {
        const msg = `File too large. Maximum size is ${maxSize / (1024 * 1024)}MB.`;
        setError(msg);
        onError?.(msg);
        return;
      }

      setIsUploading(true);
      setUploadProgress(0);

      try {
        const formData = new FormData();
        formData.append("file", file);

        // Simulate progress (since fetch doesn't support upload progress natively)
        const progressTimer = setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + 15, 90));
        }, 200);

        const res = await fetch(uploadUrl, {
          method: "POST",
          body: formData,
        });

        clearInterval(progressTimer);

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || "Upload failed.");
        }

        const data = await res.json();
        setUploadProgress(100);
        onUpload(data.url, file.name);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed.";
        setError(msg);
        onError?.(msg);
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    [accept, maxSize, onUpload, onError, uploadUrl]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled || isUploading) return;
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [disabled, isUploading, handleFile]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragging(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleClick = () => {
    if (!disabled && !isUploading) inputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  // If file is already uploaded, show the uploaded state
  if (uploadedFileName) {
    return (
      <div className="space-y-1">
        <label className="text-sm font-medium text-text">{label}</label>
        <div className="flex items-center gap-3 p-3 rounded-lg border border-trust/30 bg-trust/5">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-trust/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-trust" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text truncate">{uploadedFileName}</p>
            <p className="text-xs text-trust">Uploaded successfully</p>
          </div>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="flex-shrink-0 p-1.5 rounded-md hover:bg-danger/10 text-text-muted hover:text-danger transition-colors cursor-pointer"
              aria-label="Remove file"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-text">{label}</label>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        className={`
          relative flex flex-col items-center justify-center p-6 rounded-lg border-2 border-dashed cursor-pointer
          transition-all duration-200
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          ${isDragging ? "border-brand bg-brand/5" : "border-border hover:border-brand/50 hover:bg-surface-inset/50"}
          ${error ? "border-danger/50 bg-danger/5" : ""}
          ${isUploading ? "pointer-events-none" : ""}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept.join(",")}
          onChange={handleInputChange}
          disabled={disabled || isUploading}
          className="sr-only"
          aria-label={label}
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-2 w-full">
            <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
            <p className="text-sm text-text-muted">Uploading... {uploadProgress}%</p>
            <div className="w-full max-w-[200px] h-1.5 bg-surface-inset rounded-full overflow-hidden">
              <div
                className="h-full bg-brand rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="w-10 h-10 rounded-lg bg-surface-inset flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <p className="text-sm font-medium text-text mb-1">
              <span className="text-brand">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-text-muted">
              PDF only (max {maxSize / (1024 * 1024)}MB)
            </p>
          </>
        )}

        {error && (
          <p className="text-xs text-danger mt-2">{error}</p>
        )}
      </div>
      {helperText && !error && (
        <p className="text-xs text-text-muted mt-1">{helperText}</p>
      )}
    </div>
  );
}
