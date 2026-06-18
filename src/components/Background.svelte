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
    variants: ImageVariant[];
  }

  let {
    src,
    class: className = '',
    overlay = false,
    overlayGradient = 'linear-gradient(rgba(0,0,0,0.16), rgba(0,0,0,0.16)), linear-gradient(to top, rgba(0,0,0,0.33) 0%, rgba(0,0,0,0) 50%)',
    children,
    style: additionalStyle = '',
    ...restProps
  }: {
    src: string;
    class?: string;
    overlay?: boolean;
    overlayGradient?: string;
    children?: any;
    style?: string;
    [key: string]: any;
  } = $props();

  let optimizedSrc = $state('');

  function getManifestUrl(imageSrc: string): string {
    try {
      const url = new URL(imageSrc, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
      return `/api/image/manifest${url.pathname}`;
    } catch {
      return '';
    }
  }

  function getBaseDir(imageSrc: string): string {
    try {
      const url = new URL(imageSrc, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
      return url.pathname.substring(0, url.pathname.lastIndexOf('/') + 1);
    } catch {
      return '';
    }
  }

  async function loadOptimizedSource() {
    optimizedSrc = src;
    if (!src) return;

    try {
      const response = await fetch(getManifestUrl(src));
      if (!response.ok) return;

      const manifest: ImageManifest = await response.json();
      const bestVariant = manifest.variants
        .filter((variant) => variant.format === 'webp')
        .sort((a, b) => b.width - a.width)[0];

      if (bestVariant) {
        optimizedSrc = bestVariant.url ?? `${getBaseDir(src)}${bestVariant.path}`;
      }
    } catch {
      optimizedSrc = src;
    }
  }

  onMount(loadOptimizedSource);
  $effect(() => {
    if (src) loadOptimizedSource();
  });

  const backgroundStyle = $derived(() => {
    const layers: string[] = [];
    if (overlay) layers.push(overlayGradient);
    layers.push(`url('${optimizedSrc}')`);
    return layers.join(', ');
  });
</script>

<div
  class="smart-background {className}"
  style="background-image: {backgroundStyle()}; {additionalStyle}"
  {...restProps}
>
  <img src={optimizedSrc} alt="" aria-hidden="true" class="smart-background-preloader" />

  {#if children}
    {@render children()}
  {/if}
</div>

<style>
  .smart-background {
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    position: relative;
  }

  .smart-background-preloader {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }
</style>
