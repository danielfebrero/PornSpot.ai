"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/Button";

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  maxFiles?: number;
  maxFileSize?: number; // in bytes
}

export function FileUpload({
  onFilesSelected,
  accept = "*/*",
  multiple = false,
  disabled = false,
  maxFiles = 10,
  maxFileSize = 10 * 1024 * 1024, // 10MB default
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFiles = (
    files: File[]
  ): { validFiles: File[]; errors: string[] } => {
    const validFiles: File[] = [];
    const newErrors: string[] = [];

    if (files.length > maxFiles) {
      newErrors.push(`Maximum ${maxFiles} files allowed`);
      return { validFiles: [], errors: newErrors };
    }

    files.forEach((file) => {
      // Check file size
      if (file.size > maxFileSize) {
        newErrors.push(
          `${file.name} is too large (max ${Math.round(
            maxFileSize / 1024 / 1024
          )}MB)`
        );
        return;
      }

      // Check file type if accept is specified
      if (accept !== "*/*") {
        const acceptedTypes = accept.split(",").map((type) => type.trim());
        const isValidType = acceptedTypes.some((type) => {
          if (!type) return false;
          if (type.startsWith(".")) {
            return file.name.toLowerCase().endsWith(type.toLowerCase());
          }
          if (type.includes("*")) {
            const baseType = type.split("/")[0];
            return baseType && file.type.startsWith(baseType);
          }
          return file.type === type;
        });

        if (!isValidType) {
          newErrors.push(`${file.name} is not a supported file type`);
          return;
        }
      }

      validFiles.push(file);
    });

    return { validFiles, errors: newErrors };
  };

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const fileArray = Array.from(files);
      const { validFiles, errors } = validateFiles(fileArray);

      setErrors(errors);

      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    },
    [onFilesSelected, maxFiles, maxFileSize, accept]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      handleFiles(files);
    },
    [disabled, handleFiles]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      // Reset input value to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleFiles]
  );

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${
            isDragOver
              ? "border-blue-400 bg-blue-50"
              : "border-gray-300 hover:border-gray-400"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInputChange}
          disabled={disabled}
          className="hidden"
        />

        <div className="space-y-4">
          <div className="mx-auto w-12 h-12 text-gray-400">
            <svg
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-full h-full"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>

          <div>
            <p className="text-lg font-medium text-gray-900">
              {isDragOver ? "Drop files here" : "Upload files"}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Drag and drop files here, or click to select
            </p>
          </div>

          <div className="text-xs text-gray-400 space-y-1">
            <p>Maximum {maxFiles} files</p>
            <p>Maximum file size: {formatFileSize(maxFileSize)}</p>
            {accept !== "*/*" && <p>Accepted types: {accept}</p>}
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="pointer-events-none"
          >
            {disabled ? "Uploading..." : "Choose Files"}
          </Button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h4 className="text-sm font-medium text-red-800 mb-2">
            Upload Errors:
          </h4>
          <ul className="text-sm text-red-700 space-y-1">
            {errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
