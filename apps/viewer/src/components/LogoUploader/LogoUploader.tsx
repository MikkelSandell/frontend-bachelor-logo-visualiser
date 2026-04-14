import { useRef } from "react";
import { uploadLogo } from "../../api/viewerApi";

interface Props {
  preloadedUrl?: string;
  onLogoReady: (url: string) => void;
}

const ACCEPTED = "image/png,image/jpeg,image/svg+xml";

export function LogoUploader({ preloadedUrl, onLogoReady }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Upload to backend (B3) to get a stable reference
    const result = await uploadLogo(file);
    if (result.success) {
      onLogoReady(result.data.url);
    }
  }

  if (preloadedUrl) {
    return (
      <p>
        Logo forudindlæst:{" "}
        <button onClick={() => inputRef.current?.click()}>Skift logo</button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          style={{ display: "none" }}
          onChange={handleChange}
        />
      </p>
    );
  }

  return (
    <div>
      <label>
        Upload dit logo (PNG, JPG, SVG)
        <input
          type="file"
          accept={ACCEPTED}
          style={{ marginLeft: "0.5rem" }}
          onChange={handleChange}
        />
      </label>
    </div>
  );
}
