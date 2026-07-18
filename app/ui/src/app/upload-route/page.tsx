"use client";

export const dynamic = "force-dynamic";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import HiFiUploadPage from "@/app/components/HiFiUploadPage";

const MAX_FILE_MB = 10;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

export default function UploadRoutePage() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragDepth = useRef(0);

  const handleFile = (f: File) => {
    setError(null);
    // Only .json route files are accepted — CSV is rejected here.
    if (!f.name.endsWith(".json")) {
      setError("Only .json route files are accepted.");
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setError(`File exceeds the ${MAX_FILE_MB} MB limit.`);
      return;
    }
    setFile(f);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current === 0) setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleContinue = useCallback(async () => {
    if (!file || isProcessing) return;
    setIsProcessing(true);
    setError(null);

    try {
      const text = await file.text();
      sessionStorage.setItem(
        "routeFile",
        JSON.stringify({ name: file.name, content: text }),
      );
      router.push("/driver-view");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsProcessing(false);
    }
  }, [file, isProcessing, router]);

  return (
    <HiFiUploadPage
      title="Upload your route"
      dropzoneText="Drag and drop JSON files here, or"
      description={`Import delivery details from a JSON file. Maximum file size of ${MAX_FILE_MB} MB.`}
      accept=".json"
      file={file}
      isDragging={isDragging}
      isProcessing={isProcessing}
      error={error}
      onSelectFile={handleFile}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onRemoveFile={() => {
        setFile(null);
        setError(null);
      }}
      onCancel={() => router.back()}
      onNext={() => void handleContinue()}
    />
  );
}
