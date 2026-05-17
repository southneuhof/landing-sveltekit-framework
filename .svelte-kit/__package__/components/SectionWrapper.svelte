<script lang="ts">
  import IntersectionObserver from './IntersectionObserver.svelte';

  let { children, index = 0 } = $props<{ children: any; index?: number }>();
</script>

{#if index !== 0}
  <IntersectionObserver threshold={0.05} animationDelay={100} animationDirection="fade-up" once>
    {@render children()}
  </IntersectionObserver>
{:else}
  {@render children()}
{/if}
