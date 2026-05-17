<script lang="ts">
  const {
    active,
    ...restProps
  } = $props()
</script>

<button {...restProps} class="px-6 py-3 w-full box-border overlay whitespace-nowrap before:bg-on-surface/5 active:before:bg-on-surface/10 {active ? 'shadow-[inset_0_-2px_0_0_var(--colors-outline)] text-on-surface bg-on-surface/[12%]' : 'shadow-[inset_0_-1px_0_0_var(--colors-outline-variant)] text-outline'}">
  {@render restProps.children()}
</button>