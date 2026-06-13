import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: '#61c2a5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="20" height="22" viewBox="0 0 20 22" fill="none">
          <path
            d="M10 0C6.134 0 3 3.134 3 7c0 5.25 7 15 7 15s7-9.75 7-15c0-3.866-3.134-7-7-7z"
            fill="white"
          />
          <circle cx="10" cy="7" r="2.5" fill="#61c2a5" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
