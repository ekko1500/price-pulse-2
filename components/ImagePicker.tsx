'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from './ui';

const MAX_DIM = 480;
const JPEG_QUALITY = 0.72;

function downscale(dataUrl: string, maxDim: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    };
    img.onerror = () => reject(new Error('Could not read image'));
    img.src = dataUrl;
  });
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export interface ImagePickerLabels {
  uploadFromFile: string;
  useCamera: string;
  capture: string;
  cancel: string;
  removeImage: string;
  cameraUnavailable: string;
  hint: string;
}

export function ImagePicker({ value, onChange, labels, autoStart = false }: { value?: string; onChange: (dataUrl: string) => void; labels: ImagePickerLabels; autoStart?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [error, setError] = useState('');

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => {});
    }
  }, [cameraOn]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    stopCamera();
    try {
      onChange(await downscale(await readFile(file), MAX_DIM));
    } catch {
      setError('Could not read that image.');
    }
  };

  const startCamera = useCallback(async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(labels.cameraUnavailable);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      setCameraOn(true);
    } catch {
      setError(labels.cameraUnavailable);
    }
  }, [labels.cameraUnavailable]);

  useEffect(() => {
    if (autoStart) void startCamera();
  }, [autoStart, startCamera]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const scale = Math.min(1, MAX_DIM / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      onChange(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    }
    stopCamera();
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {cameraOn ? (
        <>
          <video ref={videoRef} className="w-full max-w-xs rounded-lg bg-black aspect-video object-cover" playsInline muted />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={capture}>{labels.capture}</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>{labels.uploadFromFile}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={stopCamera}>{labels.cancel}</Button>
          </div>
        </>
      ) : (
        <>
          {value ? (
            <img src={value} alt="preview" className="h-32 w-32 rounded-lg border border-slate-200 object-cover" />
          ) : (
            <div className="h-32 w-32 rounded-lg border border-dashed border-slate-300 grid place-items-center text-xs text-slate-400">—</div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>{labels.uploadFromFile}</Button>
            <Button type="button" size="sm" variant="secondary" onClick={startCamera}>{labels.useCamera}</Button>
            {value && <Button type="button" size="sm" variant="ghost" onClick={() => onChange('')}>{labels.removeImage}</Button>}
          </div>
        </>
      )}
      {error ? <p className="text-xs text-red-600">{error}</p> : <p className="text-xs text-slate-500">{labels.hint}</p>}
    </div>
  );
}
