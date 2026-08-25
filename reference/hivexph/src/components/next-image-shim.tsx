import * as React from "react";

/**
 * Minimal shim for `next/image`. Renders a plain `<img>` while accepting the
 * subset of props the ported components actually use: `src`, `alt`, `fill`,
 * `width`, `height`, `className`, `priority`, `sizes`, `onError`.
 *
 * `fill` switches the image to absolute-fill (matching Next's behaviour when
 * the parent has `position: relative`).
 */
export interface ImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "loading"> {
  src: string;
  alt: string;
  fill?: boolean;
  width?: number | string;
  height?: number | string;
  priority?: boolean;
  sizes?: string;
  unoptimized?: boolean;
  quality?: number;
  placeholder?: string;
  blurDataURL?: string;
}

export default function Image({
  src,
  alt,
  fill,
  width,
  height,
  className,
  priority: _priority,
  sizes: _sizes,
  unoptimized: _unoptimized,
  quality: _quality,
  placeholder: _placeholder,
  blurDataURL: _blurDataURL,
  style,
  ...rest
}: ImageProps) {
  if (fill) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          ...style,
        }}
        loading="lazy"
        {...rest}
      />
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={style}
      loading="lazy"
      {...rest}
    />
  );
}
