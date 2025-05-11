import { Button } from "@/components/ui/button"; // Assuming shadcn Button
import { Progress } from "@/components/ui/progress"; // Assuming shadcn Progress
import { FileImage, FileText, FileType, UploadCloud, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
// import { getAttachmentUploadUrl } from '@/lib/supabase/storage'; // Will be used later
// import { useUser } from '@/hooks/useUser'; // Assuming a hook to get current user ID

interface AttachmentFileEntry {
  id: string; // Unique ID for the entry (e.g., uuid)
  file: File;
  previewUrl?: string;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  storagePath?: string;
}

interface AttachmentUploaderProps {
  onAttachmentsUpdate: (
    attachments: Array<{
      name: string;
      size: number;
      type: string;
      storagePath: string;
    }>
  ) => void;
  maxFileSizeMB?: number;
  allowedMimeTypes?: string[];
  // emailId?: string; // Temporary ID for an unsaved email, or actual ID for saved one
  // For now, assume userId is fetched internally or passed if needed for getAttachmentUploadUrl
}

const AttachmentUploader: React.FC<AttachmentUploaderProps> = ({
  onAttachmentsUpdate,
  maxFileSizeMB = 10,
  allowedMimeTypes = [], // Empty array means all types allowed by default, or implement a default set
}) => {
  const [selectedFiles, setSelectedFiles] = useState<AttachmentFileEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // const { user } = useUser(); // Placeholder for getting userId
  const userId_placeholder = "user-placeholder-id"; // Replace with actual user ID

  // Helper to generate preview for image files
  const generatePreview = async (file: File): Promise<string | undefined> => {
    if (file.type.startsWith("image/")) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      });
    }
    return undefined;
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;

    const newFileEntries: AttachmentFileEntry[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const uniqueId = crypto.randomUUID(); // Browser API for UUID

      // Client-side validation
      if (file.size > maxFileSizeMB * 1024 * 1024) {
        // Handle error (e.g., add to list with error status, or show a toast)
        console.warn(`File ${file.name} exceeds ${maxFileSizeMB}MB limit.`);
        // For now, just skipping, but ideally show user feedback
        newFileEntries.push({
          id: uniqueId,
          file,
          progress: 0,
          status: "error",
          error: `Exceeds ${maxFileSizeMB}MB limit`,
        });
        continue;
      }

      if (
        allowedMimeTypes.length > 0 &&
        !allowedMimeTypes.includes(file.type)
      ) {
        console.warn(`File ${file.name} has unsupported type ${file.type}.`);
        newFileEntries.push({
          id: uniqueId,
          file,
          progress: 0,
          status: "error",
          error: `Unsupported file type`,
        });
        continue;
      }

      const preview = await generatePreview(file);
      newFileEntries.push({
        id: uniqueId,
        file,
        previewUrl: preview,
        progress: 0,
        status: "pending",
      });
    }
    setSelectedFiles((prevFiles) => [...prevFiles, ...newFileEntries]);
    // Upload logic will be triggered here or by a separate effect for 'pending' files
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Optionally add more visual cues here if needed
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Reset file input
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (fileId: string) => {
    setSelectedFiles((prevFiles) => prevFiles.filter((f) => f.id !== fileId));
    // TODO: If file is uploading, cancel the upload (requires XHR/fetch abort controller)
  };

  // Effect to call onAttachmentsUpdate when selectedFiles with status 'success' changes
  useEffect(() => {
    const successfulUploads = selectedFiles
      .filter((f) => f.status === "success" && f.storagePath)
      .map((f) => ({
        name: f.file.name,
        size: f.file.size,
        type: f.file.type,
        storagePath: f.storagePath!,
      }));
    onAttachmentsUpdate(successfulUploads);
  }, [selectedFiles, onAttachmentsUpdate]);

  // TODO: Implement actual upload logic here (e.g., in an effect watching for 'pending' files)
  // This will involve getAttachmentUploadUrl and XHR/fetch as detailed in the plan.

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/"))
      return <FileImage className="h-6 w-6 flex-shrink-0" />;
    if (fileType === "application/pdf")
      return <FileType className="h-6 w-6 flex-shrink-0" />;
    return <FileText className="h-6 w-6 flex-shrink-0" />;
  };

  return (
    <div className="space-y-4">
      <div
        className={`p-6 border-2 border-dashed rounded-lg text-center cursor-pointer
                    ${
                      isDragging
                        ? "border-primary bg-primary-foreground"
                        : "border-muted-foreground/30 hover:border-muted-foreground/50"
                    }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={triggerFileInput} // Allow click to open file dialog as well
        role="button"
        tabIndex={0}
        onKeyDown={(e) =>
          e.key === "Enter" || e.key === " " ? triggerFileInput() : undefined
        }
        aria-label="Drag and drop files here or click to select files"
      >
        <input
          type="file"
          multiple
          ref={fileInputRef}
          onChange={handleFileInputChange}
          className="hidden"
          accept={allowedMimeTypes.join(",") || undefined} // Set accept attribute
        />
        <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          Drag & drop files here, or click to select files.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Max file size: {maxFileSizeMB}MB.
          {allowedMimeTypes.length > 0 &&
            `Allowed types: ${allowedMimeTypes.join(", ")}`}
        </p>
      </div>

      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Selected Files:</h3>
          {selectedFiles.map((entry) => (
            <div
              key={entry.id}
              className="p-3 border rounded-md flex items-center space-x-3"
            >
              {entry.previewUrl && entry.file.type.startsWith("image/") ? (
                <img
                  src={entry.previewUrl}
                  alt={entry.file.name}
                  className="h-10 w-10 rounded object-cover flex-shrink-0"
                />
              ) : (
                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                  {getFileIcon(entry.file.type)}
                </div>
              )}
              <div className="flex-grow min-w-0">
                <p className="text-sm font-medium truncate">
                  {entry.file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(entry.file.size / 1024 / 1024).toFixed(2)} MB -{" "}
                  {entry.status}
                </p>
                {entry.status === "uploading" && (
                  <Progress value={entry.progress} className="h-1.5 mt-1" />
                )}
                {entry.status === "error" && entry.error && (
                  <p className="text-xs text-destructive mt-0.5">
                    Error: {entry.error}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeFile(entry.id)}
                className="flex-shrink-0"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Remove file</span>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AttachmentUploader;
