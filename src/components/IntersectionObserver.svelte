<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  let {
    children,
    threshold = 0.1,
    animationDelay = 0,
    animationDirection = 'fade-up',
    once = true,
  } = $props<{
    children: any;
    threshold?: number;
    animationDelay?: number;
    animationDirection?: string;
    once?: boolean;
  }>();

  let element: HTMLElement;
  let visible = $state(false);
  let observer: globalThis.IntersectionObserver | undefined;

  onMount(() => {
    observer = new globalThis.IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          visible = true;
          if (once) observer?.disconnect();
        } else if (!once) {
          visible = false;
        }
      },
      { threshold },
    );

    observer.observe(element);
  });

  onDestroy(() => observer?.disconnect());
</script>

<div
  bind:this={element}
  class={`landing-sveltekit-framework-observed ${visible ? 'landing-sveltekit-framework-visible' : ''}`}
  data-animation={animationDirection}
  style={`--landing-sveltekit-framework-animation-delay: ${animationDelay}ms`}
>
  {@render children()}
</div>
