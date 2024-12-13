"use client";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";

export const Uploader = () => {
  const [file, setFile] = useState<File | undefined>();
  const [filename, setFilename] = useState<string>("");

  const handlePreSignedUrlSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const res = await fetch("/api/cloudflare", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filename: file!.name }),
    });
  };

  const getDownload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const res = await fetch(`/api/cloudflare?filename=${filename}`);
    const { url } = await res.json();
    window.open(url);
  }

  return (
    <>
      <form onSubmit={(e) => handlePreSignedUrlSubmit(e)}>
        <input
          accept="image/*"
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || undefined)}
        />

        <Button>Pre-signed URL</Button>
      </form>

      <form onSubmit={(e) => getDownload(e)}>
        <input
          type="text"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
        />
        <Button>Download</Button>
      </form>
    </>
  );
};
