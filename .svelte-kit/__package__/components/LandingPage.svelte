<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import type { LandingSection, SectionComponentRegistry } from '../types/index.js';
  import SectionRenderer from './SectionRenderer.svelte';

  let {
    sections,
    sectionComponents,
    class: className = 'flex flex-col col-span-4',
  } = $props<{
    sections: LandingSection[];
    sectionComponents: SectionComponentRegistry;
    class?: string;
  }>();

  $effect(() => {
    if (!browser) return;

    const hash = $page.url.hash;
    if (!hash) return;

    const id = hash.substring(1);
    const scrollToElement = () => {
      const element = document.getElementById(id);
      if (element) element.scrollIntoView({ behavior: 'smooth' });
    };

    scrollToElement();

    const observer = new MutationObserver((_mutations, obs) => {
      if (document.getElementById(id)) {
        scrollToElement();
        obs.disconnect();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  });
</script>

<div class={className}>
  {#each sections as section, index (section.id)}
    <SectionRenderer {section} {index} {sectionComponents} />
  {/each}
</div>
