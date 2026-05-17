<script lang="ts">
	import emblaCarouselSvelte from "embla-carousel-svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { getEmblaContext } from "./context.js";
  import { cn } from "@southneuhof/utilities/classnames";
  import type { WithElementRef } from "../../types/index.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();

	const emblaCtx = getEmblaContext("<Carousel.Content/>");
</script>

<div
	data-slot="carousel-content"
	class={cn(
		"overflow-hidden",
		className
	)}
	use:emblaCarouselSvelte={{
		options: {
			container: "[data-embla-container]",
			slides: "[data-embla-slide]",
			...emblaCtx.options,
			axis: emblaCtx.orientation === "horizontal" ? "x" : "y",
		},
		plugins: emblaCtx.plugins,
	}}
	onemblaInit={emblaCtx.onInit}
>
	<div
		bind:this={ref}
		class={cn(
			"flex",
			emblaCtx.orientation === "horizontal" ? "" : "-mt-4 flex-col",
			className
		)}
		data-embla-container=""
		{...restProps}
	>
		{@render children?.()}
	</div>
</div>
