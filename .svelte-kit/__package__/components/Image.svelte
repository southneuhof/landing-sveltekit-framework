<script lang="ts">
  import { onMount } from 'svelte';

  interface ImageVariant {
    width: number;
    format: string;
    path?: string;
    url?: string;
    size: number;
  }

  interface ImageManifest {
    width: number;
    height: number;
    aspectRatio: number;
    format: string;
    placeholder: string;
    variants: ImageVariant[];
  }

  let {
    src,
    alt = '',
    sizes = '100vw',
    class: className = '',
    priority = false,
    objectFit = 'cover',
    ...restProps
  }: {
    src: string;
    alt?: string;
    sizes?: string;
    class?: string;
    priority?: boolean;
    objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
    [key: string]: any;
  } = $props();

  let manifest = $state<ImageManifest | null>(null);
  let manifestChecked = $state(false);
  let loaded = $state(false);
  let error = $state(false);

  function getManifestUrl(imageSrc: string): string {
    try {
      const url = new URL(imageSrc, window.location.origin);
      return `/api/image/manifest${url.pathname}`;
    } catch {
      return '';
    }
  }

  function getBaseDir(imageSrc: string): string {
    try {
      const url = new URL(imageSrc, window.location.origin);
      return url.pathname.substring(0, url.pathname.lastIndexOf('/') + 1);
    } catch {
      return '';
    }
  }

  function buildSrcset(variants: ImageVariant[], format: string): string {
    const baseDir = getBaseDir(src);
    return variants
      .filter((variant) => variant.format === format)
      .sort((a, b) => a.width - b.width)
      .map((variant) => `${variant.url ?? `${baseDir}${variant.path}`} ${variant.width}w`)
      .join(', ');
  }

  const webpSrcset = $derived(manifest ? buildSrcset(manifest.variants, 'webp') : '');

  async function loadManifest() {
    manifest = null;
    manifestChecked = false;
    loaded = false;
    error = false;

    const manifestUrl = getManifestUrl(src);
    if (!manifestUrl) {
      error = true;
      manifestChecked = true;
      return;
    }

    try {
      const response = await fetch(manifestUrl);
      if (response.ok) {
        manifest = await response.json();
      } else {
        error = true;
      }
    } catch (err) {
      console.error('[Image] Failed to fetch manifest:', err);
      error = true;
    }
    manifestChecked = true;
  }

  onMount(loadManifest);
  $effect(() => {
    if (src) loadManifest();
  });

  function handleLoad() {
    loaded = true;
  }

  function handleError() {
    error = true;
  }
</script>

<div
  class="smart-image-container {className}"
  style="--aspect-ratio: {manifest?.aspectRatio || 'auto'};"
  {...restProps}
>
  {#if !manifestChecked}
    <div class="smart-image-loading"></div>
  {:else if manifest && !error}
    {#if !loaded && manifest.placeholder}
      <img
        src={manifest.placeholder}
        alt=""
        aria-hidden="true"
        class="smart-image-placeholder"
        style="object-fit: {objectFit};"
      />
    {/if}

    <picture>
      {#if webpSrcset}
        <source type="image/webp" srcset={webpSrcset} {sizes} />
      {/if}

      <img
        {src}
        {sizes}
        {alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchpriority={priority ? 'high' : undefined}
        onload={handleLoad}
        onerror={handleError}
        class="smart-image-main"
        class:loaded
        style="object-fit: {objectFit};"
      />
    </picture>
  {:else}
    <img
      {src}
      {alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      onload={handleLoad}
      onerror={handleError}
      class="smart-image-main"
      class:loaded
      style="object-fit: {objectFit};"
    />
  {/if}
</div>

<style>
  .smart-image-container {
    position: relative;
    width: 100%;
    overflow: hidden;
    aspect-ratio: var(--aspect-ratio, auto);
  }

  .smart-image-placeholder {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    filter: blur(20px);
    transform: scale(1.1);
    z-index: 1;
  }

  .smart-image-main {
    width: 100%;
    height: 100%;
    opacity: 0;
    transition: opacity 0.3s ease;
    z-index: 2;
    position: relative;
  }

  .smart-image-main.loaded {
    opacity: 1;
  }

  .smart-image-loading {
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
</style>
