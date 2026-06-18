<script lang="ts">
  import { Button } from "bits-ui";
    import type { HTMLButtonAttributes } from "svelte/elements";

  const {
    children,
    size = 'wide',
    variant = 'filled',
    type = 'button',
    ...restProps
  } = $props<{
    size?: 'wide' | 'square',
    variant?: 'filled' | 'tonal' | 'outlined' | 'text' | 'tab',
    type?: HTMLButtonAttributes['type'],
    [key: string]: any;
  }>();
  
  const classMap: any = {
    variant: {
      filled: 'bg-primary text-on-primary before:bg-surface/10 active:before:bg-surface/20 disabled:bg-outline-variant',
      tonal: 'bg-primary-muted text-on-surface before:bg-on-surface/5 active:before:bg-on-surface/10 disabled:bg-outline-variant',
      outlined: 'border border-black/20 before:bg-on-surface/5 active:before:bg-on-surface/10 disabled:bg-outline-variant',
      text: 'before:bg-on-surface/5 active:before:bg-on-surface/10 disabled:text-outline-variant',
    },
    size: {
      square: 'p-3 aspect-square',
			wide: 'px-6 py-3',
    }
  }

  // const classMap: any = {
  //   variant: {
  //     filled: 'bg-[radial-gradient(circle_at_center,rgba(167,139,250,0.2),rgba(234,88,12,0.18)_50%,transparent_100%),linear-gradient(135deg,rgba(246,139,30,0.95)_0%,rgba(246,106,30,0.48)_100%),repeating-linear-gradient(45deg,rgba(255,255,255,0.03)_0px,rgba(255,255,255,0.03)_1px,transparent_1px,transparent_10px)] text-on-primary before:bg-surface/10 active:before:bg-surface/20 disabled:bg-outline-variant',
  //     tonal: 'bg-[radial-gradient(circle_at_center,rgba(167,139,250,0.1),rgba(234,88,12,0.08)_50%,transparent_100%),linear-gradient(135deg,rgba(251,191,36,0.15)_0%,rgba(251,146,60,0.1)_100%),repeating-linear-gradient(45deg,rgba(255,255,255,0.03)_0px,rgba(255,255,255,0.03)_1px,transparent_1px,transparent_10px)] text-on-surface before:bg-on-surface/5 active:before:bg-on-surface/10 disabled:bg-outline-variant',
  //     outlined: 'border border-black/20 before:bg-on-surface/5 active:before:bg-on-surface/10 disabled:bg-outline-variant',
  //     text: 'before:bg-on-surface/5 active:before:bg-on-surface/10 disabled:text-outline-variant',
  //   },
  //   size: {
  //     square: 'p-3 aspect-square',
	// 		wide: 'px-6 py-3',
  //   }
  // }
</script>

<Button.Root
  {...restProps}
  class="flex flex-row gap-2 items-center justify-center rounded-full {!restProps.disabled ? 'overlay' : ''} {restProps.class} {classMap.variant[variant]} {classMap.size[size]}"
>
  {@render children()}
</Button.Root>